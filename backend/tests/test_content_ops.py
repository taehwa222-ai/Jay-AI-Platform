from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def create_admin(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "admin@example.com", "password": "password123", "name": "Admin"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def test_list_youtube_projects_returns_empty_when_directory_is_missing():
    with TestClient(app) as client:
        token = create_admin(client)
        response = client.get(
            "/api/v1/content-ops/youtube",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json() == []


def test_list_and_get_youtube_project():
    project_dir = get_settings().content_dir / "youtube" / "2026-08-08-content-ops-api"
    project_dir.mkdir(parents=True)
    (project_dir / "research.md").write_text("# Research", encoding="utf-8")
    (project_dir / "ideas.md").write_text("# Ideas", encoding="utf-8")

    with TestClient(app) as client:
        token = create_admin(client)
        headers = {"Authorization": f"Bearer {token}"}
        listed = client.get("/api/v1/content-ops/youtube", headers=headers)
        detail = client.get(
            "/api/v1/content-ops/youtube/2026-08-08-content-ops-api",
            headers=headers,
        )

    assert listed.status_code == 200
    listed_body = listed.json()
    assert len(listed_body) == 1
    assert listed_body[0]["slug"] == "2026-08-08-content-ops-api"
    assert listed_body[0]["date"] == "2026-08-08"
    assert listed_body[0]["has_research"] is True
    assert listed_body[0]["has_ideas"] is True
    assert listed_body[0]["has_qa"] is False
    assert listed_body[0]["has_script"] is False
    assert listed_body[0]["has_production"] is False
    assert listed_body[0]["has_review"] is False
    assert listed_body[0]["updated_at"]

    assert detail.status_code == 200
    assert detail.json() == {
        "slug": "2026-08-08-content-ops-api",
        "date": "2026-08-08",
        "research": "# Research",
        "ideas": "# Ideas",
        "qa": None,
        "script": None,
        "production": None,
        "review": None,
        "review_metrics": None,
    }
    assert listed_body[0]["view_count"] is None


def test_review_metrics_are_parsed_from_review_markdown_table():
    project_dir = get_settings().content_dir / "youtube" / "2026-08-09-review-metrics"
    project_dir.mkdir(parents=True)
    (project_dir / "review.md").write_text(
        "\n".join(
            [
                "# review.md",
                "| 항목 | 수치 |",
                "|---|---|",
                "| 조회수 | 12,345 |",
                "| 노출 대비 클릭률(CTR) | 4.2% |",
                "| 평균 시청 지속시간 | 0:38 |",
                "| 구독자 증감 | +12 |",
                "| 좋아요 / 댓글 / 공유 | 320 / 15 / 8 |",
                "| 트래픽 소스 1위 | 미연동 |",
            ]
        ),
        encoding="utf-8",
    )

    with TestClient(app) as client:
        token = create_admin(client)
        headers = {"Authorization": f"Bearer {token}"}
        listed = client.get("/api/v1/content-ops/youtube", headers=headers)
        detail = client.get(
            "/api/v1/content-ops/youtube/2026-08-09-review-metrics",
            headers=headers,
        )

    assert listed.json()[0]["view_count"] == "12,345"
    assert detail.json()["review_metrics"] == {
        "view_count": "12,345",
        "ctr": "4.2%",
        "avg_watch_time": "0:38",
        "subscriber_delta": "+12",
        "engagement": "320 / 15 / 8",
        "top_traffic_source": None,
    }


def test_review_metrics_are_none_when_review_is_missing_or_unfilled():
    project_dir = get_settings().content_dir / "youtube" / "2026-08-09-no-metrics"
    project_dir.mkdir(parents=True)
    (project_dir / "review.md").write_text(
        "# review.md\n프로젝트를 아직 게시하지 않았다.\n", encoding="utf-8"
    )

    with TestClient(app) as client:
        token = create_admin(client)
        headers = {"Authorization": f"Bearer {token}"}
        detail = client.get(
            "/api/v1/content-ops/youtube/2026-08-09-no-metrics",
            headers=headers,
        )

    assert detail.json()["review_metrics"] is None


def test_member_cannot_list_youtube_projects():
    with TestClient(app) as client:
        create_admin(client)
        member_signup = client.post(
            "/api/v1/auth/signup",
            json={"email": "member@example.com", "password": "password123", "name": "Member"},
        )
        member_token = member_signup.json()["access_token"]
        response = client.get(
            "/api/v1/content-ops/youtube",
            headers={"Authorization": f"Bearer {member_token}"},
        )

    assert response.status_code == 403


def test_missing_and_traversal_youtube_projects_return_404():
    with TestClient(app) as client:
        token = create_admin(client)
        headers = {"Authorization": f"Bearer {token}"}
        missing = client.get("/api/v1/content-ops/youtube/not-found", headers=headers)
        traversal = client.get(
            "/api/v1/content-ops/youtube/..%2F..%2Fetc",
            headers=headers,
        )

    assert missing.status_code == 404
    assert missing.json()["detail"] == "Project not found."
    assert traversal.status_code == 404
