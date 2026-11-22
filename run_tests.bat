@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run run.bat once first to create the environment.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m pytest -v
pause
