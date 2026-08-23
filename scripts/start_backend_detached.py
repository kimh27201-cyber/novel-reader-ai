import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
PYTHON = BACKEND / ".venv" / "Scripts" / "python.exe"
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
DEFAULT_PORT = 8765


def clean_env():
    env = dict(os.environ)
    values = []
    for key in list(env):
        if key.lower() == "path":
            values.append(env.pop(key))
        elif key.lower() in {"pythonhome", "pythonpath"}:
            env.pop(key)
    env["Path"] = os.pathsep.join(value for value in values if value)
    return env


def probe_backend(port: int) -> str:
    try:
        with urlopen(f"http://127.0.0.1:{port}/api/health/ready", timeout=1) as response:
            if not 200 <= response.status < 300:
                return "wrong_service"
            try:
                payload = json.loads(response.read().decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return "wrong_service"
            if (
                isinstance(payload, dict)
                and payload.get("status") == "ok"
                and str(payload.get("app") or "").startswith("Novel Reader")
                and payload.get("database") == "ready"
                and bool(payload.get("migration"))
            ):
                return "healthy"
            return "wrong_service"
    except HTTPError as error:
        return "unhealthy" if error.code == 503 else "wrong_service"
    except (URLError, TimeoutError, OSError):
        return "unavailable"


def main():
    parser = argparse.ArgumentParser(description="Start the local Novel Reader backend safely.")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("NOVEL_READER_BACKEND_PORT", str(DEFAULT_PORT))),
    )
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")

    initial_state = probe_backend(args.port)
    if initial_state == "healthy":
        print(f"backend already healthy on port {args.port}")
        return 0
    if initial_state == "wrong_service":
        print(
            f"port {args.port} is occupied by a non-Novel Reader service; "
            "choose another port instead of treating it as healthy",
            file=sys.stderr,
        )
        return 3
    if initial_state == "unhealthy":
        print(
            f"Novel Reader backend on port {args.port} is live but not ready; "
            "check database write access and stop the unhealthy process before restarting",
            file=sys.stderr,
        )
        return 4

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
            str(args.port),
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
        state = probe_backend(args.port)
        if state == "healthy":
            print(f"backend pid: {process.pid}, port: {args.port}")
            return 0
        if state == "wrong_service":
            print(f"port {args.port} was taken by another service", file=sys.stderr)
            return 3
        if state == "unhealthy":
            process.terminate()
            print("backend started but database is not writable", file=sys.stderr)
            return 4
        time.sleep(0.5)

    process.terminate()
    print(f"backend started but health check timed out, pid: {process.pid}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
