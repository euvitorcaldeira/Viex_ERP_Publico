@echo off
setlocal
cd /d "%~dp0"
echo Preparando o VIEX ERP local...
python --version >nul 2>nul
if errorlevel 1 (
  echo Python nao foi encontrado. Instale Python 3.11 ou superior e tente novamente.
  pause
  exit /b 1
)
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Nao foi possivel preparar as dependencias Python.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js e necessario apenas para compilar ou editar as telas.
  echo A versao de desenvolvimento precisa do Node.js instalado nesta etapa.
  pause
  exit /b 1
)
where pnpm >nul 2>nul
if errorlevel 1 (
  echo Instalando pnpm por meio do Corepack...
  corepack enable
  if errorlevel 1 (
    echo Nao foi possivel ativar Corepack. Instale pnpm ou Node.js atualizado.
    pause
    exit /b 1
  )
)
pnpm install --frozen-lockfile
if errorlevel 1 (
  echo Nao foi possivel instalar as dependencias do frontend.
  pause
  exit /b 1
)
pnpm build
if errorlevel 1 (
  echo Nao foi possivel compilar a interface.
  pause
  exit /b 1
)
echo Preparacao concluida. Para abrir, execute VIEX.py.
pause
