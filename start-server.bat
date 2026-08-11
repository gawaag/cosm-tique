@echo off
cd /d "%~dp0"
echo Arret des process Node sur le port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul
set PORT=3000
echo Demarrage VOLTA sur http://localhost:3000
node server.js
