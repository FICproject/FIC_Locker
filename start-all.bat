@echo off
echo Starting Shared Backend, FIC Locker Admin Website, and Admin Mobile Metro...
start "FIC Locker Backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "FIC Locker Admin Website" cmd /k "cd /d %~dp0Admin && npm run dev"
start "FIC Locker Admin Mobile Metro" cmd /k "cd /d %~dp0Admin_Mobile && npm start"
