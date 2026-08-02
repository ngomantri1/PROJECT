@echo off
set "SWITCH_FILE=%LOCALAPPDATA%\ToolBet2\data\KILL_SWITCH"
if exist "%SWITCH_FILE%" del /f /q "%SWITCH_FILE%"
echo Da go KILL SWITCH local. License va RiskDecision van duoc kiem tra.
pause
