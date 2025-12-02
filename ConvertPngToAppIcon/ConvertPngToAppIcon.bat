@echo off
setlocal

rem Tìm file PNG đầu tiên trong thư mục hiện tại
set "PNG_FILE="

for %%F in (*.png) do (
    set "PNG_FILE=%%F"
    goto FoundPng
)

echo Khong tim thay file PNG nao trong thu muc nay.
echo Hay dat file .png cung thu muc voi file .bat roi chay lai.
pause
exit /b 1

:FoundPng
echo Dang su dung file PNG: "%PNG_FILE%"

rem Chuyen PNG thanh ICO nhieu kich thuoc va luu ten AppIcon.ico
magick "%PNG_FILE%" -background transparent -define icon:auto-resize=256,128,64,48,32,24,16 "AppIcon.ico"

if errorlevel 1 (
    echo Co loi khi convert PNG sang ICO.
) else (
    echo Da tao xong file AppIcon.ico
)

pause
endlocal
