# YouTube 자동 제작 사용법

프로젝트 폴더에 `script.md`, `production.md`, `pipeline.json`을 준비한 뒤 아래 명령을 실행한다.

```powershell
.\.venv\Scripts\pip.exe install -r scripts\requirements-media.txt
.\scripts\run-youtube-pipeline.ps1 `
  -ProjectDir content\youtube\2026-08-15-bigbang-20th
```

`pipeline.json`의 각 scene은 기존 이미지 파일을 재사용하거나 `prompt`를 넣어 Gemini로
누락 이미지를 생성할 수 있다. 음성 파일이 없으면 `voice.name`의 Edge Neural 음성으로
자동 생성한다. 결과는 프로젝트의 `rendered/`, `assets/captions.srt`,
`assets/captions.ass`, `upload-metadata.md`에 저장된다.

YouTube 업로드는 자동으로 실행되지 않는다. 영상을 확인한 뒤 `approval.md`에 아래처럼
대표 승인 문구를 기록하고, YouTube OAuth 환경변수가 준비된 경우에만 `--upload`를 붙인다.

Client ID와 Client Secret을 `.env`에 넣은 뒤 refresh token은 다음 명령으로 발급한다.
브라우저에서 YouTube 채널 계정으로 승인하면 터미널에 한 번 표시된다.

```powershell
.\.venv\Scripts\python.exe scripts\youtube-oauth.py
```

```text
decision: approve
```

원본 노래·멤버 사진·로고는 권리 확인 전 자동 삽입하지 않는다.
## Thumbnail step

The same automation step creates `rendered/thumbnail.jpg` from
`thumbnail.file`, or generates it from `thumbnail.prompt` with Gemini. The
image is normalized below 2 MB. For Shorts it becomes the first video frame;
for long-form uploads it can be sent through YouTube's `thumbnails.set` API.
