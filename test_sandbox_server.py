"""Serve a disposable database for browser acceptance testing, never production."""
import os,tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer
import server
if __name__=='__main__':
 with tempfile.TemporaryDirectory(prefix='screw-sandbox-') as directory:
  server.DATA=Path(directory)/'data';server.BACKUPS=Path(directory)/'backups';server.DB_PATH=server.DATA/'test.db'
  server.CONFIRM_CODE='sandbox-only'
  server.init_db()
  port=int(os.environ.get('TEST_PORT','8732'))
  print(f'Sandbox only: http://127.0.0.1:{port}',flush=True)
  ThreadingHTTPServer(('127.0.0.1',port),server.Handler).serve_forever()
