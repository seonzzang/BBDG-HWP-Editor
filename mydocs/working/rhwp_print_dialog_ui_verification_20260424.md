# RHWP Print Dialog UI Verification 2026-04-24

## 목적

`RHWP Integration Preservation Framework` 기준으로 인쇄 대화창의 핵심 UI/UX 회귀 여부를 자동 검증한다.

이번 검증은 브라우저 호스트 모드에서 다음 항목을 확인했다.

- 인쇄 대화창 표시
- 문서 전체 / 현재 페이지 / 페이지 범위 라디오
- `PDF 내보내기` / `인쇄` 방식 라디오
- helper text 변화
- 취소로 닫기

## 실행 명령

```powershell
node e2e/print-dialog-ui-smoke.test.mjs
```

## 결과

- PASS

## 확인 항목

- 인쇄 대화창 표시
- 모달 오버레이 존재
- 라디오 입력 5개 존재
- 문서 전체 페이지 수 표시
- 기본 helper text가 `PDF 내보내기` 기준으로 표시
- 현재 페이지 선택 시 helper text가 `1쪽`으로 변경
- 페이지 범위 선택 시 helper text가 범위 기준으로 변경
- legacy `인쇄` 선택 시 helper text가 `인쇄 창 열기`로 변경
- `인쇄` / `취소` 버튼 존재
- 취소로 대화창 닫힘

## 산출물

- `rhwp-studio/e2e/screenshots/print-dialog-ui-smoke-01.png`
- `rhwp-studio/output/e2e/print-dialog-ui-smoke-report.html`

## 판단

브라우저 호스트 기준 인쇄 대화창의 구조적 UI/UX 회귀는 현재 보이지 않는다.

특히 다음 항목이 자동으로 유지되는 것을 확인했다.

- 범위 선택에 따른 helper text 반영
- 인쇄 방식 전환에 따른 helper text 반영
- 취소로 닫히는 기본 대화 흐름

## 아직 남은 공백

- 실제 Tauri 앱 셸에서의 `인쇄` 버튼 이후 분기까지 완전 자동화
- app-shell 기준 범위 입력값 변경 자동화

## 결론

자동 검증 기준으로 인쇄 대화창 UI/UX의 핵심 회귀 방지는 현재 `PASS`다.
