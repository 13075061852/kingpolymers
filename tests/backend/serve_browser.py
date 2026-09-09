"""Disposable UI acceptance server: Python tests/ backend runner, port 8734."""
import sys
import tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'backend'))
import server
with tempfile.TemporaryDirectory(prefix='kingpolymer-react-ui-') as temp:
    server.DATA=Path(temp)/'data';server.BACKUPS=Path(temp)/'backups';server.DB_PATH=server.DATA/'test.db'
    server.AUTH_REQUIRED=False;server.AUTH_USER=server.AUTH_PASSWORD='';server.CONFIRM_CODE='sandbox-only'
    server.init_db()
    print('Disposable browser test: http://127.0.0.1:8734',flush=True)
    http=ThreadingHTTPServer(('127.0.0.1',8734),server.Handler)
    try:http.serve_forever()
    except KeyboardInterrupt:pass
    finally:http.server_close()
