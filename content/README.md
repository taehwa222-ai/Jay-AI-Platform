# content/

대표(사용자)의 개인 콘텐츠 제작 파이프라인 결과물을 모아두는 폴더다. 이 프로젝트의 앱 코드
(`backend/`, `frontend/`)와는 별개이며, `/yt-pipeline` 및 `.claude/agents/yt-*.md` 에이전트가
여기에 결과를 저장한다. 운영 규칙(부서 기준·승인 지점·상태 표기)은 루트 `MY_COMPANY.md` 를
따른다.

```
content/youtube/<날짜>-<소재-슬러그>/
  research.md    시장조사팀 결과 (트렌드 후보 5개 + 출처)
  ideas.md        기획1팀 결과 (아이디어 10개 → TOP3 점수표)
  qa.md            브랜드검수팀 결과 (통과/반려 + 사유)
  script.md       기획2팀 결과 (승인된 안 1개의 대본)
  production.md   영상제작팀 결과 (컷 구성 + 자막 초안 + 촬영 메모)
  review.md       성과리뷰팀 결과 (게시 후 성과 기록, 있으면)
```

- 실제 영상·이미지 원본 파일은 여기 두지 않는다 (용량 문제) — 기획 문서만 커밋한다.
- 대표 승인 전 단계(`research.md`~`ideas.md`)까지는 자유롭게 진행하지만, `script.md` 는
  대표가 TOP3 중 1개를 승인한 뒤에만 만든다 (`MY_COMPANY.md` §3-★대표 승인).
