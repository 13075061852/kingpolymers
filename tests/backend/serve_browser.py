"""Disposable browser acceptance server. Uses only temporary business/auth databases."""
import argparse
import sys
import tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'backend'))
import server
parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=8734)
parser.add_argument('--auth',action='store_true')
args=parser.parse_args()
with tempfile.TemporaryDirectory(prefix='kingpolymer-react-ui-') as temp:
    server.DATA=Path(temp)/'data';server.BACKUPS=Path(temp)/'backups';server.DB_PATH=server.DATA/'test.db'
    server.AUTH_REQUIRED=args.auth
    server.AUTH_USER='ui-engineer' if args.auth else ''
    server.AUTH_PASSWORD='ui-test-password' if args.auth else ''
    server.CONFIRM_CODE='sandbox-only'
    server.init_db()
    class QuietHandler(server.Handler):
        def log_message(self,*args): pass
    print(f'Disposable browser test: http://127.0.0.1:{args.port}',flush=True)
    http=ThreadingHTTPServer(('127.0.0.1',args.port),QuietHandler)
    try:http.serve_forever()
    except KeyboardInterrupt:pass
    finally:http.server_close()
