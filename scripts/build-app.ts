#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';
import { spawnSync, execSync } from 'child_process';

const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'app');
const tauriConfPath = path.join(appDir, 'src-tauri', 'tauri.conf.json');

if (!fs.existsSync(tauriConfPath)) {
  console.error('\x1b[31m%s\x1b[0m', `Error: tauri.conf.json not found at ${tauriConfPath}`);
  process.exit(1);
}

const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
const version = tauriConf.version || '0.1.0';
const repoUrl = 'https://github.com/cyronicstudio/git-desktop';

// 1. Locate signing private key and set environment variables
const defaultKeyPath = path.join(appDir, '~', '.tauri', 'gitdesktop.key');
const fallbackKeyPath = path.join(rootDir, '~', '.tauri', 'gitdesktop.key');
const keyPath = fs.existsSync(defaultKeyPath)
  ? defaultKeyPath
  : fs.existsSync(fallbackKeyPath)
  ? fallbackKeyPath
  : process.env.TAURI_SIGNING_PRIVATE_KEY_PATH || '';

const keyPassword = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || 'Neel0812';

let keyContent = process.env.TAURI_SIGNING_PRIVATE_KEY || '';
if (!keyContent && keyPath && fs.existsSync(keyPath)) {
  keyContent = fs.readFileSync(keyPath, 'utf8').trim();
}

console.log(`\n\x1b[36m═══════════════════════════════════════════════════════════════════════\x1b[0m`);
console.log(`\x1b[1m\x1b[35m🚀 Building Git Desktop Release v${version}\x1b[0m`);
console.log(`\x1b[36m═══════════════════════════════════════════════════════════════════════\x1b[0m\n`);

if (keyContent) {
  console.log(`  \x1b[32m✔\x1b[0m Signing Private Key loaded: \x1b[90m${keyPath || 'ENV'}\x1b[0m`);
} else {
  console.log(`  \x1b[33m⚠\x1b[0m No Signing Private Key found. Binary will not be auto-signed.`);
}

// 2. Clean old Tauri bundle output folder before building
const targetBundleDir = path.join(appDir, 'src-tauri', 'target', 'release', 'bundle');
const fallbackBundleDir = path.join(appDir, 'src-tauri', 'target', 'bundle');

console.log(`\n\x1b[34m🧹 Cleaning old Tauri bundle output folders...\x1b[0m`);
if (fs.existsSync(targetBundleDir)) {
  fs.rmSync(targetBundleDir, { recursive: true, force: true });
  console.log(`  \x1b[32m✔\x1b[0m Cleaned \x1b[90m${targetBundleDir}\x1b[0m`);
}
if (fs.existsSync(fallbackBundleDir)) {
  fs.rmSync(fallbackBundleDir, { recursive: true, force: true });
  console.log(`  \x1b[32m✔\x1b[0m Cleaned \x1b[90m${fallbackBundleDir}\x1b[0m`);
}

// 3. Run Tauri Build
// Load .env variables into build environment
const envVars: Record<string, string> = {};
for (const candidate of [path.join(rootDir, '.env'), path.join(appDir, '.env')]) {
  if (fs.existsSync(candidate)) {
    const lines = fs.readFileSync(candidate, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        let v = trimmed.slice(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        envVars[k] = v;
      }
    }
  }
}

const buildEnv = {
  ...envVars,
  ...process.env,
  ...(keyContent ? { TAURI_SIGNING_PRIVATE_KEY: keyContent } : {}),
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: keyPassword,
};

const buildResult = spawnSync('bun', ['run', 'tauri', 'build'], {
  cwd: appDir,
  stdio: 'inherit',
  env: buildEnv,
  shell: true,
});

if (buildResult.status !== 0) {
  console.error(`\n\x1b[31m❌ Build failed with exit code ${buildResult.status}\x1b[0m`);
  process.exit(buildResult.status || 1);
}

// 4. Create fresh versioned output folder on root directory (clean any existing contents)
const releaseFolderName = `release-v${version}`;
const releaseFolderPath = path.join(rootDir, releaseFolderName);

if (fs.existsSync(releaseFolderPath)) {
  fs.rmSync(releaseFolderPath, { recursive: true, force: true });
}
fs.mkdirSync(releaseFolderPath, { recursive: true });

console.log(`\n\x1b[32m📁 Preparing Fresh Release Folder:\x1b[0m \x1b[36m${releaseFolderPath}\x1b[0m\n`);

// 5. Scan bundle outputs from target/release/bundle
const bundleDir = path.join(appDir, 'src-tauri', 'target', 'release', 'bundle');
const msiDir = path.join(bundleDir, 'msi');
const nsisDir = path.join(bundleDir, 'nsis');

const copiedFiles: string[] = [];

// Helper to check version match in filename
const isVersionMatch = (fileName: string): boolean => {
  const match = fileName.match(/_(\d+\.\d+\.\d+)[_-]/);
  if (match && match[1] !== version) {
    return false;
  }
  return true;
};

// Helper to sign fresh on the fly
const signBinary = (filePath: string): string => {
  try {
    if (keyContent) {
      console.log(`  \x1b[34mℹ\x1b[0m Generating fresh signature for ${path.basename(filePath)}...`);
      const output = execSync(`bun tauri signer sign "${filePath}"`, {
        cwd: appDir,
        encoding: 'utf8',
        env: buildEnv,
      });

      const sigPath = filePath + '.sig';
      if (fs.existsSync(sigPath)) {
        return fs.readFileSync(sigPath, 'utf8').trim();
      }

      const match = output.match(/([A-Za-z0-9+/=]{80,})/);
      if (match) return match[1].trim();
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`  \x1b[33m⚠\x1b[0m Signing note:`, errorMsg);
  }
  return '';
};

// Copy helper with size display
const copyArtifact = (src: string, destFileName?: string) => {
  const destName = destFileName || path.basename(src);
  const destPath = path.join(releaseFolderPath, destName);
  fs.copyFileSync(src, destPath);
  const stats = fs.statSync(destPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  const sizeKb = (stats.size / 1024).toFixed(1);
  const displaySize = stats.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;
  console.log(`  \x1b[32m✔\x1b[0m Copied \x1b[1m${destName}\x1b[0m \x1b[90m(${displaySize})\x1b[0m`);
  copiedFiles.push(destName);
  return destPath;
};

// 5a. Collect & Copy MSI
let primaryMsiFileName = '';
let primaryMsiSignature = '';

if (fs.existsSync(msiDir)) {
  const files = fs.readdirSync(msiDir);
  for (const file of files) {
    if (!isVersionMatch(file)) continue;
    const srcPath = path.join(msiDir, file);
    if (fs.statSync(srcPath).isFile()) {
      if (file.endsWith('.msi')) {
        primaryMsiFileName = file;
        copyArtifact(srcPath);
      } else if (file.endsWith('.msi.sig') || (file.endsWith('.sig') && !file.includes('.exe'))) {
        primaryMsiSignature = fs.readFileSync(srcPath, 'utf8').trim();
        copyArtifact(srcPath);
      } else if (file.endsWith('.zip')) {
        copyArtifact(srcPath);
      }
    }
  }
}

// 5b. Collect & Copy NSIS EXE
let primaryExeFileName = '';
let primaryExeSignature = '';

if (fs.existsSync(nsisDir)) {
  const files = fs.readdirSync(nsisDir);
  for (const file of files) {
    if (!isVersionMatch(file)) continue;
    const srcPath = path.join(nsisDir, file);
    if (fs.statSync(srcPath).isFile()) {
      if (file.endsWith('.exe')) {
        primaryExeFileName = file;
        copyArtifact(srcPath);
      } else if (file.endsWith('.exe.sig') || (file.endsWith('.sig') && file.includes('.exe'))) {
        primaryExeSignature = fs.readFileSync(srcPath, 'utf8').trim();
        copyArtifact(srcPath);
      } else if (file.endsWith('.zip')) {
        copyArtifact(srcPath);
      }
    }
  }
}

// 4c. Generate fresh signatures for binaries if missing
if (primaryMsiFileName && !primaryMsiSignature) {
  const targetMsi = path.join(releaseFolderPath, primaryMsiFileName);
  primaryMsiSignature = signBinary(targetMsi);
  if (primaryMsiSignature) {
    const sigPath = targetMsi + '.sig';
    fs.writeFileSync(sigPath, primaryMsiSignature + '\n');
    copiedFiles.push(path.basename(sigPath));
    console.log(`  \x1b[32m✔\x1b[0m Generated \x1b[1m${path.basename(sigPath)}\x1b[0m`);
  }
}

if (primaryExeFileName && !primaryExeSignature) {
  const targetExe = path.join(releaseFolderPath, primaryExeFileName);
  primaryExeSignature = signBinary(targetExe);
  if (primaryExeSignature) {
    const sigPath = targetExe + '.sig';
    fs.writeFileSync(sigPath, primaryExeSignature + '\n');
    copiedFiles.push(path.basename(sigPath));
    console.log(`  \x1b[32m✔\x1b[0m Generated \x1b[1m${path.basename(sigPath)}\x1b[0m`);
  }
}

// 5. Generate brand NEW latest.json (never copy old file)
const chosenInstaller = primaryMsiFileName || primaryExeFileName || `Git Desktop_${version}_x64_en-US.msi`;
const chosenSignature = primaryMsiSignature || primaryExeSignature || 'PLACEHOLDER_SIGNATURE';

// GitHub Releases replaces spaces with dots in asset filenames
const githubAssetFileName = chosenInstaller.replace(/\s+/g, '.');

const newLatestJson = {
  version: version,
  notes: `Release notes for Git Desktop v${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: chosenSignature,
      url: `${repoUrl}/releases/download/v${version}/${githubAssetFileName}`,
    },
  },
};

const newLatestJsonString = JSON.stringify(newLatestJson, null, 2) + '\n';

// Write fresh latest.json inside release folder
const folderLatestJsonPath = path.join(releaseFolderPath, 'latest.json');
fs.writeFileSync(folderLatestJsonPath, newLatestJsonString);

// Overwrite root latest.json with freshly generated json
const rootLatestJsonPath = path.join(rootDir, 'latest.json');
fs.writeFileSync(rootLatestJsonPath, newLatestJsonString);

console.log(`  \x1b[32m✔\x1b[0m Generated brand new \x1b[1mlatest.json\x1b[0m in \x1b[36m${releaseFolderName}/\x1b[0m and root`);

// 6. Summary Output
console.log(`\n\x1b[36m═══════════════════════════════════════════════════════════════════════\x1b[0m`);
console.log(`\x1b[32m🎉 Release Package Ready: \x1b[1m${releaseFolderName}\x1b[0m`);
console.log(`\x1b[36m═══════════════════════════════════════════════════════════════════════\x1b[0m\n`);
console.log(`📦 Folder: \x1b[36m${releaseFolderPath}\x1b[0m`);
console.log(`📄 Contents:`);
for (const file of fs.readdirSync(releaseFolderPath)) {
  const stats = fs.statSync(path.join(releaseFolderPath, file));
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  const sizeKb = (stats.size / 1024).toFixed(1);
  const size = stats.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;
  console.log(`   • ${file.padEnd(45)} \x1b[90m(${size})\x1b[0m`);
}

console.log(`\n\x1b[33m📋 GitHub Release Upload Checklist for v${version}:\x1b[0m`);
console.log(`   1. Create release tag: \x1b[36mv${version}\x1b[0m`);
console.log(`   2. Upload all files from \x1b[36m${releaseFolderName}/\x1b[0m to GitHub Release:`);
console.log(`      - \x1b[1m${chosenInstaller}\x1b[0m`);
if (primaryMsiFileName && primaryMsiFileName !== chosenInstaller) {
  console.log(`      - \x1b[1m${primaryMsiFileName}\x1b[0m`);
}
if (primaryExeFileName && primaryExeFileName !== chosenInstaller) {
  console.log(`      - \x1b[1m${primaryExeFileName}\x1b[0m`);
}
console.log(`      - \x1b[1mlatest.json\x1b[0m (enables auto-updater)\n`);
