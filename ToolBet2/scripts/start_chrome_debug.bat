@echo off
REM Mở Chrome với remote debugging để ToolBet kết nối session đang login
REM Đóng hết Chrome trước khi chạy, hoặc dùng profile riêng

set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set PROFILE=%LOCALAPPDATA%\Google\Chrome\User Data

%CHROME% --remote-debugging-port=9222 --user-data-dir="%PROFILE%" https://vipbet389.com/
