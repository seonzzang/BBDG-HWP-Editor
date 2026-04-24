# RHWP Validation Modal Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

비표준 문서 경고 모달이 올바른 경계에서만 표시되는지 확인한다.

## 검증 항목

### 1. 새 문서

재현:

- `[파일] -> [새로 만들기]`

결과:

- PASS

확인 항목:

- 새 문서에서는 `HWPX 비표준 감지` 모달이 뜨지 않는다.

### 2. 실제 경고 문서

재현:

- `R3 단독` 경고 문서 열기

결과:

- PASS

확인 항목:

- `R3` 단독 경고 문서에서는 강한 모달 대신 상태바 약한 안내가 표시된다.
- 예: `일부 문단 표시를 자동 보정할 수 있습니다.`

## 자동 검증

명령:

- `node e2e/validation-modal-smoke.test.mjs`

결과:

- PASS

확인 항목:

- 새 문서에서는 validation modal 미표시
- `BlogForm_BookReview.hwp` 로드 시 validation modal 미표시
- 수동 검증 기준으로 `R3` 단독 경고는 상태바 약한 안내로 표시됨

현재 샘플 한계:

- 현재 public samples에는 `LinesegArrayEmpty` / `LinesegUncomputed` 같은 강한 경고 문서 fixture가 없어서,
  강한 경고 모달 경로는 별도 fixture 확보 후 추가 검증이 필요하다.
