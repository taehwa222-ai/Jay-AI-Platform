$ErrorActionPreference = "Stop"

Push-Location frontend
try {
    $env:VITE_API_BASE_URL = "http://127.0.0.1:8001"
    npm run dev -- --host 127.0.0.1 --port 5173
}
finally {
    Pop-Location
}
