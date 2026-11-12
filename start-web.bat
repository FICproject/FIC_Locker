@echo off
echo Starting Shared Backend and FIC Locker Admin Website...
start "FIC Locker Backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "FIC Locker Admin Website" cmd /k "cd /d %~dp0Admin && npm run dev"
