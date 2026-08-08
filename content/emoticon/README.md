# content/emoticon/

대표(사용자)의 카카오톡 이모티콘 캐릭터 사업 결과물을 모아두는 폴더다. `content/youtube/`
와 같은 성격 — 앱 코드와 무관하고, `.claude/agents/emo-*.md` 에이전트와 `/emo-pipeline` 이
여기에 결과를 저장한다. 운영 규칙은 루트 `MY_COMPANY.md` §3-7(이미지제작팀)을 따른다.

```
content/emoticon/<캐릭터-슬러그>/
  character.md          캐릭터 컨셉트 (이름·성격·특징·컬러·말투)
  set-<이름>.md          이모티콘 세트 1개 (상황 목록 + 문구)
  qa.md                  브랜드검수팀 + 카카오 제출 기준 검수 결과
  friends.md             (있으면) 함께 나오는 서브 캐릭터
  review.md              (제출/출시 후) 성과 기록
```

- 실제 이미지·GIF·WEBP 파일은 여기 두지 않는다 (용량 문제) — 기획 문서(캐릭터 설정, 상황
  리스트, 문구)만 커밋한다. 그림 자체는 대표가 별도 도구로 만들고 로컬/드라이브에 보관한다.
- 카카오 이모티콘 스튜디오 제출 규격은 시기에 따라 바뀔 수 있다 — `emo-qa` 가 검수할 때마다
  `emoticonstudio.kakao.com` 을 다시 확인하고, 확인한 날짜를 qa.md 에 남긴다.
