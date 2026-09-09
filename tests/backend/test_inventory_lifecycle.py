"""Regression coverage for stock concurrency, actual refunds and stale edit forms."""
import json
import tempfile
import threading
import urllib.request
import urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
import server

def run():
    with tempfile.TemporaryDirectory(prefix='kingpolymer-inventory-test-') as temp:
        server.DATA=Path(temp)/'data';server.BACKUPS=Path(temp)/'backups';server.DB_PATH=server.DATA/'test.db'
        server.AUTH_REQUIRED=False;server.AUTH_USER=server.AUTH_PASSWORD='';server.CONFIRM_CODE='regression-only'
        server.init_db()
        class Quiet(server.Handler):
            def log_message(self,*args):pass
        http=ThreadingHTTPServer(('127.0.0.1',0),Quiet)
        thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
        url=f'http://127.0.0.1:{http.server_port}'
        def call(path,body=None):
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            req=urllib.request.Request(url+path,data=None if body is None else json.dumps(body).encode(),headers={'Content-Type':'application/json'})
            try:
                with opener.open(req,timeout=15) as r:return r.status,json.load(r)
            except urllib.error.HTTPError as r:return r.code,json.load(r)
        try:
            _,boot=call('/api/bootstrap');comp=next(c for c in boot['components'] if c['machine']=='50')
            name,cid=comp['name'],comp['id']
            def save(name_suffix):
                status,r=call('/api/projects',{'machine':'50','sequence':[name],'ports':{},'metadata':{'drawing_name':name_suffix},'override_reason':'regression test','confirm_code':server.CONFIRM_CODE})
                assert status==200,(status,r)
                return r['id']
            assert call('/api/inventory/adjust',{'component_id':cid,'mode':'set','quantity':100})[0]==200
            pid=save('concurrent')
            def release(_):return call('/api/projects/'+pid+'/release',{'reason':'regression','confirm_code':server.CONFIRM_CODE})[0]
            with ThreadPoolExecutor(2) as pool:statuses=list(pool.map(release,range(2)))
            assert sorted(statuses)==[200,409],statuses
            with server.db() as c:assert c.execute('SELECT stock FROM components WHERE id=?',(cid,)).fetchone()[0]==98
            def void(_):return call('/api/projects/'+pid+'/void',{'reason':'regression'})[0]
            with ThreadPoolExecutor(2) as pool:statuses=list(pool.map(void,range(2)))
            assert sorted(statuses)==[200,409],statuses
            with server.db() as c:assert c.execute('SELECT stock FROM components WHERE id=?',(cid,)).fetchone()[0]==100
            assert release(0)==409
            # Unknown inventory at publication, then recorded later: no phantom refund.
            with server.db() as c:c.execute('UPDATE components SET stock=NULL WHERE id=?',(cid,))
            unknown=save('unknown')
            assert call('/api/projects/'+unknown+'/release',{'reason':'test','confirm_code':server.CONFIRM_CODE})[0]==200
            call('/api/inventory/adjust',{'component_id':cid,'mode':'set','quantity':40})
            assert call('/api/projects/'+unknown+'/void',{'reason':'test'})[0]==200
            with server.db() as c:assert c.execute('SELECT stock FROM components WHERE id=?',(cid,)).fetchone()[0]==40
            # Metadata edits posted with old stock must not roll inventory back.
            stale={**comp,'stock':1,'note':'updated engineering note'}
            assert call('/api/components',stale)[0]==200
            with server.db() as c:assert c.execute('SELECT stock FROM components WHERE id=?',(cid,)).fetchone()[0]==40
            for payload in [{'mode':'set','quantity':-1},{'mode':'add','quantity':-41},{'mode':'wrong','quantity':10},{'mode':'set','quantity':2.8}]:
                assert call('/api/inventory/adjust',{'component_id':cid,**payload})[0]==400,payload
            assert call('/api/components',{**comp,'name':'renamed-reference'})[0]==409
            assert call('/api/components',{**comp,'length':30.5})[0]==400
            original=call('/api/bootstrap')[1]['components'][0]
            duplicate={k:v for k,v in original.items() if k!='id'}
            duplicate['length']=999
            assert call('/api/components',duplicate)[0]==409
            with server.db() as c:assert c.execute('SELECT length FROM components WHERE id=?',(original['id'],)).fetchone()[0]==original['length']
            with server.db() as c:assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
            print('Stock regression checks passed: serialized lifecycle, actual refunds, stale forms, integer validation')
        finally:http.shutdown();http.server_close();thread.join()
if __name__=='__main__':run()
