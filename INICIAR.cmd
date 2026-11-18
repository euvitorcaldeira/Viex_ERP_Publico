@echo off
setlocal
cd /d "%~dp0"
set "DALEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%DALEX_NODE%" goto bundled
where node >nul 2>nul
if errorlevel 1 goto missing
set "DALEX_NODE=node"
:bundled
if not exist "node_modules\vite\bin\vite.js" goto dependencies
echo.
echo D'ALEX Simple ERP - demonstracao local
echo Abra http://127.0.0.1:5180 no navegador.
echo Se o prototipo ja estiver aberto, use esse mesmo endereco.
echo Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.
echo.
"%DALEX_NODE%" node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5180 --strictPort
pause
exit /b
:missing
echo Instale o Node.js LTS e siga as instrucoes do README.md.
pause
exit /b 1
:dependencies
echo As dependencias nao estao instaladas. Execute npm install nesta pasta.
echo Depois abra este arquivo novamente.
pause
exit /b 1
