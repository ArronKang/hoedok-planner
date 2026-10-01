"""가짜 Supabase 서버 — 진짜 계정 없이 동기화를 시험하려고 만든 것.

앱이 쓰는 주소 규칙(src/sync/supabase.js)만 흉내 낸다:
  /auth/v1/signup, /auth/v1/token, /auth/v1/logout, /auth/v1/recover
  /rest/v1/rpc/sync_push, /rest/v1/records
  /storage/v1/object/attachments/...

    python tools/fake_supabase.py            # http://127.0.0.1:54321, 키: test-anon-key
    python tools/fake_supabase.py 54321 --confirm   # 가입하면 확인 메일이 필요한 것처럼
    python tools/fake_supabase.py 54321 --no-signup # 새 가입을 막아 둔 것처럼 (혼자 쓰는 계정)
    python tools/fake_supabase.py 54321 --dump      # 서버에 들어간 기록을 /__dump 로 볼 수 있게 (시험용)

진짜 서버와 같은 규칙: 기록은 로그인한 본인 것만 읽고 쓴다. 같은 레코드는 client_updated_at이 더 큰 쪽이 이긴다.
자료는 메모리에만 있다 (끄면 사라짐).
"""
import json
import secrets
import sys
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 54321
KEY = "test-anon-key"
CONFIRM = "--confirm" in sys.argv
NO_SIGNUP = "--no-signup" in sys.argv  # 진짜 서버에서 '새 가입 받지 않기'를 켠 것처럼

# 시험용 계정 (이 가짜 서버 안에만 있는 값)
TEST_EMAIL = "tester@hoedok.test"
TEST_PASSWORD = "fake-pass-2026"

lock = threading.Lock()
users = {TEST_EMAIL: {"id": "00000000-0000-4000-8000-000000000001", "email": TEST_EMAIL, "password": TEST_PASSWORD}}  # email -> {id, email, password}
tokens = {}     # access_token -> user_id
refresh = {}    # refresh_token -> user_id
records = {}    # (user_id, tbl, id) -> row
files = {}      # path -> (content_type, bytes)
rev = [0]


def session(u):
    at, rt = secrets.token_hex(16), secrets.token_hex(16)
    tokens[at] = u["id"]
    refresh[rt] = u["id"]
    return {"access_token": at, "refresh_token": rt, "token_type": "bearer", "expires_in": 3600, "user": {"id": u["id"], "email": u["email"]}}


class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if "--verbose" in sys.argv:
            super().log_message(fmt, *args)

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "apikey, authorization, content-type, x-upsert, cache-control, prefer")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")

    def send(self, code, body=None, ctype="application/json"):
        data = b"" if body is None else (body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode())
        self.send_response(code)
        self.cors()
        if body is not None:
            self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def json_body(self):
        b = self.body()
        return json.loads(b) if b else {}

    def user(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return tokens.get(auth[7:])
        return None

    def do_OPTIONS(self):
        self.send(204)

    def check_key(self):
        if self.headers.get("apikey") != KEY:
            self.send(401, {"message": "Invalid API key"})
            return False
        return True

    def do_POST(self):
        if not self.check_key():
            return
        u = urlparse(self.path)
        q = parse_qs(u.query)
        with lock:
            if u.path == "/auth/v1/signup":
                if NO_SIGNUP:
                    return self.send(422, {"code": "signup_disabled", "msg": "Signups not allowed for this instance"})
                b = self.json_body()
                email, pw = b.get("email", "").lower(), b.get("password", "")
                if len(pw) < 6:
                    return self.send(422, {"msg": "Password should be at least 6 characters"})
                if email in users:
                    return self.send(422, {"msg": "User already registered"})
                usr = {"id": str(uuid.uuid4()), "email": email, "password": pw}
                users[email] = usr
                if CONFIRM:
                    return self.send(200, {"id": usr["id"], "email": email})
                return self.send(200, session(usr))
            if u.path == "/auth/v1/token":
                b = self.json_body()
                if q.get("grant_type") == ["password"]:
                    usr = users.get(b.get("email", "").lower())
                    if not usr or usr["password"] != b.get("password"):
                        return self.send(400, {"error": "invalid_grant", "error_description": "Invalid login credentials"})
                    return self.send(200, session(usr))
                if q.get("grant_type") == ["refresh_token"]:
                    uid = refresh.pop(b.get("refresh_token", ""), None)
                    usr = next((x for x in users.values() if x["id"] == uid), None)
                    if not usr:
                        return self.send(400, {"error_description": "Invalid Refresh Token"})
                    return self.send(200, session(usr))
            if u.path == "/auth/v1/logout":
                tokens.pop(self.headers.get("Authorization", "")[7:], None)
                return self.send(204)
            if u.path == "/auth/v1/recover":
                return self.send(200, {})
            uid = self.user()
            if not uid:
                return self.send(401, {"message": "JWT expired or missing"})
            if u.path == "/rest/v1/rpc/sync_push":
                items = self.json_body().get("items", [])
                n = 0
                for it in items:
                    k = (uid, it["tbl"], it["id"])
                    cur = records.get(k)
                    cu = int(it.get("client_updated_at") or 0)
                    if cur and cur["client_updated_at"] >= cu:
                        continue  # 서버 쪽이 같거나 더 새로움
                    rev[0] += 1
                    records[k] = {"tbl": it["tbl"], "id": it["id"], "data": it.get("data") or {}, "deleted": bool(it.get("deleted")), "client_updated_at": cu, "rev": rev[0]}
                    n += 1
                return self.send(200, n)
            if u.path.startswith("/storage/v1/object/attachments/"):
                path = unquote(u.path[len("/storage/v1/object/attachments/"):])
                if not path.startswith(uid + "/"):
                    return self.send(403, {"message": "not your folder"})
                files[path] = (self.headers.get("Content-Type", "application/octet-stream"), self.body())
                return self.send(200, {"Key": "attachments/" + path})
        self.send(404, {"message": "not found"})

    def do_GET(self):
        if "--dump" in sys.argv and urlparse(self.path).path == "/__dump":
            with lock:
                return self.send(200, [{"user": ou, **r} for (ou, _, _), r in sorted(records.items(), key=lambda kv: kv[1]["rev"])])
        if not self.check_key():
            return
        u = urlparse(self.path)
        q = parse_qs(u.query)
        uid = self.user()
        if not uid:
            return self.send(401, {"message": "JWT expired or missing"})
        with lock:
            if u.path == "/rest/v1/records":
                after = int((q.get("rev", ["gt.0"])[0]).split(".")[1])
                limit = int(q.get("limit", ["1000"])[0])
                # 기록 공간 나누기: tbl=like.preview:* / tbl=not.like.preview:* (PostgREST의 * = %)
                f = q.get("tbl", [""])[0]
                neg = f.startswith("not.")
                f = f[4:] if neg else f
                pre = f[5:].rstrip("*") if f.startswith("like.") else None

                def keep(r):
                    if pre is None:
                        return True
                    return r["tbl"].startswith(pre) != neg

                rows = sorted((r for (ou, _, _), r in records.items() if ou == uid and r["rev"] > after and keep(r)), key=lambda r: r["rev"])[:limit]
                return self.send(200, rows)
            pre = "/storage/v1/object/authenticated/attachments/"
            if u.path.startswith(pre):
                path = unquote(u.path[len(pre):])
                if not path.startswith(uid + "/") or path not in files:
                    return self.send(404, {"message": "Object not found"})
                ct, data = files[path]
                return self.send(200, data, ct)
        self.send(404, {"message": "not found"})

    def do_DELETE(self):
        if not self.check_key():
            return
        uid = self.user()
        if not uid:
            return self.send(401, {"message": "JWT expired or missing"})
        if urlparse(self.path).path == "/storage/v1/object/attachments":
            with lock:
                for p in self.json_body().get("prefixes", []):
                    if p.startswith(uid + "/"):
                        files.pop(p, None)
            return self.send(200, [])
        self.send(404, {"message": "not found"})


if __name__ == "__main__":
    print(f"fake supabase at http://127.0.0.1:{PORT}  key={KEY}{'  (가입 확인 메일 흉내)' if CONFIRM else ''}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
