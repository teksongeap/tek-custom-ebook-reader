# Run local とく Ebook Reader dev server

Set-Location $PSScriptRoot

Write-Host "Starting とく Ebook Reader locally..." -ForegroundColor Cyan

if (-Not (Test-Path "node_modules")) {
    Write-Host "node_modules not found. Running pnpm install..." -ForegroundColor Yellow
    pnpm install
}

Start-Process "http://localhost:5173"

pnpm dev
