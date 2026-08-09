# Jay AI Platform — 작업 지침 (Claude Code · Codex 공용)

> 이 파일은 Codex 가 읽는 표준 파일이다. Claude Code 는 루트 `CLAUDE.md` 에서 이 파일을 그대로
> 불러온다(`@AGENTS.md`) — 내용은 한 곳(this file)에서만 관리한다.

---

## 0. 프로젝트

**Jay AI Platform** — FastAPI + React + Docker Compose + Ubuntu VPS 배포로 만드는 1인 개발
수익형 서비스. 현재 기반: 회원가입/로그인/관리자 권한, 한국 주식 분석·포트폴리오 모듈,
향후 구독·리포트·B2B 수익 모델 확장 예정. 상세는 `README.md` 참조.

```
backend/app/main.py       FastAPI 앱 구성 (lifespan 에서 auth/stocks DB init)
backend/app/routers/      HTTP 라우터 (admin, auth, health, platform, stocks)
backend/app/services/     비즈니스 로직 — DB 스키마도 여기서 관리 (아래 참조)
backend/app/schemas/      요청/응답 계약
frontend/src/             Vite + React 대시보드 (Ant Design 아이콘)
scripts/                  로컬·VPS 운영 스크립트
docs/                     배포·운영 가이드
```

- DB: 별도 마이그레이션 도구 없음. `services/*.py` 안에서 `CREATE TABLE IF NOT EXISTS` +
  `ensure_column()` 헬퍼로 스키마를 늘려간다. 새 컬럼이 필요하면 이 패턴을 따른다.
- 브랜치: `main` 하나만 있다 (`dev` 없음). `.github/workflows/deploy-vps.yml` 이 `main` push 를
  감시하며, 리포지토리 변수 `AUTO_DEPLOY_ENABLED=true` 일 때만 실제로 VPS 에 자동 배포한다.

---

## 1. 절대 규칙

```
① .env / .env.production / VPS SSH 키 등 비밀값을 커밋하지 않는다 (.gitignore 로 이미 제외됨 — 유지)
② 사용자 승인 없이 main 에 직접 push 하지 않는다 — AUTO_DEPLOY_ENABLED 가 켜져 있으면
   main push = 실제 서버 배포다
③ scripts/deploy-vps.ps1, deploy-ubuntu.sh 등 배포 스크립트를 확인 없이 실행하지 않는다
   — 운영 서버에 직접 영향을 준다
④ backend/data/*.db (사용자 데이터)를 삭제·덮어쓰지 않는다
⑤ 실행하지 않은 테스트를 "통과"로 보고하지 않는다 — 실행 명령과 결과를 그대로 남긴다
⑥ 배포 스크립트·운영 절차를 바꾸면 docs/DEPLOYMENT.md · docs/SERVER_OPERATIONS.md 도 같이 갱신한다
```

---

## 2. 개발 명령

**백엔드**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements-dev.txt
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```
- 테스트: `python -m pytest` (루트에서 실행 — `pyproject.toml` 이 `backend/tests` 를 가리킴)
- 린트/포맷: `ruff check backend --fix` / `ruff format backend`

**프론트엔드**
```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run verify      # tsc -b && vite build — 커밋 전 필수
```

**스모크 테스트**: `python scripts/smoke-platform.py` (백엔드 기동 후)

---

## 3. Claude + Codex 역할 분담 (토큰 절감)

이 프로젝트는 1인 개발 규모라 무거운 조직 체계(부서·대시보드)를 두지 않는다. 대신 아래
분담만 지킨다 — 상세 실행 절차(worktree 준비, orca 터미널, 지시서 파일, HANDOFF 마커 감시)는
**사용자 개인 전역 지침**(`~/.claude/CLAUDE.md` "Codex와 백엔드 작업을 나눠 할 때")을 그대로 따른다.
이 프로젝트 전용 커맨드나 서브에이전트는 따로 두지 않는다.

| 담당 | 영역 | 비고 |
|---|---|---|
| Claude Code | `frontend/`, 전체 조정·계획·리뷰, 문서(`docs/`, README) | React/Vite 변경, 사용자와의 승인 지점 |
| Codex | `backend/` (FastAPI, Python, `services/*.py` 의 SQLite 스키마) | 특히 pytest 를 여러 번 돌려야 하는 작업 |

**Codex 위임 기준**: 백엔드 변경이 파일 4개 이상이거나 `pytest` 를 반복 실행해야 할 때 위임한다.
그보다 작은 백엔드 수정(라우터 한두 곳, 스키마 필드 하나 추가 등)은 Claude 가 직접 한다 —
위임 준비 비용이 더 크다.

**Codex 위임 시 지시서에 반드시 넣을 것**
- 완료 기준: `python -m pytest` 결과 + `ruff check backend` 결과
- 건드리지 말 것: `frontend/`, 루트 `AGENTS.md`/`CLAUDE.md`
- 스키마 변경이면: `ensure_column()` 패턴 사용, 기존 사용자 데이터 손실 없는지 확인

**수락 이후**: 개인 전역 지침대로, `HANDOFF_ACCEPTED` 확인 후에는 같은 worktree 에 Claude 가
쓰지 않는다. `HANDOFF_RETURNED` 확인 후 회수하고, 남긴 완료 기준(pytest/ruff)을 직접 재실행해
검증한다 — Codex 자체 보고를 그대로 신뢰하지 않는다.

---

## 4. 커밋 전 체크

```
[ ] 백엔드를 건드렸으면: python -m pytest 통과 + ruff check backend 통과
[ ] 프론트를 건드렸으면: cd frontend && npm run verify 통과
[ ] .env 류 비밀값이 diff 에 없는지 확인
[ ] main 에 바로 push 하는 것이라면 — 배포로 이어질 수 있음을 사용자에게 확인받았는지
```

---

## 5. 참고 — 루트의 AI_COMPANY*.md 파일들

`AI_COMPANY.md` / `AI_COMPANY_PRO.md` 는 콘텐츠·SNS 마케팅 회사용 **원본 템플릿**이다 (수정
금지, 참고 자료로만 보관). 이 소프트웨어 프로젝트(`backend/`·`frontend/`)의 부서 구성과는
무관하며, **이 앱을 개발하는 작업에는 운영 지침으로 쓰지 않는다** — 이 프로젝트의 코드 작업
방식은 이 문서(`AGENTS.md`)와 개인 전역 지침을 따른다.

`MY_COMPANY.md` 는 위 템플릿의 **운영본**이며, 아래 §6 개인 콘텐츠 파이프라인에서 실제로
쓰인다 (이 앱 코드와는 별개의 용도).

---

## 6. 개인 콘텐츠 제작 파이프라인 (유튜브 트렌드 영상)

대표(사용자)가 유튜브에 올릴 "요즘 트렌드" 영상을 만들 때 Claude Code 가 기획·대본·컷구성을
도와주는 개인용 파이프라인이다. **이 앱의 회원이 쓰는 기능이 아니다** — 대표 본인만 쓴다.

- 사규: `MY_COMPANY.md` (부서 기준·승인 지점·상태 표기)
- 심화 사규(선택): `MY_COMPANY_PRO.md` — 32명 인원 편성·직원 상태 5종·하루 시나리오·대표
  지시창. 부서 기준은 여전히 `MY_COMPANY.md`가 원본이며, 32명은 실제 서브에이전트 32개가
  아니라 아래 5개 서브에이전트에 성격을 입힌 텍스트 레이어다 (사무실 대시보드 없음)
- 실행: `/yt-pipeline` — 시장조사 → 기획 → 검수 → **★대표 승인★** → 대본 → 컷구성
- 서브에이전트: `.claude/agents/yt-research.md` · `yt-planner.md` · `yt-qa.md` · `yt-writer.md` ·
  `yt-production.md` — 단계마다 별도 에이전트로 분리해 컨텍스트·토큰을 아낀다
- 결과물 저장: `content/youtube/<날짜>-<소재>/` (구조는 `content/README.md` 참고)
- 대표 승인 전에는 대본을 미리 쓰지 않는다 — `MY_COMPANY.md` §3 ★대표 승인★ 지점을 지킨다

**카카오톡 이모티콘 캐릭터 사업** (우선순위 2)도 같은 구조로 만들어져 있다:

- 사규: `MY_COMPANY.md` §3-7 (이미지 제작팀, 이모티콘 버전)
- 실행: `/emo-pipeline` — 시장조사 → 기획 → 검수 → **★대표 승인★** → 제출 문구 → 제출
  체크리스트
- 서브에이전트: `.claude/agents/emo-research.md` · `emo-planner.md` · `emo-qa.md` ·
  `emo-writer.md` · `emo-production.md`
- 결과물 저장: `content/emoticon/<캐릭터-슬러그>/`
- 사업 전체 제출·승인·판매 현황: `content/emoticon/_business-status.md` (캐릭터별이 아니라
  사업 전체 1개 파일 — `content/youtube/_channel-status.md`와 같은 패턴)
- 첫 캐릭터 "곁곰(Gyeotgom)"이 `content/emoticon/gyeotgom/` 에 있다 — 정지형 32종 세트 2개
  (`set-basic-24.md`, `set-monday-24.md`)가 3차 검수(2026-08-09)까지 통과했다. 다만 실제
  그림·애니메이션 파일이 아직 없고, 경쟁 캐릭터와의 이미지 유사성 육안 대조가 끝나기 전에는
  실제 제출을 진행하지 않는다 — 두 가지 다 대표 직접 확인 사항이다 (`qa.md` 참고).
- 이모티콘 실제 이미지·애니메이션 파일은 이 파이프라인이 만들지 않는다 — 대표가 별도로
  제작한다. 카카오 스튜디오 제출 규격은 시기에 따라 바뀌므로 매번 공식 사이트를 재확인한다.
