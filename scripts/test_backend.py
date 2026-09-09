"""Run isolated backend integration tests from any working directory."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
environment = {**os.environ, 'PYTHONUTF8':'1', 'PYTHONPATH':os.pathsep.join([str(ROOT/'backend'),str(ROOT/'scripts')])}
for name in ['test_windows_runtime.py','test_web_auth.py','test_barrel_models.py','test_barrel_options.py']:
    subprocess.run([sys.executable,str(ROOT/'tests/backend'/name)], cwd=ROOT, env=environment, check=True)
