# RHWP Engine Raw Bypass Candidates

`RHWP Integration Preservation Framework / RHWP 엔진 통합 보존 프레임워크`

## 목적

이 문서는 BBDG 앱 코드 중 `WasmBridge` 같은 공식 adapter 경계를 통하지 않고
RHWP WASM 엔진에 더 직접적으로 접근하는 지점을 기록한다.

목표는 두 가지다.

1. 신규 스파게티 경계 누수를 막는다.
2. RHWP upstream 엔진 업데이트 시 예외 지점을 빠르게 재검토할 수 있게 한다.

## 2026-04-24 스냅샷

전수 검색 패턴:

- `HwpDocument`
- `@wasm/rhwp`
- `rhwp.js`

## 확인된 직접 접근 지점

### 1. 공식 adapter 경계

- `rhwp-studio/src/core/wasm-bridge.ts`
  - 상태: 허용
  - 이유: BBDG 앱의 주 adapter 경계이므로 직접 접근이 정상

### 2. 호환성 계층 예외

- `rhwp-studio/src/hwpctl/index.ts`
  - 상태: 조건부 허용
  - 이유: `hwpctl` 호환 계층이 별도 `HwpCtrl` 객체를 구성하기 위해
    동적으로 `@wasm/rhwp.js`를 로딩하고 `HwpDocument.createEmpty()`를 사용함
  - 규칙:
    - 이 예외는 `hwpctl` 내부에만 머물러야 한다
    - `app`, `ui`, `print`, `command`, `engine` 계층으로 확산되면 안 된다

## 비대상

다음은 검색되더라도 runtime bypass 로 보지 않는다.

- `hwpctl/actions/*`의 주석/매핑 문서
- 단순 버전/문자열 설명
- 문서화 목적의 `rhwp` 표기

## 현재 판단

현재 직접 RHWP import 는 제한된 범위 안에 머물러 있다.

- 허용된 직접 접근:
  - `core/wasm-bridge.ts`
  - `hwpctl/index.ts`
- 그 외 BBDG 제품 코드에서는 direct import 미발견

이는 현재 경계 상태가 양호하다는 뜻이다.

## 운영 규칙

- 신규 코드에서 `@wasm/rhwp.js` 직접 import 금지
- 신규 `HwpDocument.*` 직접 호출 금지
- 불가피한 예외는 반드시 이 문서와 API inventory 에 동시 기록
- 예외 사유는 아래 둘 중 하나여야 한다
  - adapter boundary infrastructure
  - compatibility-layer infrastructure

## 다음 확인 항목

- `src/wasm_api.rs`, `pkg/rhwp.js`, `pkg/rhwp_bg.wasm` 쪽 변경이
  BBDG 앱 계층으로 새 direct dependency 를 만들고 있지 않은지 추적
- `hwpctl` 예외 지점이 향후 adapter 로 흡수 가능한지 검토
