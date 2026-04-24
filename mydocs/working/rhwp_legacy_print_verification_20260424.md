# RHWP Legacy Print Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

앱 셸 기준 `인쇄` 모드가 선택 범위를 존중하면서 브라우저/윈도우 인쇄 흐름으로 정상 연결되는지 확인한다.

## 수동 검증 시나리오

### 1. 현재 페이지 + 인쇄

재현:

- `[인쇄] -> 현재 페이지 -> 인쇄 -> 인쇄`

결과:

- PASS

확인 항목:

- 브라우저/윈도우 인쇄창이 정상 표시된다.
- 전체 문서가 아니라 현재 페이지 기준으로 인쇄 흐름이 시작된다.
- 인쇄창에서 `취소` 후 편집기로 정상 복귀한다.

## 자동 검증 보조

명령:

- `node e2e/print-execution-smoke.test.mjs`

결과:

- PASS

확인 항목:

- `현재 페이지 + PDF 내보내기 + 인쇄` 경로에서 내부 PDF viewer 오픈
- `현재 페이지 + 인쇄 + 인쇄` 경로에서 `window.print()` 호출

제한 사항:

- headless/browser-host 환경에서는 실제 OS 인쇄창의 lifecycle과 `afterprint` 정리 타이밍이 앱 셸과 동일하지 않다.
- 따라서 `legacy print`의 최종 복귀/정리 검증은 수동 앱 셸 검증 결과를 baseline 증거로 사용한다.
