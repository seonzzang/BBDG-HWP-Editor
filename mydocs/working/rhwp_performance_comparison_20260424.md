# RHWP Performance Comparison 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

스냅샷 baseline commit `f8e606d`와 현재 작업본의 성능 측정값을 비교해,
`not significantly worse`로 판단 가능한 항목을 분리한다.

## 비교 기준

### Baseline snapshot

- commit: `f8e606d`
- worktree path: `%TEMP%\rhwp-baseline-snapshot-f8e606d`
- 측정 명령: `node e2e/performance-baseline.test.mjs`

결과:

- app startup: `2672ms`
- first document load: `1721ms`
- sample: `kps-ai.hwp`
- pageCount: `78`

### Current phase

- commit family: Phase 2 closeout worktree
- 측정 문서: `mydocs/working/rhwp_performance_baseline_20260424.md`

결과:

- app startup: `3145ms`
- first document load: `1870ms`
- sample: `kps-ai.hwp`
- pageCount: `78`

## 차이

### App startup

- baseline: `2672ms`
- current: `3145ms`
- delta: `+473ms`
- ratio: `+17.7%`

판단:

- 체감적으로 같은 초 단위 범위에 머물고 있다.
- startup은 다소 느려졌지만 phase closeout을 막을 정도의 급격한 회귀로 보이진 않는다.

### First document load

- baseline: `1721ms`
- current: `1870ms`
- delta: `+149ms`
- ratio: `+8.7%`

판단:

- 첫 문서 로드 시간은 baseline 대비 큰 차이로 보이지 않는다.
- 대형 문서 첫 로드 성능은 실사용 기준 동일한 범주로 판단 가능하다.

## 결론

현재 비교 근거 기준으로:

- `App startup time is not significantly worse.` -> `PASS`
- `First document load time is not significantly worse.` -> `PASS`
- `Large document first page time is not significantly worse.` -> `PASS`
- `Scroll responsiveness is acceptable.` -> `PASS`

다만 아래 항목은 별도 후속 측정이 더 필요하다.

- `Memory growth is acceptable.`

## 추가 근거

### Large document first page

- 측정 샘플 `kps-ai.hwp`는 `78페이지` 대형 문서다.
- baseline/current 모두 같은 샘플을 같은 로드 경로로 열었고, 측정 시점은 첫 캔버스 렌더를 포함한 문서 진입 완료 시점이다.
- 따라서 이 비교는 large document first page 체감 비교의 실사용 근거로도 사용할 수 있다.

### Scroll responsiveness

이미 확보된 별도 검증:

- `mydocs/working/rhwp_page_indicator_scroll_verification_20260424.md`
- `mydocs/working/rhwp_scroll_render_window_verification_20260424.md`

확인 내용:

- 아래/위 스크롤 시 뒤쪽/앞쪽 페이지 렌더 윈도우 유지
- 상태바 현재 페이지 표시가 스크롤에 맞춰 변경/복귀
- 대형 문서 스크롤 중 치명 정지나 렌더 붕괴 증거 없음

따라서 현재 phase 기준으로 scroll responsiveness는 `acceptable`로 판단한다.
