$ErrorActionPreference = "Stop"

uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
