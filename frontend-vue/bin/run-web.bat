@echo off
setlocal
cd /d "%~dp0.." || exit /b 1
call pnpm run dev
set "INFOQ_EXIT_CODE=%ERRORLEVEL%"
pause
exit /b %INFOQ_EXIT_CODE%
