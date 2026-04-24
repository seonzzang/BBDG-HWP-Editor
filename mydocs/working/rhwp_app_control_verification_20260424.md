# RHWP App Control Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

Phase 2 adapter 분리 이후 앱 부팅 경로와 기본 개발 실행 상태를 검증한다.

## 수행 내용

### 1. 빌드 검증

- `npm run build` 통과
- `cargo check --manifest-path src-tauri/Cargo.toml` 통과

### 2. Tauri dev 실행 점검

초기 시도에서 잘못된 작업 디렉터리에서 `cargo tauri dev`를 실행해
Tauri 프로젝트 인식 실패가 발생했다.

원인:

- `rhwp-studio` 폴더에서 실행
- 실제 Tauri 루트는 `rhwp/src-tauri/tauri.conf.json` 기준의 `rhwp` 루트

조치:

- `rhwp` 루트에서 다시 `cargo tauri dev` 실행

### 3. Vite dev server 상태 확인

Tauri는 `BeforeDevCommand` 단계에서 `http://localhost:7700` 대기 상태였다.

확인 결과:

- `tools/ensure-vite-dev-server.ps1`는 정상 구조
- 다만 실제 검증 중에는 직접 `npm run dev -- --host localhost --port 7700 --strictPort`를 별도 기동해
  dev server 응답을 확정했다

확인 결과:

- `http://localhost:7700` 응답 코드 `200`
- `vite-direct-stdout.log`에서 Vite ready 확인

### 4. 앱 프로세스 확인

확인 시점 기준:

- `rhwp-studio.exe` 실행 확인
- 창 제목: `BBDG HWP Editor`
- 단일 `rhwp-studio` 프로세스만 실행 중 확인

관찰 프로세스:

- `rhwp-studio` PID 확인
- `cargo` dev 프로세스 다수 대기/실행 상태 확인

### 5. 앱 셸 캡처 도구 보강

전역 단축키 기반 자동화는 일반 브라우저/다른 창과 충돌할 수 있으므로,
앱 셸 검증 도구는 `앱 창 내부 클릭 우선` 원칙으로 보강했다.

추가 도구:

- `tools/capture-rhwp-app-window.ps1`

보강 내용:

- 앱 메인 창 foreground 고정
- 각 클릭 단계 전 foreground 창 제목 재검증
- 앱 창 내부 클릭으로 포커스 확보
- 스크린샷 캡처 자동화
- 필요 시 메뉴 클릭/가속키 실험을 같은 도구에서 분리 수행

현재 판단:

- 안전한 app-shell 자동화는 계속 `앱 창 내부 클릭 우선`으로 유지해야 한다
- 전역 `Ctrl+P` 같은 시스템 입력은 app-shell 증거 수집 방식으로 쓰지 않는다

### 6. 현재 확보된 앱 셸 증거

확보 산출물:

- `mydocs/working/app-control-logs/bbdg-app-window.png`
- `mydocs/working/app-control-logs/print-preview-rootcause-error.png`
- `mydocs/working/app-control-logs/print-preview-success-check.png`
- `mydocs/working/app-control-logs/bbdg-app-print-dialog-latest.png`
- `mydocs/working/app-control-logs/bbdg-app-file-print-click-latest.png`
- `mydocs/working/app-control-logs/bbdg-app-alt-file-print-latest.png`
- `mydocs/working/app-control-logs/bbdg-file-menu-only-latest.png`
- `mydocs/working/app-control-logs/bbdg-file-print-dialog-latest.png`
- `mydocs/working/app-control-logs/bbdg-print-dialog-cancel-latest.png`
- `mydocs/working/app-control-logs/bbdg-print-dialog-current-page-latest.png`
- `mydocs/working/app-control-logs/bbdg-print-dialog-page-range-latest.png`

해석:

- app-shell 부팅 증거는 확보되어 있다
- app-shell 기준 PDF export -> in-app viewer 성공 증거는 확보되어 있다
- app-shell 기준 `파일 메뉴 오픈`과 `인쇄 대화창 표시` 증거를 내부 클릭 자동화로 다시 확보했다
- app-shell 기준 `인쇄 대화창 -> 취소 -> 에디터 복귀` 증거도 내부 클릭 자동화로 확보했다
- app-shell 기준 `현재 페이지` / `페이지 범위` 선택 변화도 내부 클릭 자동화로 확보했다
- app-shell 메뉴/인쇄 대화창 자동화는 전역 단축키가 아니라 내부 클릭 우선 경로로 유지해야 한다
- 따라서 현재 app-shell 공백은 기능 실패가 아니라 자동화 깊이 문제에 가깝다

## 산출 로그

- `mydocs/working/app-control-logs/tauri-dev-stdout.log`
- `mydocs/working/app-control-logs/tauri-dev-stderr.log`
- `mydocs/working/app-control-logs/vite-direct-stdout.log`
- `mydocs/working/app-control-logs/vite-direct-stderr.log`
- `tools/capture-rhwp-app-window.ps1`

## 현재 판단

이번 검증 범위에서 확인된 것은 다음과 같다.

- adapter 분리 이후에도 기본 빌드는 유지된다
- Tauri dev 앱은 정상 부팅 가능하다
- localhost dev server도 응답 가능하다
- 동일 시점 기준 앱 중복 창은 관찰되지 않았다

## 아직 남은 것

- 앱 내부 실제 문서 로드/편집/인쇄 흐름의 수동 검증
- baseline UI/UX 동등성 확인
- link-drop / print / pdf viewer 회귀 확인
- app-shell 기준 메뉴/인쇄 대화창 자동화 안정화

## App-Shell Link-Drop Helper

OS drag 자동화는 일반 브라우저/사용자 입력과 충돌할 수 있으므로,
DEV 환경에서는 app-shell 기준 동일 로직을 타는 helper를 추가했다.

추가 함수:

- `window.__debugOpenRemoteHwpUrl(url, suggestedName?)`
- `tools/print-link-drop-helper-snippet.ps1`

의미:

- `remote-link-drop`의 실제 다운로드/판별/문서 로드 경로를 그대로 사용한다.
- 단지 입력을 OS drag event 대신 직접 URL로 주입한다.
- 따라서 app-shell 기준 link-drop 회귀 확인을 더 안전하게 진행할 수 있다.

## 결론

Phase 2 이후 최소 app-control 부팅 검증은 통과로 본다.

다음 검증 초점:

- 기능 유지 검증
- UI/UX baseline 비교
