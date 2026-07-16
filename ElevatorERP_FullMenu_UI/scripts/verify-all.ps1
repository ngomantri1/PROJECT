$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "[1/4] Restore và build backend"
dotnet restore .\ElevatorERP.sln
dotnet build .\ElevatorERP.sln -c Release --no-restore

Write-Host "[2/4] Cài và lint frontend"
Push-Location .\frontend
npm ci
npm run lint

Write-Host "[3/4] Build frontend"
npm run build
Pop-Location

Write-Host "[4/4] Kiểm tra và build Docker Compose"
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}
docker compose config | Out-Null
docker compose build

Write-Host "Tất cả bước kiểm tra đã hoàn thành."
