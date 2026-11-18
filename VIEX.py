"""VIEX ERP desktop launcher."""
from __future__ import annotations

import os
import queue
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent
ASSETS = Path(getattr(sys, "_MEIPASS", ROOT)) / "dist" / "brand"
sys.path.insert(0, str(ROOT))


def create_server():
    from backend import http_server
    if os.environ.get("VIEX_PORT"):
        http_server.PORT = int(os.environ["VIEX_PORT"])
    return http_server.serve()


def console_main():
    server = create_server()
    print(f"VIEX ERP ativo em http://127.0.0.1:{server.server_port}/")
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def main():
    if os.environ.get("DALEX_OPEN_BROWSER", "1").lower() in ("0", "false") or "--console" in sys.argv:
        return console_main()

    import tkinter as tk
    from tkinter import messagebox

    navy, teal, background = "#122B43", "#087F82", "#F2F7F8"
    if sys.platform == "win32":
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("VIEX.ERP.Local")
    root = tk.Tk()
    root.title("VIEX ERP")
    root.geometry("460x350")
    root.resizable(False, False)
    root.configure(bg=background)
    if sys.platform == "win32":
        root.iconbitmap(str(ASSETS / "viex.ico"))
    logo = tk.PhotoImage(file=str(ASSETS / "viex-icon.png")).subsample(6, 6)
    root.iconphoto(True, logo)
    header = tk.Frame(root, bg=navy, padx=28, pady=24)
    header.pack(fill="x")
    tk.Label(header, image=logo, bg=navy).pack(side="left", padx=(0, 18))
    text = tk.Frame(header, bg=navy)
    text.pack(side="left")
    tk.Label(text, text="VIEX ERP", font=("Segoe UI", 24, "bold"), bg=navy, fg="white").pack(anchor="w")
    tk.Label(text, text="Gestão da sua operação", font=("Segoe UI", 11), bg=navy, fg="#9DD8D6").pack(anchor="w")
    content = tk.Frame(root, bg=background, padx=28, pady=18)
    content.pack(fill="both", expand=True)
    status = tk.StringVar(value="Iniciando o aplicativo…")
    tk.Label(content, textvariable=status, font=("Segoe UI", 11), fg=navy, bg=background, wraplength=400, justify="left").pack(anchor="w", pady=(0, 14))
    events = queue.Queue()
    closing = threading.Event()
    running = {"server": None, "address": ""}

    def open_app():
        if running["address"]:
            webbrowser.open(running["address"])

    open_button = tk.Button(content, text="Abrir VIEX ERP", command=open_app, state="disabled", bg=teal, fg="white", disabledforeground="#B8DBDC", activebackground="#06686B", activeforeground="white", font=("Segoe UI", 11, "bold"), relief="flat", padx=18, pady=10)
    open_button.pack(fill="x")
    tk.Label(content, text="Mantenha esta janela aberta durante o uso.", bg=background, fg="#526873", font=("Segoe UI", 9)).pack(anchor="w", pady=(12, 0))

    def serve_app():
        server = None
        try:
            server = create_server()
            if closing.is_set():
                return
            events.put(("ready", (server, f"http://127.0.0.1:{server.server_port}/")))
            server.serve_forever(poll_interval=0.25)
        except Exception as error:
            events.put(("error", str(error)))
        finally:
            if server is not None:
                server.server_close()

    def receive_events():
        try:
            while True:
                kind, value = events.get_nowait()
                if kind == "ready":
                    running["server"], running["address"] = value
                    status.set("Aplicativo ativo neste computador.")
                    open_button.configure(state="normal")
                    open_app()
                else:
                    status.set("Não foi possível iniciar o aplicativo.")
                    messagebox.showerror("VIEX ERP", value, parent=root)
        except queue.Empty:
            pass
        if not closing.is_set():
            root.after(150, receive_events)

    def stop():
        closing.set()
        server = running["server"]
        if server is not None:
            server.shutdown()
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", stop)
    threading.Thread(target=serve_app, name="viex-local-server", daemon=True).start()
    root.after(150, receive_events)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
