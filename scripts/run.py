"""Create the local environment, build React, and run the same backend on Windows/Linux."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8731)
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--api-only', action='store_true', help='Skip the frontend build when using Vite development mode')
    args = parser.parse_args()
    os.chdir(ROOT)
    os.environ['PYTHONUTF8'] = '1'
    if sys.version_info < (3,11):
        raise RuntimeError('Please install Python 3.11 or newer.')
    environment = ROOT / 'runtime' / 'venv'
    python = environment / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not python.exists():
        subprocess.run([sys.executable, '-m', 'venv', str(environment)], check=True)
    installed = subprocess.run([str(python), '-c', 'import pymupdf, openpyxl'], capture_output=True)
    if installed.returncode:
        subprocess.run([str(python), '-m', 'pip', 'install', '-r', 'backend/requirements-lock.txt'], check=True)
    if not args.api_only:
        npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
        if not npm:
            raise RuntimeError('Please install Node.js 22.12+ or 24 LTS, then restart this launcher.')
        if not (ROOT / 'node_modules' / '.package-lock.json').exists() or (ROOT / 'package-lock.json').stat().st_mtime > (ROOT / 'node_modules' / '.package-lock.json').stat().st_mtime:
            subprocess.run([npm, 'ci'], check=True)
        subprocess.run([npm, 'run', 'build'], check=True)
    command = [str(python), '-u', str(ROOT / 'scripts' / 'start_local.py'), '--port', str(args.port)]
    if args.no_browser:
        command.append('--no-browser')
    try:
        return subprocess.call(command)
    except KeyboardInterrupt:
        return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Startup failed: {error}', file=sys.stderr)
        sys.exit(1)
