@echo off
setlocal EnableExtensions
title MASAR Routing V1
cd /d "%~dp0"

echo ============================================================
echo   MASAR - Intelligent Urban Transportation Management
echo   Routing V1
echo ============================================================

rem ---- find Python 3.10+  (set MASAR_PYTHON to force a specific interpreter)
set "PYEXE="
if defined MASAR_PYTHON set "PYEXE=%MASAR_PYTHON%"
if not defined PYEXE (
  where py >nul 2>nul && set "PYEXE=py -3"
)
if not defined PYEXE (
  where python >nul 2>nul && set "PYEXE=python"
)
if not defined PYEXE goto :nopython

if not exist ".venv\Scripts\python.exe" (
  %PYEXE% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"
  if errorlevel 1 goto :nopython
  echo [1/3] Creating virtual environment in .venv ...
  %PYEXE% -m venv .venv
  if errorlevel 1 goto :fail
) else (
  echo [1/3] Virtual environment found.
)
set "VPY=.venv\Scripts\python.exe"

rem ---- install dependencies only when requirements.txt changed
fc /b requirements.txt .venv\requirements.installed >nul 2>nul
if errorlevel 1 (
  echo [2/3] Installing dependencies - first run only, this can take a few minutes ...
  "%VPY%" -m pip install --upgrade pip
  "%VPY%" -m pip install -r requirements.txt
  if errorlevel 1 goto :fail
  copy /y requirements.txt .venv\requirements.installed >nul
) else (
  echo [2/3] Dependencies already installed.
)

rem ---- stop a previous MASAR server still holding port 8501
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8501 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('Stopping previous server, PID ' + $_.OwningProcess); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
echo [3/3] Starting MASAR at http://localhost:8501
echo        Close this window or press Ctrl+C to stop.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 6; Start-Process 'http://localhost:8501'"
"%VPY%" -m streamlit run app.py --server.port 8501
echo.
echo MASAR server stopped.
pause
goto :eof

:nopython
echo [ERROR] Python 3.10 or newer was not found.
echo         Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
pause
exit /b 1

:fail
echo [ERROR] Setup failed - see the messages above.
echo         If dependency installation failed, check your internet connection and run this file again.
pause
exit /b 1
