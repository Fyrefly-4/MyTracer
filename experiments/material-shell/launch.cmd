@echo off
setlocal
cd /d "%~dp0\..\.."
if exist "node_modules\.bin\electron.cmd" (
  call "node_modules\.bin\electron.cmd" "experiments\material-shell\main.cjs"
) else (
  echo Electron 43.3.0 is required. From the repository root run:
  echo npm.cmd exec --yes --package=electron@43.3.0 -- electron experiments/material-shell/main.cjs
  exit /b 1
)
