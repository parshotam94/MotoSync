@echo off
title MotoSync Launcher
echo ========================================================
echo               STARTING MOTOSYNC PLATFORM
echo ========================================================
echo.

echo [1/2] Launching Backend Flask-SocketIO Server on port 5000...
start "MotoSync Backend (Flask-SocketIO)" cmd /k "cd /d %~dp0backend && python app.py"

echo [2/2] Launching Frontend React App on port 5173...
start "MotoSync Frontend (React / Vite)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo MotoSync is launching!
echo Backend:  http://127.0.0.1:5000
echo Frontend: http://localhost:5173
echo ========================================================
echo.
pause
