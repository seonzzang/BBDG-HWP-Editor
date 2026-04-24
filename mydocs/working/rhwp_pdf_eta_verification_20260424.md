# RHWP PDF ETA Verification 2026-04-24

## 목적

`RHWP Integration Preservation Framework` 기준으로 PDF 진행 오버레이의 ETA 계산이 현재 단계만 보는 단순 수치가 아니라, 다단계 작업과 학습형 평균치를 반영하는지 확인한다.

## 확인 기준

검토 파일:

- `rhwp-studio/src/print/estimate.ts`
- `rhwp-studio/src/print/progress.ts`
- `rhwp-studio/src/ui/print-progress-overlay.ts`
- `mydocs/working/rhwp_pdf_progress_overlay_verification_20260424.md`

## 확인 내용

### 1. ETA는 현재 단계만 보지 않는다

`progress.ts`에서:

- `svg batch loaded` 단계:
  - 현재 데이터 읽기 남은 시간
  - `estimateRemainingPostDataSeconds()`로 렌더 + 병합 + 저장의 추정치를 더함
- `page.pdf chunk*` 단계:
  - 현재 렌더 단계 남은 시간
  - `estimateMergeAndSaveSeconds()`로 병합 + 저장 + 열기 추정치를 더함
- `pdf merge chunk*` 단계:
  - 현재 병합 단계 남은 시간
  - `saveSeconds + openSeconds`를 더함
- `pdf merge save started` / `pdf merge save finished` / `pdf merge finished` 단계:
  - 저장 이후 남은 `openSeconds`를 별도 유지
  - `PDF 열기 남은 시간` 라벨로 표시

즉 ETA는 단일 phase 진행률만 표시하지 않고 다음 단계 추정치를 합산한다.

### 2. ETA는 학습형 평균치를 사용한다

`estimate.ts`에서:

- `PRINT_ESTIMATE_STORAGE_KEY = 'bbdg.print.pdf.estimate.v1'`
- `loadPrintEstimateStats()`로 localStorage에서 이전 측정값 로드
- `updatePrintEstimateStatsFromEntries()`로 worker analysis log를 바탕으로
  - `dataSecondsPerPage`
  - `renderSecondsPerChunk`
  - `mergeSecondsPerChunk`
  - `saveSeconds`
  - `openSeconds`
  를 업데이트
- `sampleCount`와 `blendEstimate()`로 새 측정값을 기존 추정치에 혼합

또한 `export-current-doc.ts`에서 실제 `workerPdfPreview.open()` 경과 시간을 측정해
다음 작업의 `openSeconds` 학습값으로 저장한다.

즉 성공적인 작업이 쌓일수록 ETA는 고정 상수가 아니라 세션/사용 환경 기준 평균값을 학습한다.

### 3. 사용자 체감 증거

수동 검증 문서 기준:

- 진행 오버레이에 `ETA 표시`가 실제로 존재
- spinner / elapsed / progress / percent가 함께 표시되어 long silent freeze로 보이지 않음

## 결론

현재 ETA는:

- data preparation
- PDF generation
- merge
- save
- open

을 모두 합산하는 구조이며,
현재 단계만 보는 단순 값에 머물지 않고 성공 작업 로그를 바탕으로 학습형 평균치를 저장/활용한다.

따라서 `ETA includes data preparation, PDF generation, merge, save, and open stages.` 항목은 현재 `PASS`로 판단한다.
