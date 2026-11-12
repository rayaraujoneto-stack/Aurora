@echo off
cd /d "%~dp0"
echo Compilando Aurora Stream Desktop para Windows...
npm install --no-audit --no-fund
if errorlevel 1 goto erro
npm run dist:win
if errorlevel 1 goto erro
echo.
echo Instalador e versao portatil estao na pasta dist.
pause
exit /b 0
:erro
echo.
echo A compilacao falhou. Confira a mensagem acima.
pause
exit /b 1
