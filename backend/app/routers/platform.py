from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])


@router.get("/overview")
async def overview() -> dict[str, object]:
    return {
        "name": "Jay AI Internal Business OS",
        "status": "ready",
        "message": "대표 1인의 투자 리서치와 콘텐츠 생산을 한곳에서 처리합니다.",
        "modules": ["stock-lab", "content-ops"],
    }


@router.get("/modules")
async def modules() -> dict[str, object]:
    return {
        "modules": [
            {
                "id": "stock-lab",
                "title": "주식 분석 Lab",
                "status": "active",
                "description": (
                    "보유종목, 관심종목, 시세, 공시, AI 분석과 내부 리포트를 관리합니다."
                ),
                "items": ["portfolio", "watchlist", "analysis", "disclosures"],
            },
            {
                "id": "content-ops",
                "title": "Content Ops",
                "status": "active",
                "description": "YouTube와 이모티콘 Markdown 작업물을 조회하고 편집합니다.",
                "items": ["youtube", "emoticon", "markdown editor", "templates"],
            },
        ]
    }


@router.get("/manual")
async def manual() -> dict[str, object]:
    return {
        "sections": [
            {
                "id": "local-run",
                "title": "로컬 실행",
                "summary": "사내 운영 시스템을 로컬에서 실행합니다.",
                "commands": [
                    "powershell.exe -ExecutionPolicy Bypass -File scripts\\start-local-dev.ps1",
                    "http://127.0.0.1:5173",
                ],
                "checks": ["team login", "stock lab", "content ops"],
            },
            {
                "id": "daily-backup",
                "title": "SQLite 일일 백업",
                "summary": "운영 DB를 SQLite online backup API로 하루 한 번 보존합니다.",
                "commands": ["python scripts\\backup_db.py"],
                "checks": ["dated backup exists", "integrity check succeeds"],
            },
        ]
    }


@router.get("/roadmap")
async def roadmap() -> dict[str, object]:
    return {
        "phases": [
            {
                "id": "internal-os",
                "title": "Internal Business OS",
                "status": "active",
                "items": ["stock lab", "content ops", "WAL backup", "personal notifications"],
            }
        ]
    }
