"""Historical Excel template and additive import."""
from collections import defaultdict
from datetime import date, datetime, time, timezone
from decimal import Decimal, InvalidOperation
from io import BytesIO
from uuid import uuid4
from zipfile import ZipFile
import re

from .database import StoreError

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAX_UPLOAD = 5 * 1024 * 1024
SCHEMA = {
    "Clientes": "Nome|Ativo",
    "Oficinas": "Nome|Contato|Pix|Ativo",
    "Funcionários": "Nome|Função|Diária R$|Pix|Ativo",
    "Romaneios": "Referência|Cliente|Pedido do cliente|Recebimento|Etapa|Produção|Oficina|Entrega|Observações|Divergências|NF",
    "Grades": "Romaneio|Item|Código|Descrição|Família|Cor|Grade|Tamanho|Quantidade",
    "Valores": "Romaneio|Código|Unitário cliente R$|Produção|Oficina|Unitário oficina R$",
    "Notas fiscais": "Número|Emissão|Total R$",
    "Parcelas": "NF|Parcela|Vencimento|Valor R$",
    "Recebimentos": "Referência|NF|Parcela|Data|Valor R$|Estorno",
    "Frequência": "Funcionário|Data|Situação|Diária R$|Hora extra R$|Saída antecipada R$|Observação",
    "Pag funcionários": "Referência|Funcionário|Data|Valor R$|Adiantamento|Grupo|Estorno",
    "Pag oficinas": "Referência|Oficina|Data|Valor R$|Estorno",
    "Rateios oficinas": "Pagamento|Romaneio|Código|Valor R$",
}
HEADERS = {sheet: tuple(fields.split("|")) for sheet, fields in SCHEMA.items()}
GUIDE = [
    ("Lotes", "Preencha apenas as abas necessárias, sem alterar os cabeçalhos. Valide antes de confirmar. Pode importar vários meses de uma vez. Limite: 5 MB e 15.000 linhas por arquivo."),
    ("Cadastros", "Cadastre somente nomes que ainda não existem. Em outras abas use o mesmo nome ou o ID do cadastro (ver exportação Excel). Ativo vazio = Sim."),
    ("Romaneios", "Referência única, por exemplo LOTE-2025-001, repetida em Grades e Valores. O aplicativo gera o número ROM. Pedido, entrega, observações, divergências e NF são opcionais."),
    ("Produção", "Etapa: Em fila, Em produção, Concluído. Produção: Interna, Terceirizada, Mista. Oficina é obrigatória para Terceirizada. Na produção Mista, indique a execução de cada código em Valores."),
    ("Grades", "Uma linha por tamanho. Repita o Item para agrupar tamanhos do mesmo modelo e cor. Use outro Item para outra cor. Informe o tamanho e uma quantidade inteira. Cada item precisa de pelo menos uma peça."),
    ("Tipos de grade", "Numérico adulto, Letras, Infantil, Calçados, Personalizada ou Sem grade. Para Sem grade informe Único no tamanho."),
    ("Valores", "Uma linha por código e romaneio. Concluídos exigem valor unitário cliente em todos os códigos. Para Terceirizada informe a oficina e o custo unitário."),
    ("NF e parcelas", "Use o número da NF em Romaneios e Notas fiscais. Consolide apenas romaneios concluídos do mesmo cliente. Total da NF = soma das peças × unitários. Informe parcelas em ordem, a partir de 1. O vencimento pode ficar em branco."),
    ("Impostos", "Notas fiscais históricas importadas começam como isentas. Se alguma NF tiver imposto, configure a alíquota manualmente após a importação."),
    ("Recebimentos", "Uma referência única por lançamento. Use o número da NF e o número da parcela. É possível lançar recebimentos de NFs já cadastradas."),
    ("Frequência", "Presente, Falta ou Não trabalhado. Informe a diária da época. Hora extra, desconto por saída antecipada e observação são opcionais."),
    ("Pag. funcionários", "Uma referência única por pagamento. Adiantamento: Sim ou Não. Grupo é opcional e identifica o fechamento em grupo."),
    ("Pag. oficinas", "Uma referência única por pagamento. Preencha Rateios oficinas com o valor por romaneio e código pago. Use o número ROM ou uma referência de importação. A soma dos rateios deve ser igual ao pagamento."),
    ("Estorno", "Informe a data do estorno somente para movimentos já desfeitos. Esses movimentos são preservados no histórico sem alterar os saldos."),
    ("Formato", "Datas em DD/MM/AAAA ou AAAA-MM-DD. Valores em reais com até duas casas decimais. Cole como valores, sem fórmulas. Mantenha zeros iniciais em colunas de texto."),
    ("Anexos e acessos", "Contas de acesso, senhas e arquivos de anexos ficam fora da importação. Adicione documentos no romaneio após importar."),
]
TEXT_COLUMNS = {"Referência", "Romaneio", "Item", "Código", "NF", "Número", "Tamanho",
                "Pedido do cliente", "Pagamento", "Grupo", "Pix"}


def template_bytes():
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter
    except ImportError as error:
        raise StoreError("Instale as dependências do D’ALEX para usar o Excel.") from error
    workbook = Workbook()
    guide = workbook.active
    guide.title = "Instruções"
    guide.append(("Assunto", "Orientação"))
    guide.column_dimensions["A"].width = 24
    guide.column_dimensions["B"].width = 100
    for row, instruction in enumerate(GUIDE, 2):
        guide.append(instruction)
        guide.cell(row, 2).alignment = Alignment(wrap_text=True, vertical="center")
        guide.row_dimensions[row].height = 42
    for sheet, headers in HEADERS.items():
        tab = workbook.create_sheet(sheet)
        tab.append(headers)
        for index, header in enumerate(headers, 1):
            column = tab.column_dimensions[get_column_letter(index)]
            column.width = max(16, len(header) + 5)
            if header in TEXT_COLUMNS:
                column.number_format = "@"
    for tab in workbook:
        tab.freeze_panes = "A2"
        for cell in tab[1]:
            cell.font = Font(color="FFFFFF", bold=True)
            cell.fill = PatternFill("solid", fgColor="214B3E")
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


class Row:
    def __init__(self, sheet, line, values):
        self.sheet, self.line, self.values = sheet, line, values

    def fail(self, message):
        raise StoreError(f"{self.sheet}, linha {self.line}: {message}")

    def text(self, field, optional=False):
        value = self.values.get(field)
        if value is not None and (isinstance(value, bool) or not isinstance(value, (str, int, float))):
            self.fail(f"Informe {field} como texto.")
        if isinstance(value, float) and value.is_integer():
            value = int(value)
        result = "" if value is None else str(value).strip()
        if len(result) > 4000 or (not result and not optional):
            self.fail(f"Preencha {field} com até 4.000 caracteres.")
        return result

    def choice(self, field, choices):
        value = self.text(field).casefold()
        match = next((choice for choice in choices if choice.casefold() == value), None)
        if match is None:
            self.fail(f"{field} deve ser: {', '.join(choices)}.")
        return match

    def flag(self, field, default=False):
        value = self.values.get(field)
        if value in (None, ""):
            return default
        return value if isinstance(value, bool) else self.choice(field, ("Sim", "Não")) == "Sim"

    def number(self, field, scale=1, default=None, minimum=0, maximum=999_999_999_999):
        value = self.text(field, optional=default is not None)
        if not value:
            return default
        value = value.removeprefix("R$").strip()
        if "," in value:
            if not re.fullmatch(r"[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+", value):
                self.fail(f"Número inválido em {field}.")
            value = value.replace(".", "").replace(",", ".")
        if len(value) > 28 or not re.fullmatch(r"[+-]?\d+(?:\.\d+)?", value):
            self.fail(f"Número inválido em {field}.")
        try:
            result = Decimal(value) * scale
        except InvalidOperation:
            self.fail(f"Número inválido em {field}.")
        if result != result.to_integral_value() or not minimum <= result <= maximum:
            self.fail(f"Confira o valor e as casas decimais de {field}.")
        return int(result)

    def day(self, field, optional=False, actual=True):
        value = self.values.get(field)
        if optional and value in (None, ""):
            return ""
        try:
            if isinstance(value, datetime):
                day = value.date()
            elif isinstance(value, date):
                day = value
            else:
                text = self.text(field)
                day = datetime.strptime(text, "%d/%m/%Y").date() if "/" in text else date.fromisoformat(text)
        except ValueError:
            self.fail(f"Data inválida em {field}.")
        if actual and day > date.today():
            self.fail(f"{field} deve ser uma data até hoje.")
        return day.isoformat()

    def reversal(self, original_day):
        day = self.day("Estorno", optional=True)
        if not day:
            return None
        if day < original_day:
            self.fail("O estorno não pode ser anterior ao movimento.")
        value = self.values["Estorno"]
        moment = value if isinstance(value, datetime) else datetime.combine(date.fromisoformat(day), time(12))
        return moment.astimezone(timezone.utc).isoformat()


def read_workbook(content):
    if not content or len(content) > MAX_UPLOAD:
        raise StoreError("Selecione um arquivo .xlsx de até 5 MB.")
    try:
        from openpyxl import load_workbook
    except ImportError as error:
        raise StoreError("Instale as dependências do D’ALEX para usar o Excel.") from error
    try:
        with ZipFile(BytesIO(content)) as archive:
            members = archive.infolist()
            if len(members) > 256 or sum(item.file_size for item in members) > 40 * 1024 * 1024:
                raise StoreError("A planilha é grande demais. Divida o histórico em lotes.")
        workbook = load_workbook(BytesIO(content), read_only=True, keep_links=False)
        try:
            rows = {sheet: [] for sheet in HEADERS}
            extra = set(workbook.sheetnames) - set(HEADERS) - {"Instruções"}
            if extra:
                raise StoreError(f"Aba desconhecida: {sorted(extra)[0]}. Use o modelo do D’ALEX.")
            total = 0
            for name, headers in HEADERS.items():
                if name not in workbook:
                    continue
                tab = workbook[name]
                if (tab.max_row or 0) > 15001 or (tab.max_column or 0) > len(headers):
                    raise StoreError(f"Aba {name}: há linhas demais ou colunas fora do modelo.")
                tab.reset_dimensions()
                entries = tab.iter_rows()
                if tuple(cell.value for cell in next(entries, ())) != headers:
                    raise StoreError(f"O cabeçalho da aba {name} foi alterado.")
                for line, cells in enumerate(entries, 2):
                    if line > 15001:
                        raise StoreError("Divida a planilha em lotes de até 15.000 linhas.")
                    values = [cell.value for cell in cells]
                    if not any(value is not None for value in values):
                        continue
                    row = Row(name, line, dict(zip(headers, values)))
                    if any(value is not None for value in values[len(headers):]):
                        row.fail("Há conteúdo fora das colunas do modelo.")
                    if any(cell.data_type in ("f", "e") for cell in cells):
                        row.fail("Substitua fórmulas e células com erro por valores.")
                    total += 1
                    if total > 15000:
                        raise StoreError("Divida a planilha em lotes de até 15.000 linhas.")
                    rows[name].append(row)
            return rows
        finally:
            workbook.close()
    except StoreError:
        raise
    except Exception as error:
        raise StoreError("Não foi possível ler a planilha. Use o modelo .xlsx do D’ALEX.") from error


def new_id():
    return uuid4().hex


class HistoryImport:
    def __init__(self, state, rows, actor):
        self.state = {key: list(value) if isinstance(value, list) else value for key, value in state.items()}
        self.rows = rows
        self.actor = actor
        self.at = datetime.now(timezone.utc).isoformat()
        self.summary = {}
        self.records = {entry["id"].casefold(): entry for entry in state["records"]}
        self.imported_records = {}
        self.record_rows = {}
        self.bill_records = defaultdict(list)
        self.invoices = {entry["number"].strip().casefold(): entry for entry in state["invoices"]}
        self.used_keys = set()
        record_ids = [entry["id"] for entry in state["records"]]
        for event in state["audit"]:
            record_ids.append(event["entityId"])
            after = event.get("after")
            key = after.get("importKey") if isinstance(after, dict) else None
            if event.get("action") != "Importado do histórico" or not isinstance(key, str):
                continue
            self.used_keys.add(key)
            if key.startswith("romaneio:"):
                record = self.records.get(event["entityId"].casefold())
                if record:
                    self.records[key.split(":", 1)[1]] = record
        self.last_rom = max((int(key[4:]) for key in record_ids if re.fullmatch(r"ROM-\d+", key)), default=0)

    def add(self, collection, entry, entity_id=None, import_key=None):
        self.state[collection].append(entry)
        self.summary[collection] = self.summary.get(collection, 0) + 1
        self.state["audit"].append({
            "id": new_id(), "at": self.at, "entityId": entity_id or entry["id"],
            "action": "Importado do histórico", "actor": self.actor,
            "after": {"collection": collection, "item": entry, "importKey": import_key},
        })

    def reference(self, row, prefix):
        text = row.text("Referência")
        key = f"{prefix}:{text.casefold()}"
        if key in self.used_keys:
            row.fail(f"A referência {text} está repetida ou já foi importada.")
        self.used_keys.add(key)
        return text, key

    def lookup(self, row, field, collection):
        name = row.text(field).casefold()
        matches = [entry for entry in self.state[collection]
                   if name in (entry["name"].casefold(), entry["id"].casefold())]
        if len(matches) != 1:
            row.fail(f"{field} não encontrado ou ambíguo. Confira o nome ou use o ID do cadastro.")
        return matches[0]

    def record(self, row, imported=False):
        records = self.imported_records if imported else self.records
        key = row.text("Romaneio")
        result = records.get(key.casefold())
        if result is None:
            row.fail(f"Romaneio {key} não encontrado.")
        return result

    def registrations(self):
        for sheet, collection in (("Clientes", "clients"), ("Oficinas", "workshops"), ("Funcionários", "employees")):
            names = {entry["name"].strip().casefold() for entry in self.state[collection]}
            for row in self.rows[sheet]:
                name = row.text("Nome")
                if name.casefold() in names:
                    row.fail(f"{name} já está cadastrado. Use o nome existente nas outras abas.")
                entry = {"id": new_id(), "name": name, "active": row.flag("Ativo", True)}
                if collection == "workshops":
                    entry.update(contact=row.text("Contato", True), pix=row.text("Pix", True))
                if collection == "employees":
                    entry.update(role=row.text("Função", True), pix=row.text("Pix", True),
                                 dailyCents=row.number("Diária R$", 100),
                                 attendanceStartDate=date.today().isoformat())
                self.add(collection, entry)
                names.add(name.casefold())

    def romaneios(self):
        for row in self.rows["Romaneios"]:
            reference, key = self.reference(row, "romaneio")
            if reference.casefold() in self.records or re.fullmatch(r"rom-\d+", reference, re.IGNORECASE):
                row.fail("Use uma referência diferente do padrão ROM do aplicativo, como LOTE-2025-001.")
            client = self.lookup(row, "Cliente", "clients")
            kind = row.choice("Produção", ("Interna", "Terceirizada", "Mista"))
            workshop = self.lookup(row, "Oficina", "workshops") if kind == "Terceirizada" else None
            if not workshop and row.text("Oficina", True):
                row.fail("Oficina se aplica à produção terceirizada.")
            received = row.day("Recebimento")
            delivered = row.day("Entrega", True)
            if delivered and delivered < received:
                row.fail("A entrega deve ser igual ou posterior ao recebimento.")
            self.last_rom += 1
            record_id = f"ROM-{self.last_rom:03d}"
            record = {
                "id": record_id, "clientId": client["id"], "client": client["name"],
                "clientOrder": row.text("Pedido do cliente", True), "date": received,
                "receivedOn": received, "deliveredOn": delivered or None,
                "stage": row.choice("Etapa", ("Em fila", "Em produção", "Concluído")),
                "execution": {"kind": kind, "workshopId": workshop["id"] if workshop else None},
                "workshop": workshop["name"] if workshop else kind, "notes": row.text("Observações", True),
                "divergence": row.text("Divergências", True), "attachments": [],
                "items": [], "pricing": [], "invoiceId": None,
            }
            self.records[record_id.casefold()] = self.records[reference.casefold()] = record
            self.imported_records[reference.casefold()] = record
            self.record_rows[record_id] = row
            if number := row.text("NF", True):
                self.bill_records[number.casefold()].append(record)
            self.add("records", record, import_key=key)

    def grades_and_prices(self):
        items = {}
        descriptions = {}
        sizes = set()
        grids = ("Numérico adulto", "Letras", "Infantil", "Calçados", "Personalizada", "Sem grade")
        for row in self.rows["Grades"]:
            record = self.record(row, imported=True)
            key = (record["id"], row.text("Item").casefold())
            size = row.text("Tamanho")
            size_key = (*key, size.casefold())
            if size_key in sizes:
                row.fail("O tamanho já foi informado para esse item.")
            sizes.add(size_key)
            code = row.text("Código").upper()
            if "|" in code:
                row.fail("O código não pode conter |.")
            description = row.text("Descrição")
            code_key = (record["id"], code)
            if descriptions.setdefault(code_key, description.casefold()) != description.casefold():
                row.fail("Use a mesma descrição para o mesmo código.")
            grid = row.choice("Grade", grids)
            if grid == "Sem grade" and size.casefold() != "único":
                row.fail("Use Único no tamanho de um item Sem grade.")
            details = {"code": code, "description": description, "grid": grid,
                       "family": row.text("Família", True), "color": row.text("Cor", True)}
            if key not in items:
                items[key] = {"id": new_id(), **details, "sizes": []}
                record["items"].append(items[key])
            elif any(items[key][field] != value for field, value in details.items()):
                row.fail("Mantenha código, descrição, cor, família e grade iguais nas linhas do item.")
            quantity = row.number("Quantidade", maximum=10_000_000)
            items[key]["sizes"].append({"size": size, "quantity": quantity})
        prices = set()
        for row in self.rows["Valores"]:
            record = self.record(row, imported=True)
            code = row.text("Código").upper()
            key = (record["id"], code)
            if key not in descriptions or key in prices:
                row.fail("O código precisa existir na grade e ter somente uma linha de valores.")
            prices.add(key)
            kind = row.choice("Produção", ("Interna", "Terceirizada"))
            workshop = self.lookup(row, "Oficina", "workshops") if kind == "Terceirizada" else None
            cost = row.number("Unitário oficina R$", 100, minimum=1) if workshop else 0
            if not workshop and (row.text("Oficina", True) or row.number("Unitário oficina R$", 100, default=0)):
                row.fail("Oficina e custo se aplicam à produção terceirizada.")
            workshop_id = workshop["id"] if workshop else None
            execution = record["execution"]
            if execution["kind"] != "Mista" and execution != {"kind": kind, "workshopId": workshop_id}:
                row.fail("O tipo de produção e a oficina devem corresponder ao romaneio.")
            record["pricing"].append({"code": code, "kind": kind, "workshopId": workshop_id,
                                      "workshopCents": cost, "clientCents": row.number("Unitário cliente R$", 100, minimum=1)})
        for record in self.imported_records.values():
            row = self.record_rows[record["id"]]
            if not record["items"] or any(not sum(size["quantity"] for size in item["sizes"]) for item in record["items"]):
                row.fail("Inclua pelo menos uma peça em cada item da grade.")
            if record["stage"] == "Concluído" and any((record["id"], item["code"]) not in prices for item in record["items"]):
                row.fail("Informe valores para todos os códigos do romaneio concluído.")

    @staticmethod
    def invoice_lines(records):
        lines = []
        for record in records:
            models = {}
            for item in record["items"]:
                model = models.setdefault(item["code"], {"description": item["description"], "quantity": 0})
                model["quantity"] += sum(size["quantity"] for size in item["sizes"])
            for price in record["pricing"]:
                lines.append({"romaneioId": record["id"], "code": price["code"], **models[price["code"]],
                              "unitCents": price["clientCents"]})
        return lines

    def bills(self):
        installments = defaultdict(dict)
        for row in self.rows["Parcelas"]:
            key = row.text("NF").casefold()
            position = row.number("Parcela", minimum=1, maximum=120)
            if position in installments[key]:
                row.fail("Parcela duplicada.")
            installments[key][position] = row
        for row in self.rows["Notas fiscais"]:
            number = row.text("Número")
            key = number.casefold()
            if key in self.invoices:
                row.fail(f"NF {number} já registrada ou repetida.")
            records = self.bill_records.pop(key, [])
            if not records or len({record["clientId"] for record in records}) != 1 or any(record["stage"] != "Concluído" for record in records):
                row.fail("Vincule a NF a romaneios concluídos do mesmo cliente.")
            issue = row.day("Emissão")
            if any(issue < record["receivedOn"] for record in records):
                row.fail("A emissão não pode ser anterior ao recebimento do romaneio.")
            lines = self.invoice_lines(records)
            total = row.number("Total R$", 100, minimum=1)
            if total != sum(line["unitCents"] * line["quantity"] for line in lines):
                row.fail("O total da NF não corresponde às peças e aos valores unitários.")
            parts = installments.pop(key, {})
            if not parts or sorted(parts) != list(range(1, len(parts) + 1)):
                row.fail("Informe parcelas numeradas em sequência a partir de 1.")
            invoice_parts = []
            for position in sorted(parts):
                part = parts[position]
                due = part.day("Vencimento", True, actual=False)
                if due and due < issue:
                    part.fail("Vencimento anterior à emissão da NF.")
                invoice_parts.append({"id": new_id(), "dueDate": due, "amountCents": part.number("Valor R$", 100, minimum=1)})
            if sum(part["amountCents"] for part in invoice_parts) != total:
                row.fail("A soma das parcelas não corresponde ao total da NF.")
            invoice = {"id": new_id(), "number": number, "client": records[0]["client"], "issueDate": issue,
                       "recordIds": [record["id"] for record in records], "lines": lines, "totalCents": total,
                       "installments": invoice_parts, "consolidationAuthorized": len(records) > 1,
                       "taxRateBps": 0, "taxCents": 0, "taxDueDate": "", "taxPaidAt": "", "taxExempt": True}
            self.invoices[key] = invoice
            self.add("invoices", invoice)
            for record in records:
                record["invoiceId"] = invoice["id"]
        if self.bill_records:
            record = next(iter(self.bill_records.values()))[0]
            self.record_rows[record["id"]].fail("A NF indicada não foi preenchida na aba Notas fiscais.")
        if installments:
            part = next(iter(next(iter(installments.values())).values()))
            part.fail("Informe a NF desta parcela na aba Notas fiscais.")

    def receipts(self):
        paid = defaultdict(int)
        for receipt in self.state["receipts"]:
            if not receipt.get("reversedAt"):
                paid[receipt["installmentId"]] += receipt["amountCents"]
        for row in self.rows["Recebimentos"]:
            _, key = self.reference(row, "recebimento")
            bill = self.invoices.get(row.text("NF").casefold())
            position = row.number("Parcela", minimum=1, maximum=120) - 1
            if not bill or position >= len(bill["installments"]):
                row.fail("NF ou parcela não encontrada.")
            part = bill["installments"][position]
            day = row.day("Data")
            if day < bill["issueDate"]:
                row.fail("Recebimento anterior à emissão da NF.")
            amount = row.number("Valor R$", 100, minimum=1)
            reversal = row.reversal(day)
            if not reversal:
                paid[part["id"]] += amount
                if paid[part["id"]] > part["amountCents"]:
                    row.fail("O recebimento ultrapassa o saldo da parcela.")
            receipt = {"id": new_id(), "invoiceId": bill["id"], "installmentId": part["id"],
                       "date": day, "amountCents": amount, "reversedAt": reversal}
            self.add("receipts", receipt, bill["id"], key)

    def employee_history(self):
        days = {(entry["employeeId"], entry["date"]) for entry in self.state["attendance"]}
        for row in self.rows["Frequência"]:
            employee = self.lookup(row, "Funcionário", "employees")["id"]
            day = row.day("Data")
            if (employee, day) in days:
                row.fail("Já existe frequência deste funcionário na data.")
            days.add((employee, day))
            status = row.choice("Situação", ("Presente", "Falta", "Não trabalhado"))
            daily = row.number("Diária R$", 100)
            extra = row.number("Hora extra R$", 100, default=0)
            discount = row.number("Saída antecipada R$", 100, default=0)
            if (status != "Presente" and (extra or discount)) or discount > daily + extra:
                row.fail("Acréscimo e desconto exigem presença. O desconto não pode exceder a diária mais hora extra.")
            self.add("attendance", {"employeeId": employee, "date": day, "status": status, "dailyCents": daily,
                                     "overtimeCents": extra, "earlyDepartureDeductionCents": discount,
                                     "note": row.text("Observação", True)}, employee)
        for row in self.rows["Pag funcionários"]:
            _, key = self.reference(row, "pag-funcionário")
            employee = self.lookup(row, "Funcionário", "employees")["id"]
            day = row.day("Data")
            group = row.text("Grupo", True)
            payment = {"id": new_id(), "employeeId": employee, "date": day, "amountCents": row.number("Valor R$", 100, minimum=1),
                       "advance": row.flag("Adiantamento"), "groupId": f"histórico:{group.casefold()}" if group else None,
                       "reversedAt": row.reversal(day)}
            self.add("employeePayments", payment, employee, key)

    def workshop_history(self):
        paid = defaultdict(int)
        for payment in self.state["workshopPayments"]:
            if not payment.get("reversedAt"):
                for allocation in payment["allocations"]:
                    paid[allocation["chargeId"]] += allocation["amountCents"]
        allocations_by_ref = defaultdict(list)
        for row in self.rows["Rateios oficinas"]:
            allocations_by_ref[row.text("Pagamento").casefold()].append(row)
        for row in self.rows["Pag oficinas"]:
            reference, key = self.reference(row, "pag-oficina")
            workshop = self.lookup(row, "Oficina", "workshops")["id"]
            day = row.day("Data")
            reversal = row.reversal(day)
            total = row.number("Valor R$", 100, minimum=1)
            allocations = []
            charges = set()
            for split in allocations_by_ref.pop(reference.casefold(), []):
                record = self.record(split)
                code = split.text("Código").upper()
                price = next((price for price in record["pricing"]
                              if price["code"] == code and price.get("workshopId") == workshop), None)
                if not price or record["stage"] != "Concluído":
                    split.fail("Use um código de produção concluída desta oficina.")
                charge = f"{record['id']}|{code}|{workshop}"
                if charge in charges:
                    split.fail("Use uma linha por romaneio e código no pagamento.")
                charges.add(charge)
                amount = split.number("Valor R$", 100, minimum=1)
                if not reversal:
                    quantity = sum(size["quantity"] for item in record["items"]
                                   if item["code"].strip().upper() == code for size in item["sizes"])
                    paid[charge] += amount
                    if paid[charge] > quantity * price["workshopCents"]:
                        split.fail("O rateio ultrapassa o saldo da produção.")
                allocations.append({"chargeId": charge, "amountCents": amount})
            if sum(entry["amountCents"] for entry in allocations) != total:
                row.fail("Os rateios não somam o total do pagamento.")
            self.add("workshopPayments", {"id": new_id(), "workshopId": workshop, "date": day, "amountCents": total,
                                          "allocations": allocations, "reversedAt": reversal}, workshop, key)
        if allocations_by_ref:
            next(iter(allocations_by_ref.values()))[0].fail("Preencha o pagamento indicado na aba Pag oficinas.")

    def run(self):
        self.registrations()
        self.romaneios()
        self.grades_and_prices()
        self.bills()
        self.receipts()
        self.employee_history()
        self.workshop_history()
        if not self.summary:
            raise StoreError("A planilha não contém registros para importar.")
        return self.state, self.summary
