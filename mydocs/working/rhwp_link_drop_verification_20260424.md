# RHWP Link-Drop Verification 2026-04-24

## 목적

`RHWP Integration Preservation Framework` 기준으로 원격 HWP/HWPX link-drop 기능의 입력 계층과 다운로드 계층을 분리 검증한다.

이번 검증은 다음 두 층으로 나누어 수행했다.

- 브라우저 입력 계층
  - drag payload 후보 추출
  - URL/source 우선순위
  - 파일 후보 우선 선택
- Tauri/Rust 다운로드 계층
  - direct-extension 판별
  - response-header 판별
  - HTML 페이지 오검출 차단
  - 잘못된 바이너리 시그니처 차단
  - 임시 파일 cleanup

## 변경 사항

### 1. 브라우저 입력 계층 테스트 가능화

수정 파일:

- `rhwp-studio/src/command/link-drop.ts`
- `rhwp-studio/src/app/devtools.ts`

핵심:

- `extractDropCandidatesFromSnapshot()` 추가
- `createDropTransferSnapshot()` 추가
- devtools API 추가
  - `window.__debugExtractLinkDropCandidates()`
  - `window.__debugPickPrimaryLinkDropCandidate()`

효과:

- 실제 `DataTransfer` 없이도 동일한 후보 추출/선택 로직을 e2e에서 재현 가능
- 브라우저 호스트 모드에서도 link-drop 우선순위 자동 검증 가능
- `[link-drop] candidates`, `[link-drop] selected candidate` 로그로 후보 해석 과정을 계속 추적 가능

### 2. Rust 실패 방어 테스트 보강

수정 파일:

- `src-tauri/src/remote_hwp.rs`

추가 테스트:

- `resolve_remote_hwp_url_rejects_html_page_response`
- `resolve_remote_hwp_url_rejects_invalid_download_signature`

효과:

- HTML 페이지가 문서로 잘못 내려와도 WASM 로드 전에 차단
- HWP/HWPX 시그니처가 아닌 바이너리도 WASM 로드 전에 차단

### 3. E2E 실행 안정성 보강

수정 파일:

- `rhwp-studio/e2e/helpers.mjs`

핵심:

- 원격 Chrome CDP 연결 실패 시
  - 로컬 Windows Chrome/Edge를 자동 탐지
  - headless 브라우저로 자동 폴백

효과:

- 검증 환경에 원격 CDP가 없어도 e2e가 중단되지 않음

## 실행 명령

### 브라우저 입력 계층

```powershell
node e2e/link-drop-smoke.test.mjs
```

결과:

- PASS

검증 항목:

- `uri-list` 후보 감지
- 직접 `.hwp` URL 후보 감지
- `plain-text` 단독 후보 감지
- 중복 URL 제거
- HTML `<a href>` 후보 추출
- `DownloadURL` 우선 선택
- 파일 드롭이 URL보다 우선 선택

산출물:

- `rhwp-studio/e2e/screenshots/link-drop-smoke-01.png`
- `rhwp-studio/output/e2e/link-drop-smoke-report.html`

### Rust 다운로드 계층

```powershell
cargo test --manifest-path src-tauri/Cargo.toml remote_hwp
```

결과:

- PASS

검증 항목:

- direct-extension 다운로드 허용
- header-detected 다운로드 허용
- HTML 페이지 응답 차단
- 잘못된 다운로드 시그니처 차단
- temp file cleanup

### 전체 정합성

```powershell
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

결과:

- PASS

## 판단

현재 기준으로 다음 항목은 자동 검증 증거가 확보되었다.

- browser-dragged URL 후보 추출 규칙
- browser-dragged direct `.hwp` URL 감지
- `uri-list` 기반 후보 감지
- `text/plain` 단독 후보 감지
- HTML source 후보 추출
- `DownloadURL` 우선순위
- 파일 드롭 우선순위
- direct-extension 판별
- header-based 판별
- 비문서 다운로드 차단
- temp cleanup 경로

## 아직 남은 공백

- 실제 Tauri 앱 셸에서의 drag-and-drop DOM 이벤트 종단간 자동화
- 반복 link-drop 후 앱 상태 오염 여부의 완전 자동화
- text/plain 단독 후보에 대한 별도 앱 셸 증거

## 수동 앱 셸 검증

재현:

- 일반 브라우저에서 `.hwp` / `.hwpx` 링크를 앱 창으로 drag-and-drop
- 서로 다른 원격 링크를 연속으로 여러 번 drag-and-drop

결과:

- PASS

확인 항목:

- 앱 셸에서 원격 문서가 정상적으로 열린다.
- 드롭 자체로 앱이 멈추거나 크래시하지 않는다.
- 반복 드롭 후에도 다음 드롭이 계속 정상 처리된다.
- `[link-drop] candidates`, `[link-drop] selected candidate`, `[link-drop] remote document opened`, `[link-drop] remote document open failed` 로그가 디버깅에 유용하다.
- `cleanup_remote_hwp_temp_path` 명령이 없는 환경에서는 경고를 삼키고 넘어가므로 stale cleanup 경고는 현재 기준 무해하다.

## 결론

이번 단계로 `link-drop`은 브라우저 입력 해석 계층과 Rust 다운로드 계층 모두 자동 검증 기반이 생겼다.

가디언 판단과도 일치하게, 현재는 `Continue with caution` 상태에서 다음 단계로 진행 가능하다.
