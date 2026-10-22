#!/usr/bin/env python3
"""
Local HTTP & Storage Server for ปกครอง Diary (Admin Law Exam Prep WebApp).
Serves static files from /Users/tanadon/Desktop/Admin Law, persists
user study progress, notes, and custom rulings to data/user_state.json,
and supports uploading / scanning additional PDF volumes of แนวคำวินิจฉัยของศาลปกครอง.
"""
import http.server
import json
import os
import socketserver
import subprocess
import sys
from urllib.parse import unquote, urlparse

PORT = int(os.environ.get("PORT", "8414"))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(BASE_DIR, "data", "user_state.json")
BUILD_SCRIPT = os.path.join(BASE_DIR, "scripts", "build_dataset.py")
DATASET_JSON = os.path.join(BASE_DIR, "data", "vol14_data.json")


class AdminLawHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if os.path.exists(STATE_FILE):
                with open(STATE_FILE, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b"{}")
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            try:
                data = json.loads(raw.decode("utf-8"))
                os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
                with open(STATE_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if parsed.path == "/api/upload-pdf":
            length = int(self.headers.get("Content-Length", "0"))
            raw_filename = unquote(self.headers.get("X-Filename", "uploaded_volume.pdf"))
            safe_filename = os.path.basename(raw_filename)
            if not safe_filename.lower().endswith(".pdf"):
                safe_filename += ".pdf"
            target_path = os.path.join(BASE_DIR, safe_filename)
            try:
                raw_bytes = self.rfile.read(length)
                with open(target_path, "wb") as f:
                    f.write(raw_bytes)
                proc = subprocess.run(
                    [sys.executable, BUILD_SCRIPT],
                    cwd=BASE_DIR,
                    capture_output=True,
                    text=True,
                    timeout=180,
                )
                meta = {}
                if os.path.exists(DATASET_JSON):
                    with open(DATASET_JSON, "r", encoding="utf-8") as jf:
                        meta = json.load(jf).get("book_meta", {})
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(
                    json.dumps(
                        {
                            "ok": proc.returncode == 0,
                            "filename": safe_filename,
                            "meta": meta,
                            "log": proc.stdout,
                        },
                        ensure_ascii=False,
                    ).encode("utf-8")
                )
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if parsed.path == "/api/rebuild":
            try:
                proc = subprocess.run(
                    [sys.executable, BUILD_SCRIPT],
                    cwd=BASE_DIR,
                    capture_output=True,
                    text=True,
                    timeout=180,
                )
                meta = {}
                if os.path.exists(DATASET_JSON):
                    with open(DATASET_JSON, "r", encoding="utf-8") as jf:
                        meta = json.load(jf).get("book_meta", {})
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(
                    json.dumps(
                        {
                            "ok": proc.returncode == 0,
                            "meta": meta,
                            "log": proc.stdout,
                        },
                        ensure_ascii=False,
                    ).encode("utf-8")
                )
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), AdminLawHandler) as httpd:
        print(f"ปกครอง Diary running at http://localhost:{PORT}")
        httpd.serve_forever()
