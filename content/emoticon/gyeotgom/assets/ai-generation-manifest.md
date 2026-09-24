# 곁곰 AI 생성 매니페스트

> 생성일: 2026-08-15  
> 생성 방식: OpenAI 내장 ImageGen  
> 활용 범위: SNS 콘텐츠·디지털 굿즈·인쇄 굿즈·브랜드 IP  
> 카카오 이모티콘 제출: 생성형 AI 입점 제한이 유지되는 동안 금지

## 참조 체인

1. `ai-concepts/gyeotgom-concepts-5-v1.png` — 입력 이미지 없이 텍스트에서 생성한 5안
2. `ai-master/gyeotgom-master-v4-option2-v1.png` — 5안 중 왼쪽 두 번째 캐릭터만 참조
3. `ai-pilots/*.png` — 위 마스터 시트를 각 이미지의 유일한 캐릭터 참조로 사용
4. `ai-basic-32/*.png` — 마스터를 참조해 기본 세트 01~32번을 각각 별도 생성

## 고정 프롬프트

모든 마스터·파일럿 생성에 아래 캐릭터 잠금을 적용했다.

> Tiny original warm-white no-mouth comfort bear. Viewer-left ear is smooth and round;
> viewer-right ear is fluffy/scalloped. A soft gray circular patch surrounds the viewer-right
> eye. Two small black oval eyes, a thin vertical stitched seam down the center of face and
> torso, and one small dusty-pink stitched patch on the viewer-right forearm. Compact plush
> proportions, delicate graphite outline and watercolor texture. Preserve identity exactly;
> no redesign, no extra character, no text, no logo, no watermark.

## 마스터 프롬프트

> Use only the second character from the left in the concept board. Create one clean warm
> off-white character sheet with exactly ten studies of the same character: front,
> three-quarter, side, back, plus neutral, sleepy, quietly sulky, moved with tiny tears,
> sparkling happy, and startled expressions. Keep the no-mouth rule and all locked identity
> features in every physically visible view. No captions, objects, costumes, scenery, or
> alternate designs.

산출물: `ai-master/gyeotgom-master-v4-option2-v1.png` (1402×1122 PNG)

## 파일럿 프롬프트 세트

각 항목은 위 고정 프롬프트에 아래 장면 지시를 하나씩 더해 별도 생성했다.

| 번호 | 파일 | 장면 지시 요약 |
|---:|---|---|
| 1 | `ai-pilots/01-ok-v1.png` | 정면 전신, 작은 확신의 끄덕임, 패치 팔을 든 긍정 제스처, 분홍 반짝임 1개 |
| 2 | `ai-pilots/02-confirm-v1.png` | 패치 팔로 손을 흔들고 다른 손에는 체크 표시만 있는 무지 클립보드 |
| 5 | `ai-pilots/05-coffee-v1.png` | 졸린 자세로 무지 회색 테이크아웃 컵을 양손에 들고 김 표현 |
| 8 | `ai-pilots/08-help-v1.png` | 배를 바닥에 대고 두 손을 앞으로 뻗은 도움 요청, 땀방울·떨림선 |
| 17 | `ai-pilots/17-thanks-v1.png` | 두 손을 가슴에 모아 살짝 인사, 낮춘 눈꺼풀, 작은 분홍 하트 1개 |
| 20 | `ai-pilots/20-miss-you-v1.png` | 앉아서 분홍 하트 쿠션을 안고 고개를 기울임, 눈가의 작은 눈물 |
| 21 | `ai-pilots/21-pat-v1.png` | 패치 팔을 시청자 쪽으로 내밀어 토닥이는 자세, 다른 손은 가슴 위 |
| 23 | `ai-pilots/23-good-night-v1.png` | 분홍 베개·회색 담요 아래 옆으로 잠든 자세, 작은 달과 별 |
| 보너스 | `ai-pilots/bonus-best-v1.png` | 양손 엄지형 긍정 제스처, 밝은 눈, 분홍·회색 반짝임 2~3개 |

세트 파일럿 8종과 보너스 1종은 모두 1254×1254 PNG, 따뜻한 미색 배경이다. 배경 제거·인쇄
색상 변환·플랫폼별 리사이즈는 아직 하지 않았다.

## 기본 32종 프롬프트 세트

- 공통 잠금은 위 `고정 프롬프트`를 사용했다.
- 장면별 지시는 `../../set-basic-32.md`의 01~32번 상황을 기준으로 한 번에 한 자산씩 생성했다.
- 산출물은 `ai-basic-32/01-*.png`부터 `32-*.png`까지 번호와 장면이 일치한다.
- #22는 단순 검은 타원 눈, #30은 팔 패치 외 추가 몸 패치 금지를 강화해 수정 생성했다.
- 총 32개, 전부 1254×1254 PNG, 합계 43,126,249바이트다.

## 검수 기록

- 세트 파일럿 8종과 보너스 1종 모두 입·문구·로고·워터마크 없이 생성됨
- 비대칭 귀, 회색 눈 패치, 중앙 봉제선은 9종에서 유지됨
- 분홍 팔 패치는 자세와 원근에 따라 위치가 달라 보일 수 있으므로 후속 24종에서 마스터의
  해부 방향을 우선 확인할 것
- 외부 공개·상품화 전 64px 축소, 흑백 실루엣, 경쟁 캐릭터 유사성, 상표를 별도 검수할 것
- 생성형 AI 산출물이므로 카카오 이모티콘 스튜디오 제출 파일로 사용하지 않을 것
