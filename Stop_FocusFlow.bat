@echo off
echo Stopping FocusFlow...
npx kill-port 3002
npx kill-port 3000
echo [✓] FocusFlow has been stopped and memory cleared.
timeout /t 3 >nul
exit
