@echo off
setlocal
cd /d "%~dp0.." || exit /b 1
call pnpm run build:prod
set "INFOQ_EXIT_CODE=%ERRORLEVEL%"
pause
exit /b %INFOQ_EXIT_CODE%
