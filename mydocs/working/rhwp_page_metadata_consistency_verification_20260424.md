# RHWP Page Metadata Consistency Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

큰 문서를 스크롤한 뒤에도 `getPageInfo()`가 반환하는 페이지 메타데이터가 일관되게 유지되는지 확인한다.

## 자동 검증

명령:

- `node e2e/page-metadata-consistency.test.mjs`

결과:

- PASS

대상 문서:

- `kps-ai.hwp`

## 확인 항목

- 첫 페이지 / 중간 페이지 / 마지막 페이지 메타데이터 확보
- 각 페이지의 폭/높이 값이 정상
- 큰 스크롤 이동 후에도 같은 페이지 인덱스의 메타데이터가 동일

## 산출물

- `rhwp-studio/e2e/screenshots/page-metadata-consistency-01.png`
- `rhwp-studio/output/e2e/page-metadata-consistency-report.html`
