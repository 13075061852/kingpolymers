@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONUTF8=1
where py >nul 2>nul
if not errorlevel 1 (
  py -3 scripts\run.py %*
) else (
  python scripts\run.py %*
)
if errorlevel 1 pause
