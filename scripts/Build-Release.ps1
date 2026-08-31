# One-click Build & Sign script for Git Desktop
$KeyPath = "$PSScriptRoot\app\~\.tauri\gitdesktop.key"
$Password = "Neel0812"

if (Test-Path $KeyPath) {
    $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $KeyPath -Raw
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $Password
    Write-Host "✔ Loaded private key from $KeyPath" -ForegroundColor Green
} else {
    Write-Host "⚠ Private key not found at $KeyPath, building without signature" -ForegroundColor Yellow
}

Write-Host "Building Tauri Application..." -ForegroundColor Cyan
bun run --cwd app build:app

Write-Host "Generating latest.json..." -ForegroundColor Cyan
bun run "$PSScriptRoot\scripts\generate-latest-json.ts"
