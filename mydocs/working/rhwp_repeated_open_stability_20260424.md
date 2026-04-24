# RHWP Repeated Open Stability Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

여러 문서를 연속으로 교체 로드해도 에디터가 무너지지 않고, 페이지 수/캔버스 렌더링이 계속 유지되는지 확인한다.

## 자동 검증

명령:

- `node e2e/repeated-open-stability.test.mjs`

결과:

- PASS

대상 문서:

- `biz_plan.hwp`
- `form-002.hwpx`
- `kps-ai.hwp`

## 확인 항목

- 각 문서가 앱의 실제 `open-document-bytes` 경로로 순차 로드된다.
- 문서 교체 후 `window.__wasm.pageCount`가 정상 유지된다.
- 문서 교체 후 캔버스 렌더링이 계속 유지된다.
- 페이지 수가 서로 다른 문서가 연속으로 열리며 교체 흔적이 남는다.

## 측정 결과

- `biz_plan.hwp`: `6`페이지
- `form-002.hwpx`: `10`페이지
- `kps-ai.hwp`: `78`페이지

## 산출물

- `rhwp-studio/e2e/screenshots/repeated-open-stability-01.png`
- `rhwp-studio/output/e2e/repeated-open-stability-report.html`

## 판단

현재 기준으로 반복 문서 교체 후 즉시 크래시, 렌더링 붕괴, 페이지 수 손실 같은 회귀는 보이지 않는다.
