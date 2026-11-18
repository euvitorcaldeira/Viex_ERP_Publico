"""Safe local backups, restoration, and human-readable Excel exports."""
from __future__ import annotations

import os
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any

from .database import SCHEMA_VERSION, Store, StoreError

BACKUP_LIMIT_BYTES = 1024 * 1024 * 1024


def create_backup(store: Store, root: Path, backups: Path, *, automatic=False) -> Path:
    root=root.resolve();backups.mkdir(parents=True,exist_ok=True)
    now=datetime.now().astimezone().strftime("%Y%m%d-%H%M%S-%f")
    kind="auto" if automatic else "manual"
    target=backups/f"DALEX-{kind}-{now}.zip"
    with tempfile.TemporaryDirectory(prefix="dalex-backup-") as work:
        temp_db=Path(work)/"dalex.db"
        with store.connect() as source:
            source.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            dest=sqlite3.connect(temp_db)
            try: source.backup(dest)
            finally: dest.close()
        temporary=backups/(target.name+".part")
        try:
            with zipfile.ZipFile(temporary,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
                archive.write(temp_db,"Dados/dalex.db")
                for folder in ("Anexos","Configuracoes"):
                    base=root/folder
                    if not base.exists():continue
                    for file in base.rglob("*"):
                        if file.is_file() and not file.is_symlink():
                            archive.write(file,file.relative_to(root).as_posix())
            os.replace(temporary,target)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
    return target


def maybe_daily_backup(store: Store, root: Path, backups: Path) -> Path | None:
    if not store.path.exists():return None
    with store.connect() as db:
        count=db.execute("SELECT COUNT(*) FROM users WHERE active=1").fetchone()[0]
    if not count:return None
    today=datetime.now().astimezone().date()
    existing=[]
    for path in backups.glob("DALEX-auto-*.zip"):
        parsed=None
        for pattern in ("DALEX-auto-%Y%m%d-%H%M%S-%f","DALEX-auto-%Y%m%d-%H%M%S"):
            try:parsed=datetime.strptime(path.stem,pattern).date();break
            except ValueError:pass
        if parsed:existing.append((parsed,path))
    if existing and max(date for date,_ in existing)==today:return None
    result=create_backup(store,root,backups,automatic=True)
    for _,path in sorted(existing,reverse=True)[13:]:path.unlink(missing_ok=True)
    return result


def list_backups(backups: Path) -> list[dict[str,Any]]:
    backups.mkdir(parents=True,exist_ok=True)
    return [{"name":p.name,"size":p.stat().st_size,"modified":datetime.fromtimestamp(p.stat().st_mtime).astimezone().isoformat(timespec="minutes"),"automatic":p.name.startswith("DALEX-auto-")}
            for p in sorted(backups.glob("DALEX-*.zip"),key=lambda x:x.stat().st_mtime,reverse=True) if p.is_file()]


def restore_backup(store: Store, root: Path, archive_path: Path) -> None:
    root=root.resolve(); db_path=store.path.resolve()
    if not zipfile.is_zipfile(archive_path):raise StoreError("O arquivo selecionado não é um backup ZIP válido.")
    with tempfile.TemporaryDirectory(prefix="dalex-restore-") as work:
        stage=Path(work);candidate=stage/"Dados"/"dalex.db";new_attachments=stage/"Anexos"
        total=0;found_db=False
        try:
            with zipfile.ZipFile(archive_path,"r") as archive:
                for info in archive.infolist():
                    if info.is_dir():continue
                    name=PurePosixPath(info.filename)
                    if not name.parts or name.is_absolute() or ".." in name.parts or "\\" in info.filename:
                        raise StoreError("O backup contém caminhos inválidos.")
                    allowed=name.as_posix()=="Dados/dalex.db" or name.parts[0] in ("Anexos","Configuracoes")
                    if not allowed:raise StoreError("O backup contém itens fora das pastas permitidas.")
                    total+=info.file_size
                    if info.file_size<0 or total>BACKUP_LIMIT_BYTES:raise StoreError("O backup ultrapassa o limite permitido.")
                    if info.filename=="Dados/dalex.db":found_db=True
                    destination=stage.joinpath(*name.parts).resolve()
                    if not destination.is_relative_to(stage.resolve()):raise StoreError("O backup tenta gravar fora da pasta de restauração.")
                    destination.parent.mkdir(parents=True,exist_ok=True)
                    with archive.open(info) as source,destination.open("wb") as output:shutil.copyfileobj(source,output,1024*1024)
            if not found_db:raise StoreError("O backup não contém o banco SQLite.")
            check=sqlite3.connect(candidate)
            try:
                check.row_factory=sqlite3.Row
                if check.execute("PRAGMA integrity_check").fetchone()[0]!="ok":raise StoreError("O banco do backup não passou na verificação de integridade.")
                version=check.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()
                if not version or int(version[0])>SCHEMA_VERSION:raise StoreError("A versão do banco não é compatível com este aplicativo.")
                if check.execute("PRAGMA foreign_key_check").fetchone():raise StoreError("O backup contém vínculos de dados inválidos.")
                required={"metadata","schema_migrations","clients","workshops","employees","records","record_items","pricing","invoices",
                          "invoice_records","invoice_lines","installments","receipts","attendance","employee_payments",
                          "workshop_payments","workshop_payment_allocations","audit","users","security_events","attachments","record_attachments"}
                if int(version[0]) >= 2:
                    required.add("balance_expenses")
                tables={r[0] for r in check.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                if not required.issubset(tables):raise StoreError("O banco do backup não tem a estrutura esperada.")
            finally:check.close()
            Store(candidate)  # Migrate a compatible older backup before replacing the active database.
            db_path.parent.mkdir(parents=True,exist_ok=True)
            attach_path=root/"Anexos";backups=root/"Backups"
            old_db=stage/"old.db";old_attach=stage/"old-Anexos"
            with store.connect() as live:
                checkpoint=live.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
                if checkpoint and checkpoint[0]:raise StoreError("O banco está ocupado e ainda não pode ser restaurado. Tente novamente.")
            if db_path.exists():shutil.copy2(db_path,old_db)
            had_attach=attach_path.exists()
            try:
                if had_attach:os.replace(attach_path,old_attach)
                for suffix in ("-wal","-shm"):
                    Path(str(db_path)+suffix).unlink(missing_ok=True)
                os.replace(candidate,db_path)
                if new_attachments.exists():os.replace(new_attachments,attach_path)
                else:attach_path.mkdir(parents=True,exist_ok=True)
                with store.connect() as db:
                    if db.execute("PRAGMA integrity_check").fetchone()[0]!="ok":raise StoreError("O banco restaurado não ficou íntegro.")
                backups.mkdir(parents=True,exist_ok=True)
            except Exception:
                if db_path.exists():db_path.unlink()
                if old_db.exists():shutil.copy2(old_db,db_path)
                if attach_path.exists():shutil.rmtree(attach_path)
                if had_attach and old_attach.exists():os.replace(old_attach,attach_path)
                raise
        except StoreError:raise
        except (OSError,sqlite3.DatabaseError,zipfile.BadZipFile) as error:
            raise StoreError("Não foi possível restaurar. Os arquivos anteriores foram mantidos.") from error


def excel_export(state:dict[str,Any],destination:Path) -> Path:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font,PatternFill
        from openpyxl.utils import get_column_letter
    except ImportError as error:
        raise StoreError("Para exportar Excel, execute INSTALAR_DEPENDENCIAS.bat primeiro.") from error
    wb=Workbook();wb.remove(wb.active)
    def sheet(name,headers,rows,money_columns=()):
        ws=wb.create_sheet(name);ws.append(headers)
        for row in rows:
            safe=[]
            for value in row:
                if isinstance(value,str) and value.lstrip().startswith(("=","+","-","@")):
                    value="'"+value
                safe.append(value)
            ws.append(safe)
        ws.freeze_panes="A2";ws.auto_filter.ref=ws.dimensions
        for cell in ws[1]:cell.font=Font(color="FFFFFF",bold=True);cell.fill=PatternFill("solid",fgColor="214B3E")
        for column in ws.columns:
            letter=get_column_letter(column[0].column)
            width=min(42,max(12,max((len(str(cell.value or "")) for cell in column),default=0)+2))
            ws.column_dimensions[letter].width=width
        for index in money_columns:
            for cells in ws.iter_cols(min_col=index,max_col=index,min_row=2):
                for cell in cells:
                    if isinstance(cell.value,(float,int)):cell.number_format='"R$" #,##0.00'
        return ws
    clients={c["id"]:c["name"] for c in state.get("clients",[])}
    workshops={w["id"]:w["name"] for w in state.get("workshops",[])}
    employees={e["id"]:e["name"] for e in state.get("employees",[])}
    records={r["id"]:r for r in state.get("records",[])}
    invoices={i["id"]:i for i in state.get("invoices",[])}
    sheet("Clientes",["ID","Nome","Situação"],([c["id"],c["name"],"Ativo" if c.get("active") else "Inativo"] for c in state.get("clients",[])))
    sheet("Romaneios",["ID","Pedido do cliente","Cliente","Recebido em","Etapa","Local"],([r["id"],r.get("clientOrder",""),clients.get(r.get("clientId"),r.get("client","")),r.get("receivedOn") or "",r["stage"],workshops.get((r.get("execution") or {}).get("workshopId"),"Interna")] for r in state.get("records",[])))
    item_rows=[]
    for r in state.get("records",[]):
        for item in r.get("items",[]):
            for size in item.get("sizes",[]):item_rows.append([r["id"],item.get("code"),item.get("description"),item.get("family"),item.get("color"),item.get("grid"),size.get("size"),size.get("quantity",0)])
    sheet("Itens_Romaneio",["Romaneio","Código","Descrição","Família","Cor","Grade","Tamanho","Quantidade"],item_rows)
    invoice_rows=[];part_rows=[]
    for invoice in state.get("invoices",[]):
        invoice_rows.append([invoice["number"],invoice["client"],invoice["issueDate"],invoice["totalCents"]/100,", ".join(invoice.get("recordIds",[]))])
        for pos,part in enumerate(invoice.get("installments",[]),1):part_rows.append([invoice["number"],pos,part.get("dueDate") or "A definir",part["amountCents"]/100])
    sheet("Notas_Fiscais",["NF","Cliente","Emissão","Total R$","Romaneios"],invoice_rows,(4,))
    sheet("Parcelas",["NF","Parcela","Previsão","Valor R$"],part_rows,(4,))
    receipt_rows=[]
    for receipt in state.get("receipts",[]):receipt_rows.append([invoices.get(receipt["invoiceId"],{}).get("number",""),receipt["installmentId"],receipt["date"],receipt["amountCents"]/100,receipt.get("reversedAt") or "Ativo"])
    sheet("Recebimentos",["NF","ID da parcela","Data efetiva","Valor R$","Situação"],receipt_rows,(4,))
    sheet("Funcionarios",["ID","Nome","Função","Diária R$","Situação"],([e["id"],e["name"],e["role"],e["dailyCents"]/100,"Ativo" if e.get("active") else "Inativo"] for e in state.get("employees",[])),(4,))
    sheet("Frequencia",["Funcionário","Data","Situação","Diária R$"],([employees.get(a["employeeId"],a["employeeId"]),a["date"],a["status"],a["dailyCents"]/100] for a in state.get("attendance",[])),(4,))
    sheet("Pag_Funcionarios",["ID","Funcionário","Data","Valor R$","Adiantamento","Desfeito"],([p["id"],employees.get(p["employeeId"],p["employeeId"]),p["date"],p["amountCents"]/100,"Sim" if p.get("advance") else "Não",p.get("reversedAt") or "Não"] for p in state.get("employeePayments",[])),(4,))
    sheet("Oficinas",["ID","Nome","Contato","Chave Pix","Situação"],([w["id"],w["name"],w.get("contact",""),w.get("pix",""),"Ativa" if w.get("active") else "Inativa"] for w in state.get("workshops",[])))
    sheet("Pag_Oficinas",["ID","Oficina","Data","Valor R$","Alocações","Desfeito"],([p["id"],workshops.get(p["workshopId"],p["workshopId"]),p["date"],p["amountCents"]/100,"; ".join(a["chargeId"]+": "+str(a["amountCents"]/100) for a in p.get("allocations",[])),p.get("reversedAt") or "Não"] for p in state.get("workshopPayments",[])),(4,))
    sheet(
        "Despesas_Balanco",
        ["ID", "Data do pagamento", "Categoria", "Descrição", "Valor R$", "Fornecedor", "Observação", "Estornado em"],
        ([expense["id"], expense["date"], expense["category"], expense["description"], expense["amountCents"] / 100,
          expense.get("supplier", ""), expense.get("note", ""), expense.get("reversedAt") or ""]
         for expense in state.get("balanceExpenses", [])),
        (5,),
    )
    sheet("Auditoria",["ID","Data/hora","Registro","Ação","Usuário","Perfil"],([a["id"],a["at"],a["entityId"],a["action"],(a.get("actor") or {}).get("name",""),(a.get("actor") or {}).get("role","")] for a in state.get("audit",[])))
    destination.parent.mkdir(parents=True,exist_ok=True);wb.save(destination)
    return destination
