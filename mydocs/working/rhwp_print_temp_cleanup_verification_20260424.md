# RHWP Print Temp Cleanup Verification 2026-04-24

## 목적

`RHWP Integration Preservation Framework` 기준으로 PDF 내보내기 과정에서 생성되는 print worker 임시 파일이 무제한 누적되지 않도록 정리 경로가 존재하는지 확인한다.

이번 검증은 다음 두 층으로 나누어 수행했다.

- Rust/Tauri command 레벨
  - 허용된 worker temp output path만 정리
  - temp dir 전체 삭제
  - temp root 밖 경로 거부
- 런타임 상태 확인
  - remote link-drop temp root가 현재 비어 있음
  - print worker temp cleanup 경로가 앱 레이어에 연결됨

## 변경 사항

수정 파일:

- `src-tauri/src/print_worker.rs`
- `src-tauri/src/main.rs`
- `rhwp-studio/src/print/export-current-doc.ts`
- `rhwp-studio/src/app/devtools.ts`

핵심:

- `cleanup_print_worker_temp_output_path` Tauri command 추가
- 내부 PDF 뷰어 경로에서 PDF bytes를 읽은 뒤 worker temp output cleanup 수행
- temp root 밖 경로 / 비정상 파일명 / 분석 로그가 없는 디렉터리는 삭제 거부

## 실행 명령

```powershell
cargo test --manifest-path src-tauri/Cargo.toml print_worker
cargo check --manifest-path src-tauri/Cargo.toml
```

## 결과

- PASS

## 확인 항목

- worker temp output path cleanup 단위 테스트 PASS
- non-temp path 거부 단위 테스트 PASS
- `cargo check` PASS
- `%TEMP%\\bbdg-hwp-link-drop` 현재 잔여 파일 수 `0`

## 결론

현재 구현은 내부 PDF 뷰어 경로에서 worker output PDF를 읽은 뒤 temp dir 정리를 수행한다.

즉, 정상 사용 경로 기준으로 print worker 임시 파일이 무제한 누적되는 방향은 아니라는 근거가 확보되었다.
