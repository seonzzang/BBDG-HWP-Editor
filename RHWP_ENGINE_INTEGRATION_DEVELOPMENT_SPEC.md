# RHWP Engine Integration Development Specification

## 목적

`RHWP_ENGINE_INTEGRATION_REQUIREMENTS.md`의 요구사항을 실제 코드 구조와 개발 규칙으로 구체화한다.

## 목표 아키텍처

```text
BBDG HWP Editor
  ├─ UI / UX
  │   └─ rhwp-studio/src/**
  ├─ App Services
  │   ├─ src-tauri/src/**
  │   └─ scripts/**
  ├─ Engine Adapter
  │   └─ rhwp-studio/src/core/wasm-bridge.ts
  └─ RHWP Engine
      ├─ src/**/*.rs
      └─ pkg/**
```

핵심 방향:
- BBDG 기능은 UI/App Services에 둔다.
- RHWP 호출은 Engine Adapter를 통한다.
- RHWP Engine은 upstream 교체 가능 영역으로 유지한다.
- 단, 엔진 교체 가능성은 현재 BBDG 기능 보존을 해치지 않는 범위에서만 추구한다.

## 모듈 책임

### RHWP Engine

책임:
- HWP/HWPX 파싱
- 문서 모델 구성
- 페이지 계산
- SVG/HTML/Canvas 렌더링
- hitTest
- export
- validation warnings

비책임:
- BBDG 메뉴/대화창
- PDF 생성 워커
- Tauri 파일 다운로드
- 링크 드롭 UX
- PDF 뷰어 UX
- 인쇄 진행률 오버레이

### Engine Adapter

책임:
- RHWP WASM 초기화
- RHWP document lifecycle 관리
- 앱에서 쓰는 안정 API 제공
- RHWP API 변경 흡수
- null document, retired document, load transition 안전장치

개발 규칙:
- 앱 레이어는 `HwpDocument`를 직접 import하지 않는다.
- RHWP 메서드 이름 변경은 adapter에서만 대응한다.
- adapter에 BBDG 기능이 커지면 별도 service로 이동한다.

### Print/PDF Service

책임:
- 페이지 SVG 추출 호출 조율
- print worker manifest 작성
- Puppeteer 기반 PDF 생성
- chunk PDF 생성 및 병합
- 진행률/취소/ETA
- 내부 PDF 뷰어 연결

위치:
- `rhwp-studio/src/command/commands/file.ts`
- `rhwp-studio/src/ui/print-options-dialog.ts`
- `rhwp-studio/src/ui/print-progress-overlay.ts`
- `rhwp-studio/src/pdf/pdf-preview-controller.ts`
- `scripts/print-worker.ts`
- `src-tauri/src/print_worker.rs`
- `src-tauri/src/print_job.rs`

개발 규칙:
- PDF 생성을 RHWP Rust 코어에 넣지 않는다.
- RHWP는 페이지 SVG 생성까지만 책임진다.
- PDF 병합/저장/열기는 worker/service 레이어에서 처리한다.

### Remote Link Drop Service

책임:
- 브라우저 drag data 후보 분석
- URL 다운로드
- Content-Type/Content-Disposition 기반 문서 판별
- 임시 파일 관리
- 문서 로드 요청

위치:
- `rhwp-studio/src/command/link-drop.ts`
- `rhwp-studio/src/main.ts`
- `src-tauri/src/remote_hwp.rs`

개발 규칙:
- 원격 다운로드 로직을 RHWP 코어에 넣지 않는다.
- RHWP에는 최종 문서 bytes만 전달한다.

## API 경계 명세

### 앱이 기대하는 안정 API

`wasm-bridge`는 최소한 다음 기능을 안정 API로 제공한다.

- `initialize()`
- `loadDocument(data, fileName)`
- `createNewDocument()`
- `pageCount`
- `fileName`
- `renderPageSvg(pageIndex)`
- `getPageInfo(pageIndex)`
- `hitTest(...)`
- `exportHwp()`
- `exportHwpx()`
- `getValidationWarnings()`
- `reflowLinesegs()`

RHWP upstream API가 변경되면 앱 호출부가 아니라 이 안정 API 내부에서 대응한다.

## 엔진 교체 절차 명세

### 1. Upstream 반영 브랜치 생성

```bash
git switch -c chore/update-rhwp-engine-YYYYMMDD
```

### 2. RHWP 코어 갱신

갱신 대상:
- `src/**`
- `pkg/**`
- `Cargo.toml`
- `Cargo.lock`
- generated binding 관련 파일

주의:
- 앱 UX 변경과 같은 커밋에 섞지 않는다.

### 3. Adapter 빌드 오류 수정

우선 수정 대상:
- `rhwp-studio/src/core/wasm-bridge.ts`
- `rhwp-studio/src/core/types.ts`

수정 원칙:
- 앱 호출부 변경은 최소화한다.
- adapter가 RHWP API 변경을 흡수한다.

### 4. 앱 서비스 회귀 수정

필요 시 수정 대상:
- print service
- link drop service
- canvas view
- input handler

수정 원칙:
- RHWP 코어를 다시 수정하기 전에 앱 레이어 우회를 먼저 검토한다.

## 호환성 테스트 명세

### 자동 테스트

```bash
cargo check
cargo test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

### 수동 테스트

문서 로딩:
- HWP 샘플 열기
- HWPX 샘플 열기
- 대형 문서 열기
- 비표준 HWPX validation warning 확인

편집기:
- 클릭 hitTest
- 스크롤
- 현재 페이지 표시
- 저장/export

원격 문서:
- 직접 `.hwp` URL 드롭
- 직접 `.hwpx` URL 드롭
- 실패 URL 오류 처리

인쇄/PDF:
- 전체 문서 PDF 내보내기
- 페이지 범위 PDF 내보내기
- PDF 생성 취소
- 내부 PDF 뷰어 열기
- 편집기로 복귀
- 기존 브라우저 인쇄

## 개발 금지 패턴

금지:
- BBDG UI 상태를 Rust 엔진 구조체에 저장
- PDF worker 상태를 RHWP 코어에 저장
- remote download helper를 RHWP 코어에 추가
- generated `pkg` 파일 수동 수정
- 엔진 업데이트 중 앱 UX 변경 동시 진행

허용:
- adapter에서 RHWP API 호출 보정
- 앱 레이어에서 RHWP 결과 후처리
- Tauri command로 OS/파일시스템 작업 처리
- worker에서 PDF 생성/병합 처리

## 문서화 규칙

엔진 업데이트 PR 또는 커밋에는 다음을 포함한다.

- RHWP upstream 기준
- 변경된 엔진 API
- adapter 수정 내역
- 앱 기능 영향
- 검증 결과
- 임시 우회 또는 남은 리스크

## 완료 기준

엔진 업데이트 작업은 다음 조건을 만족해야 완료된다.

- 현재 구현된 BBDG 기능과 UX가 유지되어야 한다.
- RHWP 코어 변경과 BBDG 앱 변경이 분리되어 있다.
- 앱 주요 기능이 회귀 없이 동작한다.
- adapter 외 앱 전역에서 RHWP API 변경 여파가 확산되지 않았다.
- 충돌/우회/미해결 리스크가 문서화되었다.
