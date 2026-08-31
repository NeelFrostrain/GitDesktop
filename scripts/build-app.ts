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

// 2. Run Tauri Build
console.log(`\n\x1b[34m🔨 Running Tauri Build...\x1b[0m\n`);

const buildEnv = {
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

// 3. Create versioned output folder on root directory
const releaseFolderName = `release-v${version}`;
const releaseFolderPath = path.join(rootDir, releaseFolderName);

if (!fs.existsSync(releaseFolderPath)) {
  fs.mkdirSync(releaseFolderPath, { recursive: true });
}

console.log(`\n\x1b[32m📁 Preparing Release Folder:\x1b[0m \x1b[36m${releaseFolderPath}\x1b[0m\n`);

// 4. Scan bundle outputs from target/release/bundle
const bundleDir = path.join(appDir, 'src-tauri', 'target', 'release', 'bundle');
const msiDir = path.join(bundleDir, 'msi');
const nsisDir = path.join(bundleDir, 'nsis');

const copiedFiles: string[] = [];

// Helper to sign on the fly if a .sig file was missing
const signFileOnTheFly = (filePath: string): string => {
  try {
    if (keyContent) {
      console.log(`  \x1b[34mℹ\x1b[0m Generating signature for ${path.basename(filePath)}...`);
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
  } catch (err: any) {
    console.warn(`  \x1b[33m⚠\x1b[0m On-the-fly signing note:`, err.message || err);
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

// Collect MSI artifacts
let primaryMsiFileName = '';
let primaryMsiSignature = '';

if (fs.existsSync(msiDir)) {
  const files = fs.readdirSync(msiDir);
  for (const file of files) {
    const srcPath = path.join(msiDir, file);
    if (fs.statSync(srcPath).isFile()) {
      copyArtifact(srcPath);

      if (file.endsWith('.msi')) {
        primaryMsiFileName = file;
      }
      if (file.endsWith('.msi.sig') || (file.endsWith('.sig') && !file.includes('.exe'))) {
        primaryMsiSignature = fs.readFileSync(srcPath, 'utf8').trim();
      }
    }
  }
}

// Collect NSIS artifacts
let primaryExeFileName = '';
let primaryExeSignature = '';

if (fs.existsSync(nsisDir)) {
  const files = fs.readdirSync(nsisDir);
  for (const file of files) {
    const srcPath = path.join(nsisDir, file);
    if (fs.statSync(srcPath).isFile()) {
      copyArtifact(srcPath);

      if (file.endsWith('.exe')) {
        primaryExeFileName = file;
      }
      if (file.endsWith('.exe.sig') || (file.endsWith('.sig') && file.includes('.exe'))) {
        primaryExeSignature = fs.readFileSync(srcPath, 'utf8').trim();
      }
    }
  }
}

// If MSI was found but no signature file existed, sign it now
if (primaryMsiFileName && !primaryMsiSignature) {
  const targetMsi = path.join(releaseFolderPath, primaryMsiFileName);
  primaryMsiSignature = signFileOnTheFly(targetMsi);
  if (primaryMsiSignature) {
    const sigPath = targetMsi + '.sig';
    fs.writeFileSync(sigPath, primaryMsiSignature + '\n');
    copiedFiles.push(path.basename(sigPath));
    console.log(`  \x1b[32m✔\x1b[0m Created \x1b[1m${path.basename(sigPath)}\x1b[0m`);
  }
}

// If NSIS exe was found but no signature file existed, sign it now
if (primaryExeFileName && !primaryExeSignature) {
  const targetExe = path.join(releaseFolderPath, primaryExeFileName);
  primaryExeSignature = signFileOnTheFly(targetExe);
  if (primaryExeSignature) {
    const sigPath = targetExe + '.sig';
    fs.writeFileSync(sigPath, primaryExeSignature + '\n');
    copiedFiles.push(path.basename(sigPath));
    console.log(`  \x1b[32m✔\x1b[0m Created \x1b[1m${path.basename(sigPath)}\x1b[0m`);
  }
}

// 5. Generate latest.json
const chosenInstaller = primaryMsiFileName || primaryExeFileName || `Git Desktop_${version}_x64_en-US.msi`;
const chosenSignature = primaryMsiSignature || primaryExeSignature || 'PLACEHOLDER_SIGNATURE';

// GitHub Releases normalizes spaces to dots
const githubAssetFileName = chosenInstaller.replace(/\s+/g, '.');

const latestJson = {
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

const latestJsonString = JSON.stringify(latestJson, null, 2) + '\n';

// Write latest.json inside release folder
const folderLatestJsonPath = path.join(releaseFolderPath, 'latest.json');
fs.writeFileSync(folderLatestJsonPath, latestJsonString);

// Also write latest.json at root directory for convenience
const rootLatestJsonPath = path.join(rootDir, 'latest.json');
fs.writeFileSync(rootLatestJsonPath, latestJsonString);

console.log(`  \x1b[32m✔\x1b[0m Generated \x1b[1mlatest.json\x1b[0m in \x1b[36m${releaseFolderName}/\x1b[0m and root`);

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
