# BinData ID 매핑 오류 — 배경 이미지 잘못 연결

## 날짜
2026-02-17

## 관련 타스크
타스크 105 (쪽 테두리/배경 기능 구현) — 후속 수정

## 증상

- `Worldcup_FIFA2010_32.hwp` SVG 내보내기 시 쪽 배경 이미지가 잘못 표시됨
- 원래 배경: 축구 테마 JPEG 이미지 (전체 페이지 크기)
- 실제 출력: 국기 GIF 이미지 (104×64px)가 전체 페이지로 늘려져 렌더링

## 원인 분석

### bin_data_id의 의미

HWP 문서에서 이미지를 참조할 때 사용하는 `bin_data_id`는 **doc_info의 BinData 레코드 순번 (1-indexed)**이다.

```
BinData 레코드 목록:
  [0] storage_id=3, 확장자=jpg  ← bin_data_id=1로 참조
  [1] storage_id=1, 확장자=gif  ← bin_data_id=2로 참조
  [2] storage_id=2, 확장자=gif  ← bin_data_id=3으로 참조
  ...
```

`storage_id`는 CFB 스토리지 내 파일명(`BIN0003.jpg`, `BIN0001.gif` 등)을 결정하는 번호이며, 레코드 순번과 일치하지 않을 수 있다.

### 잘못된 코드

`BinDataContent` 구조체에 `id: storage_id`를 저장하고, 이미지 참조 시 `storage_id`로 검색:

```rust
// parser/mod.rs — BinDataContent 생성
contents.push(BinDataContent {
    id: bd.storage_id,  // storage_id 저장
    data: decompressed,
    extension: ext.to_string(),
});

// renderer/layout.rs — 이미지 참조 (5곳)
bin_data_content.iter()
    .find(|c| c.id == img_fill.bin_data_id)  // storage_id로 검색 (오류!)
```

Worldcup 파일의 경우:
- 배경 ImageFill: `bin_data_id = 1` (첫 번째 BinData = JPEG 배경)
- `storage_id=1`인 항목 검색 → 두 번째 BinData (국기 GIF)가 매칭됨

### 우연히 동작한 이유

대부분의 HWP 파일에서는 `storage_id`가 1부터 순차적으로 할당되어 순번과 일치한다. Worldcup 파일처럼 `storage_id`가 비순차적인 경우에만 버그가 발생.

## 해결 방법

`storage_id`로 검색하는 대신, `bin_data_id`를 1-indexed 배열 인덱스로 사용:

```rust
/// bin_data_id(1-indexed 순번)로 BinDataContent를 찾는다.
fn find_bin_data<'a>(bin_data_content: &'a [BinDataContent], bin_data_id: u16) -> Option<&'a BinDataContent> {
    if bin_data_id == 0 {
        return None;
    }
    bin_data_content.get((bin_data_id - 1) as usize)
}
```

## 수정 파일

| 파일 | 수정 내용 |
|------|----------|
| `src/renderer/layout.rs` | `find_bin_data()` 헬퍼 추가, 5곳의 `iter().find(c.id==)` → 배열 인덱스 접근 |
| `src/wasm_api.rs` | 1곳 동일 수정 |

### 수정 대상 6곳

1. 쪽 배경 이미지 (layout.rs:231)
2. 독립 그림 개체 — 앵커 없음 (layout.rs:3714)
3. 독립 그림 개체 — 캡션 포함 (layout.rs:3853)
4. 그룹 내 그림 개체 (layout.rs:4912)
5. 도형 이미지 채우기 (layout.rs:4949)
6. WASM 클립보드 이미지 (wasm_api.rs:6839)

## 검증 결과

| 파일 | 수정 전 | 수정 후 |
|------|--------|--------|
| Worldcup 배경 | 국기 GIF (104×64) 늘려짐 | JPEG 배경 이미지 정상 |
| request.hwp 도형 | 정상 | 정상 |
| k-water-rfp 28페이지 | 정상 | 정상 |
| 전체 테스트 | 565개 통과 | 565개 통과 |

## 교훈

- `bin_data_id`는 레코드 순번이지 `storage_id`가 아니다 — HWP 스펙의 ID 참조 방식을 정확히 이해할 것
- 대부분의 파일에서 우연히 동작하는 코드는 발견이 어려움 → 다양한 샘플로 검증 필요
- 이미지 참조 로직이 여러 곳에 분산되어 있으면 일관성 유지가 어려움 → 헬퍼 함수로 중앙화
