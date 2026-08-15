# Jay AI Platform

Jay AI Platform은 대표가 운영하고 승인된 구성원이 함께 사용하는 사내용 Business OS입니다.
FastAPI, React/Vite, SQLite, Docker Compose로 구성되며 B2C 요금제·결제·멀티테넌트 기능은 포함하지
않습니다.

## 핵심 화면

- **주식 분석 Lab**: 보유종목, 관심종목, Yahoo Finance 시세, OpenDART 공시, AI 분석 기록,
  내부 리포트를 한 워크스페이스에서 관리합니다.
- **Content Ops**: `content/youtube/`, `content/emoticon/` 프로젝트와 Markdown 문서를 조회·편집·
  저장하고 기획안·대본 템플릿을 복사합니다.

최초 가입 계정은 대표(`owner`)로 생성됩니다. 이후 가입자는 승인 대기 상태가 되며 대표 또는
관리자가 활성화한 뒤 로그인할 수 있습니다. 대표는 관리자 지정까지 할 수 있고, 관리자는 일반
구성원의 접근 상태만 관리합니다.

## 데이터와 외부 연동

- SQLite 파일: `DATA_DIR/jay_ai_platform.db`
- 모든 앱 DB 연결은 WAL 모드, foreign key, busy timeout을 적용합니다.
- Yahoo Finance 응답은 기본 5분, OpenDART 공시는 기본 30분 동안 TTL 캐시됩니다.
- OpenAI 키가 설정된 분석 요청은 기본 하루 100회로 제한됩니다. 키가 없으면 로컬 규칙 기반
  분석은 계속 동작하고 외부 AI 사용량에는 포함되지 않습니다.
- 분석 완료 알림과 중요 공시 알림을 Telegram으로 보낼 수 있습니다.
- 기존 DB에 남아 있는 과거 결제·플랜 테이블/컬럼은 데이터 손실 방지를 위해 자동 삭제하지
  않지만 애플리케이션에서는 읽거나 갱신하지 않습니다.

## 로컬 실행

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements-dev.txt
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

다른 터미널에서 프론트엔드를 실행합니다.

```powershell
cd frontend
npm install
npm run dev
```

브라우저 주소는 `http://127.0.0.1:5173`입니다. 로컬 자동화 스크립트를 사용할 수도 있습니다.

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\setup-local-dev.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\start-local-dev.ps1
```

## 환경 변수

`.env.example`을 `.env`로 복사하고 실제 비밀값은 Git에 올리지 않습니다.

```text
APP_NAME=Jay AI Platform
APP_ENV=development
DATA_DIR=backend/data
CONTENT_DIR=content
AUTH_SECRET_KEY=change-this-local-secret
OPENAI_API_KEY=
OPENDART_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
MARKET_DATA_TIMEOUT_SECONDS=10
MARKET_CACHE_TTL_SECONDS=300
DISCLOSURE_CACHE_TTL_SECONDS=1800
AI_DAILY_LIMIT=100
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Telegram 연결 확인은 로그인 후 `POST /api/v1/notifications/telegram/test`, 중요 공시 발송은
`POST /api/v1/notifications/telegram/disclosures/{ticker}`를 사용합니다.

## DB 백업

백업 스크립트는 SQLite online backup API로 일관된 복사본을 만들며 같은 날짜의 백업이 이미
있으면 다시 생성하지 않습니다. 생성 후 무결성 검사와 임시 DB 복원 리허설을 수행하고 기본
30일이 지난 백업을 정리합니다.

```powershell
python scripts\backup_db.py --data-dir backend/data
```

Docker 운영 환경에서는 `backup` 서비스가 배포 직후 한 번, 이후 24시간마다 자동 실행합니다.
상세 운영법은 [`docs/SERVER_OPERATIONS.md`](docs/SERVER_OPERATIONS.md)에 있습니다. 백업 파일은
`DATA_DIR/backups/jay_ai_platform-YYYYMMDD.db`에 저장됩니다.

## 검증

```powershell
python -m pytest
ruff check backend scripts/backup_db.py
cd frontend
npm run verify
```

백엔드가 실행 중일 때 `python scripts/smoke-platform.py`로 기본 API 스모크 테스트를 수행할 수
있습니다. 대표 계정 환경 변수 `SMOKE_OWNER_EMAIL`, `SMOKE_OWNER_PASSWORD`를 함께 설정하면
주식·Content Ops·알림의 인증 API도 읽기 전용으로 점검합니다.

## 배포

Docker/VPS에서는 `./data`가 `/app/data`로, `./content`가 쓰기 가능한 `/app/content`로
마운트되어 DB·백업·Markdown 수정 내용이 컨테이너 재빌드 후에도 보존됩니다. 운영 명령과 백업 스케줄은
[`docs/SERVER_OPERATIONS.md`](docs/SERVER_OPERATIONS.md), 전체 배포 절차는
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)를 확인하세요. `main` push와 배포 스크립트 실행은 실제
서버 배포로 이어질 수 있으므로 반드시 사전 확인 후 수행합니다.

## 프로젝트 구조

```text
backend/app/main.py       FastAPI 앱과 미들웨어
backend/app/routers/      인증, 주식, 공시, Content Ops, 알림 API
backend/app/services/     SQLite 스키마, 캐시, AI 가드레일, Telegram
frontend/src/             React 내부 운영 UI
content/                  유튜브·이모티콘 Markdown 작업물
scripts/backup_db.py      일일 SQLite 백업
scripts/smoke-platform.py 운영 API 읽기 전용 스모크 테스트
docs/                     배포·운영 가이드
```
