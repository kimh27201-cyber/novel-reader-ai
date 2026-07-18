import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
PYTHON = BACKEND / ".venv" / "Scripts" / "python.exe"
LOG_DIR = ROOT.parent / "novel-reader-backend-logs"
LOG_DIR.mkdir(exist_ok=True)


def clean_env():
    env = dict(os.environ)
    values = []
    for key in list(env):
        if key.lower() == "path":
            values.append(env.pop(key))
    env["Path"] = os.pathsep.join(value for value in values if value)
    return env


def health_ok():
    try:
        with urlopen("http://127.0.0.1:8000/api/health", timeout=1) as response:
            return 200 <= response.status < 300
    except Exception:
        return False


def main():
    if health_ok():
        print("backend already healthy")
        return 0

    stdout = open(LOG_DIR / "uvicorn.out.log", "ab")
    stderr = open(LOG_DIR / "uvicorn.err.log", "ab")
    create_breakaway_from_job = 0x01000000
    creationflags = (
        subprocess.CREATE_NEW_PROCESS_GROUP
        | subprocess.DETACHED_PROCESS
        | create_breakaway_from_job
    )
    process = subprocess.Popen(
        [
            str(PYTHON),
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
        ],
        cwd=str(BACKEND),
        env=clean_env(),
        stdout=stdout,
        stderr=stderr,
        stdin=subprocess.DEVNULL,
        creationflags=creationflags,
        close_fds=True,
    )

    for _ in range(20):
        if process.poll() is not None:
            print(f"backend exited early: {process.returncode}")
            return process.returncode or 1
        if health_ok():
            print(f"backend pid: {process.pid}")
            return 0
        time.sleep(0.5)

    print(f"backend started but health check timed out, pid: {process.pid}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
