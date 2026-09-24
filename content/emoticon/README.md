# content/emoticon/

> **⛔ 이 사업은 2026-09-24 대표 결정으로 폐기되었다.**
> `/emo-pipeline` 과 `emo-*` 에이전트는 더 이상 실행하지 않는다. 아래 구조 설명은 폐기
> 시점의 기록이며, 재개 조건과 사유는 `_business-status.md` 맨 위에 있다.
> 파일은 지우지 않는다 — 재개할 때 여기서 이어서 시작한다.

대표(사용자)의 카카오톡 이모티콘 캐릭터 사업 결과물을 모아두는 폴더다. `content/youtube/`
와 같은 성격 — 앱 코드와 무관하고, `.claude/agents/emo-*.md` 에이전트와 `/emo-pipeline` 이
여기에 결과를 저장한다. 운영 규칙은 루트 `MY_COMPANY.md` §3-7(이미지제작팀)을 따른다.

```
content/emoticon/<캐릭터-슬러그>/
  character.md          캐릭터 컨셉트 (이름·성격·특징·컬러·말투)
  set-<이름>.md          이모티콘 세트 1개 (상황 목록 + 문구)
  qa.md                  브랜드검수팀 + 카카오 제출 기준 검수 결과
  ai-production-plan.md  AI 캐릭터 IP 제작·활용 경로와 승인 게이트
  launch-package-plan.md SNS 검증·디지털 상품·소량 굿즈 출시 순서와 게이트
  assets/ai-concepts/    대표 승인 전 AI 콘셉트 보드
  assets/ai-master/      승인안의 기준 마스터 시트
  assets/ai-pilots/      마스터 일관성·활용성 확인용 파일럿 이미지
  assets/ai-basic-32/    기본 세트 작업용 AI PNG 32종
  assets/ai-generation-manifest.md  생성 도구·참조 체인·프롬프트·검수 기록
  design-reboot-brief.md 사람의 독립 디자인 제작 기준과 아트 검수 게이트
  human-designer-handoff.md  사람 디자이너 견적·계약·산출물 전달 패키지
  design-approval.md     실루엣 5안·파일럿 8개 대표 승인 기록
  designer-shortlist.md  현재 활동 중인 사람 디자이너 후보·가격·위험 비교
  submission-checklist-<이름>.md  제출 전 체크리스트 (세트별)
  friends.md             (있으면) 함께 나오는 서브 캐릭터
  review.md              (제출/출시 후) 성과 기록

content/emoticon/_business-status.md   사업 전체 제출·승인·판매 현황 (캐릭터별이 아니라
                                        사업 전체 1개 파일 — `content/youtube/_channel-status.md`
                                        와 같은 패턴)
```

- 대표 승인 전 콘셉트 보드는 `assets/ai-concepts/`에 둘 수 있고, 승인 후 마스터·파일럿은 각각
  `assets/ai-master/`·`assets/ai-pilots/`에 둔다. 기본 32종의 1차 작업 PNG는 검수 편의를 위해
  `assets/ai-basic-32/`에 보관한다. 배경 제거본·문구 합성본·GIF·WEBP·인쇄 원본 등 파생 파일은
  용량 문제로 별도 로컬/드라이브에 보관하고 이 폴더에는 매니페스트만 남긴다.
- 카카오 공식 운영 원칙이 생성형 AI 활용 이모티콘 제안을 제한하는 동안에는 AI 이미지를
  **카카오 제출용**으로 사용하지 않는다. 대표가 선택한 AI 경로의 산출물은 SNS·굿즈·브랜드
  IP용으로 활용하고 제작 경로를 기록한다(공식 원문 2026-08-15 확인:
  `https://emoticonstudio.kakao.com/guideline`).
- 카카오 이모티콘 스튜디오 제출 규격은 시기에 따라 바뀔 수 있다 — `emo-qa` 가 검수할 때마다
  `emoticonstudio.kakao.com` 을 다시 확인하고, 확인한 날짜를 qa.md 에 남긴다.
