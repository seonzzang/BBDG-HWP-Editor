# file.ts 1차 분리 작업 계획서

Project:
- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 대상

- `rhwp-studio/src/command/commands/file.ts`

## 배경

현재 `file.ts`는 약 1000줄 이상으로 커져 있으며,
다음 책임이 한 파일에 동시에 누적되어 있다.

- 파일 관련 command entry
- 인쇄 대화창 진입
- PDF 내보내기 orchestration
- 진행률 오버레이 제어
- ETA 계산
- worker 분석 로그 파싱
- 취소 처리
- PDF 뷰어 연결

이 상태는 바이브 코딩 속도에는 유리할 수 있으나,
향후 아래 리스크를 빠르게 키운다.

- 인쇄 기능 수정 시 영향 범위 과대화
- ETA/overlay/viewer 로직의 결합 심화
- 테스트 단위 분리 어려움
- 다음 RHWP 통합 작업과 무관한 app 서비스 복잡도 증가

## 목표

1차 분리의 목표는 기능 변경이 아니다.

목표는 아래 두 가지다.

1. `file.ts`를 “커맨드 진입점 파일” 방향으로 되돌리기 시작한다.
2. ETA/로그 해석/진행률 계산처럼 순수하게 분리 가능한 부분부터 떼어낸다.

## 이번 단계 범위

이번 1차 분리에서는 아래만 수행한다.

포함:

- ETA 계산 함수 분리
- estimate stats load/save/update 로직 분리
- worker analysis log parse 로직 분리
- `file.ts`에서 새 모듈 호출로 치환

제외:

- print dialog UI 구조 변경
- 실제 PDF export orchestration 대규모 이동
- cancel 동작 변경
- overlay 동작 변경
- PDF viewer 흐름 변경

즉, 이번 단계는 동작을 바꾸지 않고 “순수 계산/해석 로직 분리”까지만 한다.

## 제안 모듈 구조

신규 후보 파일:

- `rhwp-studio/src/print/estimate.ts`
- `rhwp-studio/src/print/worker-analysis.ts`

### `print/estimate.ts`

담당:

- 기본 ETA 상수
- estimate stats type
- stats load/save
- `estimateRemainingSeconds`
- `estimateMergeAndSaveSeconds`
- `estimateRenderSeconds`
- `estimateWorkerChunkCount`
- `estimateRemainingPostDataSeconds`
- stats blend/update helper

### `print/worker-analysis.ts`

담당:

- worker analysis log entry type
- latest entry parse
- entries parse
- chunk range format

## 기대 효과

1차 분리 후 기대 효과:

- `file.ts` 상단의 계산/파싱 코드량 감소
- PDF/print 서비스 핵심 흐름을 더 읽기 쉬워짐
- ETA 로직 테스트/검증을 별도로 하기 쉬워짐
- 이후 2차 분리에서 orchestration 분리를 진행하기 쉬워짐

## 비목표

이번 단계에서 하지 않는 것:

- `file.ts`를 짧게 끝내겠다는 욕심
- 인쇄 기능 전체 재구성
- print service 완전 분리
- command system 구조 변경

이번 단계는 어디까지나 “작고 안전한 첫 분리”다.

## 검증 항목

오류 검증:

- `npm run build`
- 필요 시 `cargo check`
- type error 없음
- import path 오류 없음

기능 유지 검증:

- `[파일] -> [인쇄]` 진입
- 인쇄 대화창 표시
- `PDF 내보내기` 기본 선택 유지
- 진행률 오버레이 표시 유지
- ETA 계산/표시 유지
- 취소 동작 유지
- PDF 내보내기 후 내부 PDF 뷰어 연결 유지

## 커밋 경계

권장 커밋:

- 1커밋으로 수행

커밋 의도:

- `refactor: split print estimate helpers from file command`

중요:

- 기능 수정 커밋과 섞지 않는다.
- UI 문구 수정과 섞지 않는다.
- RHWP 코어 변경과 섞지 않는다.

## 다음 단계 예고

1차 분리 완료 후 가능한 2차 후보:

- `print/progress.ts`
- `print/export-current-doc.ts`
- `print/cancel.ts`

하지만 2차는 1차 검증 통과 후 별도 계획으로 진행한다.

## 승인 기준

이 계획은 아래가 만족되면 승인 가능하다.

1. 동작 변경 없는 구조 정리로 범위가 제한되어 있다.
2. `file.ts`의 가장 안전한 분리 대상부터 다룬다.
3. 기능 유지 검증 항목이 명확하다.
4. 다음 단계 욕심을 이번 단계에 섞지 않는다.
