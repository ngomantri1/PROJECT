@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

REM ============================================================
REM  ToolBet — chay toan bo he thong bang 1 file
REM  Double-click hoac: ToolBet.bat
REM ============================================================

cd /d "%~dp0"
title ToolBet v2

echo.
echo  ========================================
echo   TOOLBET v2 - AE SEXY Baccarat
echo  ========================================
echo.

REM --- Python ---
where python >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Python. Cai Python 3.10+ tu python.org
    echo        Tick "Add Python to PATH" khi cai dat.
    pause
    exit /b 1
)
python -c "import struct; raise SystemExit(0 if struct.calcsize('P')*8==64 else 1)" >nul 2>&1
if errorlevel 1 (
    echo [LOI] Can Python 64-bit. Go bo Python 32-bit, cai lai ban 64-bit tu python.org
    pause
    exit /b 1
)

REM --- Virtual env (tu dong tao lan dau) ---
if not exist ".venv\Scripts\python.exe" (
    echo [1/4] Tao moi truong ao .venv ...
    python -m venv .venv
    if errorlevel 1 (
        echo [LOI] Khong tao duoc venv.
        pause
        exit /b 1
    )
)
set "PY=%CD%\.venv\Scripts\python.exe"
set "PIP=%CD%\.venv\Scripts\pip.exe"

REM --- Dependencies ---
if not exist ".venv\.toolbet_ready" (
    echo [2/4] Cai thu vien lan dau — co the mat 5-15 phut, cho den khi xong ...
    echo       Dang nang cap pip ...
    "%PY%" -m pip install --upgrade pip
    echo       Dang cai requirements.txt ...
    "%PIP%" install -r requirements.txt
    if errorlevel 1 (
        echo [LOI] Cai dat thu vien that bai. Kiem tra mang / firewall.
        pause
        exit /b 1
    )
    echo       Kiem tra greenlet / playwright ...
    "%PY%" -c "import greenlet; from playwright.async_api import Page"
    if errorlevel 1 (
        echo.
        echo [LOI] Khong nap duoc greenlet — thieu Visual C++ hoac venv loi.
        echo.
        echo   Cach sua tren may nay:
        echo   1. Cai Microsoft Visual C++ Redistributable 64-bit:
        echo      https://aka.ms/vs/17/release/vc_redist.x64.exe
        echo   2. Xoa thu muc .venv trong ToolBet, chay lai ToolBet.bat
        echo   3. Hoac thu: .venv\Scripts\pip install --force-reinstall greenlet
        echo.
        pause
        exit /b 1
    )
    echo       Dang tai Chromium cho Playwright — co the mat vai phut ...
    "%PY%" -m playwright install chromium
    if errorlevel 1 (
        echo [CANH BAO] Playwright chromium chua cai — tool van thu chay qua Chrome CDP.
    )
    echo. > ".venv\.toolbet_ready"
) else (
    echo [2/4] Thu vien da san sang.
    "%PY%" -c "import greenlet; from playwright.async_api import Page" >nul 2>&1
    if errorlevel 1 (
        echo [CANH BAO] Thu vien loi — xoa .venv va chay lai, hoac cai VC++ Redistributable x64.
        del ".venv\.toolbet_ready" >nul 2>&1
        pause
        exit /b 1
    )
    "%PY%" -c "import ddddocr" >nul 2>&1
    if errorlevel 1 (
        echo       Cai them ddddocr cho captcha 222b...
        "%PIP%" install ddddocr
    )
)

REM --- Config / credentials ---
if not exist "config.yaml" (
    if exist "config.example.yaml" (
        copy /y "config.example.yaml" "config.yaml" >nul
        echo [INFO] Da tao config.yaml tu mau.
    )
)
if not exist "credentials.yaml" (
    if exist "credentials.example.yaml" (
        copy /y "credentials.example.yaml" "credentials.yaml" >nul
        echo [INFO] Da tao credentials.yaml mau — co the nhap Web/TK/MK tren panel khi mo tool.
    )
)

REM --- Chrome CDP (port 9222) ---
set "CDP_PORT=9222"
set "CDP_URL=http://localhost:%CDP_PORT%"
set "CHROME_EXE="
set "PROFILE=%CD%\data\cdp_profile"

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
)

powershell -NoProfile -Command "(Test-NetConnection -ComputerName localhost -Port %CDP_PORT% -WarningAction SilentlyContinue).TcpTestSucceeded" 2>nul | findstr /i "True" >nul
if errorlevel 1 (
    if not defined CHROME_EXE (
        echo [LOI] Khong tim thay Google Chrome.
        echo        Cai Chrome hoac mo Chrome thu cong voi:
        echo        chrome.exe --remote-debugging-port=9222
        pause
        exit /b 1
    )
    echo [3/4] Mo Chrome CDP — profile: data\cdp_profile
    if not exist "%PROFILE%" mkdir "%PROFILE%"
    start "" "%CHROME_EXE%" --remote-debugging-port=%CDP_PORT% --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check "about:blank"
    echo       Cho Chrome khoi dong 5 giay ...
    timeout /t 5 /nobreak >nul
) else (
    echo [3/4] Chrome CDP da chay tren port %CDP_PORT%.
)

REM --- Dung instance ToolBet cu (main.py nen) ---
echo [4/5] Kiem tra va dung ToolBet dang chay nen ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop_running_toolbet.ps1" "%CD%"
if errorlevel 1 (
    echo [CANH BAO] Khong kiem tra duoc process cu — tiep tuc khoi dong.
)

REM --- Chay tool ---
echo [5/5] Khoi dong ToolBet — nhan Ctrl+C de dung.
echo.
"%PY%" main.py
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
    echo ToolBet da ket thuc.
) else (
    echo ToolBet thoat voi ma loi: %EXIT_CODE%
)
echo.
pause
exit /b %EXIT_CODE%
