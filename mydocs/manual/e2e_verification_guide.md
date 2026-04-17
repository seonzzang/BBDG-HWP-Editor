# E2E 조판 자동 검증 가이드

## 개요

빈 문서에서 프로그래밍으로 문서를 생성하고, 렌더링 결과가 기대값과 일치하는지 **자동으로 검증**하는 체계입니다.

```
시나리오 정의 → 자동 실행 → 렌더 트리 측정 → 규칙 기반 검증 → 결과 보고
```

## 사전 조건

1. WASM 빌드 완료 (`docker compose --env-file .env.docker run --rm wasm`)
2. Vite dev server 실행 중 (`cd rhwp-studio && npx vite --host 0.0.0.0 --port 7700`)
3. Chrome CDP 연결 가능 (호스트 또는 headless)

## 실행 방법

```bash
cd rhwp-studio

# 호스트 Chrome CDP
CHROME_CDP=http://localhost:19222 node e2e/tac-verify.test.mjs --mode=host

# headless Chrome
node e2e/tac-verify.test.mjs --mode=headless
```

## 파일 구조

```
rhwp-studio/e2e/
├── scenario-runner.mjs      # 시나리오 실행기 + 측정기 + 검증기
├── tac-verify.test.mjs       # 인라인 TAC 표 검증 시나리오 모음
├── tac-inline-create.test.mjs # 한컴 방식 입력 E2E (단계별 스크린샷)
├── helpers.mjs               # 공통 헬퍼 (moveCursorTo 등)
└── screenshots/              # 자동 생성 스크린샷
```

## 시나리오 작성

### 시나리오 정의

JSON 객체로 문서 작성 순서를 선언합니다. 한컴에서의 입력 순서를 그대로 반영합니다.

```javascript
const scenario = {
  name: 'TC-V01: 인라인 TAC 표 기본',
  steps: [
    { type: 'text',  value: 'TC #20',           label: 'title' },
    { type: 'enter',                             label: 'enter1' },
    { type: 'text',  value: '표 앞 텍스트   ',    label: 'before-text' },
    { type: 'inlineTable',
      rows: 2, cols: 2,
      colWidths: [6777, 6777],                   // HWPUNIT 단위 열 폭
      cells: ['1', '2', '3', '4'],               // 셀 텍스트 (좌→우, 위→아래)
      label: 'table' },
    { type: 'text',  value: '   표 뒤 텍스트',    label: 'after-text' },
    { type: 'enter',                             label: 'enter2' },
    { type: 'text',  value: '다음 줄',            label: 'last-line' },
  ],
};
```

### step 종류

| type | 설명 | 필수 속성 | 선택 속성 |
|------|------|----------|----------|
| `text` | 키보드로 텍스트 입력 | `value` | `label` |
| `enter` | Enter 키 (문단 분할) | — | `label` |
| `inlineTable` | 인라인 TAC 표 삽입 | `rows`, `cols`, `colWidths` | `cells`, `label`, `sec`, `para` |

### label

각 step에 `label`을 지정하면:
- 스크린샷 파일명에 포함됨 (`v01-03-table.png`)
- 스냅샷 키로 사용됨 (규칙 검증에서 참조)
- 생략 시 `step-0`, `step-1`, ... 자동 생성

### 기대값 정의

구조 검증과 레이아웃 규칙 검증으로 구성됩니다.

```javascript
const expectations = {
  // ── 구조 검증 ──
  pageCount: 1,
  paragraphs: [
    { index: 0, text: 'TC #20' },                      // 정확한 텍스트 일치
    { index: 1, textContains: ['표 앞', '표 뒤'] },     // 부분 문자열 포함
    { index: 2, textContains: ['다음 줄'] },
  ],

  // ── 레이아웃 규칙 검증 ──
  layout: [
    { rule: 'inline-order', paraIndex: 1 },
    { rule: 'table-baseline-align', paraIndex: 1, controlIndex: 0, tolerance: 10.0 },
    { rule: 'space-before-table', paraIndex: 1, controlIndex: 0, minGap: 5.0 },
    { rule: 'space-after-table', paraIndex: 1, controlIndex: 0, minGap: 5.0 },
    { rule: 'stable-after-enter', paraIndex: 1,
      compareSteps: ['table', 'enter2'], tolerance: 3.0 },
  ],
};
```

## 검증 규칙 상세

### inline-order

표가 텍스트 사이에 인라인으로 배치되었는지 x좌표 순서를 확인합니다.

```javascript
{ rule: 'inline-order', paraIndex: 1 }
```

- 표와 같은 y 범위(±10px)의 TextRun을 수집
- 표 앞 텍스트(x+w ≤ 표 x)와 뒤 텍스트(x ≥ 표 x+w)가 존재하는지 확인
- TextRun이 분리되지 않은 경우(표 앞에 전체 텍스트 하나)도 통과

### table-baseline-align

표 하단이 텍스트 베이스라인 부근에 정렬되었는지 확인합니다.

```javascript
{ rule: 'table-baseline-align', paraIndex: 1, tolerance: 10.0 }
```

- `tolerance`: 허용 px 차이 (기본 5.0)
- 표 앞 텍스트의 y좌표와 표 하단(y+h)의 차이를 비교

### space-before-table / space-after-table

표 앞/뒤에 공백이 렌더링되었는지 확인합니다.

```javascript
{ rule: 'space-before-table', paraIndex: 1, minGap: 5.0 }
```

- `minGap`: 최소 간격 px (기본 3.0)
- 표 x와 앞 텍스트 끝 x 사이의 간격을 측정

### stable-after-enter

두 시점의 스냅샷을 비교하여 표 위치가 변하지 않았는지 확인합니다.

```javascript
{ rule: 'stable-after-enter', paraIndex: 1,
  compareSteps: ['table', 'enter2'], tolerance: 3.0 }
```

- `compareSteps`: 비교할 두 step의 label
- 두 스냅샷에서 같은 paraIndex의 표 bbox를 비교
- `tolerance`: 허용 dx/dy px (기본 2.0)

## 테스트 실행 코드

```javascript
import { runTest, createNewDocument, clickEditArea } from './helpers.mjs';
import { runScenario } from './scenario-runner.mjs';

runTest('테스트 이름', async ({ page }) => {
  await createNewDocument(page);
  await clickEditArea(page);
  await runScenario(page, scenario, expectations, 'screenshot-prefix');
});
```

### runScenario 반환값

```javascript
const { results, snapshots, finalState } = await runScenario(page, scenario, expectations);

// results: 검증 결과 배열
// [{ rule: 'pageCount', pass: true, message: '...' }, ...]

// snapshots: 단계별 렌더 트리
// { 'title': { tables: [...], textRuns: [...] }, 'table': {...}, 'final': {...} }

// finalState: 최종 문서 상태
// { pageCount: 1, paraCount: 3, paragraphs: [{ index: 0, text: '...' }, ...] }
```

## 시나리오 추가 예시

### 인라인 표 2개 연속

```javascript
const scenario = {
  name: 'TC-V04: 인라인 표 2개',
  steps: [
    { type: 'text', value: '앞 ' },
    { type: 'inlineTable', rows: 1, cols: 2, colWidths: [4000, 4000],
      cells: ['A', 'B'], label: 'table1' },
    { type: 'text', value: ' 중간 ' },
    { type: 'inlineTable', rows: 1, cols: 2, colWidths: [4000, 4000],
      cells: ['C', 'D'], label: 'table2' },
    { type: 'text', value: ' 뒤' },
  ],
};

const expectations = {
  pageCount: 1,
  paragraphs: [
    { index: 0, textContains: ['앞', '중간', '뒤'] },
  ],
  layout: [
    { rule: 'inline-order', paraIndex: 0 },
  ],
};
```

### 큰 표와 작은 표

```javascript
const scenario = {
  name: 'TC-V05: 다양한 크기 표',
  steps: [
    { type: 'text', value: '작은표: ' },
    { type: 'inlineTable', rows: 1, cols: 1, colWidths: [3000],
      cells: ['S'], label: 'small' },
    { type: 'text', value: ' 큰표: ' },
    { type: 'inlineTable', rows: 3, cols: 3, colWidths: [5000, 5000, 5000],
      cells: ['1','2','3','4','5','6','7','8','9'], label: 'large' },
    { type: 'text', value: ' 끝' },
  ],
};
```

### 한컴 원본 파일 비교 (골든 테스트)

```javascript
import { loadHwpFile } from './helpers.mjs';
import { captureLayout } from './scenario-runner.mjs';

// 한컴 원본 로드 → 렌더 트리 추출 → 기대값으로 사용
const { pageCount } = await loadHwpFile(page, 'tac-case-001.hwp');
const goldenLayout = await captureLayout(page, 0);

// 빈 문서에서 동일 구조 생성 → 렌더 트리 비교
await createNewDocument(page);
await runScenario(page, scenario, expectations);
const generatedLayout = await captureLayout(page, 0);

// 좌표 비교
const goldenTable = goldenLayout.tables[0];
const genTable = generatedLayout.tables[0];
const dx = Math.abs(goldenTable.x - genTable.x);
const dy = Math.abs(goldenTable.y - genTable.y);
assert(dx < 5 && dy < 5, `한컴 대비 차이: dx=${dx} dy=${dy}`);
```

## WASM API 참조

시나리오 실행기가 내부적으로 사용하는 API:

| API | 용도 |
|-----|------|
| `createTableEx(json)` | 인라인 TAC 표 생성 (`treatAsChar: true`) |
| `insertTextLogical(sec, para, logicalOffset, text)` | 논리적 오프셋으로 텍스트 삽입 |
| `getLogicalLength(sec, para)` | 논리적 문단 길이 (텍스트 + 컨트롤) |
| `logicalToTextOffset(sec, para, logicalOffset)` | 논리적 → 텍스트 오프셋 변환 |
| `navigateNextEditable(sec, para, charOffset, delta, contextJson)` | 커서 이동 (컨트롤 건너뛰기) |
| `getPageRenderTree(pageNum)` | 렌더 트리 JSON (좌표 검증용) |
| `insertTextInCell(sec, para, ctrl, cell, cellPara, offset, text)` | 셀 내 텍스트 삽입 |

## 출력

### 콘솔 출력

```
  === 시나리오: TC-V01: 인라인 TAC 표 기본 ===
  실행 완료: 1페이지, 3문단
  ✓ [pageCount] 페이지 수: 기대=1 실제=1
  ✓ [paragraph-contains] pi=1 '배치 시작' 포함: true
  ✓ [inline-order] 인라인 순서: 앞=3 뒤=11 같은줄=18
  ✓ [table-baseline-align] 세로 정렬: 표하단=187.8 textY=195.8 차이=8.0px (허용=10)
  결과: 7 통과, 0 실패
```

### 스크린샷

각 step마다 `e2e/screenshots/{prefix}-{번호}-{label}.png`에 저장됩니다.

### HTML 보고서

`output/e2e/{테스트명}-report.html`에 인라인 스크린샷 포함 보고서가 생성됩니다.
