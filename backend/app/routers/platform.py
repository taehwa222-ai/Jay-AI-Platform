from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])


@router.get("/overview")
async def overview() -> dict[str, object]:
    return {
        "name": "Jay AI Platform",
        "status": "ready",
        "message": "Clean platform foundation is ready for new custom features.",
        "modules": [],
    }


@router.get("/roadmap")
async def roadmap() -> dict[str, object]:
    return {
        "phases": [
            {
                "id": "foundation",
                "title": "Platform Foundation",
                "status": "active",
                "items": ["FastAPI API", "React dashboard", "Docker deployment", "VPS scripts"],
            },
            {
                "id": "custom",
                "title": "Custom Features",
                "status": "next",
                "items": ["define feature scope", "add data model", "build API", "build UI"],
            },
            {
                "id": "operations",
                "title": "Operations",
                "status": "planned",
                "items": ["auth", "database", "logs", "backups"],
            },
            {
                "id": "release",
                "title": "Release",
                "status": "planned",
                "items": ["domain", "HTTPS", "monitoring", "deployment checklist"],
            },
        ]
    }
