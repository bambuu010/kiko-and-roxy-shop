@echo off
cd /d "%~dp0"
echo Restarting Kiko and Roxy shop...
echo.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
  echo Stopping old server process %%a...
  taskkill /PID %%a /F >nul 2>nul
)
echo.
echo Starting fresh server...
"C:\Users\bambu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
echo.
echo Shop stopped. Press any key to close this window.
pause >nul
