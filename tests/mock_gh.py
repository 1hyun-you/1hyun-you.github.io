# GitHub 저장소 파일 API 흉내 (동기화 시험용): GET/PUT /repos/{o}/{r}/contents/builds.json, GET /repos/{o}/{r}
import base64, hashlib, json, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
TOKEN = 'github_pat_TEST'; OWNER = 'tester'; REPO = 'tem-tree-sync'
STATE = {'file': None, 'sha': None, 'puts': 0, 'gets': 0, 'n304': 0, 'slow': 0}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, X-GitHub-OTP, X-Requested-With')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
        self.send_header('Access-Control-Expose-Headers', 'ETag')
    def reply(self, code, obj=None, extra=None):
        body = json.dumps(obj).encode() if obj is not None else b''
        self.send_response(code); self.cors()
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_OPTIONS(self): self.reply(204)
    def auth(self):
        a = self.headers.get('Authorization', '')
        if a != 'Bearer ' + TOKEN: self.reply(401, {'message': 'Bad credentials'}); return False
        return True
    def do_GET(self):
        if self.path == '/__state': return self.reply(200, {k: v for k, v in STATE.items() if k != 'file'} | {'doc': json.loads(base64.b64decode(STATE['file'])) if STATE['file'] else None})
        if not self.auth(): return
        base = f'/repos/{OWNER}/{REPO}'
        if self.path == base: return self.reply(200, {'name': REPO, 'private': True})
        if self.path == base + '/contents/builds.json':
            STATE['gets'] += 1
            if not STATE['file']: return self.reply(404, {'message': 'Not Found'})
            etag = '"' + STATE['sha'] + '"'
            if self.headers.get('If-None-Match') == etag: STATE['n304'] += 1; return self.reply(304, None, {'ETag': etag})
            return self.reply(200, {'sha': STATE['sha'], 'content': STATE['file'], 'encoding': 'base64'}, {'ETag': etag})
        return self.reply(404, {'message': 'Not Found'})
    def do_PUT(self):
        if self.path == '/__slow':
            n = int(self.headers.get('Content-Length', 0)); STATE['slow'] = float(self.rfile.read(n) or b'0'); return self.reply(200, {})
        if self.path == '/__seed':
            n = int(self.headers.get('Content-Length', 0)); raw = self.rfile.read(n)
            STATE.update({'file': base64.b64encode(raw).decode(), 'sha': hashlib.sha1(raw).hexdigest(), 'puts': 0, 'gets': 0, 'n304': 0}); return self.reply(200, {})
        if self.path == '/__reset': STATE.update({'file': None, 'sha': None, 'puts': 0, 'gets': 0, 'n304': 0}); return self.reply(200, {})
        if not self.auth(): return
        if self.path != f'/repos/{OWNER}/{REPO}/contents/builds.json': return self.reply(404, {'message': 'Not Found'})
        n = int(self.headers.get('Content-Length', 0)); body = json.loads(self.rfile.read(n))
        if STATE['slow']: time.sleep(STATE['slow'])
        if STATE['file'] and not body.get('sha'): return self.reply(422, {'message': 'sha wasn\'t supplied'})
        if STATE['file'] and body.get('sha') != STATE['sha']: return self.reply(409, {'message': 'conflict'})
        STATE['file'] = body['content']; STATE['sha'] = hashlib.sha1((body['content'] + str(time.time())).encode()).hexdigest(); STATE['puts'] += 1
        return self.reply(200, {'content': {'sha': STATE['sha']}})
ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8771), H).serve_forever()
