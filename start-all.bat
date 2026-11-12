@echo off
echo Starting Shared Backend, Admin Website, and Admin Mobile Metro...
start "DocScan Backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "DocScan Admin Website" cmd /k "cd /d %~dp0Admin && npm run dev"
start "DocScan Admin Mobile Metro" cmd /k "cd /d %~dp0Admin_Mobile && npm start"

