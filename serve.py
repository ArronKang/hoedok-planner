"""로컬 개발 서버 (빌드 도구 없이 정적 파일 제공).

사용법:
    python serve.py            # http://localhost:5173
    python serve.py 5180       # 다른 포트
    python serve.py 5173 --lan # 같은 와이파이의 기기에서 접속 허용 (방화벽 확인 창이 뜰 수 있음)

주의: 서비스 워커(오프라인)와 설치(PWA)는 https 또는 localhost에서만 동작한다.
"""
import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 5173
HOST = "0.0.0.0" if "--lan" in sys.argv else "127.0.0.1"

TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".md": "text/markdown; charset=utf-8",
    ".sql": "text/plain; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **TYPES}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "--verbose" in sys.argv:
            super().log_message(fmt, *args)


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer((HOST, PORT), functools.partial(Handler, directory=ROOT))
    print(f"serving {ROOT} at http://{'localhost' if HOST == '127.0.0.1' else HOST}:{PORT}", flush=True)
    server.serve_forever()
