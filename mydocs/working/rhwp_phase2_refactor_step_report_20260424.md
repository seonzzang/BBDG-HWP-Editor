# RHWP Phase 2 Refactor Step Report

Date:
- `2026-04-24`

Project:
- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## Step

- `Phase 2. 엔진 경계 고정 / app-adapter 경계 리팩토링`

## Scope

이번 단계는 기능 추가가 아니라 구조 정리와 경계 고정에 집중했다.

주요 대상:

- `rhwp-studio/src/main.ts`
- `rhwp-studio/src/command/commands/file.ts`
- `rhwp-studio/src/core/wasm-bridge.ts`
- `rhwp-studio/src/app/*`
- `rhwp-studio/src/print/*`

## What Changed

### 1. File command split

- `file.ts` 인쇄/PDF 관련 책임을 `print/*` 모듈로 분리
- ETA, worker analysis, progress, current-doc export, legacy print, dialog entry를 별도 모듈로 분리

### 2. Main bootstrap split

- `main.ts`의 bootstrap, dev runtime, embedded API, event binding, file input, editor context, command runtime, DOM helper를 `app/*`로 분리
- `main.ts`는 현재 진입점/조립 파일 성격으로 축소

### 3. Document lifecycle split

- 문서 초기화, URL 파라미터 로드, HWPX beta notice, validation, file/bytes/new-doc 로드 액션을 `app/*`로 분리

### 4. WasmBridge cleanup

- `wasm-bridge.ts`에 공통 adapter helper 추가
  - `requireDoc`
  - `withDoc`
  - `withOptionalDoc`
  - `parseDocJson`
  - `parseOptionalDocJson`
  - optional-method helpers
- 반복적인 null guard와 JSON parse 패턴을 대량 정리
- 타입/폰트 관련 상단 책임을 별도 파일로 분리
- `selection/edit`, `document/paging`, `field/search/bookmark`, `header/footer`, `char/para/style`, `form-object` 기능군을 별도 내부 모듈로 분리

### 5. API inventory update

- `RHWP_ENGINE_API_INVENTORY.md`에 현재 adapter usage snapshot과 hotspot 파일 분포를 기록
- `RHWP_ENGINE_RAW_BYPASS_CANDIDATES.md`에 direct RHWP import 예외 지점을 기록

## New Modules Added

- `rhwp-studio/src/app/bootstrap-editor.ts`
- `rhwp-studio/src/app/command-runtime.ts`
- `rhwp-studio/src/app/dev-runtime.ts`
- `rhwp-studio/src/app/document-initializer.ts`
- `rhwp-studio/src/app/document-load-actions.ts`
- `rhwp-studio/src/app/document-validation.ts`
- `rhwp-studio/src/app/editor-context.ts`
- `rhwp-studio/src/app/editor-dom.ts`
- `rhwp-studio/src/app/embedded-api.ts`
- `rhwp-studio/src/app/event-bindings.ts`
- `rhwp-studio/src/app/file-input.ts`
- `rhwp-studio/src/app/initialize-editor.ts`
- `rhwp-studio/src/app/url-param-load.ts`
- `rhwp-studio/src/core/wasm-bridge-fonts.ts`
- `rhwp-studio/src/core/wasm-bridge-document.ts`
- `rhwp-studio/src/core/wasm-bridge-fields.ts`
- `rhwp-studio/src/core/wasm-bridge-form.ts`
- `rhwp-studio/src/core/wasm-bridge-paging.ts`
- `rhwp-studio/src/core/wasm-bridge-selection.ts`
- `rhwp-studio/src/core/wasm-bridge-header-footer.ts`
- `rhwp-studio/src/core/wasm-bridge-formatting.ts`
- `rhwp-studio/src/core/wasm-bridge-types.ts`
- `rhwp-studio/src/core/wasm-bridge-view.ts`
- `rhwp-studio/src/print/dialog-entry.ts`
- `rhwp-studio/src/print/estimate.ts`
- `rhwp-studio/src/print/export-current-doc.ts`
- `rhwp-studio/src/print/legacy-print.ts`
- `rhwp-studio/src/print/progress.ts`
- `rhwp-studio/src/print/worker-analysis.ts`

## Current Size Snapshot

- `rhwp-studio/src/main.ts`: `87` lines
- `rhwp-studio/src/command/commands/file.ts`: `158` lines
- `rhwp-studio/src/app/document-lifecycle.ts`: `96` lines
- `rhwp-studio/src/core/wasm-bridge.ts`: `984` lines
- extracted `wasm-bridge` internal modules:
  - `wasm-bridge-selection.ts`: `186` lines
  - `wasm-bridge-document.ts`: `81` lines
  - `wasm-bridge-paging.ts`: `75` lines
  - `wasm-bridge-fields.ts`: `212` lines
  - `wasm-bridge-header-footer.ts`: `116` lines
  - `wasm-bridge-formatting.ts`: `186` lines
  - `wasm-bridge-form.ts`: `57` lines
  - `wasm-bridge-view.ts`: `42` lines

## Verification Evidence

Completed:

- `npm run build` passed repeatedly after each refactor block
- latest `npm run build` passed on `2026-04-24`
- `cargo check --manifest-path src-tauri/Cargo.toml` passed
- `cargo check --manifest-path src-tauri/Cargo.toml` re-confirmed after additional adapter split
- `cargo test --manifest-path src-tauri/Cargo.toml remote_hwp` passed
- `node e2e/preservation-smoke.test.mjs` passed
- `scripts/print-worker.ts --generate-pdf <temp-manifest>` shell smoke passed
- app control verification completed in separate report
- baseline verification completed in separate report
- actual Tauri app-shell `[인쇄] -> PDF 내보내기 -> [인쇄]` verification passed
- app-shell internal PDF viewer capture recorded
- `node e2e/link-drop-smoke.test.mjs` passed
- `node e2e/pdf-viewer-ui-smoke.test.mjs` passed
- `node e2e/print-dialog-ui-smoke.test.mjs` passed
- `node e2e/print-execution-smoke.test.mjs` passed
- `node e2e/validation-modal-smoke.test.mjs` passed
- `node e2e/validation-choice-respected.test.mjs` passed
- `node e2e/performance-baseline.test.mjs` passed
- `node e2e/repeated-open-stability.test.mjs` passed
- `node e2e/page-indicator-scroll.test.mjs` passed
- `node e2e/scroll-render-window.test.mjs` passed
- `node e2e/normal-load-console-clean.test.mjs` passed
- `node e2e/page-metadata-consistency.test.mjs` passed
- `node e2e/preload-click-clean.test.mjs` passed
- `node e2e/font-loader-os-detection.test.mjs` passed
- `node e2e/font-loader-cache.test.mjs` passed
- `node e2e/font-loader-failure-cache.test.mjs` passed
- `node e2e/font-fallback-rendering.test.mjs` passed
- latest performance baseline:
  - app startup `3145ms`
  - first document load `1870ms`
  - sample `kps-ai.hwp` `78` pages
- `cargo test --manifest-path src-tauri/Cargo.toml remote_hwp` re-passed with HTML/signature rejection cases
- approval gate latest status: `Approve With Conditions`
- guardian latest status: `Continue with caution`

Resolved in this phase:

- app-shell PDF export root cause confirmed
  - failure was not PDF viewer rendering
  - failure was `print-worker` browser launch selection
  - worker previously selected the first existing browser executable and hit `Edge(x86)` launch failure
  - worker now tries launchable browser candidates in order and succeeds with `Chrome`
- frontend runtime probe hardened
  - `debug_probe_print_worker_runtime` now requires `result.ok === true`
- validation warning display policy hardened without touching RHWP core
  - new document: modal suppressed
  - `LinesegTextRunReflow`-only warnings: modal suppressed, soft status-bar guidance used
  - stronger warning kinds remain eligible for modal display
- PDF ETA now includes viewer open stage in addition to data/generation/merge/save
  - `PrintEstimateStats.openSeconds` added in app layer
  - open stage is learned and blended from actual `workerPdfPreview.open()` durations

Evidence:

- `mydocs/working/app-control-logs/print-preview-rootcause-error.png`
- `mydocs/working/app-control-logs/print-preview-success-check.png`
- `rhwp-studio/e2e/screenshots/link-drop-smoke-01.png`
- `rhwp-studio/output/e2e/link-drop-smoke-report.html`
- `mydocs/working/rhwp_link_drop_verification_20260424.md`
- `rhwp-studio/e2e/screenshots/pdf-viewer-ui-smoke-01-open.png`
- `rhwp-studio/output/e2e/pdf-viewer-ui-smoke-report.html`
- `mydocs/working/rhwp_pdf_viewer_ui_verification_20260424.md`
- `rhwp-studio/e2e/screenshots/print-dialog-ui-smoke-01.png`
- `rhwp-studio/output/e2e/print-dialog-ui-smoke-report.html`
- `mydocs/working/rhwp_print_dialog_ui_verification_20260424.md`
- `mydocs/working/rhwp_pdf_progress_overlay_verification_20260424.md`
- `mydocs/working/rhwp_pdf_export_manual_verification_20260424.md`
- `mydocs/working/rhwp_legacy_print_verification_20260424.md`
- `mydocs/working/rhwp_link_drop_appshell_helper_20260424.md`
- `mydocs/working/rhwp_link_drop_verification_20260424.md`
- `mydocs/working/rhwp_validation_modal_verification_20260424.md`
- `mydocs/working/rhwp_validation_choice_verification_20260424.md`
- `mydocs/working/rhwp_performance_baseline_20260424.md`
- `mydocs/working/rhwp_repeated_open_stability_20260424.md`
- `mydocs/working/rhwp_page_indicator_scroll_verification_20260424.md`
- `mydocs/working/rhwp_scroll_render_window_verification_20260424.md`
- `mydocs/working/rhwp_normal_load_console_clean_verification_20260424.md`
- `mydocs/working/rhwp_page_metadata_consistency_verification_20260424.md`
- `mydocs/working/rhwp_preload_click_clean_verification_20260424.md`
- `mydocs/working/rhwp_font_loader_os_detection_verification_20260424.md`
- `mydocs/working/rhwp_font_loader_cache_verification_20260424.md`
- `mydocs/working/rhwp_font_loader_failure_cache_verification_20260424.md`
- `mydocs/working/rhwp_font_fallback_rendering_verification_20260424.md`
- `mydocs/working/rhwp_print_temp_cleanup_verification_20260424.md`
- `mydocs/working/rhwp_pdf_eta_verification_20260424.md`
- `mydocs/working/rhwp_print_worker_pdf_quality_verification_20260424.md`

Not yet completed in this report:

- Tauri 앱 셸 기준 drag-and-drop 종단간 자동화
- full UI/UX manual verification beyond current print/PDF/link-drop evidence

## Guardian Result

- Guardian decision: `Continue with caution`

Guardian summary:

- current direction is compliant with engine boundary preservation
- no obvious RHWP core contamination found in current refactor scope
- verification gates for behavior/UI/UX preservation still need explicit evidence

## Approval Gate Status

Latest approval gate result:

- `Approve With Conditions`

Conditions summary:

- continue `WasmBridge` functional split in small units, then move to app-control verification
- keep verification green while moving
- complete app-control / baseline verification before final completion judgment

## Risks

- `wasm-bridge.ts` is still a large high-risk adapter file
- Tauri 앱 셸 기준 자동화 증거는 아직 일부 공백이 있다
- baseline equivalence is improved but not fully closed for app-shell-only flows

## Current Phase And Blocker Snapshot

Current phase:

- `Phase 2. 엔진 경계 고정 / app-adapter 경계 리팩토링`

Current blocker:

- 기능 blocker보다는 closeout blocker가 남아 있다.
- 주된 잔여 blocker는 성능 비교 항목의 `baseline 대비 not worse` 판정과 메모리 증가 허용 범위 기록이다.
- history 성격의 `before implementation` 체크박스는 사후에 참으로 만들 수 없으므로 documented exception 후보로 다뤄야 한다.

Next concrete action:

- 남은 미체크 항목을 `PASS / documented exception / follow-up`으로 분류한 closeout 요약 문서를 작성한다.
- 성능 비교 항목의 현재 증거와 남은 공백을 명시하고, 최종 gate/result 문구를 정리한다.
- guardian / approval / momentum 최신 판단을 closeout 문서에 반영한다.

## Engine-Core Exception Note

- 이번 Phase 2에서 RHWP engine core에 대한 BBDG 전용 workflow 침투 변경은 기록되지 않았다.
- 따라서 engine-core exception은 `none for this phase`로 기록한다.

## Requested Next Step

- `Phase 2 continued: drag-and-drop / app-shell UX verification hardening`

## Requested Approval

- preferred: `Approve With Conditions`

Suggested conditions:

- continue refactoring in small units
- keep `npm run build` and `cargo check --manifest-path src-tauri/Cargo.toml` green
- run app-control and baseline verification before commit/push
