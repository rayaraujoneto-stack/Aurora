@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias do Aurora Stream Desktop...
  npm install
)
npm start
