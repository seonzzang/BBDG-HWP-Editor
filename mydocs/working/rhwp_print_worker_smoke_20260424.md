# RHWP Print Worker Smoke Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

Tauri 앱 셸 전체 자동화가 아직 없는 상태에서, `print worker` 핵심 백엔드 경로가 실제로 동작하는지 shell smoke로 검증한다.

검증 범위:

- SVG 페이지 입력
- browser launch
- PDF chunk 생성
- PDF merge
- 최종 `output.pdf` 저장
- worker progress/result 메시지 출력
- analysis log 생성

## 실행 방식

다음 스크립트로 재현 가능하게 고정했다:

- `tools/run-print-worker-smoke.ps1`

스크립트 내부에서 임시 디렉터리와 2개 SVG 페이지를 만든 뒤:

- `scripts/print-worker.ts --generate-pdf <manifest>`

를 호출한다.

환경:

- `BBDG_PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`

## 결과

- PASS

생성 결과:

- output path:
  - `C:\Users\BBDG\AppData\Local\Temp\bbdg-print-worker-smoke\output.pdf`
- output size:
  - `8144 bytes`

진행 메시지 확인:

- `spawned`
- `loading`
- `rendering-batch`
- `writing-pdf` (chunk generation)
- `writing-pdf` (merge)
- `result.ok=true`

analysis log 확인:

- `page.setContent`
- `page.pdf`
- `pdf merge started`
- `pdf merge chunk loaded/copied/appended`
- `pdf merge save finished`
- `browser closed`

## 해석

다음 사항이 확인되었다.

- print worker script가 Chrome을 실제로 띄울 수 있다
- SVG 입력에서 chunk PDF 생성까지 이어진다
- `pdf-lib` merge/save 단계까지 성공한다
- 최종 PDF가 파일 시스템에 저장된다
- 진행 메시지와 분석 로그가 읽을 수 있는 형태로 남는다

## 한계

- 이 검증은 Tauri 앱 UI 오버레이/ETA/취소 버튼/내부 PDF 뷰어 복귀까지 포함하지 않는다
- 즉, `worker backend smoke`는 닫혔지만 `app-shell end-to-end`는 아직 남아 있다

## 결론

`print worker`의 핵심 백엔드 PDF 생성 경로는 현재 smoke 기준으로 정상 동작한다.
