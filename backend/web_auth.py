"""Cookie login independent of the engineering database. No plaintext passwords."""
import hashlib,hmac,secrets,sqlite3,time,threading
from pathlib import Path
from collections import defaultdict,deque

_failures=defaultdict(deque)
_lock=threading.Lock()
ITERATIONS=600000
class ClosingConnection(sqlite3.Connection):
    """Commit/rollback and release file handles on context exit, also on Windows."""
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()

class AuthStore:
    def __init__(self,data): self.path=Path(data)/'web_auth.db'
    def connect(self):
        self.path.parent.mkdir(parents=True,exist_ok=True)
        c=sqlite3.connect(self.path,timeout=10,factory=ClosingConnection);c.row_factory=sqlite3.Row
        c.executescript('CREATE TABLE IF NOT EXISTS account(username TEXT PRIMARY KEY,salt TEXT,hash TEXT); CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,csrf TEXT,expires INTEGER);')
        self.path.chmod(0o600)
        return c
    def enabled(self): return self.path.is_file()
    def initialize(self,user,password):
        if not self.enabled() and user and password:self.set_password(user,password)
    def set_password(self,user,password):
        if not isinstance(password,str) or not 10<=len(password)<=128:raise ValueError('新密码须为10至128个字符')
        salt=secrets.token_hex(24);hashed=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),ITERATIONS).hex()
        with self.connect() as c:
            c.execute('DELETE FROM account');c.execute('INSERT INTO account VALUES(?,?,?)',(user,salt,hashed));c.execute('DELETE FROM sessions')
    def verify(self,user,password):
        if not isinstance(user,str) or not isinstance(password,str) or len(password)>128:return False
        with self.connect() as c:r=c.execute('SELECT * FROM account LIMIT 1').fetchone()
        if not r:return False
        got=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(r['salt']),ITERATIONS).hex()
        return hmac.compare_digest(got,r['hash']) and hmac.compare_digest(user.encode(),r['username'].encode())
    def username(self):
        with self.connect() as c:return c.execute('SELECT username FROM account LIMIT 1').fetchone()[0]
    def session(self,token):
        if not token or not self.enabled():return None
        with self.connect() as c:
            r=c.execute('SELECT csrf,expires FROM sessions WHERE token_hash=? AND expires>?',(hashlib.sha256(token.encode()).hexdigest(),int(time.time()))).fetchone()
        return dict(r) if r else None
    def login(self,user,password,ip):
        now=time.monotonic()
        with _lock:
            q=_failures[ip]
            while q and q[0]<now-300:q.popleft()
            if len(q)>=5:raise PermissionError('尝试过多，请5分钟后重试')
        if not self.verify(user,password):
            with _lock:_failures[ip].append(now)
            return None
        with _lock:_failures.pop(ip,None)
        token=secrets.token_urlsafe(32);csrf=secrets.token_urlsafe(32)
        with self.connect() as c:
            c.execute('DELETE FROM sessions WHERE expires<=?',(int(time.time()),))
            c.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),csrf,int(time.time())+28800))
        return token
    def logout(self,token):
        with self.connect() as c:c.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
