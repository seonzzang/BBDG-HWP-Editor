# RHWP Normal Load Console Clean Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

정상 문서 로드 중 `WASM panic`, `null pointer`, `hitTest 실패` 같은 치명 콘솔 오류가 반복되지 않는지 확인한다.

## 자동 검증

명령:

- `node e2e/normal-load-console-clean.test.mjs`

결과:

- PASS

대상 문서:

- `biz_plan.hwp`
- `form-002.hwpx`
- `kps-ai.hwp`

## 확인 항목

- 정상 로드 중 `null pointer passed to rust` 미발생
- 정상 로드 중 `WASM panic` 미발생
- 정상 로드 중 `hitTest 실패` 미발생
- `pageerror` 미발생

## 산출물

- `rhwp-studio/e2e/screenshots/normal-load-console-clean-01.png`
- `rhwp-studio/output/e2e/normal-load-console-clean-report.html`
