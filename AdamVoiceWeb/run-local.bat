@echo off
cd /d %~dp0
dotnet restore
dotnet run --urls http://localhost:5000
pause
