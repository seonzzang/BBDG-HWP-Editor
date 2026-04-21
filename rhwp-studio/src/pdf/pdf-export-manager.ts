import type { PrintRangeRequest } from '@/core/types';

export interface PdfExportProgress {
  completedPages: number;
  totalPages: number;
  batchIndex: number;
  batchStartPage: number;
  batchEndPage: number;
}

export interface PdfExportResult {
  blob: Blob;
  pageCount: number;
  mimeType: 'application/pdf';
  fileName: string;
}

export interface PdfPageViewport {
  width: number;
  height: number;
}

export interface PdfPageRenderResult {
  pageIndex: number;
  svg: string;
  viewport: PdfPageViewport;
}

export interface PdfExportDependencies {
  getFileName: () => string;
  getPageCount: () => number;
  getPageViewport: (pageIndex: number) => Promise<PdfPageViewport> | PdfPageViewport;
  renderPageSvg: (pageIndex: number) => Promise<string> | string;
}

export interface PdfExportOptions {
  range?: PrintRangeRequest;
  signal?: AbortSignal;
  batchSize?: number;
  onProgress?: (progress: PdfExportProgress) => void;
}

export class PdfExportManager {
  constructor(
    private readonly deps: PdfExportDependencies,
  ) {}

  async exportRangeToPdf(options: PdfExportOptions = {}): Promise<PdfExportResult> {
    const targetPages = this.resolveTargetPages(options.range);
    const batchSize = Math.max(1, options.batchSize ?? 20);
    const collectedPages: PdfPageRenderResult[] = [];

    try {
      for (let start = 0; start < targetPages.length; start += batchSize) {
        this.throwIfAborted(options.signal);

        const batch = targetPages.slice(start, start + batchSize);
        const batchResults = await this.generatePdfBatch(batch, options.signal);
        collectedPages.push(...batchResults);

        options.onProgress?.({
          completedPages: Math.min(start + batch.length, targetPages.length),
          totalPages: targetPages.length,
          batchIndex: Math.floor(start / batchSize) + 1,
          batchStartPage: batch[0] + 1,
          batchEndPage: batch[batch.length - 1] + 1,
        });
      }

      return {
        blob: this.createPlaceholderPdfBlob(collectedPages),
        pageCount: collectedPages.length,
        mimeType: 'application/pdf',
        fileName: toPdfFileName(this.deps.getFileName()),
      };
    } catch (error) {
      throw normalizePdfExportError(error);
    }
  }

  async generatePdfBatch(
    pageIndexes: number[],
    signal?: AbortSignal,
  ): Promise<PdfPageRenderResult[]> {
    const results: PdfPageRenderResult[] = [];

    for (const pageIndex of pageIndexes) {
      this.throwIfAborted(signal);

      const svg = await this.deps.renderPageSvg(pageIndex);
      const viewport = await this.deps.getPageViewport(pageIndex);

      results.push({
        pageIndex,
        svg,
        viewport,
      });
    }

    return results;
  }

  private resolveTargetPages(range?: PrintRangeRequest): number[] {
    const totalPages = this.deps.getPageCount();
    if (totalPages <= 0) {
      return [];
    }

    if (!range || range.type === 'all') {
      return Array.from({ length: totalPages }, (_, index) => index);
    }

    if (range.type === 'currentPage') {
      return [clampPage(range.page, totalPages) - 1];
    }

    const start = clampPage(range.start, totalPages);
    const end = clampPage(range.end, totalPages);
    const normalizedStart = Math.min(start, end);
    const normalizedEnd = Math.max(start, end);
    return Array.from(
      { length: normalizedEnd - normalizedStart + 1 },
      (_, index) => normalizedStart - 1 + index,
    );
  }

  private createPlaceholderPdfBlob(_pages: PdfPageRenderResult[]): Blob {
    // Step 1a 스캐폴드 단계: 실제 pdfkit 연동 전까지는 비어 있는 PDF Blob만 반환.
    return new Blob([], { type: 'application/pdf' });
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new DOMException('PDF export aborted', 'AbortError');
    }
  }
}

function clampPage(page: number, totalPages: number): number {
  return Math.max(1, Math.min(totalPages, Math.floor(page)));
}

function toPdfFileName(fileName: string): string {
  if (fileName.toLowerCase().endsWith('.pdf')) {
    return fileName;
  }

  return fileName.replace(/\.[^.]+$/u, '') + '.pdf';
}

function normalizePdfExportError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
