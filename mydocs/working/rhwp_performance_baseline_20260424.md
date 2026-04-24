# RHWP Performance Baseline 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

현재 기준 앱 부팅 시간과 첫 문서 로드 시간을 baseline 값으로 기록한다.

## 자동 검증

명령:

- `node e2e/performance-baseline.test.mjs`

결과:

- PASS

대상 문서:

- `kps-ai.hwp`

## 측정 항목

- 앱 부팅 시간
- 첫 문서 로드 시간
- 로드 대상 페이지 수

## 측정 결과

- 앱 부팅 시간: `3145ms`
- 첫 문서 로드 시간: `1870ms`
- 로드 대상 페이지 수: `78`

## 산출물

- `rhwp-studio/e2e/screenshots/performance-baseline-01.png`
- `rhwp-studio/output/e2e/performance-baseline-report.html`

## 비고

- 이 문서는 “현재 기준 측정값”을 남기는 baseline 기록이다.
- 추후 RHWP 엔진 업데이트 후 같은 명령으로 다시 측정해 비교한다.
