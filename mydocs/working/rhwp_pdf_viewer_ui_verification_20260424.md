# RHWP PDF Viewer UI Verification 2026-04-24

## 목적

`RHWP Integration Preservation Framework` 기준으로 내부 PDF 뷰어의 핵심 UI/UX 회귀 여부를 자동 검증한다.

이번 검증은 브라우저 호스트 모드에서 다음 항목을 확인했다.

- PDF viewer shell 표시
- body active class 적용
- 편집기 루트 숨김 처리
- 이전/다음 버튼 부재
- 복귀 버튼 존재
- 제목/상태 문구 유지
- Escape 복귀
- 닫힘 후 상태 정리

## 실행 명령

```powershell
node e2e/pdf-viewer-ui-smoke.test.mjs
```

## 결과

- PASS

## 확인 항목

- `biz_plan.hwp` 로드 성공
- 내부 PDF 뷰어 오픈 성공
- `.pdf-preview-shell iframe.pdf-preview-frame` 표시
- `body.pdf-preview-active` 활성화
- `#studio-root` visibility가 `hidden`
- viewer shell position이 `fixed`
- `편집기로 돌아가기` 버튼 존재
- obsolete previous/next chunk 버튼 없음
- viewer 제목 유지
- 상태 문구 유지
- 복귀 버튼 크기 유지 (`30px x 30px`)
- `Escape`로 viewer 닫힘
- 닫힘 후 body class 해제
- 닫힘 후 shell 제거

## 산출물

- `rhwp-studio/e2e/screenshots/pdf-viewer-ui-smoke-01-open.png`
- `rhwp-studio/output/e2e/pdf-viewer-ui-smoke-report.html`

## 판단

브라우저 호스트 기준 내부 PDF 뷰어의 구조적 UI/UX 회귀는 현재 보이지 않는다.

특히 이전에 문제였던 항목과 연결해서 보면:

- 편집기 위에 PDF viewer가 독립 shell로 올라오는 구조 유지
- obsolete previous/next 버튼 부재 유지
- Escape 복귀와 닫힘 후 상태 정리 정상
- 복귀 컨트롤이 헤더 좌측에 작은 아이콘 버튼으로 배치되어 뷰어 상단 바와 자연스럽게 연결됨

## 추가 판단

최신 스크린샷 기준으로 `편집기로 돌아가기` 컨트롤은 별도 CTA처럼 튀지 않는다.

근거:

- 헤더 좌측에 정렬된 icon-only control
- 제목/상태 정보와 같은 헤더 그룹 안에 배치
- 별도 강조색 배지나 독립 카드 버튼이 아님
- hover/focus 상태도 헤더 툴 성격에 가깝게 유지

## 아직 남은 공백

- 실제 Tauri 앱 셸 기준의 시각적 일체감 비교
- 앱 셸 기준 버튼 위치/간격/헤더 배치의 스크린샷 기반 비교

## 결론

자동 검증 기준으로 내부 PDF viewer UI/UX의 핵심 회귀 방지는 현재 `PASS`다.

추가로, `Return-to-editor control does not look like an unrelated CTA.` 항목도 현재 스크린샷 기준으로 `PASS`로 판단한다.
