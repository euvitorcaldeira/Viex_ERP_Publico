import http.client
import base64
from io import BytesIO
from openpyxl import load_workbook
import json
import tempfile
import threading
import unittest
from datetime import date
from pathlib import Path
from http.server import ThreadingHTTPServer

from backend import http_server
from backend.database import Store, empty_state


class LocalHttpTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.old_store=http_server.DB
        self.old_root=http_server.ROOT
        self.old_data=http_server.DATA
        self.old_store_root=http_server.STORE_ROOT
        http_server.ROOT=Path(self.temp.name)/"Application"
        http_server.ROOT.mkdir()
        http_server.DATA=Path(self.temp.name)/"Data"/"dalex.db"
        http_server.STORE_ROOT=Path(self.temp.name)/"DataRoot"
        http_server.DB=Store(Path(self.temp.name)/"Data"/"dalex.db")
        http_server.SESSIONS.clear()
        self.server=ThreadingHTTPServer(("127.0.0.1",0),http_server.Handler)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
        self.port=self.server.server_port

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join(timeout=2)
        http_server.SESSIONS.clear();http_server.DB=self.old_store;http_server.ROOT=self.old_root;http_server.DATA=self.old_data;http_server.STORE_ROOT=self.old_store_root;self.temp.cleanup()

    def call(self,method,path,body=None,cookie="",csrf=""):
        conn=http.client.HTTPConnection("127.0.0.1",self.port,timeout=5)
        headers={"Host":f"127.0.0.1:{self.port}"}
        if method in ("POST","PUT"):
            headers["Origin"]=f"http://127.0.0.1:{self.port}"
            headers["Content-Type"]="application/json"
        if cookie: headers["Cookie"]=cookie
        if csrf: headers["X-Dalex-CSRF"]=csrf
        conn.request(method,path,None if body is None else json.dumps(body).encode(),headers)
        response=conn.getresponse();data=response.read();result=json.loads(data) if data else {}
        set_cookie=response.getheader("Set-Cookie","").split(";",1)[0]
        status=response.status;conn.close()
        return status,result,set_cookie

    def test_admin_setup_login_local_storage_and_private_operation_role(self):
        status,result,_=self.call("GET","/api/status")
        self.assertEqual(status,200);self.assertTrue(result["setupRequired"])
        status,result,admin_cookie=self.call("POST","/api/setup",{"name":"Admin","email":"admin@example.test","password":"Senha Segura 123!"})
        self.assertEqual(status,200)
        admin_csrf=result["csrf"]
        self.assertTrue(admin_cookie.startswith("dalex_session="))
        status,result,_=self.call("GET","/api/state",cookie=admin_cookie)
        self.assertEqual(status,200);self.assertEqual(result["state"]["records"],[]);self.assertEqual(len(result["state"]["users"]),1)
        forged=empty_state();forged['audit']=[{'id':'a1','entityId':'ROM-001','at':'2026-11-04T10:00:00Z','action':'Teste','actor':{'id':'forjado','name':'Outro usuário','role':'Operação'}}]
        status,result,_=self.call("PUT","/api/state",{"state":forged,"revision":0},admin_cookie,admin_csrf)
        self.assertEqual(status,200);self.assertEqual(result["revision"],1)
        self.assertEqual(http_server.DB.load()['audit'][0]['actor']['name'],'Admin')
        current=http_server.DB.load()
        renamed={**current,"internalWorkshopName":"Ateliê D’ALEX","systemDisplayName":"Ateliê ERP","invoiceSummaryPaymentText":"TED para conta corrente","audit":current["audit"]+[
            {"id":"internal-name-change","entityId":"settings:internalWorkshopName",
             "at":"2026-11-16T10:00:00Z","action":"Nome da oficina interna alterado",
             "before":"D’ALEX","after":"Ateliê D’ALEX"},
            {"id":"system-name-change","entityId":"settings:systemDisplayName",
             "at":"2026-11-16T10:01:00Z","action":"Nome de exibição do sistema alterado",
             "before":"D’ALEX","after":"Ateliê ERP"},
            {"id":"payment-text-change","entityId":"settings:invoiceSummaryPaymentText",
             "at":"2026-11-16T10:02:00Z","action":"Complemento do resumo da NF alterado",
             "before":"PIX 42655411862","after":"TED para conta corrente"}]}
        status,result,_=self.call("PUT","/api/state",{"state":renamed,"revision":1},admin_cookie,admin_csrf)
        self.assertEqual(status,200);self.assertEqual(result["revision"],2)
        self.assertEqual(http_server.DB.load()["internalWorkshopName"],"Ateliê D’ALEX")
        self.assertEqual(http_server.DB.load()["systemDisplayName"],"Ateliê ERP")
        self.assertEqual(http_server.DB.load()["invoiceSummaryPaymentText"],"TED para conta corrente")
        status,users_result,_=self.call("POST","/api/users",{"name":"Operação","email":"operacao@example.test","role":"Operação","password":"Senha Operacao 456!"},admin_cookie,admin_csrf)
        self.assertEqual(status,201)
        self.assertEqual(len(users_result["users"]),2)
        status,_,_=self.call("POST","/api/login",{"email":"operacao@example.test","password":"errada"})
        self.assertEqual(status,401)
        status,login,operation_cookie=self.call("POST","/api/login",{"email":"operacao@example.test","password":"Senha Operacao 456!"})
        self.assertEqual(status,200)
        status,operation_state,_=self.call("GET","/api/state",cookie=operation_cookie)
        changed_name={**operation_state["state"],"systemDisplayName":"Outro ERP"}
        status,_,_=self.call("PUT","/api/state",{"state":changed_name,"revision":operation_state["revision"]},operation_cookie,login["csrf"])
        self.assertEqual(status,400)
        changed_payment={**operation_state["state"],"invoiceSummaryPaymentText":"PIX alterado"}
        status,_,_=self.call("PUT","/api/state",{"state":changed_payment,"revision":operation_state["revision"]},operation_cookie,login["csrf"])
        self.assertEqual(status,400)
        self.assertEqual(http_server.DB.load()["internalWorkshopName"],"Ateliê D’ALEX")
        self.assertEqual(http_server.DB.load()["systemDisplayName"],"Ateliê ERP")
        self.assertEqual(http_server.DB.load()["invoiceSummaryPaymentText"],"TED para conta corrente")
        status,_,_=self.call("GET","/api/users",cookie=operation_cookie)
        self.assertEqual(status,403)
        status,_,_=self.call("POST","/api/logout",{},operation_cookie,login["csrf"])
        self.assertEqual(status,204)

    def test_local_operations_cannot_read_or_change_financial_snapshots(self):
        state=empty_state()
        state["clients"]=[{"id":"c1","name":"Loja","active":True}]
        state["workshops"]=[{"id":"w1","name":"Oficina","contact":"","pix":"pix privado","active":True}]
        state["employees"]=[{"id":"e1","name":"Funcionário","role":"Costura","dailyCents":10000,"pix":"pix privado","active":True}]
        state["records"]=[{"id":"ROM-001","clientId":"c1","client":"Loja","workshop":"Oficina","stage":"Concluído","receivedOn":"2026-11-04","execution":{"kind":"Terceirizada","workshopId":"w1"},"items":[{"code":"CAM-1","description":"Camiseta","family":"","color":"","grid":"Letras","sizes":[{"size":"M","quantity":5}]}],"pricing":[{"code":"CAM-1","clientCents":9000,"kind":"Terceirizada","workshopId":"w1","workshopCents":4000}],"invoiceId":"i1","attachments":[]}]
        state["invoices"]=[{"id":"i1","number":"NF-1","client":"Loja","recordIds":["ROM-001"],"issueDate":"2026-11-04","totalCents":45000,"lines":[{"romaneioId":"ROM-001","code":"CAM-1","description":"Camiseta","quantity":5,"unitCents":9000}],"installments":[{"id":"p1","amountCents":45000,"dueDate":""}]}]
        state["receipts"]=[{"id":"r1","invoiceId":"i1","installmentId":"p1","date":"2026-11-04","amountCents":10000,"reversedAt":None}]
        http_server.DB.save(state,0,{"id":"root","role":"Administrador"})
        _,_,_=self.call("POST","/api/setup",{"name":"Admin","email":"admin@example.test","password":"Senha Segura 123!"})
        _,_,admin_cookie=self.call("POST","/api/login",{"email":"admin@example.test","password":"Senha Segura 123!"})
        _,users,_=self.call("POST","/api/users",{"name":"Operação","email":"operacao@example.test","role":"Operação","password":"Senha Operacao 456!"},admin_cookie,http_server.SESSIONS[admin_cookie.split("=",1)[1]]["csrf"])
        _,login,cookie=self.call("POST","/api/login",{"email":"operacao@example.test","password":"Senha Operacao 456!"})
        status,response,_=self.call("GET","/api/state",cookie=cookie)
        safe=response["state"]
        self.assertEqual(status,200)
        self.assertEqual(safe["invoices"],[]);self.assertEqual(safe["receipts"],[]);self.assertEqual(safe["employees"],[])
        self.assertEqual(safe["records"][0]["invoiceId"],"i1")
        self.assertEqual(safe["records"][0]["pricing"],[])
        self.assertEqual(safe["workshops"][0]["pix"],"")
        safe["records"][0]["items"][0]["sizes"][0]["quantity"]=6
        status,response,_=self.call("PUT","/api/state",{"state":safe,"revision":response["revision"]},cookie,login["csrf"])
        self.assertEqual(status,400)
        self.assertEqual(http_server.DB.load()["records"][0]["items"][0]["sizes"][0]["quantity"],5)
        self.assertEqual(http_server.DB.load()["clients"][0]["name"],"Loja")

    def test_admin_can_manage_balance_expenses_and_operational_profiles_cannot_access_them(self):
        _, admin, cookie = self.call("POST", "/api/setup", {
            "name": "Admin", "email": "admin@example.test", "password": "Senha Segura 123!",
        })
        csrf = admin["csrf"]
        expense = {
            "id": "exp-1", "date": date.today().isoformat(), "category": "Aluguel",
            "description": "Aluguel do ateliê", "amountCents": 25000,
            "supplier": "Imobiliária", "note": "Comprovante em arquivo",
        }
        state = http_server.DB.load()

        def update_expense(original, changed, action, revision):
            state = http_server.DB.load()
            state["balanceExpenses"] = [changed]
            state["audit"].append({
                "id": f"event-{revision}", "entityId": expense["id"], "at": date.today().isoformat(),
                "action": action, "before": original, "after": changed,
            })
            return self.call("PUT", "/api/state", {"state": state, "revision": revision}, cookie, csrf)

        state["balanceExpenses"] = [expense]
        status, _, _ = self.call("PUT", "/api/state", {"state": state, "revision": 0}, cookie, csrf)
        self.assertEqual(status, 400)
        invalid = {**expense, "amountCents": 0}
        status, _, _ = update_expense(None, invalid, "Despesa lançada", 0)
        self.assertEqual(status, 400)
        status, _, _ = update_expense(None, expense, "Despesa lançada", 0)
        self.assertEqual(status, 200)
        revised = {**expense, "amountCents": 25500}
        status, _, _ = update_expense(expense, revised, "Despesa atualizada", 1)
        self.assertEqual(status, 200)
        reversed_expense = {**revised, "reversedAt": date.today().isoformat() + "T12:00:00Z"}
        status, _, _ = update_expense(revised, reversed_expense, "Despesa estornada", 2)
        self.assertEqual(status, 200)
        status, _, _ = update_expense(reversed_expense, revised, "Despesa atualizada", 3)
        self.assertEqual(status, 400)
        state = http_server.DB.load()
        self.assertEqual(state["balanceExpenses"], [reversed_expense])
        self.assertEqual([event["actor"]["name"] for event in state["audit"]], ["Admin"] * 3)
        state["balanceExpenses"] = []
        status, _, _ = self.call("PUT", "/api/state", {"state": state, "revision": 3}, cookie, csrf)
        self.assertEqual(status, 400)

        for role in ("Operação", "Consulta"):
            email = "operation@example.test" if role == "Operação" else "consult@example.test"
            password = "Senha Teste Segura 123!"
            status, _, _ = self.call("POST", "/api/users", {
                "name": role, "email": email, "role": role, "password": password,
            }, cookie, csrf)
            self.assertEqual(status, 201)
            _, actor, actor_cookie = self.call("POST", "/api/login", {"email": email, "password": password})
            status, response, _ = self.call("GET", "/api/state", cookie=actor_cookie)
            self.assertEqual(status, 200)
            hidden = response["state"]
            self.assertEqual(hidden["balanceExpenses"], [])
            self.assertEqual(hidden["audit"], [])
            hidden["balanceExpenses"] = [expense]
            status, _, _ = self.call("PUT", "/api/state", {"state": hidden, "revision": 3}, actor_cookie, actor["csrf"])
            self.assertEqual(status, 400 if role == "Operação" else 403)
        self.assertEqual(http_server.DB.load()["balanceExpenses"], [reversed_expense])
        restored = {**reversed_expense, "reversedAt": None}
        status, _, _ = update_expense(reversed_expense, restored, "Estorno de despesa desfeito", 3)
        self.assertEqual(status, 200)
        self.assertEqual(http_server.DB.load()["balanceExpenses"], [restored])
        self.assertEqual(len(http_server.DB.load()["audit"]), 4)

    def test_consultation_profile_is_read_only_and_cannot_list_user_accounts(self):
        self.call("POST","/api/setup",{"name":"Admin","email":"admin@example.test","password":"Senha Segura 123!"})
        _,admin,admin_cookie=self.call("POST","/api/login",{"email":"admin@example.test","password":"Senha Segura 123!"})
        status,_,_=self.call("POST","/api/users",{"name":"Consulta","email":"consulta@example.test","role":"Consulta","password":"Senha Consulta 789!"},admin_cookie,admin['csrf'])
        self.assertEqual(status,201)
        status,login,cookie=self.call("POST","/api/login",{"email":"consulta@example.test","password":"Senha Consulta 789!"})
        self.assertEqual(status,200)
        status,result,_=self.call("GET","/api/state",cookie=cookie)
        self.assertEqual(status,200);self.assertEqual(result['state']['users'],[])
        status,_,_=self.call("PUT","/api/state",{"state":result['state'],"revision":result['revision']},cookie,login['csrf'])
        self.assertEqual(status,403)
        status,_,_=self.call("POST","/api/attachments",{},cookie,login['csrf'])
        self.assertEqual(status,403)

    def test_admin_can_upload_and_download_real_romaneio_attachment(self):
        status,setup,_=self.call("POST","/api/setup",{"name":"Admin","email":"admin@example.test","password":"Senha Segura 123!"})
        self.assertEqual(status,200)
        status,login,cookie=self.call("POST","/api/login",{"email":"admin@example.test","password":"Senha Segura 123!"})
        self.assertEqual(status,200)
        pdf=b"%PDF-1.7\nD'ALEX local attachment\n"
        status,uploaded,_=self.call("POST","/api/attachments",{"name":"pedido.pdf","mime":"application/pdf","data":base64.b64encode(pdf).decode()},cookie,login["csrf"])
        self.assertEqual(status,201)
        state=empty_state();state["clients"]=[{"id":"c1","name":"Loja","active":True}]
        state["records"]=[{"id":"ROM-001","clientId":"c1","client":"Loja","stage":"Em fila","receivedOn":"2026-11-04","execution":{"kind":"Interna","workshopId":None},"items":[],"pricing":[],"attachments":[uploaded["reference"]]}]
        status,response,_=self.call("PUT","/api/state",{"state":state,"revision":0},cookie,login["csrf"])
        self.assertEqual(status,200)
        conn=http.client.HTTPConnection("127.0.0.1",self.port,timeout=5)
        conn.request("GET",f"/api/attachments/{uploaded['id']}",headers={"Host":f"127.0.0.1:{self.port}","Cookie":cookie})
        downloaded=conn.getresponse();content=downloaded.read();self.assertEqual(downloaded.status,200);self.assertEqual(content,pdf);conn.close()
        status,_,_=self.call("POST","/api/attachments",{"name":"falso.pdf","mime":"application/pdf","data":base64.b64encode(b"not a pdf").decode()},cookie,login["csrf"])
        self.assertEqual(status,400)

    def test_history_workbook_validates_without_writing_and_imports_once(self):
        _, admin, cookie = self.call("POST", "/api/setup", {
            "name": "Admin", "email": "admin@example.test", "password": "Senha Segura 123!",
        })
        host = f"127.0.0.1:{self.port}"
        headers = {"Host": host, "Cookie": cookie, "Origin": f"http://{host}",
                   "X-Dalex-CSRF": admin["csrf"], "Content-Type": http_server.XLSX}

        def workbook_request(method, path, body=None):
            conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
            try:
                conn.request(method, path, body, headers)
                response = conn.getresponse()
                return response.status, response.read()
            finally:
                conn.close()

        status, template = workbook_request("GET", "/api/history/template")
        self.assertEqual(status, 200)
        workbook = load_workbook(BytesIO(template))
        data = {
            "Clientes": [["Loja"]],
            "Oficinas": [["Costura"]],
            "Funcionários": [["Ana", "Costureira", "50,00"]],
            "Romaneios": [["ANT-1", "Loja", "001", "01/10/2025", "Concluído", "Terceirizada",
                           "Costura", "04/10/2025", "Histórico", "", "007"]],
            "Grades": [["ANT-1", "01", "CAL-1", "Calça", "", "Azul", "Numérico adulto", "34", 1],
                       ["ANT-1", "01", "CAL-1", "Calça", "", "Azul", "Numérico adulto", "36", 2]],
            "Valores": [["ANT-1", "CAL-1", "100,00", "Terceirizada", "Costura", "20,00"]],
            "Notas fiscais": [["007", "05/10/2025", "300,00"]],
            "Parcelas": [["007", 1, "", 200], ["007", 2, "15/10/2025", 100]],
            "Recebimentos": [["R-1", "007", 1, "06/10/2025", 100, "07/10/2025"],
                             ["R-2", "007", 2, "16/10/2025", 100]],
            "Frequência": [["Ana", "02/10/2025", "Presente", 50, 10, 5, "Ajuste de ponto"]],
            "Pag funcionários": [["PF-1", "Ana", "03/10/2025", 55, "Não"]],
            "Pag oficinas": [["PO-1", "Costura", "05/10/2025", 60]],
            "Rateios oficinas": [["PO-1", "ANT-1", "CAL-1", 60]],
        }
        for sheet, rows in data.items():
            for row in rows:
                workbook[sheet].append(row)

        workbook["Recebimentos"]["E3"] = 101
        invalid = BytesIO()
        workbook.save(invalid)
        status, content = workbook_request("POST", "/api/history/preview", invalid.getvalue())
        self.assertEqual(status, 400)
        self.assertIn("Recebimentos, linha 3", json.loads(content)["error"])
        self.assertEqual(http_server.DB.revision(), 0)
        self.assertEqual(http_server.DB.load()["records"], [])
        workbook["Recebimentos"]["E3"] = 100

        output = BytesIO()
        workbook.save(output)
        payload = output.getvalue()

        status, content = workbook_request("POST", "/api/history/preview", payload)
        self.assertEqual(status, 200, content)
        preview = json.loads(content)
        self.assertEqual(preview["counts"]["receipts"], 2)
        self.assertEqual(http_server.DB.revision(), 0)
        self.assertEqual(http_server.DB.load()["records"], [])
        status, content = workbook_request("POST", "/api/history/import?preview=" + preview["token"], payload)
        self.assertEqual(status, 201, content)
        saved = http_server.DB.load()
        self.assertEqual(saved["records"][0]["items"][0]["sizes"], [{"size": "34", "quantity": 1}, {"size": "36", "quantity": 2}])
        self.assertEqual(saved["invoices"][0]["number"], "007")
        self.assertEqual(saved["invoices"][0]["taxCents"], 0)
        self.assertTrue(saved["invoices"][0]["taxExempt"])
        self.assertEqual(saved["employees"][0]["attendanceStartDate"], date.today().isoformat())
        self.assertEqual(saved["invoices"][0]["installments"][0]["amountCents"], 20000)
        self.assertTrue(saved["receipts"][0]["reversedAt"])
        self.assertEqual(saved["workshopPayments"][0]["allocations"][0]["amountCents"], 6000)
        self.assertEqual(saved["attendance"][0]["overtimeCents"], 1000)
        self.assertEqual(saved["employeePayments"][0]["amountCents"], 5500)
        self.assertEqual(saved["audit"][0]["actor"]["name"], "Admin")
        status, _ = workbook_request("POST", "/api/history/import?preview=" + preview["token"], payload)
        self.assertEqual(status, 409)
        self.assertEqual(http_server.DB.revision(), 1)

    def test_backup_restore_and_excel_download_are_admin_only(self):
        status,_,_=self.call("GET","/api/backups")
        self.assertEqual(status,401)
        status,_,_=self.call("POST","/api/setup",{"name":"Admin","email":"admin@example.test","password":"Senha Segura 123!"})
        self.assertEqual(status,200)
        status,login,cookie=self.call("POST","/api/login",{"email":"admin@example.test","password":"Senha Segura 123!"})
        self.assertEqual(status,200)
        csrf=login['csrf']
        status,created,_=self.call("POST","/api/backups",{},cookie,csrf)
        self.assertEqual(status,201)
        status,listing,_=self.call("GET","/api/backups",cookie=cookie)
        self.assertEqual(status,200);self.assertEqual(listing['backups'][0]['name'],created['name'])
        conn=http.client.HTTPConnection("127.0.0.1",self.port,timeout=5)
        host=f"127.0.0.1:{self.port}"
        conn.request("GET",f"/api/backups/{created['name']}",headers={"Host":host,"Cookie":cookie})
        download=conn.getresponse();archive=download.read();self.assertEqual(download.status,200);conn.close()
        conn=http.client.HTTPConnection("127.0.0.1",self.port,timeout=5)
        conn.request("GET","/api/export/excel",headers={"Host":host,"Cookie":cookie})
        excel=conn.getresponse();book=load_workbook(BytesIO(excel.read()),read_only=True);self.assertEqual(excel.status,200);self.assertIn('Romaneios',book.sheetnames);conn.close()
        state=empty_state();state['clients']=[{'id':'c1','name':'Alteração após backup','active':True}]
        status,_,_=self.call("PUT","/api/state",{"state":state,"revision":0},cookie,csrf)
        self.assertEqual(status,200)
        conn=http.client.HTTPConnection("127.0.0.1",self.port,timeout=5)
        conn.request("POST","/api/restore",archive,{"Host":host,"Cookie":cookie,"Origin":f"http://{host}","X-Dalex-CSRF":csrf,"Content-Type":"application/zip"})
        restored=conn.getresponse();payload=json.loads(restored.read());self.assertEqual(restored.status,200);self.assertTrue(payload['restored']);conn.close()
        self.assertEqual(http_server.DB.load()['clients'],[])
        self.assertFalse(http_server.SESSIONS)


if __name__=="__main__":
    unittest.main()
