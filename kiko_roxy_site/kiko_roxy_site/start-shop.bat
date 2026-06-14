@echo off
cd /d "%~dp0"
echo Starting Kiko and Roxy shop...
echo.
"C:\Users\bambu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
echo.
echo Shop stopped. Press any key to close this window.
pause >nul
