@echo off
TITLE FocusFlow - 5 Year Productivity Engine
echo [1/2] Starting Backend Server (SQLite)...
start /B cmd /c "npx kill-port 3002 && node server/index.js"
echo [2/2] Starting Frontend Client (Vite)...
start /B cmd /c "npm run dev"
echo [✓] FocusFlow is now launching.
echo [!] Keep this window open while using the app.
timeout /t 10 >nul
start http://localhost:3000
exit
