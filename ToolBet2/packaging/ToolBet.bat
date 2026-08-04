@echo off
chcp 65001 >nul
setlocal
set "INSTALL_DIR=%~dp0"
set "TOOLBET_HOME=%LOCALAPPDATA%\ToolBet2"
if not exist "%TOOLBET_HOME%" mkdir "%TOOLBET_HOME%"
if not exist "%TOOLBET_HOME%\data" mkdir "%TOOLBET_HOME%\data"
if not exist "%TOOLBET_HOME%\logs" mkdir "%TOOLBET_HOME%\logs"
if not exist "%TOOLBET_HOME%\reports" mkdir "%TOOLBET_HOME%\reports"

REM %~dp0 always ends with \. Append "." so the slash cannot escape
REM the closing quote when cmd.exe passes the argument to powershell.exe.
powershell -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_DIR%Verify-Release.ps1" -InstallRoot "%INSTALL_DIR%."
if errorlevel 1 (
    echo [BLOCK] Bo cai dat bi thieu hoac da bi thay doi. Khong khoi dong ToolBet.
    pause
    exit /b 2
)
if "%TOOLBET_LAUNCHER_VERIFY_ONLY%"=="1" exit /b 0

if not exist "%TOOLBET_HOME%\config.example.yaml" (
    copy /y "%INSTALL_DIR%templates\config.example.yaml" "%TOOLBET_HOME%\config.example.yaml" >nul
)
if not exist "%TOOLBET_HOME%\config.yaml" (
    copy /y "%INSTALL_DIR%templates\config.example.yaml" "%TOOLBET_HOME%\config.yaml" >nul
)
if not exist "%TOOLBET_HOME%\credentials.example.yaml" (
    copy /y "%INSTALL_DIR%templates\credentials.example.yaml" "%TOOLBET_HOME%\credentials.example.yaml" >nul
)
if exist "%INSTALL_DIR%templates\license_public.pem" if not exist "%TOOLBET_HOME%\data\license_public.pem" (
    copy /y "%INSTALL_DIR%templates\license_public.pem" "%TOOLBET_HOME%\data\license_public.pem" >nul
)

cd /d "%TOOLBET_HOME%"
title ToolBet v2
echo Du lieu ToolBet: %TOOLBET_HOME%
"%INSTALL_DIR%ToolBet2\ToolBet2.exe"
set "EXIT_CODE=%ERRORLEVEL%"
echo ToolBet ket thuc voi ma: %EXIT_CODE%
pause
exit /b %EXIT_CODE%
