# RHWP Link-Drop App-Shell Helper 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

앱 셸 기준 link-drop 기능을 OS 드래그 자동화 없이 안전하게 재현하기 위한 DEV helper 경로를 기록한다.

## 추가된 helper

DEV 환경에서 아래 함수가 노출된다.

- `window.__debugOpenRemoteHwpUrl(url, suggestedName?)`

의미:

- 실제 앱의 `remote-link-drop` 다운로드/판별/문서 로드 경로를 그대로 사용한다.
- 입력만 OS drag event 대신 URL 문자열로 직접 주입한다.

## 사용 예시

```js
await window.__debugOpenRemoteHwpUrl(
  'https://www.scfmc.or.kr/upload/board/files/2024081_sample.hwpx'
)
```

보조 도구:

- `tools/print-link-drop-helper-snippet.ps1`

예:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/print-link-drop-helper-snippet.ps1
```

효과:

- app-shell devtools 콘솔에 바로 붙여넣을 수 있는 호출문을 출력한다.
- 가능하면 클립보드에도 자동 복사한다.

## 기대 효과

- 일반 브라우저/사용자 마우스와 충돌하는 전역 drag 자동화가 필요 없다.
- 앱 내부 실제 다운로드/판별/문서 열기 경로를 그대로 검증할 수 있다.
- app-shell 증거 수집 시 안전한 반자동 검증 수단으로 사용할 수 있다.

## 주의

- 이 helper는 DEV 전용이다.
- production 기능 경로를 바꾸지 않는다.
- 입력 계층만 단순화할 뿐, 다운로드/판별/문서 로드 로직은 기존 app 경로를 그대로 사용한다.
