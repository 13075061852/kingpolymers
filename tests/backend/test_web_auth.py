"""Authentication integration test; all state lives in temporary directories."""
import base64,gzip,json,os,tempfile,threading,urllib.request,urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer
import server
from web_auth import AuthStore
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None

def run():
 with tempfile.TemporaryDirectory() as temp:
  server.DATA=Path(temp)/'data';server.BACKUPS=Path(temp)/'backups';server.DB_PATH=server.DATA/'test.db';server.AUTH_USER=server.AUTH_PASSWORD='';server.init_db()
  store=AuthStore(server.DATA);store.set_password('kingpolymer','sandbox-password-old')
  http=ThreadingHTTPServer(('127.0.0.1',0),server.Handler);thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
  url=f'http://127.0.0.1:{http.server_port}';opener=urllib.request.build_opener(NoRedirect())
  def req(path,body=None,cookie='',csrf='',extra=None):
   headers={'Content-Type':'application/json'}
   if cookie:headers['Cookie']=cookie
   if csrf:headers['X-CSRF-Token']=csrf
   headers.update(extra or {})
   r=urllib.request.Request(url+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
   try:
    with opener.open(r) as response:return response.status,response.read(),response.headers
   except urllib.error.HTTPError as e:return e.code,e.read(),e.headers
  try:
   assert req('/')[0]==303
   assert req('/login')[0]==200
   asset='/assets/'+next((server.STATIC/'assets').glob('index-*.js')).name
   status,body,headers=req(asset,extra={'Accept-Encoding':'gzip'})
   assert status==200 and headers['Content-Encoding']=='gzip'
   assert gzip.decompress(body)==(server.STATIC/asset.lstrip('/')).read_bytes()
   assert 'immutable' in headers['Cache-Control'] and headers['Vary']=='Accept-Encoding'
   assert req(asset,extra={'Accept-Encoding':'gzip','If-None-Match':headers['ETag']})[0]==304
   assert req(asset,extra={'Accept-Encoding':'gzip;q=0'})[2].get('Content-Encoding') is None
   poster='/assets/login/screw-fallback.webp'
   status,body,headers=req(poster)
   assert status==200 and headers.get('Content-Encoding') is None and headers['Cache-Control']=='no-cache'
   assert req(poster,extra={'If-None-Match':headers['ETag']})[0]==304
   assert req('/api/bootstrap')[0]==401
   assert req('/api/bootstrap',extra={'Authorization':'Basic '+base64.b64encode(b'kingpolymer:sandbox-password-old').decode()})[0]==401
   login={'username':'kingpolymer','password':'sandbox-password-old'}
   assert req('/api/auth/login',login,extra={'Origin':'https://evil.invalid'})[0]==403
   status,body,headers=req('/api/auth/login',login,extra={'X-Forwarded-Proto':'https'})
   assert status==200,(status,body)
   assert all(x in headers['Set-Cookie'] for x in ['HttpOnly','Secure','SameSite=Strict'])
   cookie=headers['Set-Cookie'].split(';')[0]
   csrf=json.loads(req('/api/auth/session',cookie=cookie)[1])['csrf']
   assert csrf and req('/api/bootstrap',cookie=cookie)[0]==200
   assert req('/api/validate',{'machine':'50','sequence':[],'ports':{}},cookie=cookie)[0]==403
   assert req('/api/validate',{'machine':'50','sequence':[],'ports':{}},cookie=cookie,csrf=csrf)[0]==200
   assert req('/api/auth/password',{'old_password':'sandbox-password-old','new_password':'sandbox-password-new'},cookie,csrf,{'Origin':'https://evil.invalid'})[0]==403
   assert req('/api/auth/password',{'old_password':'bad','new_password':'sandbox-password-new'},cookie,csrf)[0]==403
   assert req('/api/auth/password',{'old_password':'sandbox-password-old','new_password':'sandbox-password-new'},cookie,csrf)[0]==200
   assert req('/api/bootstrap',cookie=cookie)[0]==401
   assert req('/api/auth/login',login)[0]==401
   status,body,headers=req('/api/auth/login',{**login,'password':'sandbox-password-new'});assert status==200
   cookie=headers['Set-Cookie'].split(';')[0];csrf=json.loads(req('/api/auth/session',cookie=cookie)[1])['csrf']
   assert req('/api/auth/logout',{},cookie,csrf)[0]==200
   assert req('/api/bootstrap',cookie=cookie)[0]==401
   for _ in range(5):assert req('/api/auth/login',{**login,'password':'wrong'})[0]==401
   assert req('/api/auth/login',{**login,'password':'wrong'})[0]==429
   assert b'sandbox-password-new' not in store.path.read_bytes()
   if os.name != 'nt':assert store.path.stat().st_mode&0o777==0o600
  finally:http.shutdown();http.server_close();thread.join()
 print('PASS: branded login, cookie flags, CSRF/origin enforcement, password rotation, session invalidation, logout, no Basic bypass, throttling, hashed passwords')
if __name__=='__main__':run()
