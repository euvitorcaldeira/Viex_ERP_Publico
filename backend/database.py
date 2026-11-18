"""Portable SQLite storage for the local D'ALEX application.

The existing V4 domain model remains the source of the application rules. This
module stores its records in relational tables, with JSON snapshots on parent
rows to retain the approved UI's full model during the staged migration.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 2


def add_balance_expenses(db: sqlite3.Connection) -> None:
    db.execute("""
        CREATE TABLE balance_expenses (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
            reversed_at TEXT,
            payload TEXT NOT NULL
        )
    """)
    db.execute("CREATE INDEX ix_balance_expenses_date ON balance_expenses(date)")


MIGRATIONS = {2: add_balance_expenses}


def empty_state() -> dict[str, Any]:
    return {
        "version": 4, "records": [], "invoices": [], "receipts": [],
        "employees": [], "attendance": [], "employeePayments": [],
        "workshops": [], "workshopPayments": [], "balanceExpenses": [], "audit": [],
        "clients": [], "users": [],
        "internalWorkshopName": "D’ALEX",
        "systemDisplayName": "D’ALEX",
        "invoiceSummaryPaymentText": "PIX 42655411862",
    }


class StoreError(ValueError):
    pass


class RevisionConflict(StoreError):
    pass


class Store:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY, value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL
                );
                INSERT OR IGNORE INTO metadata(key,value) VALUES('revision','0');
                CREATE TABLE IF NOT EXISTS clients (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    active INTEGER NOT NULL CHECK(active IN (0,1)), payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workshops (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    active INTEGER NOT NULL CHECK(active IN (0,1)), payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS employees (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)),
                    daily_cents INTEGER NOT NULL CHECK(daily_cents >= 0), payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS records (
                    id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id),
                    stage TEXT NOT NULL CHECK(stage IN ('Em fila','Em produção','Concluído')),
                    received_on TEXT, execution_kind TEXT, workshop_id TEXT REFERENCES workshops(id),
                    payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS record_items (
                    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
                    position INTEGER NOT NULL, code TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity >= 0),
                    payload TEXT NOT NULL, PRIMARY KEY(record_id,position)
                );
                CREATE TABLE IF NOT EXISTS pricing (
                    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
                    code TEXT NOT NULL, client_cents INTEGER NOT NULL CHECK(client_cents >= 0),
                    kind TEXT NOT NULL CHECK(kind IN ('Interna','Terceirizada')),
                    workshop_id TEXT REFERENCES workshops(id), workshop_cents INTEGER NOT NULL CHECK(workshop_cents >= 0),
                    PRIMARY KEY(record_id,code)
                );
                CREATE TABLE IF NOT EXISTS invoices (
                    id TEXT PRIMARY KEY, number TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    client TEXT NOT NULL, issue_date TEXT NOT NULL,
                    total_cents INTEGER NOT NULL CHECK(total_cents >= 0), payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS invoice_records (
                    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                    record_id TEXT NOT NULL UNIQUE REFERENCES records(id), position INTEGER NOT NULL,
                    PRIMARY KEY(invoice_id,position)
                );
                CREATE TABLE IF NOT EXISTS invoice_lines (
                    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                    position INTEGER NOT NULL, record_id TEXT NOT NULL REFERENCES records(id),
                    code TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity >= 0),
                    unit_cents INTEGER NOT NULL CHECK(unit_cents >= 0), payload TEXT NOT NULL,
                    PRIMARY KEY(invoice_id,position)
                );
                CREATE TABLE IF NOT EXISTS installments (
                    id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                    position INTEGER NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
                    due_date TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL, UNIQUE(invoice_id,position)
                );
                CREATE TABLE IF NOT EXISTS receipts (
                    id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id),
                    installment_id TEXT NOT NULL REFERENCES installments(id), date TEXT NOT NULL,
                    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), reversed_at TEXT, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS attendance (
                    employee_id TEXT NOT NULL REFERENCES employees(id), date TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('Presente','Falta','Não trabalhado')),
                    daily_cents INTEGER NOT NULL CHECK(daily_cents >= 0), payload TEXT NOT NULL,
                    PRIMARY KEY(employee_id,date)
                );
                CREATE TABLE IF NOT EXISTS employee_payments (
                    id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), date TEXT NOT NULL,
                    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), reversed_at TEXT, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workshop_payments (
                    id TEXT PRIMARY KEY, workshop_id TEXT NOT NULL REFERENCES workshops(id), date TEXT NOT NULL,
                    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), reversed_at TEXT, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workshop_payment_allocations (
                    payment_id TEXT NOT NULL REFERENCES workshop_payments(id) ON DELETE CASCADE,
                    record_id TEXT NOT NULL REFERENCES records(id), charge_id TEXT NOT NULL,
                    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
                    PRIMARY KEY(payment_id,charge_id)
                );
                CREATE TABLE IF NOT EXISTS audit (
                    id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, at TEXT NOT NULL,
                    action TEXT NOT NULL, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('Administrador','Operação','Consulta')),
                    active INTEGER NOT NULL CHECK(active IN (0,1)), password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS security_events (
                    id TEXT PRIMARY KEY, at TEXT NOT NULL, actor_id TEXT NOT NULL,
                    target_user_id TEXT NOT NULL, action TEXT NOT NULL, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS attachments (
                    id TEXT PRIMARY KEY, original_name TEXT NOT NULL, mime_type TEXT NOT NULL,
                    relative_path TEXT NOT NULL UNIQUE, size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
                    uploaded_by TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS record_attachments (
                    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
                    attachment_id TEXT NOT NULL REFERENCES attachments(id),
                    position INTEGER NOT NULL, PRIMARY KEY(record_id,position),
                    UNIQUE(record_id,attachment_id)
                );
                CREATE INDEX IF NOT EXISTS ix_records_received ON records(received_on);
                CREATE INDEX IF NOT EXISTS ix_receipts_date ON receipts(date);
                CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit(entity_id,at);
            """)
            db.execute("BEGIN IMMEDIATE")
            db.execute("INSERT OR IGNORE INTO metadata(key,value) VALUES('schema_version','1')")
            version = db.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()[0]
            if int(version) > SCHEMA_VERSION:
                raise StoreError("Este banco foi criado por uma versão mais nova do D’ALEX.")
            db.execute("INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(?,datetime('now'))",(int(version),))
            for next_version in range(int(version)+1,SCHEMA_VERSION+1):
                migration=MIGRATIONS.get(next_version)
                if migration is None:
                    raise StoreError(f"Não há migração definida para a versão {next_version} do banco.")
                migration(db)
                db.execute("UPDATE metadata SET value=? WHERE key='schema_version'",(str(next_version),))
                db.execute("INSERT INTO schema_migrations(version,applied_at) VALUES(?,datetime('now'))",(next_version,))

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA busy_timeout=15000")
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def encode(value: Any) -> str:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

    @staticmethod
    def decode(value: str) -> Any:
        return json.loads(value)

    def revision(self) -> int:
        with self.connect() as db:
            return int(db.execute("SELECT value FROM metadata WHERE key='revision'").fetchone()[0])

    def load(self) -> dict[str, Any]:
        with self.connect() as db:
            state = empty_state()
            tables = {
                "clients": "clients", "workshops": "workshops", "employees": "employees",
                "records": "records", "invoices": "invoices", "receipts": "receipts",
                "attendance": "attendance", "employee_payments": "employeePayments",
                "workshop_payments": "workshopPayments", "balance_expenses": "balanceExpenses", "audit": "audit",
            }
            for table, key in tables.items():
                state[key] = [self.decode(row[0]) for row in db.execute(f"SELECT payload FROM {table}")]
            internal_name = db.execute("SELECT value FROM metadata WHERE key='internal_workshop_name'").fetchone()
            state["internalWorkshopName"] = internal_name[0] if internal_name else "D’ALEX"
            system_name = db.execute("SELECT value FROM metadata WHERE key='system_display_name'").fetchone()
            state["systemDisplayName"] = system_name[0] if system_name else "D’ALEX"
            payment_text = db.execute("SELECT value FROM metadata WHERE key='invoice_summary_payment_text'").fetchone()
            state["invoiceSummaryPaymentText"] = payment_text[0] if payment_text else "PIX 42655411862"
            state["users"] = [{"id": r["id"], "name": r["name"], "email": r["email"],
                               "role": r["role"], "active": bool(r["active"])}
                              for r in db.execute("SELECT id,name,email,role,active FROM users ORDER BY name")]
            return state

    @staticmethod
    def _require(condition: bool, message: str) -> None:
        if not condition:
            raise StoreError(message)

    @staticmethod
    def _valid_date(value: Any) -> bool:
        if not isinstance(value,str) or not value:return False
        try:return date.fromisoformat(value).isoformat()==value
        except ValueError:return False

    @classmethod
    def balance_expenses_by_id(cls, rows: Any) -> dict[str, dict[str, Any]]:
        cls._require(isinstance(rows, list), "A lista de despesas está inválida.")
        result = {}
        today = date.today().isoformat()
        for row in rows:
            cls._require(isinstance(row, dict), "Despesa inválida.")
            for field, maximum in (("id", 100), ("category", 80), ("description", 200)):
                value = row.get(field)
                cls._require(isinstance(value, str) and value.strip() and len(value) <= maximum,
                             "Informe identificação, categoria e descrição válidas para a despesa.")
            for field, maximum in (("supplier", 120), ("note", 1000)):
                value = row.get(field, "")
                cls._require(isinstance(value, str) and len(value) <= maximum,
                             "Fornecedor ou observação da despesa inválidos.")
            day = row.get("date")
            cls._require(cls._valid_date(day) and day <= today,
                         "Informe uma data válida de pagamento até hoje.")
            amount = row.get("amountCents")
            cls._require(type(amount) is int and 0 < amount <= 9_007_199_254_740_991,
                         "Informe um valor de despesa válido e maior que zero.")
            reversed_at = row.get("reversedAt")
            if reversed_at is not None:
                try:
                    timestamp = datetime.fromisoformat(reversed_at)
                except (TypeError, ValueError):
                    raise StoreError("A data do estorno da despesa está inválida.") from None
                cls._require("T" in reversed_at and timestamp.tzinfo is not None,
                             "A data do estorno da despesa está inválida.")
            cls._require(row["id"] not in result, "Há despesas repetidas.")
            result[row["id"]] = row
        return result

    def save(self, state: dict[str, Any], expected_revision: int, actor: dict[str, Any], *, dry_run: bool = False) -> int:
        self._require(state.get("version") == 4, "Versão de dados inválida.")
        internal_name=state.get("internalWorkshopName", "D’ALEX")
        self._require(isinstance(internal_name,str) and 0<len(internal_name.strip())<=48, "Nome da oficina interna inválido.")
        system_name=state.get("systemDisplayName", "D’ALEX")
        self._require(isinstance(system_name,str) and 0<len(system_name.strip())<=48, "Nome de exibição do sistema inválido.")
        payment_text=state.get("invoiceSummaryPaymentText", "PIX 42655411862")
        self._require(isinstance(payment_text,str) and len(payment_text.strip())<=120, "Complemento do resumo da NF inválido.")
        keys = ("clients","workshops","employees","records","invoices","receipts","attendance",
                "employeePayments","workshopPayments","audit")
        for key in keys:
            self._require(isinstance(state.get(key), list), f"A coleção {key} está inválida.")
        balance_expenses = self.balance_expenses_by_id(state["balanceExpenses"]) if "balanceExpenses" in state else None
        client_ids = {c.get("id") for c in state["clients"]}
        workshop_ids = {w.get("id") for w in state["workshops"]}
        employee_ids = {e.get("id") for e in state["employees"]}
        record_ids = {r.get("id") for r in state["records"]}
        invoice_ids = {i.get("id") for i in state["invoices"]}
        invoice_by_id = {i["id"]: i for i in state["invoices"]}
        installments = {p.get("id"): (invoice["id"], p) for invoice in state["invoices"] for p in invoice.get("installments", [])}
        self._require(len(record_ids) == len(state["records"]), "Há códigos de romaneio repetidos.")
        self._require(len(invoice_ids) == len(state["invoices"]), "Há notas fiscais com identificadores repetidos.")
        numbers = [i.get("number", "").strip().casefold() for i in state["invoices"]]
        self._require(all(numbers) and len(set(numbers)) == len(numbers), "O número da NF está vazio ou duplicado.")
        for record in state["records"]:
            self._require(record.get("clientId") in client_ids, f"Cliente inválido no romaneio {record.get('id')}.")
            self._require(record.get("stage") in ("Em fila","Em produção","Concluído"), "Etapa de produção inválida.")
            self._require(record.get("receivedOn") in (None,"") or self._valid_date(record.get("receivedOn")), "Data de recebimento inválida.")
            execution = record.get("execution") or {}
            self._require(execution.get("kind") in (None,"Interna","Terceirizada","Mista"), "Tipo de produção inválido.")
            if execution.get("kind") == "Terceirizada":
                self._require(execution.get("workshopId") in workshop_ids, "Oficina inválida no romaneio.")
            self._require(isinstance(record.get("items",[]),list), "Os itens do romaneio estão inválidos.")
            for item in record.get("items",[]):
                self._require(isinstance(item.get("code"),str) and item["code"].strip(), "Código de produto inválido.")
                self._require(isinstance(item.get("sizes",[]),list), "A grade de tamanhos está inválida.")
                for size in item.get("sizes",[]):
                    quantity=size.get("quantity")
                    self._require(type(quantity) is int and quantity>=0, "Quantidade por tamanho inválida.")
            for price in record.get("pricing", []):
                self._require(type(price.get("clientCents")) is int and price["clientCents"] >= 0, "Preço do cliente inválido.")
                self._require(type(price.get("workshopCents")) is int and price["workshopCents"] >= 0, "Custo da oficina inválido.")
                self._require(price.get("kind") in ("Interna","Terceirizada"), "Tipo de preço inválido.")
                if price["kind"]=="Terceirizada":self._require(price.get("workshopId") in workshop_ids, "Oficina inválida no preço da produção.")
        billed_records: list[str] = []
        for invoice in state["invoices"]:
            self._require(type(invoice.get("totalCents")) is int and invoice["totalCents"] >= 0, "Total de NF inválido.")
            self._require(self._valid_date(invoice.get("issueDate")), "Data de emissão da NF inválida.")
            self._require(isinstance(invoice.get("recordIds"),list) and isinstance(invoice.get("lines"),list), "O conteúdo da NF está inválido.")
            for record_id in invoice.get("recordIds", []):
                self._require(record_id in record_ids, "A NF contém romaneio inexistente.")
                self._require(next(r for r in state["records"] if r["id"]==record_id).get("invoiceId")==invoice["id"], "O vínculo entre a NF e o romaneio não corresponde.")
                billed_records.append(record_id)
            line_total=0
            for line in invoice.get("lines", []):
                self._require(type(line.get("unitCents")) is int and type(line.get("quantity")) is int and line["unitCents"] >= 0 and line["quantity"] >= 0, "Snapshot de faturamento inválido.")
                self._require(line.get("romaneioId") in invoice.get("recordIds",[]) and isinstance(line.get("code"),str), "Uma linha da NF não corresponde aos romaneios faturados.")
                line_total+=line["unitCents"]*line["quantity"]
            self._require(line_total==invoice["totalCents"], "O total da NF não corresponde às linhas faturadas.")
            self._require(isinstance(invoice.get("installments"),list) and len(invoice["installments"])>0, "A NF precisa ter ao menos uma parcela.")
            self._require(sum((part.get("amountCents",-1) if type(part.get("amountCents")) is int else -1) for part in invoice["installments"])==invoice["totalCents"], "As parcelas não totalizam o valor da NF.")
            for part in invoice["installments"]:
                due_date=part.get("dueDate") or ""
                self._require(type(part.get("amountCents")) is int and part["amountCents"]>=0, "Valor da parcela inválido.")
                self._require(not due_date or (self._valid_date(due_date) and due_date>=invoice["issueDate"]), "Previsão da parcela inválida.")
            tax_rate=invoice.get("taxRateBps",0)
            tax_cents=invoice.get("taxCents",(invoice["totalCents"]*tax_rate+5000)//10000 if type(tax_rate) is int else -1)
            tax_due_date=invoice.get("taxDueDate") or ""
            tax_paid_at=invoice.get("taxPaidAt") or ""
            tax_exempt=invoice.get("taxExempt",False)
            self._require(type(tax_rate) is int and 0<=tax_rate<=10000, "Alíquota de imposto inválida.")
            self._require(type(tax_exempt) is bool, "Situação de isenção de imposto inválida.")
            self._require(not tax_exempt or (tax_rate==0 and tax_cents==0 and not tax_due_date and not tax_paid_at), "NF isenta não pode manter alíquota, valor, previsão ou pagamento de imposto.")
            self._require(type(tax_cents) is int and tax_cents==(invoice["totalCents"]*tax_rate+5000)//10000, "Valor de imposto não corresponde à alíquota e à NF.")
            self._require(not tax_due_date or (self._valid_date(tax_due_date) and tax_due_date>=invoice["issueDate"]), "Previsão de pagamento do imposto inválida.")
            self._require(not tax_paid_at or (self._valid_date(tax_paid_at) and tax_paid_at>=invoice["issueDate"]), "Data de pagamento do imposto inválida.")
        for record in state["records"]:
            invoice_id=record.get("invoiceId")
            self._require(not invoice_id or (invoice_id in invoice_by_id and record["id"] in invoice_by_id[invoice_id].get("recordIds",[])), "Romaneio vinculado a uma NF inexistente.")
        self._require(len(billed_records) == len(set(billed_records)), "Um romaneio não pode ser faturado mais de uma vez.")
        paid_by_part: dict[str, int] = {}
        for receipt in state["receipts"]:
            self._require(receipt.get("invoiceId") in invoice_ids, "Recebimento sem NF válida.")
            part = installments.get(receipt.get("installmentId"))
            self._require(part is not None and part[0] == receipt.get("invoiceId"), "Recebimento sem parcela válida.")
            self._require(type(receipt.get("amountCents")) is int and receipt["amountCents"] > 0, "Valor de recebimento inválido.")
            self._require(self._valid_date(receipt.get("date")) and receipt["date"]>=invoice_by_id[receipt["invoiceId"]]["issueDate"], "Data de recebimento inválida.")
            if not receipt.get("reversedAt"):
                pid = receipt["installmentId"]
                paid_by_part[pid] = paid_by_part.get(pid, 0) + receipt["amountCents"]
        for pid, total in paid_by_part.items():
            self._require(total <= installments[pid][1].get("amountCents", -1), "Recebimentos ultrapassam o valor da parcela.")
        for row in state["attendance"]:
            self._require(row.get("employeeId") in employee_ids, "Frequência sem funcionário válido.")
            self._require(self._valid_date(row.get("date")) and row.get("status") in ("Presente","Falta","Não trabalhado"), "Registro de frequência inválido.")
            self._require(type(row.get("dailyCents")) is int and row["dailyCents"]>=0, "Diária histórica inválida.")
            overtime=row.get("overtimeCents",0);deduction=row.get("earlyDepartureDeductionCents",0)
            self._require(type(overtime) is int and overtime>=0 and type(deduction) is int and deduction>=0, "Acréscimo ou desconto da frequência inválido.")
            self._require(row.get("status")=="Presente" or (overtime==0 and deduction==0), "Só presenças podem ter acréscimos ou descontos.")
            self._require(deduction<=row["dailyCents"]+overtime, "O desconto ultrapassa a diária e as horas extras.")
        for payment in state["employeePayments"]:
            self._require(payment.get("employeeId") in employee_ids, "Pagamento sem funcionário válido.")
            self._require(type(payment.get("amountCents")) is int and payment["amountCents"] > 0, "Valor de pagamento inválido.")
            self._require(self._valid_date(payment.get("date")), "Data de pagamento de funcionário inválida.")
        workshop_charges={}
        for record in state["records"]:
            if record.get("stage")!="Concluído":continue
            quantities={}
            for item in record.get("items",[]):
                code=item["code"].strip().casefold()
                quantities[code]=quantities.get(code,0)+sum(size["quantity"] for size in item.get("sizes",[]))
            for price in record.get("pricing",[]):
                if price["kind"]!="Terceirizada":continue
                code=price["code"].strip().casefold()
                workshop_charges[f"{record['id']}|{price['code']}|{price['workshopId']}"]=(price["workshopId"],quantities.get(code,0)*price["workshopCents"])
        paid_by_charge={}
        for payment in state["workshopPayments"]:
            self._require(payment.get("workshopId") in workshop_ids, "Pagamento sem oficina válida.")
            self._require(type(payment.get("amountCents")) is int and payment["amountCents"] > 0, "Valor de pagamento inválido.")
            self._require(self._valid_date(payment.get("date")) and isinstance(payment.get("allocations"),list), "Pagamento de oficina inválido.")
            allocated=0
            for allocation in payment.get("allocations", []):
                charge_id=allocation.get("chargeId","")
                record_id=charge_id.split("|",1)[0]
                self._require(record_id in record_ids, "Alocação histórica de oficina sem romaneio válido.")
                if not payment.get("reversedAt"):
                    self._require(charge_id in workshop_charges and workshop_charges[charge_id][0]==payment["workshopId"], "Alocação de oficina sem produção válida.")
                self._require(type(allocation.get("amountCents")) is int and allocation["amountCents"]>0, "Valor alocado à oficina inválido.")
                allocated+=allocation["amountCents"]
                if not payment.get("reversedAt"):
                    paid_by_charge[charge_id]=paid_by_charge.get(charge_id,0)+allocation["amountCents"]
                    self._require(paid_by_charge[charge_id]<=workshop_charges[charge_id][1], "Pagamentos ultrapassam o saldo da oficina.")
            self._require(allocated==payment["amountCents"], "O total alocado não corresponde ao pagamento da oficina.")

        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            current = int(db.execute("SELECT value FROM metadata WHERE key='revision'").fetchone()[0])
            if current != expected_revision:
                raise RevisionConflict("Os dados foram alterados em outra janela. Atualize antes de salvar novamente.")
            if balance_expenses is not None:
                current_expenses = {row[0]: self.decode(row[1]) for row in db.execute("SELECT id,payload FROM balance_expenses")}
                self._require(not (current_expenses.keys() - balance_expenses.keys()),
                              "Despesas registradas não podem ser excluídas. Use Estornar.")
                self._require(balance_expenses == current_expenses or actor.get("role") == "Administrador",
                              "Somente o Administrador pode alterar despesas do balanço.")
                for expense_id, expense in balance_expenses.items():
                    if expense == current_expenses.get(expense_id):
                        continue
                    db.execute("""INSERT INTO balance_expenses(id,date,category,amount_cents,reversed_at,payload)
                                  VALUES(?,?,?,?,?,?)
                                  ON CONFLICT(id) DO UPDATE SET date=excluded.date, category=excluded.category,
                                  amount_cents=excluded.amount_cents, reversed_at=excluded.reversed_at, payload=excluded.payload""",
                               (expense_id, expense["date"], expense["category"], expense["amountCents"],
                                expense.get("reversedAt"), self.encode(expense)))
            existing_links = {(row[0], row[1]) for row in db.execute("SELECT record_id,attachment_id FROM record_attachments")}
            for record in state["records"]:
                for entry in record.get("attachments", []):
                    if not isinstance(entry, str) or "|" not in entry:
                        continue  # Older local records may contain a display-only filename.
                    attachment_id = entry.split("|", 1)[0]
                    if not db.execute("SELECT 1 FROM attachments WHERE id=?", (attachment_id,)).fetchone():
                        raise StoreError("Um anexo selecionado não foi enviado para o armazenamento local.")
                    owner = db.execute("SELECT uploaded_by FROM attachments WHERE id=?", (attachment_id,)).fetchone()[0]
                    if owner != actor.get("id") and (record["id"], attachment_id) not in existing_links:
                        raise StoreError("Este usuário não pode vincular o anexo selecionado.")
            # Deleting and rebuilding the relational projection happens in one
            # transaction, so any failed FK/check leaves the previous version intact.
            for table in ("record_attachments","audit","receipts","installments","invoice_lines","invoice_records","invoices",
                          "record_items","pricing","attendance","employee_payments",
                          "workshop_payment_allocations","workshop_payments","records","employees","workshops","clients"):
                db.execute(f"DELETE FROM {table}")
            for c in state["clients"]:
                db.execute("INSERT INTO clients VALUES(?,?,?,?)", (c["id"],c["name"],int(c.get("active",True)),self.encode(c)))
            for w in state["workshops"]:
                db.execute("INSERT INTO workshops VALUES(?,?,?,?)", (w["id"],w["name"],int(w.get("active",True)),self.encode(w)))
            for e in state["employees"]:
                cents=e.get("dailyCents",0)
                self._require(type(cents) is int and cents >= 0, "Diária inválida.")
                db.execute("INSERT INTO employees VALUES(?,?,?,?,?)", (e["id"],e["name"],int(e.get("active",True)),cents,self.encode(e)))
            for r in state["records"]:
                ex=r.get("execution") or {}
                db.execute("INSERT INTO records VALUES(?,?,?,?,?,?,?)",(r["id"],r["clientId"],r["stage"],r.get("receivedOn"),ex.get("kind"),ex.get("workshopId"),self.encode(r)))
                for pos,item in enumerate(r.get("items",[])):
                    qty=sum(size.get("quantity",0) for size in item.get("sizes",[]))
                    db.execute("INSERT INTO record_items VALUES(?,?,?,?,?)",(r["id"],pos,item.get("code",""),int(qty),self.encode(item)))
                for p in r.get("pricing",[]):
                    db.execute("INSERT INTO pricing VALUES(?,?,?,?,?,?)",(r["id"],p["code"],p["clientCents"],p["kind"],p.get("workshopId"),p["workshopCents"]))
                for position, entry in enumerate(r.get("attachments", [])):
                    if isinstance(entry, str) and "|" in entry:
                        attachment_id = entry.split("|", 1)[0]
                        db.execute("INSERT INTO record_attachments VALUES(?,?,?)", (r["id"], attachment_id, position))
            for inv in state["invoices"]:
                db.execute("INSERT INTO invoices VALUES(?,?,?,?,?,?)",(inv["id"],inv["number"],inv["client"],inv["issueDate"],inv["totalCents"],self.encode(inv)))
                for pos,rid in enumerate(inv.get("recordIds",[])):
                    db.execute("INSERT INTO invoice_records VALUES(?,?,?)",(inv["id"],rid,pos))
                for pos,line in enumerate(inv.get("lines",[])):
                    db.execute("INSERT INTO invoice_lines VALUES(?,?,?,?,?,?,?)",(inv["id"],pos,line["romaneioId"],line["code"],line["quantity"],line["unitCents"],self.encode(line)))
                for pos,part in enumerate(inv.get("installments",[])):
                    db.execute("INSERT INTO installments VALUES(?,?,?,?,?,?)",(part["id"],inv["id"],pos,part["amountCents"],part.get("dueDate") or "",self.encode(part)))
            for rec in state["receipts"]:
                db.execute("INSERT INTO receipts VALUES(?,?,?,?,?,?,?)",(rec["id"],rec["invoiceId"],rec["installmentId"],rec["date"],rec["amountCents"],rec.get("reversedAt"),self.encode(rec)))
            for row in state["attendance"]:
                db.execute("INSERT INTO attendance VALUES(?,?,?,?,?)",(row["employeeId"],row["date"],row["status"],row["dailyCents"],self.encode(row)))
            for payment in state["employeePayments"]:
                db.execute("INSERT INTO employee_payments VALUES(?,?,?,?,?,?)",(payment["id"],payment["employeeId"],payment["date"],payment["amountCents"],payment.get("reversedAt"),self.encode(payment)))
            for payment in state["workshopPayments"]:
                db.execute("INSERT INTO workshop_payments VALUES(?,?,?,?,?,?)",(payment["id"],payment["workshopId"],payment["date"],payment["amountCents"],payment.get("reversedAt"),self.encode(payment)))
                for allocation in payment.get("allocations",[]):
                    rid=allocation["chargeId"].split("|",1)[0]
                    db.execute("INSERT INTO workshop_payment_allocations VALUES(?,?,?,?)",(payment["id"],rid,allocation["chargeId"],allocation["amountCents"]))
            for event in state["audit"]:
                db.execute("INSERT INTO audit VALUES(?,?,?,?,?)",(event["id"],event["entityId"],event["at"],event["action"],self.encode(event)))
            if dry_run:
                db.rollback()
                return current
            new_revision=current+1
            db.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('internal_workshop_name',?)",(internal_name.strip(),))
            db.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('system_display_name',?)",(system_name.strip(),))
            db.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('invoice_summary_payment_text',?)",(payment_text.strip(),))
            db.execute("UPDATE metadata SET value=? WHERE key='revision'",(str(new_revision),))
            return new_revision

