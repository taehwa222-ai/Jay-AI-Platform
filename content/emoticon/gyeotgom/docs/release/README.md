# 곁곰 자산 검수·출시 준비 사용법

## 1. 카카오 규격 입력

`../../config/kakao-config.json`을 열고 최신 공식 화면에서 사람이 확인한 값만 입력한다.

- `verification.status`: 확인 후 `verified`
- `official_source_url`: 확인한 공식 페이지
- `verified_at`: 확인 시각
- 캔버스 크기, 최대 파일 크기, 필요 개수, 허용 포맷, 알파/투명성 조건

빈 값은 검수기가 의도적으로 건너뛴다. 따라서 `unverified` 상태의 결과는 제출 적합 판정이 아니다.

## 2. 검수와 미리보기 생성

프로젝트 루트에서 실행한다.

```powershell
python scripts/validate-emoticon-assets.py
```

생성 결과:

- `output/reports/asset-validation.md`
- `output/reports/asset-validation.json`
- `output/preview/index.html`

## 3. 미리보기 열기

프로젝트 루트에서 로컬 서버를 실행한다.

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

브라우저에서 다음 주소를 연다.

```text
http://127.0.0.1:8765/content/emoticon/gyeotgom/output/preview/index.html
```

## 검수 범위

도구가 확인하는 항목은 파일 존재, PNG 서명과 구조, PNG 청크 CRC, 압축 데이터 손상, 이미지
크기, 파일 용량, 알파 채널, 투명성 정보, SHA-256 중복, 파일명 규칙, 누락·중복 번호다.

도구는 이미지 파일을 쓰거나 수정하지 않는다. 시각적 유사성, 저작권, 상표, 플랫폼 정책 적합성,
문구의 최종 교정은 자동 판정하지 않는다.
