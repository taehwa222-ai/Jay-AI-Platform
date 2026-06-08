from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])


@router.get("/overview")
async def overview() -> dict[str, object]:
    return {
        "name": "Jay AI Platform",
        "status": "ready",
        "message": "AI revenue platform foundation for team operations and custom modules.",
        "modules": [
            "member-auth",
            "admin-console",
            "operation-manual",
            "auto-deploy",
            "korea-stock-lab",
            "portfolio-manager",
            "revenue-lab",
        ],
    }


@router.get("/modules")
async def modules() -> dict[str, object]:
    return {
        "modules": [
            {
                "id": "member-auth",
                "title": "회원가입/로그인",
                "status": "active",
                "description": "팀원이 각자 계정으로 접속하고 권한을 분리하는 기본 기능입니다.",
                "items": ["email signup", "login", "logout", "role based access"],
            },
            {
                "id": "admin-console",
                "title": "관리페이지",
                "status": "active",
                "description": (
                    "회원, 권한, 결제, 사용량, 공지, 기능 노출을 관리하는 운영 화면입니다."
                ),
                "items": ["member list", "role control", "account activation", "service settings"],
            },
            {
                "id": "operation-manual",
                "title": "운영 매뉴얼",
                "status": "active",
                "description": (
                    "로컬 개발부터 GitHub, VPS 배포까지 반복 가능한 절차를 화면에서 제공합니다."
                ),
                "items": ["local setup", "local run", "git push", "vps deploy"],
            },
            {
                "id": "auto-deploy",
                "title": "자동 배포",
                "status": "active",
                "description": "로컬 한 줄 배포와 GitHub push 자동 배포를 지원합니다.",
                "items": ["local deploy script", "GitHub Actions", "SSH deploy", "health check"],
            },
            {
                "id": "korea-stock-lab",
                "title": "국내 주식 분석",
                "status": "active",
                "description": (
                    "거래량, RSI, MACD, 가격 변화율을 입력해 관심 후보와 리스크를 정리합니다."
                ),
                "items": ["condition scoring", "volume signal", "RSI/MACD", "AI summary"],
            },
            {
                "id": "portfolio-manager",
                "title": "내 주식 관리",
                "status": "active",
                "description": (
                    "보유 종목, 평단가, 현재가, 손익, 투자 근거, 리스크 메모를 관리합니다."
                ),
                "items": ["holdings", "profit/loss", "risk memo", "current price update"],
            },
            {
                "id": "revenue-lab",
                "title": "수익화 실험",
                "status": "planned",
                "description": "구독, 리포트, B2B 자동화, 교육 상품 등 수익 모델을 검증합니다.",
                "items": ["subscription", "paid reports", "B2B tools", "education content"],
            },
        ]
    }


@router.get("/manual")
async def manual() -> dict[str, object]:
    return {
        "sections": [
            {
                "id": "local-setup",
                "title": "1. 로컬 개발 환경 준비",
                "summary": "처음 한 번만 의존성을 설치하고 로컬 실행 준비를 끝냅니다.",
                "commands": [
                    "powershell.exe -ExecutionPolicy Bypass -File scripts\\setup-local-dev.ps1",
                ],
                "checks": ["backend virtualenv created", "frontend dependencies installed"],
            },
            {
                "id": "local-run",
                "title": "2. 로컬에서 기능 개발",
                "summary": "PC에서 백엔드와 프론트를 실행하고 새 기능을 확인합니다.",
                "commands": [
                    "powershell.exe -ExecutionPolicy Bypass -File scripts\\start-local-dev.ps1",
                    "http://127.0.0.1:5173",
                    "http://127.0.0.1:8001/docs",
                ],
                "checks": ["dashboard opens", "health API returns ok"],
            },
            {
                "id": "git-push",
                "title": "3. GitHub에 변경사항 업로드",
                "summary": "검증된 코드를 GitHub main 브랜치에 올립니다.",
                "commands": [
                    "git add -A",
                    "git commit -m \"Describe your change\"",
                    "git push origin main",
                ],
                "checks": ["commit created", "GitHub main updated"],
            },
            {
                "id": "vps-deploy",
                "title": "4. VPS 서버에 반영",
                "summary": "운영 서버에서 최신 코드를 받아 Docker Compose로 다시 배포합니다.",
                "commands": [
                    "cd ~/Jay-AI-Platform",
                    "git pull",
                    "bash scripts/configure-ubuntu-env.sh",
                    "bash scripts/deploy-ubuntu.sh",
                ],
                "checks": ["public IP opens", "API docs opens", "health API returns ok"],
            },
            {
                "id": "auto-deploy",
                "title": "5. 자동 배포",
                "summary": "로컬에서 한 명령으로 배포하거나 GitHub push 후 자동 배포합니다.",
                "commands": [
                    (
                        "powershell.exe -ExecutionPolicy Bypass "
                        "-File scripts\\deploy-vps.ps1 -ServerHost YOUR_SERVER_IP"
                    ),
                    "GitHub Settings -> Secrets and variables -> Actions",
                    "Set AUTO_DEPLOY_ENABLED=true after adding VPS secrets",
                ],
                "checks": ["local deploy script works", "GitHub Actions deploy succeeds"],
            },
        ]
    }


@router.get("/monetization")
async def monetization() -> dict[str, object]:
    return {
        "ideas": [
            {
                "id": "subscription",
                "title": "AI 투자 정보 구독",
                "model": "월 구독으로 관심종목 요약, 공시 요약, 체크리스트를 제공합니다.",
                "risk": "개별 매수/매도 지시처럼 보이면 투자자문 규제 검토가 필요합니다.",
                "next_step": "정보 제공형 리포트와 면책 문구부터 설계합니다.",
            },
            {
                "id": "b2b-reports",
                "title": "기업/사업자용 리포트 자동화",
                "model": (
                    "공시, 뉴스, 재무 데이터를 요약해 내부 보고서 자동 생성 도구로 판매합니다."
                ),
                "risk": "데이터 출처와 재배포 가능 범위를 확인해야 합니다.",
                "next_step": "OpenDART 기반 공시 요약 MVP를 만듭니다.",
            },
            {
                "id": "portfolio-coach",
                "title": "개인 포트폴리오 관리 도구",
                "model": (
                    "보유 종목 정리, 리스크 메모, 리밸런싱 체크리스트를 유료 기능으로 제공합니다."
                ),
                "risk": "수익 보장 표현과 맞춤 매매 지시는 피해야 합니다.",
                "next_step": "보유종목 입력과 손익/비중 대시보드를 먼저 만듭니다.",
            },
            {
                "id": "education",
                "title": "AI 자동화 교육/템플릿",
                "model": "AI 업무 자동화, 투자 데이터 분석 템플릿, 서버 구축 강의를 판매합니다.",
                "risk": "투자 성과 과장 광고를 피하고 교육 목적을 명확히 해야 합니다.",
                "next_step": "이 플랫폼 구축 과정을 매뉴얼 콘텐츠로 정리합니다.",
            },
        ]
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
                "id": "access",
                "title": "Member Access",
                "status": "active",
                "items": ["signup", "login", "admin roles", "separate auth/admin screens"],
            },
            {
                "id": "manual",
                "title": "Manual And Deploy",
                "status": "planned",
                "items": ["local development", "GitHub flow", "VPS deployment", "auto deploy"],
            },
            {
                "id": "revenue",
                "title": "Revenue Modules",
                "status": "active",
                "items": ["Korea stock lab", "portfolio manager", "paid reports", "subscription"],
            },
        ]
    }
