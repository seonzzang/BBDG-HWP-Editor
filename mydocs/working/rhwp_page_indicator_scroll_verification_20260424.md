# RHWP Page Indicator Scroll Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

큰 문서에서 스크롤 위치에 따라 상태바의 현재 페이지 표시가 정상적으로 갱신되는지 확인한다.

## 자동 검증

명령:

- `node e2e/page-indicator-scroll.test.mjs`

결과:

- PASS

대상 문서:

- `kps-ai.hwp`

## 확인 항목

- 큰 문서 로드 후 상태바에 `1 / 78 쪽` 표시
- 아래로 스크롤 시 현재 페이지가 `1`보다 큰 값으로 증가
- 다시 맨 위로 스크롤 시 현재 페이지가 `1`로 복귀

## 측정 결과

- 초기 페이지: `1 / 78 쪽`
- 하단 스크롤 후 페이지: `55 / 78 쪽`
- 상단 복귀 후 페이지: `1 / 78 쪽`

## 산출물

- `rhwp-studio/e2e/screenshots/page-indicator-scroll-01.png`
- `rhwp-studio/output/e2e/page-indicator-scroll-report.html`
