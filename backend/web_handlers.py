"""Login routes and cookie/CSRF enforcement, without Basic-auth bypass."""
import hmac,json,ipaddress
from http.cookies import SimpleCookie,CookieError
from urllib.parse import urlparse
from web_auth import AuthStore

class AuthMixin:
    def auth_store(self):
        # server.DATA may be changed by isolated acceptance tests.
        import server
        return AuthStore(server.DATA)
    def secure_request(self):
        return self.client_address[0] in ('127.0.0.1','::1') and self.headers.get('X-Forwarded-Proto','').lower()=='https'
    def auth_client_ip(self):
        ip=self.client_address[0]
        if ip in ('127.0.0.1','::1'):
            try:return str(ipaddress.ip_address(self.headers.get('X-Real-IP',ip)))
            except ValueError:pass
        return ip
    def token(self):
        try:
            c=SimpleCookie();c.load(self.headers.get('Cookie',''));return c['kp_session'].value if 'kp_session' in c else ''
        except CookieError:return ''
    def auth_context(self):
        store=self.auth_store();enabled=store.enabled();session=store.session(self.token()) if enabled else None
        return {'enabled':enabled,'authenticated':bool(session),'csrf':session['csrf'] if session else '', 'username':store.username() if session else ''}
    def origin_ok(self):
        origin=self.headers.get('Origin')
        expected=('https' if self.secure_request() else 'http')+'://'+self.headers.get('Host','')
        return (not origin or origin==expected) and self.headers.get('Sec-Fetch-Site')!='cross-site'
    def redirect_login(self):
        self.send_response(303);self.send_header('Location','/login');self.send_header('Content-Length','0');self.send_header('Cache-Control','no-store');self.end_headers()
    def require_auth(self):
        if not self.auth_store().enabled():
            import server
            if server.AUTH_REQUIRED:
                self.send_json({'error':'登录服务暂不可用，请联系管理员'},503);return False
            return True
        auth=self.auth_context()
        if not auth['authenticated']:
            if urlparse(self.path).path.startswith('/api/'):self.send_json({'error':'请先登录','login_required':True},401)
            else:self.redirect_login()
            return False
        if self.command not in ('GET','HEAD'):
            if not self.origin_ok() or not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),auth['csrf']):
                self.send_json({'error':'安全校验失败，请刷新页面后重试'},403);return False
        return True
    def auth_response(self,obj,token='',status=200):
        body=json.dumps(obj,ensure_ascii=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store')
        cookie='kp_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+('28800' if token else '0')
        if self.secure_request():cookie+='; Secure'
        self.send_header('Set-Cookie',cookie);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def auth_public_get(self):
        path=urlparse(self.path).path
        if path=='/api/auth/session':self.send_json(self.auth_context());return True
        if path in ('/login','/brand-logo.svg') or path.startswith('/assets/'):
            self.serve_static('/index.html' if path=='/login' else path);return True
        return False
    def auth_public_post(self):
        if urlparse(self.path).path!='/api/auth/login':return False
        if not self.origin_ok():self.send_json({'error':'跨站登录请求被拒绝'},403);return True
        if not self.secure_request() and self.client_address[0] not in ('127.0.0.1','::1'):
            self.send_json({'error':'请通过 https://kingpolymer.com 安全登录'},403);return True
        store=self.auth_store()
        if not store.enabled():self.send_json({'error':'此本机服务未启用登录保护'},400);return True
        try:
            if int(self.headers.get('Content-Length','0'))>2048:raise ValueError('登录请求过大')
            data=self.body_json();token=store.login(data.get('username',''),data.get('password',''),self.auth_client_ip())
            if not token:self.send_json({'error':'用户名或密码不正确'},401)
            else:self.auth_response({'ok':True},token)
        except PermissionError as e:self.send_json({'error':str(e)},429)
        except (ValueError,AttributeError):self.send_json({'error':'登录信息格式不正确'},400)
        return True
    def auth_private_post(self,path,data):
        if path not in ('/api/auth/logout','/api/auth/password'):return False
        store=self.auth_store()
        if not store.enabled():self.send_json({'error':'本机未启用登录保护'},400);return True
        if path.endswith('/logout'):
            store.logout(self.token());self.auth_response({'ok':True});return True
        password=data.get('new_password','')
        if not isinstance(password,str) or not 10<=len(password)<=128:raise ValueError('新密码须为10至128个字符')
        try:verified=store.login(store.username(),data.get('old_password',''),self.auth_client_ip())
        except PermissionError as e:self.send_json({'error':str(e)},429);return True
        if not verified:self.send_json({'error':'当前密码不正确'},403);return True
        store.set_password(store.username(),password)
        self.auth_response({'ok':True,'message':'密码已修改，所有设备需重新登录'});return True
