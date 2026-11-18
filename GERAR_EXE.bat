@echo off
setlocal
cd /d "%~dp0"
echo Este procedimento cria o pacote portatil do VIEX ERP para Windows.
echo Ele nao deve ser executado antes da aprovacao da versao Python.
echo.
python -c "import sys; assert sys.version_info >= (3,11)" >nul 2>nul
if errorlevel 1 (
  echo Python 3.11 ou superior nao foi encontrado.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo A interface compilada nao foi encontrada. Execute INSTALAR_DEPENDENCIAS.bat primeiro.
  pause
  exit /b 1
)
echo Instalando PyInstaller gratuito no ambiente Python atual...
python -m pip install "pyinstaller>=6,<7"
if errorlevel 1 (
  echo Nao foi possivel instalar PyInstaller.
  pause
  exit /b 1
)
echo Preparando o pacote VIEX.exe em release\VIEX...
python -m PyInstaller --clean --noconfirm --distpath release --workpath build\pyinstaller DALEX.spec
if errorlevel 1 (
  echo A preparacao do pacote falhou. Os dados locais permanecem em Dados, Anexos e Backups.
  pause
  exit /b 1
)
echo Pacote criado. Copie a pasta inteira release\VIEX; nao separe VIEX.exe dos arquivos ao redor.
pause
