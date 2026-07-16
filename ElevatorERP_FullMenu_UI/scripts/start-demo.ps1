$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Invoke-DockerCommand {
    param([Parameter(Mandatory = $true)][scriptblock]$Command)
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Lệnh Docker thất bại với mã lỗi $LASTEXITCODE. Hệ thống chưa được khởi động."
    }
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Đã tạo .env từ .env.example"
}

Invoke-DockerCommand { docker compose config | Out-Null }
Invoke-DockerCommand { docker compose up -d --build }
Invoke-DockerCommand { docker compose ps }

Write-Host ""
Write-Host "ElevatorERP đã khởi động thành công."
Write-Host "Web:     http://localhost"
Write-Host "Swagger: http://localhost/api/swagger"
Write-Host "Health:  http://localhost/api/health"
