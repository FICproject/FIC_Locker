@echo off
echo Starting Shared Backend and DocScan Admin Website...
start "DocScan Backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "DocScan Admin Website" cmd /k "cd /d %~dp0Admin && npm run dev"

