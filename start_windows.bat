@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONUTF8=1
if exist ".venv\Scripts\python.exe" goto ready
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -m venv .venv
) else (
  python -m venv .venv
)
if errorlevel 1 goto failed
:ready
".venv\Scripts\python.exe" -c "import fitz, openpyxl" >nul 2>nul
if errorlevel 1 (
  echo Installing PDF and Excel dependencies...
  ".venv\Scripts\python.exe" -m pip install -r requirements-lock.txt
  if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" -u start_local.py %*
if errorlevel 1 goto failed
exit /b 0
:failed
echo Startup failed. Python 3.11+ and internet access are needed for first setup.
pause
exit /b 1
