export function buildPrintDocumentCss(): string {
  return `
@page {
  size: A4;
  margin: 12mm 15mm 15mm 15mm;
}

html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #111111;
  font-family: "Malgun Gothic", "Pretendard", sans-serif;
  line-height: 1.5;
}

body {
  padding: 0;
}

.print-document {
  width: 100%;
  box-sizing: border-box;
}

.print-block {
  box-sizing: border-box;
}

.print-block + .print-block {
  margin-top: 4mm;
}

.print-block--page-break {
  break-after: page;
  page-break-after: always;
  height: 0;
  margin: 0;
}

.print-block table {
  width: 100%;
  border-collapse: collapse;
}

.print-block td,
.print-block th {
  border: 1px solid #999999;
  padding: 2mm;
  vertical-align: top;
}

.print-block img {
  max-width: 100%;
  height: auto;
}
`.trim();
}
