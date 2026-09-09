"""Local desktop entry point. Cloud deployments continue to use server.py."""
import argparse
import json
import os
from pathlib import Path
import sqlite3
import threading
import urllib.request
import webbrowser
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent


class LocalServer(ThreadingHTTPServer):
    allow_reuse_address = False


def prepare_data(directory):
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / 'guangjun_screw.db'
    source = ROOT / 'data' / 'guangjun_screw.db'
    if not destination.exists() and source.exists():
        temporary = directory / 'guangjun_screw.initializing.db'
        original = sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)
        copied = sqlite3.connect(temporary)
        try:
            original.backup(copied)
            if copied.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('原始数据库校验失败，请重新复制数据库')
        finally:
            copied.close()
            original.close()
        temporary.replace(destination)


def main():
    parser = argparse.ArgumentParser(description='kingpolymer Windows 本地版')
    parser.add_argument('--port', type=int, default=8731)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    directory = ROOT / 'runtime' / 'local' / 'data'
    url = f'http://127.0.0.1:{args.port}'
    os.environ.update(GJ_HOST='127.0.0.1', GJ_PORT=str(args.port),
                      GJ_DATA_DIR=str(directory),
                      GJ_BACKUP_DIR=str(ROOT / 'runtime' / 'local' / 'backups'),
                      GJ_AUTH_REQUIRED='0', GJ_AUTH_USER='', GJ_AUTH_PASSWORD='')
    import server

    class LocalHandler(server.Handler):
        def do_GET(self):
            if self.path == '/api/local-instance':
                self.send_json({'project': str(ROOT), 'mode': 'local'})
                return
            super().do_GET()

    # Bind before creating data so repeated launches cannot race the first copy.
    try:
        httpd = LocalServer(('127.0.0.1', args.port), LocalHandler)
    except OSError:
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(url + '/api/local-instance', timeout=2) as response:
                identity = json.load(response)
            if identity != {'project': str(ROOT), 'mode': 'local'}:
                raise ValueError('another application')
        except Exception:
            raise RuntimeError(f'端口 {args.port} 已被占用，请使用 start_windows.bat --port 8732') from None
        print(f'本地项目已经运行：{url}')
        if not args.no_browser:
            webbrowser.open(url)
        return
    try:
        prepare_data(directory)
        server.init_db()
        server.automatic_backup()
        print(f'kingpolymer 本地版已启动：{url}', flush=True)
        print(f'本地数据：{directory}\n关闭此窗口或按 Ctrl+C 停止。', flush=True)
        if not args.no_browser:
            threading.Timer(0.5, webbrowser.open, args=(url,)).start()
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n本地服务已停止。')
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
