# RHWP Baseline Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

Phase 2 adapter 분리 이후 핵심 기능이 baseline 대비 유지되는지 자동 검증 결과를 기록한다.

## 검증 환경

- Vite dev server: `http://localhost:7700`
- Chrome CDP: `http://127.0.0.1:19222`
- 실행 방식: 기존 `rhwp-studio/e2e/*.test.mjs` 재사용

## 실행 결과

### 1. 텍스트 플로우

명령:

- `node e2e/text-flow.test.mjs`

결과:

- PASS

확인 항목:

- 새 문서 생성
- 텍스트 입력
- 줄바꿈
- Enter 문단 분리
- 페이지 넘김
- Backspace 문단 병합

산출물:

- `output/e2e/text-flow-report.html`
- `e2e/screenshots/01-new-document.png`
- `e2e/screenshots/02-text-input.png`
- `e2e/screenshots/03-line-wrap.png`
- `e2e/screenshots/04-enter-split.png`
- `e2e/screenshots/05-page-overflow.png`
- `e2e/screenshots/06-backspace-merge.png`

### 2. 양식 컨트롤

명령:

- `node e2e/form-control.test.mjs`

결과:

- PASS

확인 항목:

- `form-002.hwpx` 로드
- FormObject bbox 추출
- `hitTest()` 셀 진입
- `getFormObjectAt()` 체크박스 감지
- `setFormValue()` 체크 토글
- 원래 값 복원

산출물:

- `output/e2e/form-control-report.html`
- `e2e/screenshots/form-01-loaded.png`
- `e2e/screenshots/form-02-hittest.png`
- `e2e/screenshots/form-03-form-hit.png`
- `e2e/screenshots/form-04-toggled.png`
- `e2e/screenshots/form-05-restored.png`

### 3. 반응형 레이아웃

명령:

- `node e2e/responsive.test.mjs`

결과:

- PASS

확인 항목:

- desktop
- tablet
- mobile
- mobile-landscape

산출물:

- `output/e2e/responsive-report.html`
- `e2e/screenshots/responsive-desktop.png`
- `e2e/screenshots/responsive-tablet.png`
- `e2e/screenshots/responsive-mobile.png`
- `e2e/screenshots/responsive-mobile-landscape.png`

### 4. 보존 프레임워크 스모크

명령:

- `node e2e/preservation-smoke.test.mjs`

결과:

- PASS

확인 항목:

- `biz_plan.hwp` 로드 후 내부 PDF 뷰어 오픈/복귀
- 브라우저 호스트 모드에서 PDF devtools API 존재 확인
- 반복 문서 교체 후 캔버스 렌더링 유지
- 반복 문서 교체 후 `hitTest()` 안정성 유지
- 반복 문서 교체 후 PDF 뷰어 잔존 없음

산출물:

- `output/e2e/preservation-smoke-report.html`
- `e2e/screenshots/preservation-pdf-01-loaded.png`
- `e2e/screenshots/preservation-pdf-02-preview-opened.png`
- `e2e/screenshots/preservation-replace-01-final.png`

### 5. Tauri 원격 링크 백엔드 통합 테스트

명령:

- `cargo test --manifest-path src-tauri/Cargo.toml remote_hwp`

결과:

- PASS

확인 항목:

- direct-extension 경로의 HWPX 다운로드 판별
- response-header 경로의 HWPX 다운로드 판별
- 임시 파일 생성 및 cleanup 경로

### 6. Print worker shell smoke

명령:

- `powershell -NoProfile -ExecutionPolicy Bypass -File tools/run-print-worker-smoke.ps1`

결과:

- PASS

확인 항목:

- SVG 입력에서 browser launch
- PDF chunk 생성
- PDF merge
- 최종 `output.pdf` 저장
- worker progress/result 메시지 출력
- `print-worker-analysis.log` 생성

산출물:

- `mydocs/working/rhwp_print_worker_smoke_20260424.md`
- `tools/run-print-worker-smoke.ps1`
- `C:\Users\BBDG\AppData\Local\Temp\bbdg-print-worker-smoke\output.pdf`

### 7. Tauri 앱 셸 PDF 내보내기

명령/재현:

- 앱 셸에서 `[인쇄] -> PDF 내보내기 -> [인쇄]`

결과:

- PASS

확인 항목:

- `PDF 미리보기 준비 중` 오버레이 표시
- print worker 정상 실행
- 내부 PDF 뷰어 정상 오픈
- 앱 내부에서 PDF 첫 페이지 표시
- 우하단 디버그 추적 패널 기준 정상 순서 확인
  - `worker result has output path`
  - `pdf bytes read`
  - `preview.open resolved`
  - `preview container attached`

산출물:

- `mydocs/working/app-control-logs/print-preview-rootcause-error.png`
- `mydocs/working/app-control-logs/print-preview-success-check.png`
- `mydocs/working/rhwp_pdf_progress_overlay_verification_20260424.md`
- `mydocs/working/rhwp_pdf_export_manual_verification_20260424.md`

원인 분석 요약:

- 기존 실패는 PDF 뷰어 문제가 아니라 `print-worker`의 `puppeteer.launch()` 실패였다.
- worker가 “존재하는 첫 브라우저 실행 파일”을 선택하면서 `Edge(x86)`를 먼저 집었고, 현재 환경에서는 해당 실행 파일이 headless launch에 실패했다.
- `Chrome`은 launch 가능했으므로, worker를 “존재하는 첫 후보”가 아니라 “실제로 launch 성공하는 후보”를 순차 시도하도록 수정했다.
- frontend runtime probe도 `invoke 성공`만으로 true 처리하던 문제를 수정해 실제 `result.ok`를 확인하도록 보강했다.

### 8. Link-drop 입력 계층 / 다운로드 계층 보강 검증

명령:

- `node e2e/link-drop-smoke.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml remote_hwp`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run build`

결과:

- PASS

확인 항목:

- 브라우저 입력 계층
  - `uri-list` 후보 감지
  - `plain-text` 단독 후보 감지
  - 중복 URL 제거
  - HTML 링크 후보 추출
  - `DownloadURL` 우선 선택
  - 파일 드롭이 URL보다 우선
- Rust 다운로드 계층
  - direct-extension 다운로드 허용
  - response-header 다운로드 허용
  - HTML 페이지 응답 차단
  - 잘못된 다운로드 시그니처 차단
  - temp cleanup 경로 유지

산출물:

- `rhwp-studio/e2e/screenshots/link-drop-smoke-01.png`
- `rhwp-studio/output/e2e/link-drop-smoke-report.html`
- `mydocs/working/rhwp_link_drop_verification_20260424.md`

### 9. PDF viewer UI/UX 자동 검증

명령:

- `node e2e/pdf-viewer-ui-smoke.test.mjs`

결과:

- PASS

확인 항목:

- 내부 PDF viewer shell 표시
- `body.pdf-preview-active` 활성화
- 편집기 루트 숨김 처리
- obsolete previous/next 버튼 부재
- 복귀 버튼 존재
- 제목/상태 문구 유지
- Escape 복귀
- 닫힘 후 shell 제거 및 body class 해제

산출물:

- `rhwp-studio/e2e/screenshots/pdf-viewer-ui-smoke-01-open.png`
- `rhwp-studio/output/e2e/pdf-viewer-ui-smoke-report.html`

### 10. Legacy print 수동 검증

재현:

- 앱 셸에서 `[인쇄] -> 현재 페이지 -> 인쇄 -> 인쇄`
- 인쇄창에서 `취소`

결과:

- PASS

확인 항목:

- 브라우저/윈도우 인쇄창이 정상 표시
- 전체 페이지가 아니라 현재 페이지 기준 인쇄 흐름 진입
- `취소` 후 편집기로 정상 복귀

보조 자동 검증:

- `node e2e/print-execution-smoke.test.mjs`

산출물:

- `mydocs/working/rhwp_legacy_print_verification_20260424.md`

### 11. Link-drop 앱 셸 수동 검증

재현:

- 일반 브라우저에서 `.hwp` / `.hwpx` 링크를 앱 창으로 drag-and-drop

결과:

- PASS

확인 항목:

- 원격 문서가 앱 셸에서 정상 오픈
- 드롭 후 앱이 멈추거나 크래시하지 않음
- HWPX의 경우 베타 안내 토스트가 표시될 수 있으나 로드 실패는 아님

산출물:

- `mydocs/working/rhwp_link_drop_verification_20260424.md`

### 12. Validation modal 경계 검증

명령:

- `node e2e/validation-modal-smoke.test.mjs`

결과:

- PASS

확인 항목:

- 새 문서에서는 validation modal 미표시
- `R3` 단독 경고 문서에서는 validation modal 미표시
- 수동 검증 기준으로 상태바 약한 안내 표시

산출물:

- `rhwp-studio/e2e/screenshots/validation-modal-smoke-01-soft-warning.png`
- `rhwp-studio/output/e2e/validation-modal-smoke-report.html`
- `mydocs/working/rhwp_validation_modal_verification_20260424.md`
- `mydocs/working/rhwp_pdf_viewer_ui_verification_20260424.md`

### 10. Print worker PDF 품질 smoke 검증

명령:

- `powershell -NoProfile -ExecutionPolicy Bypass -File tools/run-print-worker-smoke.ps1`
- `python + fitz(PyMuPDF) 텍스트/픽셀 검증`

결과:

- PASS

확인 항목:

- 최종 `output.pdf` 페이지 수 확인
- 1페이지 텍스트 `Smoke Page 1`
- 2페이지 텍스트 `Smoke Page 2`
- 두 페이지 모두 non-white pixel 존재 확인
- smoke 수준에서 blank page / page order 문제 없음

산출물:

- `mydocs/working/rhwp_print_worker_pdf_quality_verification_20260424.md`
- `mydocs/working/app-control-logs/print-worker-smoke-pdf-page1.png`
- `mydocs/working/app-control-logs/print-worker-smoke-pdf-page2.png`

### 10. App-shell 파일 메뉴 / 인쇄 대화창 표시

재현:

- 앱 창 내부 클릭 자동화로 `파일 메뉴` 오픈
- 같은 경로로 `인쇄` 메뉴 항목 클릭

결과:

- PASS

확인 항목:

- 파일 메뉴에 단일 `[인쇄]` 항목 존재
- obsolete PDF chunk preview 메뉴가 재등장하지 않음
- app-shell 기준 custom print dialog 표시
- app-shell 기준 print dialog 취소 후 에디터 복귀
- app-shell 기준 `현재 페이지` 선택 반영
- app-shell 기준 `페이지 범위` 선택 반영

산출물:

- `mydocs/working/app-control-logs/bbdg-file-menu-only-latest.png`
- `mydocs/working/app-control-logs/bbdg-file-print-dialog-latest.png`
- `mydocs/working/app-control-logs/bbdg-print-dialog-cancel-latest.png`
- `mydocs/working/app-control-logs/bbdg-print-dialog-current-page-latest.png`
- `mydocs/working/app-control-logs/bbdg-print-dialog-page-range-latest.png`
- `tools/capture-rhwp-app-window.ps1`

### 11. 인쇄 대화창 UI/UX 자동 검증

명령:

- `node e2e/print-dialog-ui-smoke.test.mjs`

결과:

- PASS

확인 항목:

- 인쇄 대화창 표시
- 문서 전체 / 현재 페이지 / 페이지 범위 라디오
- `PDF 내보내기` / `인쇄` 방식 라디오
- helper text 변화
- 취소로 닫기

산출물:

- `rhwp-studio/e2e/screenshots/print-dialog-ui-smoke-01.png`
- `rhwp-studio/output/e2e/print-dialog-ui-smoke-report.html`
- `mydocs/working/rhwp_print_dialog_ui_verification_20260424.md`

### 12. Performance baseline 자동 측정

명령:

- `node e2e/performance-baseline.test.mjs`

결과:

- PASS

확인 항목:

- 앱 부팅 시간 측정
- 첫 문서 로드 시간 측정
- baseline 비교용 현재 수치 확보
- 앱 부팅 시간: `3145ms`
- 첫 문서 로드 시간: `1870ms`
- 로드 대상 페이지 수: `78`

산출물:

- `rhwp-studio/e2e/screenshots/performance-baseline-01.png`
- `rhwp-studio/output/e2e/performance-baseline-report.html`
- `mydocs/working/rhwp_performance_baseline_20260424.md`

### 13. 반복 문서 교체 안정성

명령:

- `node e2e/repeated-open-stability.test.mjs`

결과:

- PASS

확인 항목:

- `biz_plan.hwp` -> `form-002.hwpx` -> `kps-ai.hwp` 순차 로드
- 각 로드 후 페이지 수 유지
- 각 로드 후 캔버스 렌더링 유지
- 서로 다른 페이지 수로 문서 교체 흔적 확보

산출물:

- `rhwp-studio/e2e/screenshots/repeated-open-stability-01.png`
- `rhwp-studio/output/e2e/repeated-open-stability-report.html`
- `mydocs/working/rhwp_repeated_open_stability_20260424.md`

### 14. 상태바 페이지 표시 / 스크롤 동기화

명령:

- `node e2e/page-indicator-scroll.test.mjs`

결과:

- PASS

확인 항목:

- 큰 문서 로드 후 상태바에 `1 / 78 쪽` 표시
- 아래로 스크롤 시 현재 페이지 증가
- 다시 맨 위로 복귀 시 `1쪽` 복귀

산출물:

- `rhwp-studio/e2e/screenshots/page-indicator-scroll-01.png`
- `rhwp-studio/output/e2e/page-indicator-scroll-report.html`
- `mydocs/working/rhwp_page_indicator_scroll_verification_20260424.md`

### 15. 스크롤 전후 페이지 렌더 윈도우

명령:

- `node e2e/scroll-render-window.test.mjs`

결과:

- PASS

확인 항목:

- 초기 `visible pages`에 첫 페이지 포함
- 아래로 스크롤 시 뒤쪽 `visible pages` / `active pages` 렌더링
- 다시 위로 복귀 시 앞쪽 `visible pages` / `active pages` 복귀

산출물:

- `rhwp-studio/e2e/screenshots/scroll-render-window-01.png`
- `rhwp-studio/output/e2e/scroll-render-window-report.html`
- `mydocs/working/rhwp_scroll_render_window_verification_20260424.md`

### 16. 정상 로드 중 치명 콘솔 오류 부재

명령:

- `node e2e/normal-load-console-clean.test.mjs`

결과:

- PASS

확인 항목:

- `null pointer passed to rust` 미발생
- `WASM panic` 미발생
- `hitTest 실패` 미발생
- `pageerror` 미발생

산출물:

- `rhwp-studio/e2e/screenshots/normal-load-console-clean-01.png`
- `rhwp-studio/output/e2e/normal-load-console-clean-report.html`
- `mydocs/working/rhwp_normal_load_console_clean_verification_20260424.md`

### 17. 페이지 메타데이터 일관성

명령:

- `node e2e/page-metadata-consistency.test.mjs`

결과:

- PASS

확인 항목:

- 첫/중간/마지막 페이지 메타데이터 확보
- 폭/높이 값 정상
- 큰 스크롤 이동 후에도 메타데이터 동일

산출물:

- `rhwp-studio/e2e/screenshots/page-metadata-consistency-01.png`
- `rhwp-studio/output/e2e/page-metadata-consistency-report.html`
- `mydocs/working/rhwp_page_metadata_consistency_verification_20260424.md`

### 18. 문서 로드 전 클릭 시 조용한 처리

명령:

- `node e2e/preload-click-clean.test.mjs`

결과:

- PASS

확인 항목:

- 문서 로드 전 편집 영역 클릭 시 치명 console 로그 없음
- 문서 로드 전 편집 영역 클릭 시 치명 pageerror 없음

산출물:

- `rhwp-studio/e2e/screenshots/preload-click-clean-01.png`
- `rhwp-studio/output/e2e/preload-click-clean-report.html`
- `mydocs/working/rhwp_preload_click_clean_verification_20260424.md`

### 19. OS 폰트 감지

명령:

- `node e2e/font-loader-os-detection.test.mjs`

결과:

- PASS

확인 항목:

- cold-start 이후 `[FontLoader] OS 폰트 감지:` 로그 존재
- 문서 로드와 렌더링 정상 유지

산출물:

- `rhwp-studio/e2e/screenshots/font-loader-os-detection-01.png`
- `rhwp-studio/output/e2e/font-loader-os-detection-report.html`
- `mydocs/working/rhwp_font_loader_os_detection_verification_20260424.md`

### 20. 웹폰트 재시도 억제

명령:

- `node e2e/font-loader-cache.test.mjs`

결과:

- PASS

확인 항목:

- 첫 로드에서 웹폰트 로드 시작 로그 존재
- 같은 문서 재로드 시 웹폰트 로드 재시작 없음

산출물:

- `rhwp-studio/e2e/screenshots/font-loader-cache-01.png`
- `rhwp-studio/output/e2e/font-loader-cache-report.html`
- `mydocs/working/rhwp_font_loader_cache_verification_20260424.md`
- `mydocs/working/rhwp_performance_baseline_20260424.md`

### 21. 웹폰트 실패 캐시로 로그 폭주 억제

명령:

- `node e2e/font-loader-failure-cache.test.mjs`

결과:

- PASS

확인 항목:

- 첫 실패 시도에서 `FontFace.load()` 호출 발생
- 동일 폰트 재요청 시 실패 캐시 때문에 추가 `load()` 호출 없음
- 동일 실패 조건에서 웹폰트 실패 로그가 무한 반복되지 않는 방향으로 동작

산출물:

- `rhwp-studio/e2e/screenshots/font-loader-failure-cache-01.png`
- `rhwp-studio/output/e2e/font-loader-failure-cache-report.html`
- `mydocs/working/rhwp_font_loader_failure_cache_verification_20260424.md`

## 추가 수정 사항

자동 검증 중 Windows 경로 처리 문제를 발견했다.

수정:

- `rhwp-studio/e2e/helpers.mjs`
  - 보고서 파일명 생성 시 `path.basename()` 사용하도록 수정

효과:

- `text-flow.test.mjs`
- `form-control.test.mjs`
- `preservation-smoke.test.mjs`

Windows 경로에 의존하던 HTML 보고서 생성 실패가 해결되었다.

## 현재 판단

자동 baseline 검증 기준으로 다음 기능은 유지된 것으로 본다.

- 편집 기본 흐름
- 양식 컨트롤 인식/토글
- 반응형 기본 레이아웃
- 브라우저 호스트 기준 PDF 내부 뷰어 오픈/복귀
- 반복 문서 교체 후 렌더링 / hitTest 안정성
- Tauri 백엔드 기준 원격 HWP/HWPX 다운로드 판별
- 브라우저 입력 계층 기준 link-drop 후보 추출 / 우선순위
- print worker 백엔드 기준 PDF chunk / merge / save
- Tauri 앱 셸 기준 PDF 내보내기 -> 내부 PDF 뷰어 오픈
- 브라우저 호스트 기준 PDF viewer UI/UX 핵심 회귀 방지
- Tauri 앱 셸 기준 파일 메뉴 / 인쇄 대화창 표시
- 브라우저 호스트 기준 인쇄 대화창 UI/UX 핵심 회귀 방지
- 반복 문서 교체 후 페이지 수 / 캔버스 렌더링 안정성
- 큰 문서 스크롤 시 상태바 페이지 표시 동기화
- 큰 문서 스크롤 시 뒤쪽/앞쪽 페이지 렌더 윈도우 유지
- 정상 로드 중 치명 WASM/null pointer 콘솔 오류 부재
- 큰 문서 스크롤 후에도 페이지 메타데이터 일관성 유지
- 문서 로드 전 클릭 시 치명 노이즈 없이 조용한 처리
- cold-start 이후 OS 폰트 감지 유지
- 동일 문서 재로드 시 웹폰트 재시도 억제
- 웹폰트 실패 캐시로 동일 실패 로그 폭주 억제
- 직접 `.hwp` 링크 drag-and-drop 후보 감지
- 반복 link-drop 후에도 앱이 멈추거나 크래시하지 않음
- 강한 validation 경고에서 `그대로 보기` / `자동 보정` 선택이 실제 동작으로 반영됨
- 누락 웹폰트 상황에서도 fallback 폰트로 문서 렌더링 유지
- 내부 PDF 뷰어 경로에서 print worker temp output cleanup 수행
- ETA가 data/generation/merge/save/open 전 단계를 합산하고, 학습형 평균치를 사용함

추가 비교 근거:

- `mydocs/working/rhwp_performance_comparison_20260424.md`
- `mydocs/working/rhwp_memory_growth_verification_20260424.md`

비교 결과:

- app startup: baseline `2672ms` -> current `3145ms`
- first document load: baseline `1721ms` -> current `1870ms`
- 위 두 항목은 현재 기준 `not significantly worse`로 판단
- 반복 문서 교체 후 JS heap delta: `-3952915 bytes`
- memory growth는 현재 phase 기준 `acceptable`로 판단

## 아직 남은 공백

- Tauri 앱 컨텍스트에서의 실제 drag-and-drop DOM 이벤트 종단간 자동 검증
- 내부 PDF viewer의 실제 Tauri 앱 셸 기준 UI 회귀 비교 자동화
- 내부 PDF viewer의 실제 Tauri 앱 셸 기준 UI 회귀 비교 자동화

## 결론

Phase 2 adapter 분리 이후 핵심 자동 baseline 검증은 현재까지 `PASS`다.

다음 우선순위:

- Tauri 앱 셸 기준 drag-and-drop / print worker 종단간 자동화 고도화
