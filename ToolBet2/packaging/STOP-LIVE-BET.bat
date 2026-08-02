@echo off
set "TOOLBET_HOME=%LOCALAPPDATA%\ToolBet2"
if not exist "%TOOLBET_HOME%\data" mkdir "%TOOLBET_HOME%\data"
echo Emergency stop created at %DATE% %TIME%> "%TOOLBET_HOME%\data\KILL_SWITCH"
echo Da BAT KILL SWITCH. ToolBet se khong tao cuoc that moi.
pause
