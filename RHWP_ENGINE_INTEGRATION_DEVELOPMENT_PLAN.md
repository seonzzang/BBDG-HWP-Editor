# RHWP Engine Integration Development Plan

## 목적

향후 RHWP 엔진 업데이트를 BBDG HWP Editor에 안정적으로 반영하기 위한 단계별 개발 계획을 정의한다.

## 전체 전략

1. 현재 BBDG 기능과 UX를 보존 대상으로 고정한다.
2. 현재 BBDG 기능과 RHWP 엔진 의존 지점을 조사한다.
3. 엔진 코어 오염도를 낮춘다.
4. `wasm-bridge`를 명확한 adapter 계층으로 정리한다.
5. RHWP 업데이트 절차를 반복 가능한 프로세스로 만든다.
6. 회귀 테스트 체크리스트를 고정한다.

## Phase 1. 현황 감사

목표:
- RHWP 코어에 직접 들어간 BBDG성 변경을 식별한다.

작업:
- `git log -- src pkg rhwp-studio/src/core/wasm-bridge.ts` 분석
- 엔진성 변경과 앱성 변경 분류
- `src/wasm_api.rs` 변경 이력 정리
- `pkg/*` 생성 산출물 갱신 이력 정리
- `wasm-bridge.ts`가 호출하는 RHWP API 목록화

산출물:
- 엔진 의존 API 목록
- 코어 변경 리스크 목록
- 앱 레이어 이전 가능 항목 목록

완료 기준:
- 어떤 기능이 RHWP 코어에 의존하는지 한눈에 볼 수 있어야 한다.

## Phase 2. 엔진 경계 고정

목표:
- BBDG 앱이 RHWP 엔진을 직접 만지는 면적을 줄인다.

작업:
- `wasm-bridge.ts`를 공식 adapter로 선언
- RHWP raw import 사용 위치 검색
- 앱 레이어에서 직접 `HwpDocument`를 호출하는 코드 제거 또는 예외 문서화
- adapter public method 목록 정리
- adapter에 없는 엔진 호출은 추가 전 검토 규칙 적용

산출물:
- 안정 adapter API 목록
- raw engine access 예외 목록

완료 기준:
- RHWP API 변경 시 수정 지점이 대부분 adapter로 제한되어야 한다.

## Phase 3. 과거 실험성 엔진 변경 정리

목표:
- 인쇄 추출 등 RHWP 코어에 섞였던 실험성 변경을 제거 또는 앱 레이어로 이동한다.

작업:
- print extraction 관련 과거 커밋 재검토
- 현재 사용하지 않는 WASM print API 제거 여부 확인
- `src/print_module.rs` 제거 상태 확인
- `src/wasm_api.rs`에 남은 BBDG 전용 API 식별
- 필요 API는 일반화하거나 adapter/worker 경로로 이동

산출물:
- 제거된 실험성 API 목록
- 유지해야 하는 엔진 API 목록
- upstream PR 후보 목록

완료 기준:
- PDF/인쇄 기능이 RHWP 코어가 아니라 앱/worker 레이어에서 완결되어야 한다.

## Phase 4. RHWP 업데이트 리허설

목표:
- 실제 엔진 업데이트 전에 충돌 포인트를 예측한다.

작업:
- upstream RHWP 기준 커밋 확인
- 임시 브랜치에서 RHWP 코어만 갱신
- 빌드 오류 확인
- adapter 수정만으로 앱 빌드가 가능한지 확인
- 핵심 수동 테스트 수행

산출물:
- 충돌 파일 목록
- adapter 수정 목록
- 회귀 테스트 결과

완료 기준:
- RHWP 업데이트가 어떤 비용으로 가능한지 명확해야 한다.

## Phase 5. 업데이트 자동 체크 스크립트

목표:
- 엔진 업데이트 후 반복 검증을 빠르게 수행한다.

작업:
- 엔진 API 사용 검색 스크립트 작성
- generated `pkg` 변경 확인 스크립트 작성
- 기본 빌드/체크 명령 묶음 작성
- 수동 테스트 체크리스트 문서화

권장 명령:

```bash
cargo check
cargo test
cd rhwp-studio && npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

산출물:
- 엔진 업데이트 체크리스트
- 검증 명령 문서

완료 기준:
- 업데이트 담당자가 매번 같은 순서로 검증할 수 있어야 한다.

## Phase 6. 운영 규칙 적용

목표:
- 이후 개발에서 엔진 오염이 다시 증가하지 않게 한다.

작업:
- PR/커밋 리뷰 기준에 계층 구분 추가
- 엔진 코어 수정 시 사유 문서화 강제
- 앱 레이어 우회 가능성 검토 체크 추가
- upstream PR 후보와 BBDG 전용 패치 분리

산출물:
- 개발 규칙 업데이트
- 엔진 수정 예외 기록 양식

완료 기준:
- 새 기능 개발 시 RHWP 코어 수정 여부를 먼저 검토하는 문화가 생겨야 한다.

## 우선순위

### P0
- `wasm-bridge` API 목록화
- RHWP raw API 직접 호출 위치 검색
- `src/wasm_api.rs` BBDG 전용 변경 식별

### P1
- 실험성 print extraction 잔여물 정리
- 엔진 업데이트 리허설
- 회귀 테스트 체크리스트 고정

### P2
- 자동 체크 스크립트 작성
- upstream PR 후보 분리
- adapter 모듈 세분화

## 리스크

### 엔진 API 변경

영향:
- `wasm-bridge` 빌드 오류
- rendering/hitTest/export 호출 실패

대응:
- adapter에서 호환 레이어 추가
- 앱 호출부 변경 최소화

### generated pkg 불일치

영향:
- TypeScript 타입과 WASM 실제 함수 불일치

대응:
- RHWP 빌드 절차로 `pkg` 재생성
- 수동 수정 금지

### 기존 BBDG 기능 회귀

영향:
- 인쇄/PDF/링크드롭/편집기 UX 깨짐

대응:
- 수동 회귀 테스트 체크리스트 수행
- 앱 레이어 기능은 엔진 업데이트 커밋과 분리

## 작업 완료 정의

이 계획의 1차 완료 조건:
- 요구사항 명세서 작성 완료
- 개발명세서 작성 완료
- 개발계획 명세서 작성 완료
- 엔진 경계 원칙 합의
- 현재 업그레이드된 BBDG 기능 유지 원칙 합의
- 다음 RHWP 업데이트 시 적용 가능한 절차 확보
