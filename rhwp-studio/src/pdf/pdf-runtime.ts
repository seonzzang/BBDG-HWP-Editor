import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

export interface PdfRuntime {
  PDFDocument: typeof PDFDocument;
  SVGtoPDF: typeof SVGtoPDF;
}

export function getPdfRuntime(): PdfRuntime {
  return {
    PDFDocument,
    SVGtoPDF,
  };
}
