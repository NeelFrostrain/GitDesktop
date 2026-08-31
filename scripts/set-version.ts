#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
let newVersion = args[0];

if (!newVersion) {
  console.error('\x1b[31m%s\x1b[0m', 'Error: Please specify a version number.');
  console.log('Usage: bun run version <version>');
  console.log('Example: bun run version 0.1.1');
  process.exit(1);
}

// Strip leading 'v' if present (e.g. v0.1.1 -> 0.1.1)
if (newVersion.startsWith('v')) {
  newVersion = newVersion.substring(1);
}

const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
if (!semverRegex.test(newVersion)) {
  console.error('\x1b[31m%s\x1b[0m', `Error: "${newVersion}" is not a valid semantic version (e.g. 0.1.1 or 1.0.0-beta.1).`);
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const appPackageJsonPath = path.join(rootDir, 'app', 'package.json');
const tauriConfPath = path.join(rootDir, 'app', 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(rootDir, 'app', 'src-tauri', 'Cargo.toml');
const rootPackageJsonPath = path.join(rootDir, 'package.json');

console.log(`\n\x1b[36m🚀 Bumping Git Desktop Version to v${newVersion}...\x1b[0m\n`);

// 1. Update app/package.json
if (fs.existsSync(appPackageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(appPackageJsonPath, 'utf8'));
  const oldVer = pkg.version;
  pkg.version = newVersion;
  fs.writeFileSync(appPackageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  \x1b[32m✔\x1b[0m app/package.json: \x1b[90m${oldVer}\x1b[0m -> \x1b[32m${newVersion}\x1b[0m`);
}

// 2. Update app/src-tauri/tauri.conf.json
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  const oldVer = tauriConf.version;
  tauriConf.version = newVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`  \x1b[32m✔\x1b[0m app/src-tauri/tauri.conf.json: \x1b[90m${oldVer}\x1b[0m -> \x1b[32m${newVersion}\x1b[0m`);
}

// 3. Update app/src-tauri/Cargo.toml (under [package])
if (fs.existsSync(cargoTomlPath)) {
  const cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  const updatedCargo = cargoContent.replace(
    /(\[package\][\s\S]*?version\s*=\s*")[^"]*(")/,
    `$1${newVersion}$2`
  );
  fs.writeFileSync(cargoTomlPath, updatedCargo);
  console.log(`  \x1b[32m✔\x1b[0m app/src-tauri/Cargo.toml: -> \x1b[32m${newVersion}\x1b[0m`);
}

// 4. Update root package.json if version exists
if (fs.existsSync(rootPackageJsonPath)) {
  const rootPkg = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
  if (rootPkg.version) {
    rootPkg.version = newVersion;
    fs.writeFileSync(rootPackageJsonPath, JSON.stringify(rootPkg, null, 2) + '\n');
    console.log(`  \x1b[32m✔\x1b[0m package.json: -> \x1b[32m${newVersion}\x1b[0m`);
  }
}

console.log(`\n\x1b[32m✨ Version successfully updated across all files to v${newVersion}!\x1b[0m`);
console.log(`\nNext steps for release:`);
console.log(`  git add .`);
console.log(`  git commit -m "chore: release v${newVersion}"`);
console.log(`  git tag v${newVersion}`);
console.log(`  git push origin main --tags\n`);
