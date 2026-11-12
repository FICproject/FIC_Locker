@echo off
echo Starting Shared Backend and DocScan Admin Website...
start "DocScan Backend" cmd /k "cd /d %~dp0..\backend && npm run dev"
start "DocScan Admin Website" cmd /k "cd /d %~dp0Admin_Website && npm run dev"

