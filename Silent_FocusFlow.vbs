Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c npx kill-port 3002 && node server/src/index.js", 0, False
WshShell.Run "cmd /c npm run dev", 0, False
WScript.Sleep 5000
WshShell.Run "http://localhost:3000"
