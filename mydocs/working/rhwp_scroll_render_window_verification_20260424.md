# RHWP Scroll Render Window Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

큰 문서에서 아래로 스크롤할 때 뒤쪽 페이지가 실제로 렌더링되고, 다시 위로 올리면 앞쪽 페이지가 재렌더되는지 확인한다.

## 자동 검증

명령:

- `node e2e/scroll-render-window.test.mjs`

결과:

- PASS

대상 문서:

- `kps-ai.hwp`

## 확인 항목

- 초기 `visible pages`에 첫 페이지 포함
- 아래로 스크롤 후 `visible pages` / `active pages`에 뒤쪽 페이지 포함
- 다시 위로 스크롤 후 `visible pages` / `active pages`에 첫 페이지 복귀

## 측정 결과

- 초기 visible pages: `0`
- 하단 스크롤 후 visible pages: `54, 55`
- 하단 스크롤 후 active pages: `49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59`
- 상단 복귀 후 visible pages: `0`
- 상단 복귀 후 active pages: `0, 1, 2, 3, 4, 5`

## 산출물

- `rhwp-studio/e2e/screenshots/scroll-render-window-01.png`
- `rhwp-studio/output/e2e/scroll-render-window-report.html`
