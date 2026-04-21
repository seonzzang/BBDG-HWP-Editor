# Experimental Print Path Removal And Regression Checklist

## 목표

- 운영 경로에는 기존 정확한 인쇄 경로만 남긴다.
- 실험용 추출 경로(`PrintTask`, `PrintSandbox`, Rust print extraction API)를 제거한다.
- 제거 후에도 핵심 기능 회귀가 없어야 한다.

## 제거 대상

### TS 실험 경로

- `rhwp-studio/src/print/print-controller.ts`
- `rhwp-studio/src/print/print-sandbox.ts`
- `rhwp-studio/src/print/print-task.ts`
- `rhwp-studio/src/print/print-styles.ts`

### Rust/WASM 실험 경로

- `src/print_module.rs`
- `src/wasm_api.rs` 내 print extraction 관련 API
- `src/lib.rs` 내 `print_module` 등록

### 수정 대상

- `rhwp-studio/src/command/commands/file.ts`
  - `usePrintExtraction` 분기 제거
  - `PrintController` import 제거
- `rhwp-studio/src/main.ts`
  - `window.__printExtraction()` dev helper 제거
- `Cargo.toml`
  - print extraction 전용 의존성 정리 여부 검토

## 단계별 제거 순서

### Step A. 의존성 탐색

- [ ] `PrintController`, `print-task`, `print-sandbox`, `print-styles` 참조 검색
- [ ] `beginPrintTask`, `extractPrintChunk`, `endPrintTask` 참조 검색
- [ ] `usePrintExtraction`, `__printExtraction` 참조 검색
- [ ] 제거 순서 확정

검증:
- [ ] 검색 결과를 기준으로 운영 경로가 기본 SVG 인쇄만 사용함을 확인

### Step B. TS 운영 경로 정리

- [ ] `file.ts`에서 `usePrintExtraction` 분기 제거
- [ ] `PrintController` import 제거
- [ ] `main.ts`에서 `window.__printExtraction()` 제거
- [ ] 실험용 TS 파일 삭제

검증:
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`

커밋 기준:
- [ ] TS 제거분만 별도 커밋

### Step C. Rust/WASM 실험 경로 제거

- [ ] `print_module.rs` 삭제
- [ ] `wasm_api.rs`에서 print extraction API 제거
- [ ] `HwpDocument.print_task` 상태 제거
- [ ] `lib.rs`에서 `print_module` 등록 제거
- [ ] 필요 시 `Cargo.toml` 정리
- [ ] `wasm-pack build --target web --out-dir pkg` 재생성

검증:
- [ ] `cargo check`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`

커밋 기준:
- [ ] Rust/WASM 제거분만 별도 커밋

### Step D. 회귀 확인

- [ ] 앱 실행
- [ ] 문서 열기
- [ ] 드래그앤드롭 열기
- [ ] `[파일] -> [인쇄]` 기본 경로 동작
- [ ] `[파일] -> [제품 정보]` 동작
- [ ] 대용량 문서 열기 정상

검증:
- [ ] 포터블 또는 dev 앱 기준 수동 확인

## 필수 회귀 테스트 목록

### 문서 로딩

- [ ] 소용량 HWP 파일 열기
- [ ] 대용량 HWP 파일 열기
- [ ] 드래그앤드롭으로 파일 열기
- [ ] `[파일] -> [열기]`로 파일 열기

### 인쇄

- [ ] `[파일] -> [인쇄]` 클릭 시 인쇄 준비 오버레이 표시
- [ ] 진행률 표시 정상
- [ ] 취소 버튼 동작
- [ ] 기본 인쇄 미리보기 품질 유지

### 일반 기능

- [ ] `[파일] -> [제품 정보]`
- [ ] 새 문서 생성
- [ ] 저장
- [ ] 줌 조작

## 성공 조건

- 운영 경로에서 실험용 추출 코드가 더 이상 참조되지 않는다.
- 기본 인쇄 경로는 정확도와 동작을 유지한다.
- 대용량 문서 로딩 및 인쇄 오버레이 동작에 회귀가 없다.
