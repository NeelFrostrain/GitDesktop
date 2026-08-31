#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'app');
const tauriConfPath = path.join(appDir, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

const version = tauriConf.version || '0.1.0';
const releaseDate = new Date().toISOString();
const repoUrl = 'https://github.com/cyronicstudio/git-desktop';

// Paths to search for bundle outputs in target/release/bundle
const bundleDir = path.join(appDir, 'src-tauri', 'target', 'release', 'bundle');
const msiDir = path.join(bundleDir, 'msi');
const nsisDir = path.join(bundleDir, 'nsis');

// Possible key file locations
const defaultKeyPath = path.join(appDir, '~', '.tauri', 'gitdesktop.key');
const fallbackKeyPath = path.join(rootDir, '~', '.tauri', 'gitdesktop.key');
const keyPath = fs.existsSync(defaultKeyPath)
  ? defaultKeyPath
  : fs.existsSync(fallbackKeyPath)
  ? fallbackKeyPath
  : process.env.TAURI_SIGNING_PRIVATE_KEY_PATH || '';

const keyPassword =
  process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || 'Neel0812';

console.log(`\n\x1b[36m📦 Generating latest.json for Git Desktop v${version}...\x1b[0m\n`);

let signature = '';
let installerFileName = '';
let installerFilePath = '';

// Helper to sign on the fly if needed
const signFileOnTheFly = (filePath: string): string => {
  try {
    let keyContent = '';
    if (process.env.TAURI_SIGNING_PRIVATE_KEY) {
      keyContent = process.env.TAURI_SIGNING_PRIVATE_KEY;
    } else if (keyPath && fs.existsSync(keyPath)) {
      keyContent = fs.readFileSync(keyPath, 'utf8');
    }

    if (keyContent) {
      console.log(`  \x1b[34mℹ\x1b[0m Signing ${path.basename(filePath)}...`);
      const output = execSync(`bun tauri signer sign "${filePath}"`, {
        cwd: appDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          TAURI_SIGNING_PRIVATE_KEY: keyContent,
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: keyPassword,
        },
      });

      // Check if .sig file was generated
      const sigPath = filePath + '.sig';
      if (fs.existsSync(sigPath)) {
        return fs.readFileSync(sigPath, 'utf8').trim();
      }

      const match = output.match(/([A-Za-z0-9+/=]{80,})/);
      if (match) return match[1].trim();
    }
  } catch (err: any) {
    console.warn(`  \x1b[33m⚠\x1b[0m Auto-signing note:`, err.message || err);
  }
  return '';
};

// 1. Scan for MSI
if (fs.existsSync(msiDir)) {
  const files = fs.readdirSync(msiDir);
  const sigFile = files.find(f => f.endsWith('.msi.sig') || (f.endsWith('.sig') && !f.includes('.exe')));
  const msiFile = files.find(f => f.endsWith('.msi') && !f.endsWith('.sig'));

  if (msiFile) {
    installerFileName = msiFile;
    installerFilePath = path.join(msiDir, msiFile);

    if (sigFile) {
      signature = fs.readFileSync(path.join(msiDir, sigFile), 'utf8').trim();
    } else {
      signature = signFileOnTheFly(installerFilePath);
    }
  }
}

// 2. Scan for NSIS if MSI wasn't found
if (!installerFileName && fs.existsSync(nsisDir)) {
  const files = fs.readdirSync(nsisDir);
  const sigFile = files.find(f => f.endsWith('.exe.sig') || f.endsWith('.sig'));
  const exeFile = files.find(f => f.endsWith('.exe') && !f.endsWith('.sig'));

  if (exeFile) {
    installerFileName = exeFile;
    installerFilePath = path.join(nsisDir, exeFile);

    if (sigFile) {
      signature = fs.readFileSync(path.join(nsisDir, sigFile), 'utf8').trim();
    } else {
      signature = signFileOnTheFly(installerFilePath);
    }
  }
}

// 3. Fallback placeholder if nothing compiled yet
if (!signature) {
  if (installerFilePath && keyPath) {
    signature = signFileOnTheFly(installerFilePath);
  }
  
  if (!signature) {
    console.warn('\x1b[33m%s\x1b[0m', 'Warning: No signed installer found yet in target/release/bundle/msi or nsis.');
    console.log('Using placeholder signature. Once `bun run build:app` finishes, run this command again.');
    signature = 'PLACEHOLDER_SIGNATURE_GENERATE_WITH_TAURI_BUILD';
    installerFileName = installerFileName || `Git Desktop_${version}_x64_en-US.msi`;
  }
}

// GitHub Releases automatically replaces spaces with dots in asset filenames
const githubAssetFileName = installerFileName.replace(/\s+/g, '.');

const latestJson = {
  version: version,
  notes: `Release notes for Git Desktop v${version}`,
  pub_date: releaseDate,
  platforms: {
    'windows-x86_64': {
      signature: signature,
      url: `${repoUrl}/releases/download/v${version}/${githubAssetFileName}`
    }
  }
};

const outputDistPath = path.join(rootDir, 'latest.json');
fs.writeFileSync(outputDistPath, JSON.stringify(latestJson, null, 2) + '\n');

console.log(`  \x1b[32m✔\x1b[0m Output: \x1b[36m${outputDistPath}\x1b[0m`);
console.log(`  \x1b[32m✔\x1b[0m Target Installer: \x1b[33m${installerFileName}\x1b[0m`);
console.log('\n\x1b[32m✨ latest.json:\x1b[0m');
console.log(JSON.stringify(latestJson, null, 2));
console.log('\nUpload this latest.json alongside ' + installerFileName + ' to your GitHub Release (v' + version + ')!\n');
