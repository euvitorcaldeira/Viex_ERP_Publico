"""Loopback-only HTTP service. No cross-origin access and no cloud calls."""
from __future__ import annotations

import hashlib
import hmac
import base64
import binascii
import json
import mimetypes
import os
import secrets
import shutil
import sys
import tempfile
import threading
import time
import uuid
from datetime import date, timedelta
from urllib.parse import quote
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from .database import RevisionConflict, Store, StoreError, empty_state
from .employee_activity import employee_activity
from .data_files import create_backup, excel_export, list_backups, maybe_daily_backup, restore_backup
from .history_import import HistoryImport, MAX_UPLOAD, XLSX, read_workbook, template_bytes

ROOT = Path(sys.executable).resolve().parent if getattr(sys,"frozen",False) else Path(__file__).resolve().parents[1]
DATA_OVERRIDE = os.environ.get("DALEX_DATA_DIR")
DATA = Path(DATA_OVERRIDE or ROOT / "Dados").resolve()
STORE_ROOT = DATA.parent if DATA_OVERRIDE else ROOT
WEB = (Path(getattr(sys,"_MEIPASS",ROOT)) / "dist") if getattr(sys,"frozen",False) else ROOT / "dist"
PORT = 8765
DB = Store(DATA / "dalex.db")
SESSIONS: dict[str, dict] = {}
SESSION_TTL = 8 * 60 * 60
MAX_BODY = 8 * 1024 * 1024
MAX_BACKUP_UPLOAD = 1024 * 1024 * 1024 + 16 * 1024 * 1024
MAX_ATTACHMENT = 5 * 1024 * 1024
ATTACHMENT_TYPES = {
    "application/pdf": (".pdf", b"%PDF-"),
    "image/jpeg": (".jpg", b"\xff\xd8\xff"),
    "image/png": (".png", b"\x89PNG\r\n\x1a\n"),
    "image/gif": (".gif", b"GIF8"),
    "image/webp": (".webp", b"RIFF"),
}


def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt$16384$8$1${salt.hex()}${digest.hex()}"


def password_matches(password: str, stored: str) -> bool:
    try:
        algorithm, n, r, p, salt_hex, digest_hex = stored.split("$")
        if algorithm != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt_hex), n=int(n), r=int(r), p=int(p), dklen=len(bytes.fromhex(digest_hex)))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def account_count() -> int:
    with DB.connect() as db:
        return db.execute("SELECT COUNT(*) FROM users WHERE active=1").fetchone()[0]


def user_by_email(email: str):
    with DB.connect() as db:
        return db.execute("SELECT * FROM users WHERE email=? COLLATE NOCASE", (email.strip(),)).fetchone()


def user_view(user) -> dict:
    return {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}


def start_session(user) -> tuple[str, dict]:
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    SESSIONS[token] = {"user": user_view(user), "csrf": csrf, "expires": time.time() + SESSION_TTL}
    return token, SESSIONS[token]


BALANCE_EXPENSE_ACTIONS = frozenset({
    "Despesa lançada", "Despesa atualizada", "Despesa estornada", "Estorno de despesa desfeito",
})


def validate_balance_expense_transition(before: dict, after: dict, events: list[dict], actor_role: str | None) -> None:
    previous = Store.balance_expenses_by_id(before.get("balanceExpenses", []))
    current = Store.balance_expenses_by_id(after.get("balanceExpenses", before.get("balanceExpenses", [])))
    expense_events = [event for event in events if event.get("action") in BALANCE_EXPENSE_ACTIONS]
    if actor_role != "Administrador" and (previous != current or expense_events):
        raise StoreError("Somente o Administrador pode alterar despesas do balanço.")
    if previous.keys() - current.keys():
        raise StoreError("Despesas registradas não podem ser excluídas. Use Estornar.")

    for expense_id, expense in current.items():
        original = previous.get(expense_id)
        if original == expense:
            continue
        if original is None:
            if expense.get("reversedAt"):
                raise StoreError("Uma nova despesa não pode ser registrada como estornada.")
            action = "Despesa lançada"
        elif original.get("reversedAt"):
            if expense != {**original, "reversedAt": None}:
                raise StoreError("Restaure a despesa sem editar os dados originais.")
            action = "Estorno de despesa desfeito"
        elif expense.get("reversedAt"):
            if expense != {**original, "reversedAt": expense["reversedAt"]}:
                raise StoreError("Estorne a despesa sem editar os dados originais.")
            action = "Despesa estornada"
        else:
            action = "Despesa atualizada"
        for index, event in enumerate(expense_events):
            if (event.get("entityId") == expense_id and event["action"] == action
                    and event.get("before") == original and event.get("after") == expense):
                expense_events.pop(index)
                break
        else:
            raise StoreError("A alteração da despesa precisa ficar registrada no histórico.")
    if expense_events:
        raise StoreError("Há registros de histórico de despesas sem uma alteração correspondente.")


def validate_state_transition(before: dict, after: dict, actor_role: str | None = None) -> None:
    """Protect issued documents, settled payments, and append-only history."""
    def by_id(rows):
        return {row["id"]:row for row in rows}
    removed_invoice_ids = set()
    previous_audit_ids = set(by_id(before.get("audit", [])))
    new_events = [event for event in after.get("audit", []) if event.get("id") not in previous_audit_ids]
    validate_balance_expense_transition(before, after, new_events, actor_role)
    previous_internal_name=before.get("internalWorkshopName", "D’ALEX")
    next_internal_name=after.get("internalWorkshopName", "D’ALEX")
    if previous_internal_name!=next_internal_name:
        if actor_role!="Administrador":raise StoreError("Somente o Administrador pode alterar o nome da oficina interna.")
        if not any(event.get("entityId")=="settings:internalWorkshopName" and event.get("action")=="Nome da oficina interna alterado" and event.get("before")==previous_internal_name and event.get("after")==next_internal_name for event in new_events):
            raise StoreError("A alteração do nome da oficina interna precisa ficar registrada no histórico.")
    previous_system_name=before.get("systemDisplayName", "D’ALEX")
    next_system_name=after.get("systemDisplayName", "D’ALEX")
    if previous_system_name!=next_system_name:
        if actor_role!="Administrador":raise StoreError("Somente o Administrador pode alterar o nome de exibição do sistema.")
        if not any(event.get("entityId")=="settings:systemDisplayName" and event.get("action")=="Nome de exibição do sistema alterado" and event.get("before")==previous_system_name and event.get("after")==next_system_name for event in new_events):
            raise StoreError("A alteração do nome do sistema precisa ficar registrada no histórico.")
    previous_payment_text=before.get("invoiceSummaryPaymentText", "PIX 42655411862")
    next_payment_text=after.get("invoiceSummaryPaymentText", "PIX 42655411862")
    if previous_payment_text!=next_payment_text:
        if actor_role!="Administrador":raise StoreError("Somente o Administrador pode alterar o complemento do resumo da NF.")
        if not any(event.get("entityId")=="settings:invoiceSummaryPaymentText" and event.get("action")=="Complemento do resumo da NF alterado" and event.get("before")==previous_payment_text and event.get("after")==next_payment_text for event in new_events):
            raise StoreError("A alteração do complemento do resumo da NF precisa ficar registrada no histórico.")
    movement_owners = {
        "receipts": "invoiceId",
        "employeePayments": "employeeId",
        "workshopPayments": "workshopId",
    }
    def archived_by_undo(receipt, invoice_id):
        candidates = [receipt] if receipt.get("reversedAt") else [
            event["after"] for event in new_events
            if event.get("entityId") == invoice_id and event.get("action") == "Recebimento desfeito"
            and event.get("before") == receipt and isinstance(event.get("after"), dict)
            and event["after"].get("reversedAt")
            and {**receipt, "reversedAt": event["after"]["reversedAt"]} == event["after"]
        ]
        return any(
            event.get("entityId") == invoice_id and event.get("action") == "Faturamento desfeito"
            and isinstance(event.get("after"), dict)
            and any(candidate in event["after"].get("archivedReceipts", []) for candidate in candidates)
            for event in new_events
        )

    for key in ("invoices", "receipts", "employeePayments", "workshopPayments", "audit"):
        old_rows, new_rows = by_id(before.get(key, [])), by_id(after.get(key, []))
        deleted=set(old_rows)-set(new_rows)
        if deleted:
            if key in movement_owners:
                if actor_role != "Administrador":
                    raise StoreError("Somente o Administrador pode excluir movimentações.")
                for movement_id in deleted:
                    movement = old_rows[movement_id]
                    owner_id = movement[movement_owners[key]]
                    preserved = any(
                        event.get("entityId") == owner_id
                        and event.get("action") == "Movimentação excluída do histórico"
                        and event.get("before") == movement
                        and event.get("after") == {"collection": key, "removed": True}
                        for event in new_events
                    )
                    if key == "receipts" and owner_id in removed_invoice_ids:
                        preserved = preserved or archived_by_undo(movement, owner_id)
                    if not preserved:
                        raise StoreError("A movimentação precisa ser preservada integralmente na auditoria.")
                deleted = set()
            if deleted and key!="invoices":
                raise StoreError(f"O histórico de {key} é preservado e não pode ser apagado.")
            for invoice_id in deleted:
                invoice=old_rows[invoice_id]
                if actor_role!="Administrador":
                    raise StoreError("Somente o Administrador pode desfazer o registro de uma NF.")
                if any(row.get("invoiceId")==invoice_id and not row.get("reversedAt") and not archived_by_undo(row, invoice_id) for row in before.get("receipts",[])):
                    raise StoreError("Estorne os recebimentos ativos antes de desfazer o faturamento.")
                undo = next((
                    event for event in new_events
                    if event.get("entityId") == invoice_id and event.get("action") == "Faturamento desfeito"
                ), None)
                if undo and undo.get("before") != invoice:
                    raise StoreError("A nota original precisa ser preservada integralmente na auditoria.")
                if undo and invoice.get("taxPaidAt"):
                    raise StoreError("Desfaça a baixa do imposto primeiro.")
                if undo and any(not any(r.get("id")==rid and r.get("invoiceId") is None and r.get("stage")=="Concluído" for r in after.get("records",[])) for rid in invoice.get("recordIds",[])):
                    raise StoreError("Os romaneios devem retornar para faturamento.")
                if not undo and len(invoice.get("recordIds",[]))!=1:
                    raise StoreError("A remoção só é permitida para uma NF vinculada a um único romaneio.")
                if not undo and not any(event.get("entityId")==invoice_id and event.get("action")=="NF e romaneio faturados removidos" for event in after.get("audit",[])):
                    raise StoreError("A remoção precisa deixar um registro no histórico.")
                removed_invoice_ids.add(invoice_id)
        for row_id, old in old_rows.items():
            if row_id not in new_rows:
                continue
            new = new_rows[row_id]
            if key == "invoices":
                def invoice_snapshot(value):
                    snapshot=json.loads(json.dumps(value))
                    for part in snapshot.get("installments",[]):part.pop("dueDate",None)
                    for field in ("taxRateBps","taxCents","taxDueDate","taxPaidAt","taxExempt"):snapshot.pop(field,None)
                    return snapshot
                if invoice_snapshot(old)!=invoice_snapshot(new):
                    raise StoreError("A nota e os valores originalmente faturados não podem ser reescritos; somente previsões e apontamentos de imposto podem ser ajustados.")
                tax_fields=("taxRateBps","taxCents","taxDueDate","taxPaidAt","taxExempt")
                if any(old.get(field)!=new.get(field) for field in tax_fields) and not any(entry.get("entityId")==row_id and entry.get("action") in ("Apuração de imposto atualizada","Imposto pago","Pagamento de imposto desfeito","NF marcada como isenta de imposto","Isenção de imposto removida") for entry in after.get("audit",[])):
                    raise StoreError("Alterações de imposto precisam deixar registro no histórico.")
            elif key == "audit":
                if old != new:
                    raise StoreError(f"O registro histórico de {key} não pode ser reescrito.")
            else:
                allowed = dict(old)
                if old.get("reversedAt"):
                    if old != new:
                        raise StoreError("Um pagamento já desfeito não pode ser alterado.")
                elif new.get("reversedAt"):
                    allowed["reversedAt"] = new["reversedAt"]
                    if allowed != new:
                        raise StoreError("Desfaça o pagamento sem editar os dados originais.")
                elif old != new:
                    raise StoreError("Pagamentos registrados não podem ser editados; use Desfazer.")

    old_employee_payments=by_id(before.get("employeePayments",[]))
    attendance_by_employee={employee_id:[row for row in before.get("attendance",[]) if row.get("employeeId")==employee_id] for employee_id in by_id(before.get("employees",[]))}
    employee_balances={}
    for employee_id, employee in by_id(before.get("employees",[])).items():
        entries=attendance_by_employee[employee_id]
        earned=sum(row.get("dailyCents",0)+row.get("overtimeCents",0)-row.get("earlyDepartureDeductionCents",0) for row in entries if row.get("status")=="Presente")
        start_text=employee.get("attendanceStartDate") or date.today().isoformat()
        try:start=date.fromisoformat(start_text)
        except (TypeError,ValueError):start=date.today()
        recorded={row.get("date") for row in entries}
        active_on = employee_activity(before, employee)
        cursor=start;today=date.today()
        while cursor<=today:
            if cursor.weekday()<5 and cursor.isoformat() not in recorded and active_on(cursor.isoformat()):
                earned+=employee.get("dailyCents",0)
            cursor+=timedelta(days=1)
        employee_balances[employee_id]=earned
    for payment in before.get("employeePayments",[]):
        if not payment.get("reversedAt"):
            employee_balances[payment["employeeId"]]=employee_balances.get(payment["employeeId"],0)-payment["amountCents"]
    for payment in after.get("employeePayments",[]):
        if payment["id"] in old_employee_payments:continue
        if payment.get("reversedAt"):
            raise StoreError("Um novo pagamento não pode nascer como desfeito.")
        employee_id=payment.get("employeeId");amount=payment.get("amountCents")
        if not payment.get("advance") and amount>employee_balances.get(employee_id,0):
            raise StoreError("Pagamento de funcionário ultrapassa o saldo disponível. Use Adiantamento para antecipar valores.")
        employee_balances[employee_id]=employee_balances.get(employee_id,0)-amount

    before_records=by_id(before.get("records",[])); after_records=by_id(after.get("records",[]))
    invoice_record_ids={rid for invoice in before.get("invoices",[]) for rid in invoice.get("recordIds",[])}
    workshop_record_ids=set()
    active_workshop_record_ids=set()
    for payment in before.get("workshopPayments",[]):
        for allocation in payment.get("allocations",[]):
            record_id=allocation.get("chargeId","").split("|",1)[0]
            workshop_record_ids.add(record_id)
            if not payment.get("reversedAt"):
                active_workshop_record_ids.add(record_id)
    removable_record_ids={rid for invoice in before.get("invoices",[]) if invoice.get("id") in removed_invoice_ids for rid in invoice.get("recordIds",[])}
    for record_id, old in before_records.items():
        maintenance_delete = actor_role == "Administrador" and any(
            event.get("entityId") == record_id
            and event.get("action") == "Romaneio excluído pela manutenção"
            and event.get("before") == old for event in new_events
        )
        if record_id not in after_records and old.get("stage")=="Concluído" and record_id not in removable_record_ids and not maintenance_delete:
            raise StoreError("Retorne o romaneio para Em produção antes de excluir.")
        if record_id not in invoice_record_ids and record_id not in workshop_record_ids:
            continue
        new=after_records.get(record_id)
        if new is None:
            if record_id in removable_record_ids and record_id not in workshop_record_ids and not old.get("attachments"):
                continue
            raise StoreError("Este romaneio tem vínculo financeiro e não pode ser excluído.")
        if record_id not in invoice_record_ids and record_id not in active_workshop_record_ids:
            continue
        protected=("stage","client","clientId","items","pricing","execution","invoiceId","attachments")
        if any(old.get(field)!=new.get(field) for field in protected if not (field=="invoiceId" and old.get("invoiceId") in removed_invoice_ids and new.get("invoiceId") is None)):
            raise StoreError("Itens, cliente, oficina e preços estão protegidos por faturamento ou pagamento.")
    for key in ("employees", "workshops", "clients"):
        if not set(by_id(before.get(key,[]))).issubset(by_id(after.get(key,[]))):
            raise StoreError(f"O cadastro de {key} com histórico não pode ser excluído; desative-o.")


class Handler(SimpleHTTPRequestHandler):
    server_version = "DALEX-Local/1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def log_message(self, fmt, *args):
        # Avoid writing personal data or HTTP query strings into permanent logs.
        return

    def send_json(self, status: int, payload: dict, cookie: str | None = None):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        if cookie:
            self.send_header("Set-Cookie", f"dalex_session={cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_TTL}")
        self.end_headers()
        self.wfile.write(raw)

    def send_file(self,path:Path,content_type:str,download_name:str):
        safe_name=quote(download_name.encode("utf-8"))
        size=path.stat().st_size
        self.send_response(200)
        self.send_header("Content-Type",content_type)
        self.send_header("Content-Length",str(size))
        self.send_header("Content-Disposition",f"attachment; filename*=UTF-8''{safe_name}")
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.end_headers()
        with path.open("rb") as source:shutil.copyfileobj(source,self.wfile,1024*1024)

    def body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY:
            raise StoreError("O tamanho da solicitação é inválido.")
        try:
            value = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise StoreError("Os dados enviados não estão em formato válido.")
        if not isinstance(value, dict):
            raise StoreError("O formato da solicitação é inválido.")
        return value

    def check_origin(self, required=False):
        host = self.headers.get("Host", "").split(":", 1)[0].lower()
        if host not in ("127.0.0.1", "localhost"):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "Acesso local inválido."})
            return False
        origin = self.headers.get("Origin")
        expected = f"http://{self.headers.get('Host')}"
        if required and origin != expected:
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "Origem da solicitação inválida."})
            return False
        return True

    def session(self):
        cookie = self.headers.get("Cookie", "")
        token = next((part.strip().split("=",1)[1] for part in cookie.split(";") if part.strip().startswith("dalex_session=")), "")
        session = SESSIONS.get(token)
        if session and session["expires"] > time.time():
            session["expires"] = time.time() + SESSION_TTL
            return token, session
        if token:
            SESSIONS.pop(token, None)
        return token, None

    def require_user(self, admin=False, csrf=False):
        token, session = self.session()
        if not session:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Entre novamente no D’ALEX."})
            return None
        if admin and session["user"]["role"] != "Administrador":
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "Esta ação exige perfil Administrador."})
            return None
        if csrf and (self.headers.get("X-Dalex-CSRF") != session["csrf"] or not self.check_origin(required=True)):
            if self.headers.get("X-Dalex-CSRF") != session["csrf"]:
                self.send_json(HTTPStatus.FORBIDDEN, {"error": "Verificação de segurança inválida."})
            return None
        return session

    def do_GET(self):
        if not self.check_origin():
            return
        path = urlparse(self.path).path
        if path == "/api/status":
            _, session = self.session()
            payload = {"setupRequired": account_count() == 0, "authenticated": bool(session)}
            if session:
                payload.update({"actor": session["user"], "csrf": session["csrf"]})
            self.send_json(200, payload)
            return
        if path == "/api/state":
            session = self.require_user()
            if not session:
                return
            state = DB.load()
            if session["user"]["role"] != "Administrador":
                state = self.operational_view(state)
            self.send_json(200, {"state": state, "revision": DB.revision()})
            return
        if path == "/api/users":
            if not self.require_user(admin=True):
                return
            state = DB.load()
            self.send_json(200, {"users": state["users"]})
            return
        if path == "/api/backups":
            if not self.require_user(admin=True):return
            self.send_json(200,{"backups":list_backups(STORE_ROOT/"Backups")})
            return
        if path.startswith("/api/backups/"):
            if not self.require_user(admin=True):return
            name=unquote(path.rsplit("/",1)[-1])
            if Path(name).name!=name or not name.startswith("DALEX-") or not name.endswith(".zip"):
                self.send_json(400,{"error":"Nome de backup inválido."});return
            backup=STORE_ROOT/"Backups"/name
            if not backup.is_file():self.send_json(404,{"error":"Backup não encontrado."});return
            self.send_file(backup,"application/zip",name)
            return
        if path == "/api/history/template":
            if not self.require_user(admin=True):
                return
            try:
                content = template_bytes()
            except StoreError as error:
                self.send_json(503, {"error": str(error)})
                return
            self.send_response(200)
            self.send_header("Content-Type", XLSX)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Content-Disposition", "attachment; filename*=UTF-8''DALEX_Modelo_Historico.xlsx")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(content)
            return
        if path == "/api/export/excel":
            if not self.require_user(admin=True):return
            try:
                destination=STORE_ROOT/"Planilhas"/"DALEX_Exportacao_Atual.xlsx"
                excel_export(DB.load(),destination)
                self.send_file(destination,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",destination.name)
            except StoreError as error:self.send_json(503,{"error":str(error)})
            except Exception:self.send_json(500,{"error":"Não foi possível gerar a planilha. Os dados do banco continuam preservados."})
            return
        if path.startswith("/api/attachments/"):
            session=self.require_user()
            if not session:return
            attachment_id=path.rsplit("/",1)[-1]
            with DB.connect() as db:
                row=db.execute("SELECT * FROM attachments WHERE id=?",(attachment_id,)).fetchone()
                linked=db.execute("SELECT 1 FROM record_attachments WHERE attachment_id=?",(attachment_id,)).fetchone()
            if not row or (not linked and row["uploaded_by"]!=session["user"]["id"]):
                self.send_json(404,{"error":"Anexo não encontrado."});return
            file_path=(STORE_ROOT/row["relative_path"]).resolve()
            if not file_path.is_relative_to((STORE_ROOT/"Anexos").resolve()) or not file_path.is_file():
                self.send_json(404,{"error":"O arquivo do anexo não está disponível."});return
            self.send_file(file_path,row["mime_type"],row["original_name"])
            return
        if path.startswith("/api/"):
            self.send_json(404, {"error": "Operação local não encontrada."})
            return
        if path == "/":
            self.path = "/index.html"
        return super().do_GET()

    @staticmethod
    def operational_view(state: dict) -> dict:
        safe = json.loads(json.dumps(state))
        safe["invoices"] = []
        safe["receipts"] = []
        safe["employees"] = []
        safe["attendance"] = []
        safe["employeePayments"] = []
        safe["workshopPayments"] = []
        safe["balanceExpenses"] = []
        safe["users"] = []
        safe["workshops"] = [{"id": w["id"], "name": w["name"], "active": w["active"], "contact": "", "pix": ""} for w in state["workshops"]]
        safe["audit"] = [{"id": a["id"], "entityId": a["entityId"], "at": a["at"], "action": a["action"], "actor": a.get("actor")}
                         for a in state["audit"] if a.get("action") not in BALANCE_EXPENSE_ACTIONS]
        for record in safe["records"]:
            record["pricing"] = []
        return safe

    def do_POST(self):
        if not self.check_origin():
            return
        path = urlparse(self.path).path
        try:
            if path in ("/api/setup", "/api/login"):
                if not self.check_origin(required=True):
                    return
                data = self.body()
                email = str(data.get("email", "")).strip().lower()
                password = data.get("password", "")
                if not isinstance(password, str):
                    raise StoreError("Senha inválida.")
                if path == "/api/setup":
                    name = str(data.get("name", "")).strip()
                    if not name or "@" not in email:
                        raise StoreError("Informe seu nome e um e-mail válido.")
                    if len(password) < 12:
                        raise StoreError("Crie uma senha com pelo menos 12 caracteres.")
                    with DB.connect() as db:
                        db.execute("BEGIN IMMEDIATE")
                        if db.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
                            self.send_json(409, {"error": "A configuração inicial já foi concluída."})
                            return
                        db.execute("INSERT INTO users(id,email,name,role,active,password_hash,created_at) VALUES(?,?,?,'Administrador',1,?,?)",(secrets.token_hex(16),email,name,password_hash(password),time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())))
                    user = user_by_email(email)
                else:
                    user = user_by_email(email)
                    if not user or not user["active"] or not password_matches(password, user["password_hash"]):
                        self.send_json(401, {"error": "E-mail ou senha inválidos."})
                        return
                old_token, _ = self.session()
                SESSIONS.pop(old_token, None)
                token, session = start_session(user)
                self.send_json(200, {"actor": session["user"], "csrf": session["csrf"]}, cookie=token)
                return
            if path == "/api/logout":
                session = self.require_user(csrf=True)
                if not session:
                    return
                token, _ = self.session()
                SESSIONS.pop(token, None)
                self.send_response(204)
                self.send_header("Set-Cookie", "dalex_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
                self.end_headers()
                return
            if path == "/api/users":
                session = self.require_user(admin=True, csrf=True)
                if not session:
                    return
                data = self.body()
                name, email, role, password = (str(data.get(k," ")).strip() for k in ("name","email","role","password"))
                if not name or "@" not in email or role not in ("Administrador","Operação","Consulta") or len(password) < 12:
                    raise StoreError("Informe nome, e-mail, perfil e senha com pelo menos 12 caracteres.")
                with DB.connect() as db:
                    new_id=secrets.token_hex(16)
                    db.execute("INSERT INTO users(id,email,name,role,active,password_hash,created_at) VALUES(?,?,?,?,1,?,?)",(new_id,email,name,role,password_hash(password),time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())))
                    event={"id":uuid.uuid4().hex,"at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"actorId":session["user"]["id"],"targetUserId":new_id,"action":"Usuário autorizado criado","after":{"name":name,"email":email,"role":role,"active":True}}
                    db.execute("INSERT INTO security_events VALUES(?,?,?,?,?,?)",(event["id"],event["at"],event["actorId"],new_id,event["action"],DB.encode(event)))
                self.send_json(201, {"users": DB.load()["users"]})
                return
            if path == "/api/backups":
                if not self.require_user(admin=True,csrf=True):return
                backup=create_backup(DB,STORE_ROOT,STORE_ROOT/"Backups")
                self.send_json(201,{"name":backup.name,"size":backup.stat().st_size})
                return
            if path in ("/api/history/preview", "/api/history/import"):
                self.import_history(preview=path.endswith("/preview"))
                return
            if path == "/api/attachments":
                session=self.require_user(csrf=True)
                if not session:return
                if session["user"]["role"] not in ("Administrador","Operação"):
                    self.send_json(403,{"error":"Este perfil pode consultar arquivos, mas não enviar anexos."});return
                data=self.body()
                name=str(data.get("name","")).replace("\\","/").split("/")[-1].strip()
                name="".join(character for character in name if ord(character)>=32 and ord(character)!=127)
                mime=str(data.get("mime","")).strip().lower()
                encoded=data.get("data","")
                if not name or len(name)>180 or not isinstance(encoded,str):
                    raise StoreError("Informe um nome de arquivo válido.")
                if mime not in ATTACHMENT_TYPES:
                    raise StoreError("Anexe um arquivo PDF, JPEG, PNG, GIF ou WebP.")
                if len(encoded)>((MAX_ATTACHMENT+2)//3)*4+8:
                    raise StoreError("Cada anexo deve ter no máximo 5 MB.")
                try:content=base64.b64decode(encoded,validate=True)
                except (binascii.Error,ValueError):raise StoreError("O arquivo enviado não está em formato válido.")
                extension,signature=ATTACHMENT_TYPES[mime]
                if not content or len(content)>MAX_ATTACHMENT:
                    raise StoreError("Cada anexo deve ter no máximo 5 MB.")
                if not content.startswith(signature) or (mime=="image/webp" and content[8:12]!=b"WEBP"):
                    raise StoreError("O conteúdo do arquivo não corresponde ao formato informado.")
                attachment_id=uuid.uuid4().hex
                relative=Path("Anexos")/"Romaneios"/f"{attachment_id}{extension}"
                destination=(STORE_ROOT/relative).resolve()
                if not destination.is_relative_to((STORE_ROOT/"Anexos").resolve()):raise StoreError("Caminho de anexo inválido.")
                destination.parent.mkdir(parents=True,exist_ok=True)
                temporary=destination.with_suffix(destination.suffix+".part")
                temporary.write_bytes(content);os.replace(temporary,destination)
                try:
                    with DB.connect() as db:
                        db.execute("INSERT INTO attachments VALUES(?,?,?,?,?,?,?)",(attachment_id,name,mime,relative.as_posix(),len(content),session["user"]["id"],time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())))
                except Exception:
                    destination.unlink(missing_ok=True)
                    raise
                self.send_json(201,{"id":attachment_id,"name":name,"reference":f"{attachment_id}|{name}"})
                return
            if path == "/api/restore":
                if not self.require_user(admin=True,csrf=True):return
                length=int(self.headers.get("Content-Length","0"))
                if length<=0 or length>MAX_BACKUP_UPLOAD:
                    self.send_json(413,{"error":"O arquivo está vazio ou ultrapassa o limite de restauração."});return
                if self.headers.get("Content-Type","").split(";",1)[0].strip()!="application/zip":
                    self.send_json(415,{"error":"Selecione um arquivo ZIP de backup do D’ALEX."});return
                temp_path=None
                try:
                    with tempfile.NamedTemporaryFile(prefix="dalex-upload-",suffix=".zip",dir=DATA.parent,delete=False) as temp:
                        temp_path=Path(temp.name);remaining=length
                        while remaining:
                            chunk=self.rfile.read(min(1024*1024,remaining))
                            if not chunk:raise StoreError("O arquivo enviado foi interrompido.")
                            temp.write(chunk);remaining-=len(chunk)
                    create_backup(DB,STORE_ROOT,STORE_ROOT/"Backups")
                    restore_backup(DB,STORE_ROOT,temp_path)
                    SESSIONS.clear()
                    self.send_json(200,{"restored":True,"message":"Backup restaurado. Entre novamente para continuar."})
                except StoreError as error:self.send_json(400,{"error":str(error)})
                except Exception:self.send_json(500,{"error":"Falha ao restaurar. Os dados anteriores foram preservados."})
                finally:
                    if temp_path:temp_path.unlink(missing_ok=True)
                return
            self.send_json(404, {"error": "Operação local não encontrada."})
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "O e-mail já está cadastrado ou há vínculos inválidos."})
        except StoreError as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(500, {"error": "Não foi possível concluir a operação local."})

    def import_history(self, *, preview: bool):
        session = self.require_user(admin=True, csrf=True)
        if not session:
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_UPLOAD:
            self.send_json(413, {"error": "Selecione um arquivo .xlsx de até 5 MB."})
            return
        if self.headers.get_content_type() != XLSX:
            self.send_json(415, {"error": "Selecione uma planilha .xlsx do D’ALEX."})
            return
        content = self.rfile.read(length)
        if len(content) != length:
            raise StoreError("O envio da planilha foi interrompido. Tente novamente.")
        revision = DB.revision()
        token = f"{revision}-{hashlib.sha256(content).hexdigest()}"
        supplied_token = parse_qs(urlparse(self.path).query).get("preview", [""])[0]
        if not preview and supplied_token != token:
            self.send_json(409, {"error": "A planilha ou os dados mudaram. Valide o arquivo novamente."})
            return
        actor = {**session["user"], "source": "authenticated"}
        state, counts = HistoryImport(DB.load(), read_workbook(content), actor).run()
        try:
            saved_revision = DB.save(state, revision, actor, dry_run=preview)
        except RevisionConflict as error:
            self.send_json(409, {"error": str(error)})
            return
        except sqlite3.IntegrityError as error:
            raise StoreError("Há registros repetidos ou vínculos inválidos na planilha. Nenhum dado foi importado.") from error
        if preview:
            self.send_json(200, {"counts": counts, "token": token})
        else:
            self.send_json(201, {"counts": counts, "revision": saved_revision, "state": state})

    def do_PUT(self):
        if not self.check_origin():
            return
        session = self.require_user(csrf=True)
        if not session:
            return
        path = urlparse(self.path).path
        if path.startswith("/api/users/"):
            if session["user"]["role"] != "Administrador":
                self.send_json(403, {"error":"Esta ação exige perfil Administrador."})
                return
            user_id = path.rsplit("/",1)[-1]
            try:
                data=self.body()
                with DB.connect() as db:
                    old=db.execute("SELECT * FROM users WHERE id=?",(user_id,)).fetchone()
                    if not old:
                        self.send_json(404,{"error":"Usuário não encontrado."})
                        return
                    name=str(data.get("name",old["name"])).strip()
                    email=str(data.get("email",old["email"])).strip().lower()
                    role=str(data.get("role",old["role"]))
                    active=bool(data.get("active",old["active"]))
                    password=data.get("password","")
                    if not name or "@" not in email or role not in ("Administrador","Operação","Consulta"):
                        raise StoreError("Informe nome, e-mail e perfil válidos.")
                    if not active and user_id==session["user"]["id"]:
                        raise StoreError("Entre com outra conta de administrador antes de desativar esta conta.")
                    if not active and old["role"]=="Administrador" and old["active"]:
                        admins=db.execute("SELECT COUNT(*) FROM users WHERE active=1 AND role='Administrador'").fetchone()[0]
                        if admins<=1:
                            raise StoreError("Mantenha pelo menos um administrador ativo.")
                    if password and (not isinstance(password,str) or len(password)<12):
                        raise StoreError("A nova senha deve ter pelo menos 12 caracteres.")
                    if password:
                        db.execute("UPDATE users SET name=?,email=?,role=?,active=?,password_hash=? WHERE id=?",(name,email,role,int(active),password_hash(password),user_id))
                    else:
                        db.execute("UPDATE users SET name=?,email=?,role=?,active=? WHERE id=?",(name,email,role,int(active),user_id))
                    after={"id":user_id,"name":name,"email":email,"role":role,"active":active}
                    event={"id":uuid.uuid4().hex,"at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"actorId":session["user"]["id"],"targetUserId":user_id,"action":"Acesso de usuário atualizado","before":{"id":old["id"],"name":old["name"],"email":old["email"],"role":old["role"],"active":bool(old["active"])},"after":after}
                    db.execute("INSERT INTO security_events VALUES(?,?,?,?,?,?)",(event["id"],event["at"],event["actorId"],user_id,event["action"],DB.encode(event)))
                for token,live in list(SESSIONS.items()):
                    if live["user"]["id"]==user_id and (not active or role!=live["user"]["role"]):
                        SESSIONS.pop(token,None)
                self.send_json(200,{"users":DB.load()["users"]})
            except sqlite3.IntegrityError:
                self.send_json(409,{"error":"Este e-mail já está cadastrado."})
            except StoreError as error:
                self.send_json(400,{"error":str(error)})
            return
        if path != "/api/state":
            self.send_json(404, {"error": "Operação local não encontrada."})
            return
        try:
            data = self.body()
            state = data.get("state")
            if not isinstance(state, dict):
                raise StoreError("Dados do D’ALEX inválidos.")
            current = DB.load()
            if session["user"]["role"] == "Consulta":
                self.send_json(HTTPStatus.FORBIDDEN,{"error":"O perfil Consulta tem acesso somente para leitura."})
                return
            if session["user"]["role"] != "Administrador":
                # Keep finance and administrator-managed lists on the server.
                state["invoices"] = current["invoices"]
                state["receipts"] = current["receipts"]
                state["employees"] = current["employees"]
                state["attendance"] = current["attendance"]
                state["employeePayments"] = current["employeePayments"]
                state["workshopPayments"] = current["workshopPayments"]
                if "balanceExpenses" in state and state["balanceExpenses"] != []:
                    raise StoreError("Somente o Administrador pode alterar despesas do balanço.")
                state["balanceExpenses"] = current["balanceExpenses"]
                state["users"] = current["users"]
                state["clients"] = current["clients"]
                state["workshops"] = current["workshops"]
                for record in state.get("records", []):
                    old = next((r for r in current["records"] if r["id"] == record["id"]), None)
                    if old:
                        record["pricing"] = old.get("pricing", [])
                        record["invoiceId"] = old.get("invoiceId")
                old_audit_ids = {event["id"] for event in current["audit"]}
                state["audit"] = current["audit"] + [event for event in state.get("audit", []) if event.get("id") not in old_audit_ids]
            old_audit_ids = {event["id"] for event in current["audit"]}
            for event in state.get("audit", []):
                if event.get("id") not in old_audit_ids:
                    event["actor"]={**session["user"],"source":"authenticated"}
            validate_state_transition(current,state,session["user"]["role"])
            expected_revision = int(data.get("revision", -1))
            if expected_revision != DB.revision():
                raise RevisionConflict("Os dados foram alterados em outra janela. Atualize antes de salvar novamente.")
            if session["user"]["role"] == "Administrador" and any(
                {row["id"] for row in current[key]} - {row["id"] for row in state[key]}
                for key in ("invoices", "records", "receipts", "employeePayments", "workshopPayments")
            ):
                create_backup(DB, STORE_ROOT, STORE_ROOT / "Backups")
            revision = DB.save(state, expected_revision, session["user"])
            self.send_json(200, {"revision": revision})
        except RevisionConflict as error:
            self.send_json(409, {"error": str(error), "revision": DB.revision()})
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "A operação violaria um vínculo ou regra do banco. Nada foi alterado."})
        except (StoreError, TypeError, KeyError, ValueError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(500, {"error": "Falha ao salvar. A transação foi desfeita; os dados anteriores foram preservados."})

    def do_OPTIONS(self):
        self.send_json(405, {"error": "Solicitação não permitida."})


import sqlite3  # Keep the HTTP layer independent from third-party packages.


def serve():
    if not WEB.joinpath("index.html").is_file():
        raise RuntimeError("A interface não foi compilada. Execute INSTALAR_DEPENDENCIAS.bat primeiro.")
    DATA.mkdir(parents=True, exist_ok=True)
    (STORE_ROOT / "Anexos" / "Romaneios").mkdir(parents=True, exist_ok=True)
    (STORE_ROOT / "Anexos" / "Documentos").mkdir(parents=True, exist_ok=True)
    (STORE_ROOT / "Backups").mkdir(parents=True, exist_ok=True)
    (STORE_ROOT / "Configuracoes").mkdir(parents=True, exist_ok=True)
    try:
        result=maybe_daily_backup(DB,STORE_ROOT,STORE_ROOT/"Backups")
        if result:print(f"Backup local automático criado: {result.name}")
    except Exception as error:
        print(f"Aviso: não foi possível criar o backup automático de hoje: {error}")
    def backup_watch():
        while True:
            time.sleep(6*60*60)
            try:
                result=maybe_daily_backup(DB,STORE_ROOT,STORE_ROOT/"Backups")
                if result:print(f"Backup local automático criado: {result.name}")
            except Exception as error:
                print(f"Aviso: não foi possível criar o backup automático: {error}")
    threading.Thread(target=backup_watch,name="dalex-backup-watch",daemon=True).start()
    # This offline, single-computer app serializes requests. In particular,
    # a restore cannot race a second local request while SQLite is replaced.
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    return server

