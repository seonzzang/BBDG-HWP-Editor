# RHWP Memory Growth Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

반복 문서 교체 시 JS heap 기준 메모리 증가가 통제되는지 확인한다.

## 실행 명령

```powershell
node e2e/memory-growth.test.mjs
```

## 결과

- PASS

## 확인 시나리오

반복 로드 순서:

- `biz_plan.hwp`
- `form-002.hwpx`
- `kps-ai.hwp`
- `biz_plan.hwp`
- `kps-ai.hwp`

측정 항목:

- 초기 `performance.memory.usedJSHeapSize`
- 반복 로드 후 `performance.memory.usedJSHeapSize`
- 허용 기준: `+50MB` 이내

## 측정 결과

- before: `24007780`
- after: `20054865`
- delta: `-3952915`
- allowed delta: `52428800`

## 판단

- 반복 문서 교체 후 heap 증가가 허용 범위 이내다.
- 이번 측정에서는 오히려 초기값보다 감소했다.
- 따라서 현재 phase 기준으로 `Memory growth is acceptable.` 항목은 `PASS`로 판단한다.

## 산출물

- `rhwp-studio/e2e/screenshots/memory-growth-01.png`
- `output/e2e/memory-growth-report.html`
