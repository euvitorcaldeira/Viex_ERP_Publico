# One-folder Windows package; permanent user data is written beside VIEX.exe.
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

ROOT = Path(SPECPATH)
openpyxl_data, openpyxl_binaries, openpyxl_hidden = collect_all("openpyxl")
et_xmlfile_data, et_xmlfile_binaries, et_xmlfile_hidden = collect_all("et_xmlfile")

a = Analysis(
    [str(ROOT / "VIEX.py")],
    pathex=[str(ROOT)],
    binaries=openpyxl_binaries + et_xmlfile_binaries,
    datas=[(str(ROOT / "dist"), "dist")] + openpyxl_data + et_xmlfile_data,
    hiddenimports=openpyxl_hidden + et_xmlfile_hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="VIEX",
    icon=str(ROOT / "public" / "brand" / "viex.ico"),
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    name="VIEX",
)
