# Server Operations

저장소 루트에서 실행합니다. 배포 스크립트는 운영 서버에 직접 영향을 줄 수 있으므로 실행 전에
대상 서버와 변경 내용을 확인합니다.

## 시작과 상태 확인

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start-server.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\status-server.ps1
```

주요 주소:

```text
http://localhost/#stocks
http://localhost/#contentOps
http://localhost/#auth
http://localhost/docs
http://localhost/api/v1/health
```

중지는 다음 명령을 사용합니다.

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\stop-server.ps1
```

## 대표 계정과 데이터

최초 가입 계정만 대표 계정으로 생성되며 추가 가입은 거부됩니다. SQLite 데이터는
`DATA_DIR/jay_ai_platform.db`에 저장됩니다. Docker/VPS의 `./data` 마운트 디렉터리를 재배포 중
삭제하거나 덮어쓰지 마세요.

Content Ops 저장을 위해 Docker의 `./content`는 `/app/content`에 읽기/쓰기로 마운트됩니다.
운영 서버에서 저장소와 `content/` 디렉터리의 소유권·권한을 임의로 바꾸지 마세요.

앱이 생성하는 모든 SQLite 연결은 WAL 모드를 사용합니다. 확인 명령:

```powershell
@'
import sqlite3
connection = sqlite3.connect("backend/data/jay_ai_platform.db")
print(connection.execute("PRAGMA journal_mode").fetchone()[0])
connection.close()
'@ | python -
```

정상 결과는 `wal`입니다.

## 일일 DB 백업

스크립트는 실행 날짜별 파일을 하나만 만들기 때문에 하루 중 중복 실행되어도 새 백업을 계속
쌓지 않습니다. 생성한 백업은 무결성 검사와 임시 복원 리허설을 통과해야 하며 기본 30일 보관 후
자동 정리됩니다.

```powershell
python scripts\backup_db.py --data-dir backend/data
```

결과 위치:

```text
DATA_DIR/backups/jay_ai_platform-YYYYMMDD.db
```

Docker/VPS에서는 Compose의 `backup` 서비스가 배포 직후 한 번, 이후 24시간마다 이 작업을
실행합니다. 상태와 최근 결과는 다음과 같이 확인합니다.

```bash
docker compose ps backup
docker compose logs --tail=30 backup
ls -lh data/backups
```

배포는 `Restore check: passed` 로그를 최대 30초 기다리며, 백업 실패 또는 시간 초과 시 실패로
종료됩니다.

Windows 작업 스케줄러에서는 프로그램을 `.venv\Scripts\python.exe`, 인수를
`scripts\backup_db.py --data-dir backend/data`, 시작 위치를 저장소 루트로 지정합니다. `--retention-days`
옵션으로 보관 기간을 바꿀 수 있고, 긴급 점검 외에는 복원 검증을 끄지 않습니다.

## 외부 API와 비용 가드레일

```text
OPENAI_API_KEY=
OPENDART_API_KEY=
MARKET_CACHE_TTL_SECONDS=300
DISCLOSURE_CACHE_TTL_SECONDS=1800
AI_DAILY_LIMIT=100
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

- Yahoo Finance 시세는 기본 5분, OpenDART 공시는 기본 30분 캐시됩니다.
- OpenAI 키가 설정된 `POST /api/v1/stocks/analyze`는 날짜별 사용량을 SQLite에 원자적으로
  기록하며 한도 초과 시 HTTP 429를 반환합니다.
- OpenAI 키가 없으면 규칙 기반 분석만 수행하며 외부 AI 한도를 차감하지 않습니다.
- Telegram 연결 확인: `POST /api/v1/notifications/telegram/test`
- 중요 공시 발송: `POST /api/v1/notifications/telegram/disclosures/{ticker}`

## VPS 배포

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy-vps.ps1 -ServerHost YOUR_SERVER_IP
```

이 명령은 검증, GitHub push, VPS 배포, health check를 연속 수행합니다. `main` push가 자동 배포로
이어질 수 있으므로 사용자 승인 없이 실행하지 않습니다. 자세한 설정은 `docs/DEPLOYMENT.md`를
참조하세요.

## 운영 점검

```powershell
python -m pytest
ruff check backend scripts/backup_db.py
cd frontend
npm run verify
```

실제 서버의 공개 화면과 API를 읽기 전용으로 점검합니다.

```powershell
python scripts\smoke-platform.py --base-url http://YOUR_SERVER_IP --frontend-url http://YOUR_SERVER_IP
```

대표 계정까지 점검하려면 `SMOKE_OWNER_EMAIL`, `SMOKE_OWNER_PASSWORD`를 현재 터미널에만 설정하고
같은 명령을 실행합니다. 외부 Yahoo Finance/OpenDART 호출도 포함하려면 `--external`을 추가합니다.
자격 증명은 명령행 기록이나 저장소 파일에 남기지 않습니다.

점검 후에는 다음 항목을 함께 확인합니다.

- `.env`와 API 키가 Git diff에 없는지
- `data/`와 `backend/data/`의 사용자 DB가 삭제·교체되지 않았는지
- 최신 날짜 백업 파일을 별도 위치에서 열 수 있는지
- `/api/v1/health`, 주식 조회, 공시 조회, Content Ops 읽기/쓰기가 정상인지
