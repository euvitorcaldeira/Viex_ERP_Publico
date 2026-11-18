import tempfile
import unittest
import zipfile
from datetime import date
from openpyxl import load_workbook
from pathlib import Path

from backend.data_files import create_backup, excel_export, list_backups, restore_backup
from backend.database import SCHEMA_VERSION, Store, StoreError, empty_state


class DataFileTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.store=Store(self.root/'Dados'/'dalex.db')
        self.backups=self.root/'Backups'
        self.attachments=self.root/'Anexos'/'Romaneios'
        self.attachments.mkdir(parents=True)

    def tearDown(self):self.temp.cleanup()

    def save_clients(self,names):
        state=empty_state();state['clients']=[{'id':f'c{i}','name':name,'active':True} for i,name in enumerate(names)]
        self.store.save(state,self.store.revision(),{'id':'admin','role':'Administrador'})

    def test_backup_restores_database_and_attachment_files_as_one_snapshot(self):
        self.save_clients(['Loja Original'])
        original=self.attachments/'original.pdf';original.write_bytes(b'%PDF-original')
        backup=create_backup(self.store,self.root,self.backups)
        original.unlink();(self.attachments/'novo.pdf').write_bytes(b'%PDF-new')
        self.save_clients(['Loja Nova'])

        restore_backup(self.store,self.root,backup)

        self.assertEqual([c['name'] for c in self.store.load()['clients']],['Loja Original'])
        self.assertEqual((self.attachments/'original.pdf').read_bytes(),b'%PDF-original')
        self.assertFalse((self.attachments/'novo.pdf').exists())
        self.assertEqual(list_backups(self.backups)[0]['name'],backup.name)

    def test_restore_rejects_path_traversal_and_keeps_current_data(self):
        self.save_clients(['Loja preservada'])
        malicious=self.backups/'bad.zip';malicious.parent.mkdir(exist_ok=True)
        with zipfile.ZipFile(malicious,'w') as archive:archive.writestr('../outside.txt','not allowed')
        with self.assertRaises(StoreError):restore_backup(self.store,self.root,malicious)
        self.assertEqual([c['name'] for c in self.store.load()['clients']],['Loja preservada'])
        self.assertFalse((self.root.parent/'outside.txt').exists())

    def test_restore_migrates_older_backup_and_preserves_expenses_in_new_backups(self):
        self.save_clients(["Cliente original"])
        with self.store.connect() as db:
            db.execute("DROP TABLE balance_expenses")
            db.execute("UPDATE metadata SET value='1' WHERE key='schema_version'")
            db.execute("DELETE FROM schema_migrations WHERE version=2")
        legacy_backup = create_backup(self.store, self.root, self.backups)

        restore_backup(self.store, self.root, legacy_backup)

        restored = self.store.load()
        self.assertEqual([client["name"] for client in restored["clients"]], ["Cliente original"])
        self.assertEqual(restored["balanceExpenses"], [])
        with self.store.connect() as db:
            version = db.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()[0]
        self.assertEqual(int(version), SCHEMA_VERSION)

        restored["balanceExpenses"] = [{
            "id": "exp-1", "date": date.today().isoformat(), "category": "Frete",
            "description": "Frete dos materiais", "amountCents": 10000,
        }]
        self.store.save(restored, self.store.revision(), {"id": "admin", "role": "Administrador"})
        current_backup = create_backup(self.store, self.root, self.backups)
        restore_backup(self.store, self.root, legacy_backup)
        restore_backup(self.store, self.root, current_backup)
        self.assertEqual(self.store.load()["balanceExpenses"], restored["balanceExpenses"])

    def test_excel_export_has_expected_sheets_and_keeps_untrusted_text_as_text(self):
        state=empty_state();state['clients']=[{'id':'c1','name':'=HYPERLINK("https://example.invalid")','active':True}]
        state["balanceExpenses"] = [{
            "id": "exp-1", "date": date.today().isoformat(), "category": "Frete",
            "description": "=Frete", "amountCents": 12345, "supplier": "Fornecedor",
            "note": "Conferido", "reversedAt": "2026-11-17T12:00:00Z",
        }]
        output=excel_export(state,self.root/'Planilhas'/'export.xlsx')
        workbook=load_workbook(output,data_only=False)
        self.assertIn('Romaneios',workbook.sheetnames);self.assertIn('Parcelas',workbook.sheetnames)
        cell=workbook['Clientes']['B2']
        self.assertEqual(cell.data_type,'s');self.assertTrue(cell.value.startswith("'="))
        expense = workbook["Despesas_Balanco"]
        self.assertEqual(expense["E2"].value, 123.45)
        self.assertEqual(expense["D2"].data_type, "s")
        self.assertEqual(expense["D2"].value, "'=Frete")
        self.assertEqual(expense["H2"].value, "2026-11-17T12:00:00Z")


if __name__=='__main__':unittest.main()
