import tempfile
import unittest
from copy import deepcopy
from datetime import date
from pathlib import Path

from backend.database import SCHEMA_VERSION, RevisionConflict, Store, StoreError, empty_state
from backend.http_server import validate_state_transition


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "Data" / "dalex.db")

    def tearDown(self):
        self.temp.cleanup()

    def test_empty_database_can_be_saved_and_reopened(self):
        state = empty_state()
        revision = self.store.save(state, 0, {"id": "u1", "role": "Administrador"})
        self.assertEqual(revision, 1)
        self.assertEqual(self.store.load(), state)

    def test_internal_workshop_display_name_is_persisted_without_a_schema_migration(self):
        state=empty_state();state["internalWorkshopName"]="Ateliê D’ALEX";state["systemDisplayName"]="Ateliê ERP"
        self.store.save(state,0,{"id":"u1","role":"Administrador"})
        self.assertEqual(self.store.load()["internalWorkshopName"],"Ateliê D’ALEX")
        self.assertEqual(self.store.load()["systemDisplayName"],"Ateliê ERP")
        self.assertEqual(self.store.revision(),1)

    def test_internal_workshop_name_requires_admin_and_auditable_change(self):
        before=empty_state()
        after={**before,"internalWorkshopName":"Ateliê D’ALEX","audit":[{
            "id":"settings-audit","entityId":"settings:internalWorkshopName",
            "at":"2026-11-16T10:00:00Z","action":"Nome da oficina interna alterado",
            "before":"D’ALEX","after":"Ateliê D’ALEX"}]}
        with self.assertRaisesRegex(StoreError,"Administrador"):
            validate_state_transition(before,after,"Operação")
        with self.assertRaisesRegex(StoreError,"histórico"):
            validate_state_transition(before,{**after,"audit":[]},"Administrador")
        validate_state_transition(before,after,"Administrador")

    def test_system_display_name_requires_admin_and_auditable_change(self):
        before=empty_state()
        after={**before,"systemDisplayName":"Ateliê ERP","audit":[{
            "id":"system-name-audit","entityId":"settings:systemDisplayName",
            "at":"2026-11-16T10:00:00Z","action":"Nome de exibição do sistema alterado",
            "before":"D’ALEX","after":"Ateliê ERP"}]}
        with self.assertRaisesRegex(StoreError,"Administrador"):
            validate_state_transition(before,after,"Operação")
        with self.assertRaisesRegex(StoreError,"histórico"):
            validate_state_transition(before,{**after,"audit":[]},"Administrador")
        validate_state_transition(before,after,"Administrador")

    def test_invoice_summary_payment_text_persists_and_requires_admin_audit(self):
        state=empty_state();state["invoiceSummaryPaymentText"]="TED para conta corrente"
        self.store.save(state,0,{"id":"u1","role":"Administrador"})
        self.assertEqual(self.store.load()["invoiceSummaryPaymentText"],"TED para conta corrente")
        before=empty_state()
        after={**before,"invoiceSummaryPaymentText":"TED para conta corrente","audit":[{
            "id":"payment-text-audit","entityId":"settings:invoiceSummaryPaymentText",
            "at":"2026-11-16T10:00:00Z","action":"Complemento do resumo da NF alterado",
            "before":"PIX 42655411862","after":"TED para conta corrente"}]}
        with self.assertRaisesRegex(StoreError,"Administrador"):
            validate_state_transition(before,after,"Operação")
        with self.assertRaisesRegex(StoreError,"histórico"):
            validate_state_transition(before,{**after,"audit":[]},"Administrador")
        validate_state_transition(before,after,"Administrador")

    def test_romaneio_and_its_items_are_saved_with_client_relationship(self):
        state = empty_state()
        state["clients"] = [{"id":"c1","name":"Loja Exemplo","active":True}]
        state["records"] = [{"id":"ROM-001","clientId":"c1","client":"Loja Exemplo","stage":"Em fila",
            "receivedOn":"2026-11-04","execution":{"kind":"Interna","workshopId":None},"items":[
                {"code":"CAM-1","description":"Camiseta","sizes":[{"size":"P","quantity":3},{"size":"M","quantity":2}]}
            ],"pricing":[],"invoiceId":None}]
        self.store.save(state, 0, {"id":"u1","role":"Administrador"})
        self.assertEqual(self.store.load(), state)
        with self.store.connect() as db:
            row = db.execute("SELECT quantity FROM record_items WHERE record_id='ROM-001'").fetchone()
        self.assertEqual(row[0], 5)

    def test_invalid_foreign_key_does_not_replace_prior_data(self):
        original = empty_state()
        self.store.save(original, 0, {"id":"u1","role":"Administrador"})
        invalid = empty_state()
        invalid["records"] = [{"id":"ROM-001","clientId":"missing","stage":"Em fila","items":[],"pricing":[]}]
        with self.assertRaises(StoreError):
            self.store.save(invalid, 1, {"id":"u1","role":"Administrador"})
        self.assertEqual(self.store.load(), original)
        self.assertEqual(self.store.revision(), 1)

    def test_stale_revision_is_rejected(self):
        self.store.save(empty_state(), 0, {"id":"u1","role":"Administrador"})
        with self.assertRaises(RevisionConflict):
            self.store.save(empty_state(), 0, {"id":"u1","role":"Administrador"})

    def test_balance_expense_validation_legacy_save_and_atomic_rollback(self):
        state = empty_state()
        expense = {
            "id": "expense-1", "date": date.today().isoformat(), "category": "Energia",
            "description": "Energia do ateliê", "amountCents": 32000,
        }
        state["balanceExpenses"] = [expense]
        self.store.save(state, 0, {"id": "admin", "role": "Administrador"})
        self.assertEqual(self.store.load()["balanceExpenses"], [expense])
        legacy = deepcopy(state)
        legacy.pop("balanceExpenses")
        self.store.save(legacy, 1, {"id": "admin", "role": "Administrador"})
        self.assertEqual(self.store.load()["balanceExpenses"], [expense])
        invalid = deepcopy(state)
        invalid["balanceExpenses"][0]["amountCents"] = True
        with self.assertRaisesRegex(StoreError, "valor de despesa"):
            self.store.save(invalid, 2, {"id": "admin", "role": "Administrador"})
        repeated = deepcopy(state)
        repeated["balanceExpenses"].append(expense)
        with self.assertRaisesRegex(StoreError, "despesas repetidas"):
            self.store.save(repeated, 2, {"id": "admin", "role": "Administrador"})
        forbidden = deepcopy(state)
        forbidden["balanceExpenses"][0]["amountCents"] = 100
        with self.assertRaisesRegex(StoreError, "Administrador"):
            self.store.save(forbidden, 2, {"id": "operator", "role": "Operação"})
        with self.assertRaisesRegex(StoreError, "excluídas"):
            self.store.save(empty_state(), 2, {"id": "admin", "role": "Administrador"})
        rollback = deepcopy(state)
        rollback["balanceExpenses"][0]["amountCents"] = 100
        rollback["audit"] = [{"id": "bad-audit"}]
        with self.assertRaises(KeyError):
            self.store.save(rollback, 2, {"id": "admin", "role": "Administrador"})
        self.assertEqual(self.store.revision(), 2)
        self.assertEqual(self.store.load()["balanceExpenses"], [expense])

    def test_repeated_invoice_number_is_rejected_before_write(self):
        state = empty_state()
        state["invoices"] = [
            {"id":"i1","number":"NF-10","client":"Loja","issueDate":"2026-11-04","totalCents":100,"recordIds":[],"lines":[],"installments":[]},
            {"id":"i2","number":"nf-10","client":"Loja","issueDate":"2026-11-04","totalCents":100,"recordIds":[],"lines":[],"installments":[]},
        ]
        with self.assertRaises(StoreError):
            self.store.save(state, 0, {"id":"u1","role":"Administrador"})
        self.assertEqual(self.store.revision(), 0)

    def _full_operational_snapshot(self):
        state=empty_state()
        state['clients']=[{'id':'c1','name':'Loja Teste','active':True}]
        state['workshops']=[{'id':'w1','name':'Oficina Teste','contact':'contato','pix':'pix','active':True}]
        state['employees']=[{'id':'e1','name':'Pessoa Teste','role':'Costura','dailyCents':12000,'pix':'chave','active':True}]
        state['records']=[{'id':'ROM-001','clientId':'c1','client':'Loja Teste','clientOrder':'PED-5','stage':'Concluído','receivedOn':'2026-11-04',
            'execution':{'kind':'Terceirizada','workshopId':'w1'},'items':[{'code':'CAM-1','description':'Camiseta','family':'Malha','color':'Azul','grid':'Letras','sizes':[{'size':'M','quantity':5}]}],
            'pricing':[{'code':'CAM-1','clientCents':2000,'kind':'Terceirizada','workshopId':'w1','workshopCents':800}], 'invoiceId':'i1','attachments':[]}]
        state['invoices']=[{'id':'i1','number':'NF-5','client':'Loja Teste','recordIds':['ROM-001'],'issueDate':'2026-11-04','totalCents':10000,'taxRateBps':600,'taxCents':600,'taxDueDate':'2026-11-30','taxPaidAt':'',
            'lines':[{'romaneioId':'ROM-001','code':'CAM-1','description':'Camiseta','quantity':5,'unitCents':2000}],
            'installments':[{'id':'p1','amountCents':10000,'dueDate':''}], 'consolidationAuthorized':False}]
        state['receipts']=[{'id':'rc1','invoiceId':'i1','installmentId':'p1','date':'2026-11-04','amountCents':2000,'reversedAt':None}]
        state['attendance']=[{'employeeId':'e1','date':'2026-11-04','status':'Presente','dailyCents':12000,'overtimeCents':3000,'earlyDepartureDeductionCents':1000}]
        state['employeePayments']=[{'id':'ep1','employeeId':'e1','date':'2026-11-04','amountCents':5000,'advance':False,'groupId':None}]
        state['workshopPayments']=[{'id':'wp1','workshopId':'w1','date':'2026-11-04','amountCents':1000,'allocations':[{'chargeId':'ROM-001|CAM-1|w1','amountCents':1000}]}]
        state['audit']=[{'id':'a1','entityId':'ROM-001','at':'2026-11-04T10:00:00Z','action':'Romaneio cadastrado','actor':{'id':'u1','name':'Admin','role':'Administrador'}}]
        return state

    def test_full_operational_financial_snapshot_round_trips_atomically(self):
        state = self._full_operational_snapshot()
        self.store.save(state,0,{'id':'u1','role':'Administrador'})
        self.assertEqual(self.store.load(),state)
        with self.store.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM invoice_records').fetchone()[0],1)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM workshop_payment_allocations').fetchone()[0],1)
            self.assertEqual(db.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()[0], str(SCHEMA_VERSION))
            self.assertEqual(db.execute('SELECT COUNT(*) FROM schema_migrations').fetchone()[0], SCHEMA_VERSION)

        invalid={**state,'invoices':[{**state['invoices'][0],'totalCents':11000}]}
        with self.assertRaisesRegex(StoreError,'total da NF'):
            self.store.save(invalid,1,{'id':'u1','role':'Administrador'})
        self.assertEqual(self.store.load(),state)
        self.assertEqual(self.store.revision(),1)
        invalid_tax={**state,'invoices':[{**state['invoices'][0],'taxCents':601}]}
        with self.assertRaisesRegex(StoreError,'imposto'):
            self.store.save(invalid_tax,1,{'id':'u1','role':'Administrador'})
        invalid_attendance={**state,'attendance':[{**state['attendance'][0],'earlyDepartureDeductionCents':16000}]}
        with self.assertRaisesRegex(StoreError,'desconto'):
            self.store.save(invalid_attendance,1,{'id':'u1','role':'Administrador'})
        edited_tax={**state,'invoices':[{**state['invoices'][0],'taxRateBps':700,'taxCents':700}],
            'audit':state['audit']+[{'id':'a2','entityId':'i1','at':'2026-11-04T11:00:00Z','action':'Apuração de imposto atualizada'}]}
        validate_state_transition(state,edited_tax)
        without_audit={**edited_tax,'audit':state['audit']}
        with self.assertRaisesRegex(StoreError,'histórico'):
            validate_state_transition(state,without_audit)

    def test_tax_exempt_invoice_is_stored_and_requires_zero_tax_values(self):
        state=self._full_operational_snapshot()
        invoice={**state['invoices'][0],'taxRateBps':0,'taxCents':0,'taxDueDate':'','taxPaidAt':'','taxExempt':True}
        state={**state,'invoices':[invoice]}
        self.store.save(state,0,{'id':'u1','role':'Administrador'})
        self.assertEqual(self.store.load()['invoices'][0]['taxExempt'],True)
        invalid={**state,'invoices':[{**invoice,'taxCents':1}]}
        with self.assertRaisesRegex(StoreError,'isenta'):
            self.store.save(invalid,1,{'id':'u1','role':'Administrador'})

    def test_admin_can_archive_receipts_and_payments_with_auditable_originals(self):
        state = self._full_operational_snapshot()
        self.store.save(state, 0, {"id": "u1", "role": "Administrador"})
        previous = self.store.load()
        movements = {"receipts": "invoiceId", "employeePayments": "employeeId", "workshopPayments": "workshopId"}
        archived = {**previous, **{kind: [] for kind in movements}}
        archived["audit"] = previous["audit"] + [
            {
                "id": "archive-" + kind,
                "entityId": previous[kind][0][owner],
                "action": "Movimentação excluída do histórico",
                "at": "2026-11-04T11:00:00Z",
                "before": previous[kind][0],
                "after": {"collection": kind, "removed": True},
            }
            for kind, owner in movements.items()
        ]
        with self.assertRaisesRegex(StoreError, "Administrador"):
            validate_state_transition(previous, archived, "Operação")
        with self.assertRaisesRegex(StoreError, "auditoria"):
            validate_state_transition(previous, {**archived, "audit": archived["audit"][:-1]}, "Administrador")
        validate_state_transition(previous, archived, "Administrador")
        self.store.save(archived, 1, {"id": "u1", "role": "Administrador"})
        self.assertEqual(self.store.load(), archived)

    def test_admin_can_remove_only_unpaid_single_record_test_invoice_and_keep_audit(self):
        state=empty_state();state['clients']=[{'id':'c1','name':'Loja','active':True}]
        state['records']=[{'id':'ROM-001','clientId':'c1','client':'Loja','stage':'Concluído','receivedOn':'2026-11-04','execution':{'kind':'Interna','workshopId':None},
            'items':[{'code':'CAM-1','description':'Camiseta','sizes':[{'size':'M','quantity':5}]}], 'pricing':[{'code':'CAM-1','clientCents':2000,'kind':'Interna','workshopId':None,'workshopCents':0}], 'invoiceId':'i1','attachments':[]}]
        state['invoices']=[{'id':'i1','number':'NF-TESTE','client':'Loja','recordIds':['ROM-001'],'issueDate':'2026-11-04','totalCents':10000,
            'lines':[{'romaneioId':'ROM-001','code':'CAM-1','description':'Camiseta','quantity':5,'unitCents':2000}],
            'installments':[{'id':'p1','amountCents':10000,'dueDate':''}], 'consolidationAuthorized':False}]
        self.store.save(state,0,{'id':'u1','role':'Administrador'});before=self.store.load()
        after={**before,'records':[],'invoices':[],'audit':[{'id':'a1','entityId':'i1','at':'2026-11-05T10:00:00Z','action':'NF e romaneio faturados removidos','before':{'invoice':before['invoices'][0],'record':before['records'][0]} }]}
        with self.assertRaisesRegex(StoreError,'Administrador'):
            validate_state_transition(before,after,'Operação')
        validate_state_transition(before,after,'Administrador')
        self.store.save(after,1,{'id':'u1','role':'Administrador'})
        self.assertEqual(self.store.load()['records'],[]);self.assertEqual(self.store.load()['invoices'],[])
        self.assertEqual(self.store.load()['audit'][0]['action'],'NF e romaneio faturados removidos')

    def test_undo_billing_archives_reversed_receipts_and_persists(self):
        state=empty_state();state['clients']=[{'id':'c1','name':'Loja','active':True}]
        state['records']=[{'id':'ROM-001','clientId':'c1','client':'Loja','stage':'Concluído','receivedOn':'2026-11-04','execution':{'kind':'Interna','workshopId':None},
            'items':[{'code':'CAM-1','description':'Camiseta','sizes':[{'size':'M','quantity':5}]}], 'pricing':[{'code':'CAM-1','clientCents':2000,'kind':'Interna','workshopId':None,'workshopCents':0}], 'invoiceId':'i1','attachments':[]}]
        state['invoices']=[{'id':'i1','number':'NF-TESTE','client':'Loja','recordIds':['ROM-001'],'issueDate':'2026-11-04','totalCents':10000,
            'lines':[{'romaneioId':'ROM-001','code':'CAM-1','description':'Camiseta','quantity':5,'unitCents':2000}],
            'installments':[{'id':'p1','amountCents':10000,'dueDate':''}], 'consolidationAuthorized':False}]
        state['receipts']=[{'id':'r1','invoiceId':'i1','installmentId':'p1','date':'2026-11-04','amountCents':10000,'reversedAt':'2026-11-05T10:00:00Z'}]
        self.store.save(state,0,{'id':'u1','role':'Administrador'});before=self.store.load()
        after={**before,'invoices':[],'receipts':[],'records':[{**before['records'][0],'invoiceId':None}], 'audit':[{'id':'undo1','entityId':'i1','at':'2026-11-05T11:00:00Z','action':'Faturamento desfeito','before':before['invoices'][0],'after':{'recordIds':['ROM-001'],'archivedReceipts':before['receipts']}}]}
        validate_state_transition(before,after,'Administrador')
        self.store.save(after,1,{'id':'u1','role':'Administrador'})
        saved=self.store.load()
        self.assertEqual(saved['invoices'],[])
        self.assertEqual(saved['receipts'],[])
        self.assertIsNone(saved['records'][0]['invoiceId'])
        self.assertEqual(saved['audit'][0]['after']['archivedReceipts'],before['receipts'])
        with self.assertRaises(StoreError):
            validate_state_transition(before,{**after,'audit':[]},'Administrador')
        active={**before,'receipts':[{**before['receipts'][0],'reversedAt':None}]}
        with self.assertRaises(StoreError):
            validate_state_transition(active,after,'Administrador')
        reversal = {'id':'reverse1','entityId':'i1','action':'Recebimento desfeito',
                    'before':active['receipts'][0],'after':before['receipts'][0]}
        combined = {**after, 'audit':[reversal, *after['audit']]}
        validate_state_transition(active,combined,'Administrador')
        with self.assertRaises(StoreError):
            validate_state_transition(active,combined,'Operação')

    def test_paid_attendance_correction_keeps_credit_and_blocks_new_regular_overpayment(self):
        today=date.today().isoformat()
        before=empty_state();before['employees']=[{'id':'e1','name':'Pessoa','role':'Costura','dailyCents':10000,'pix':'','active':True,'attendanceStartDate':today}]
        before['attendance']=[{'employeeId':'e1','date':today,'status':'Presente','dailyCents':10000}]
        before['employeePayments']=[{'id':'p1','employeeId':'e1','date':today,'amountCents':10000,'advance':False,'groupId':None}]
        after={**before,'attendance':[{'employeeId':'e1','date':today,'status':'Falta','dailyCents':10000}],
            'audit':[{'id':'a1','entityId':'e1','at':today+'T10:00:00Z','action':'Frequência registrada/corrigida','before':before['attendance'][0],'after':{'employeeId':'e1','date':today,'status':'Falta','dailyCents':10000}}]}
        validate_state_transition(before,after)
        attempted={**after,'employeePayments':after['employeePayments']+[{'id':'p2','employeeId':'e1','date':today,'amountCents':1,'advance':False,'groupId':None}]}
        with self.assertRaisesRegex(StoreError,'ultrapassa o saldo disponível'):
            validate_state_transition(after,attempted)

    def test_reversed_workshop_payment_history_survives_later_production_edit(self):
        state=empty_state();state['clients']=[{'id':'c1','name':'Loja','active':True}]
        state['workshops']=[{'id':'w1','name':'Oficina','contact':'','pix':'','active':True}]
        state['records']=[{'id':'ROM-001','clientId':'c1','client':'Loja','stage':'Concluído','receivedOn':'2026-11-04','execution':{'kind':'Terceirizada','workshopId':'w1'},
            'items':[{'code':'CAM-1','description':'Camiseta','sizes':[{'size':'M','quantity':5}]}], 'pricing':[{'code':'CAM-1','clientCents':2000,'kind':'Terceirizada','workshopId':'w1','workshopCents':800}], 'invoiceId':None,'attachments':[]}]
        state['workshopPayments']=[{'id':'wp1','workshopId':'w1','date':'2026-11-04','amountCents':1000,'allocations':[{'chargeId':'ROM-001|CAM-1|w1','amountCents':1000}]}]
        self.store.save(state,0,{'id':'u1','role':'Administrador'})
        before=self.store.load();reversed_state={**before,'workshopPayments':[{**before['workshopPayments'][0],'reversedAt':'2026-11-04T12:00:00Z'}]}
        validate_state_transition(before,reversed_state);self.store.save(reversed_state,1,{'id':'u1','role':'Administrador'})
        edited=self.store.load();edited['records'][0]['items'][0]['sizes'][0]['quantity']=6
        validate_state_transition(self.store.load(),edited);self.store.save(edited,2,{'id':'u1','role':'Administrador'})
        saved=self.store.load();self.assertEqual(saved['records'][0]['items'][0]['sizes'][0]['quantity'],6)
        self.assertEqual(saved['workshopPayments'][0]['allocations'][0]['amountCents'],1000)


if __name__ == "__main__":
    unittest.main()
