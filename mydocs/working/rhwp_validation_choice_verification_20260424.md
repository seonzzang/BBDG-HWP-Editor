# RHWP Validation Choice Verification 2026-04-24

## 목적

`RHWP Integration Preservation Framework` 기준으로 강한 validation 경고가 발생했을 때 사용자의 선택이 앱 레이어에서 실제 동작으로 존중되는지 확인한다.

이번 검증은 RHWP 엔진을 수정하지 않고, `runDocumentValidation()`에 가짜 `wasm` / `canvasView` 어댑터를 주입해 모달 선택에 따른 side effect를 분리 검증한다.

## 실행 명령

```powershell
node e2e/validation-choice-respected.test.mjs
```

## 결과

- PASS

## 확인 항목

- 강한 validation 경고에서는 모달이 표시된다.
- `그대로 보기` 선택 시:
  - `reflowLinesegs()`가 호출되지 않는다.
  - `canvasView.loadDocument()`가 호출되지 않는다.
- `자동 보정` 선택 시:
  - `reflowLinesegs()`가 1회 호출된다.
  - `canvasView.loadDocument()`가 1회 호출된다.
  - 상태 메시지에 자동 보정 완료 안내가 남는다.

## 산출물

- `rhwp-studio/e2e/screenshots/validation-choice-respected-01.png`
- `rhwp-studio/output/e2e/validation-choice-respected-report.html`

## 결론

현재 앱 레이어 구현은 validation 모달에서 사용자가 고른 선택지를 그대로 따른다.

즉, `그대로 보기`는 비침습적으로 종료되고, `자동 보정`은 실제 보정과 캔버스 재로딩으로 이어진다.
