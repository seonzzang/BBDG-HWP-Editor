# RHWP Print Worker PDF Quality Verification 2026-04-24

Project:

- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

print worker가 생성한 최종 PDF가 비어 있지 않고, 페이지 순서가 보존되는지 확인한다.

## 검증 대상

- smoke PDF: `%TEMP%\bbdg-print-worker-smoke\output.pdf`

## 검증 방법

### 1. smoke PDF 생성

명령:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run-print-worker-smoke.ps1
```

결과:

- PASS

### 2. PDF 페이지 수 / 텍스트 추출 검증

명령:

```powershell
@'
import fitz, os
path = os.path.expandvars('%TEMP%\\bbdg-print-worker-smoke\\output.pdf')
doc = fitz.open(path)
print('PAGE_COUNT', doc.page_count)
for i in range(doc.page_count):
    text = doc.load_page(i).get_text('text').strip().replace('\r', ' ').replace('\n', ' | ')
    print(f'PAGE_{i+1}_TEXT', text)
'@ | python -
```

결과:

- `PAGE_COUNT 2`
- `PAGE_1_TEXT Smoke Page 1`
- `PAGE_2_TEXT Smoke Page 2`

판단:

- 최종 PDF는 2페이지로 저장되었다.
- 1페이지와 2페이지의 텍스트가 서로 다르며 순서도 올바르다.

### 3. 페이지 비어 있음 여부 확인

명령:

```powershell
@'
import fitz, os
path = os.path.expandvars('%TEMP%\\bbdg-print-worker-smoke\\output.pdf')
doc = fitz.open(path)
for i in range(doc.page_count):
    page = doc.load_page(i)
    pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
    samples = pix.samples
    nonwhite = 0
    total = pix.width * pix.height
    for idx in range(0, len(samples), 3):
        r, g, b = samples[idx], samples[idx + 1], samples[idx + 2]
        if not (r > 245 and g > 245 and b > 245):
            nonwhite += 1
    print(f'PAGE_{i+1}_NONWHITE', nonwhite, 'TOTAL', total)
'@ | python -
```

결과:

- `PAGE_1_NONWHITE 3212 TOTAL 501832`
- `PAGE_2_NONWHITE 3225 TOTAL 501832`

판단:

- 두 페이지 모두 비어 있지 않다.
- 최소 smoke 검증 수준에서 `blank page` 문제는 보이지 않는다.

### 4. PDF data preparation time 기록 여부

근거 로그:

- `%TEMP%\bbdg-print-worker-smoke\print-worker-analysis.log`

확인 값:

- `readAllSvgMs: 3`
- `htmlBuildMs: 0`
- `setContentMs: 4`

판단:

- SVG 읽기와 HTML 구성, 브라우저 content 주입에 대한 준비 단계 시간이 analysis log에 기록된다.
- 따라서 `PDF data preparation time is recorded.` 항목은 현재 `PASS`로 볼 수 있다.

## 산출물

- `C:\Users\BBDG\AppData\Local\Temp\bbdg-print-worker-smoke\output.pdf`
- `mydocs/working/app-control-logs/print-worker-smoke-pdf-page1.png`
- `mydocs/working/app-control-logs/print-worker-smoke-pdf-page2.png`

## 결론

현재 smoke 검증 기준에서:

- output PDF pages are not broken or blank
- output PDF preserves page order
- PDF data preparation time is recorded

두 항목은 `PASS`로 판단한다.
