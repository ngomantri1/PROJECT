@echo off
setlocal
cd /d "%~dp0.."
if not exist .env copy .env.example .env >nul
echo [1/3] Dang khoi dong COIN SPOT SCANNER V8.1...
docker compose up -d --build
if errorlevel 1 goto :error
echo [2/3] Dang kiem tra trang thai...
docker compose ps
echo [3/3] Hoan tat.
echo Giao dien: http://localhost:5173
start http://localhost:5173
exit /b 0
:error
echo Khoi dong that bai. Hay mo Docker Desktop va cho Docker Engine chay xong.
pause
exit /b 1
