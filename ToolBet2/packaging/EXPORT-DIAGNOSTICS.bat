@echo off
setlocal
set "INSTALL_DIR=%~dp0"
set "TOOLBET_HOME=%LOCALAPPDATA%\ToolBet2"
cd /d "%TOOLBET_HOME%"
"%INSTALL_DIR%ToolBet2\ToolBet2.exe" --diagnostics
echo Goi file ZIP vua tao trong thu muc reports cho bo phan support.
pause
