import type { CommandDef } from '../types';
import { PageSetupDialog } from '@/ui/page-setup-dialog';
import { AboutDialog } from '@/ui/about-dialog';
import { showConfirm } from '@/ui/confirm-dialog';
import { showSaveAs } from '@/ui/save-as-dialog';
import {
  pickOpenFileHandle,
  readFileFromHandle,
  saveDocumentToFileSystem,
  type FileSystemWindowLike,
} from '@/command/file-system-access';
import { PrintProgressOverlay } from '@/ui/print-progress-overlay';
import { PdfPreviewController } from '@/pdf/pdf-preview-controller';
import { invoke } from '@tauri-apps/api/core';
import { showToast } from '@/ui/toast';
import { showPrintOptionsDialog } from '@/ui/print-options-dialog';

const DEFAULT_SVG_BATCH_SIZE = 50;
const DEFAULT_DOM_INSERT_BATCH_SIZE = 50;
const DEFAULT_PDF_PREVIEW_CHUNK_SIZE = 10;
const DEFAULT_PDF_WORKER_BATCH_SIZE = 30;
const DEFAULT_PDF_WORKER_SVG_BATCH_SIZE = 30;

type PdfChunkPreviewCursor = {
  sourceFileName: string;
  startPage: number;
  endPage: number;
  nextStartPage: number;
  chunkSize: number;
  batchSize: number;
  svgBatchSize: number;
  totalPages: number;
};

const workerPdfPreview = new PdfPreviewController();
let currentPdfChunkCursor: PdfChunkPreviewCursor | null = null;

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function getCurrentPageFromStatusBar(): number {
  const statusText = document.getElementById('sb-page')?.textContent ?? '';
  const match = statusText.match(/^\s*(\d+)\s*\/\s*\d+\s*쪽/);
  if (!match) return 1;
  const currentPage = Number.parseInt(match[1], 10);
  return Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
}

function parsePageRangeInput(
  value: string,
  maxPage: number,
): { startPage: number; endPage: number } | null {
  const normalized = value.trim().replace(/\s+/g, '');
  if (!normalized) return null;

  const rangeMatch = normalized.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const startPage = Number.parseInt(rangeMatch[1], 10);
    const endPage = Number.parseInt(rangeMatch[2], 10);
    if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) return null;
    if (startPage < 1 || endPage < startPage) return null;
    return {
      startPage: Math.min(startPage, maxPage),
      endPage: Math.min(endPage, maxPage),
    };
  }

  const singleMatch = normalized.match(/^(\d+)$/);
  if (singleMatch) {
    const page = Number.parseInt(singleMatch[1], 10);
    if (!Number.isFinite(page) || page < 1) return null;
    const clampedPage = Math.min(page, maxPage);
    return {
      startPage: clampedPage,
      endPage: clampedPage,
    };
  }

  return null;
}

function isPdfChunkCursorCurrentDocument(
  cursor: PdfChunkPreviewCursor | null,
  services: Parameters<NonNullable<CommandDef['execute']>>[0],
): cursor is PdfChunkPreviewCursor {
  if (!cursor) return false;
  return (
    cursor.sourceFileName === services.wasm.fileName &&
    cursor.totalPages === services.wasm.pageCount
  );
}

async function previewCurrentDocPdfChunk(
  services: Parameters<NonNullable<CommandDef['execute']>>[0],
  params: {
    startPage?: number;
    chunkSize?: number;
    batchSize?: number;
    svgBatchSize?: number;
    openExternally?: boolean;
    trackCursor?: boolean;
  } = {},
): Promise<void> {
  const wasm = services.wasm;
  if (wasm.pageCount <= 0) {
    throw new Error('문서가 로드되지 않았습니다.');
  }

  const startPage = Math.max(1, Math.min(params.startPage ?? 1, wasm.pageCount));
  const chunkSize = Math.max(1, Math.round(params.chunkSize ?? DEFAULT_PDF_PREVIEW_CHUNK_SIZE));
  const endPage = Math.min(wasm.pageCount, startPage + chunkSize - 1);
  const batchSize = Math.max(1, Math.round(params.batchSize ?? DEFAULT_PDF_WORKER_BATCH_SIZE));
  const svgBatchSize = Math.max(1, Math.round(params.svgBatchSize ?? DEFAULT_PDF_WORKER_SVG_BATCH_SIZE));
  const openExternally = params.openExternally ?? false;
  const trackCursor = params.trackCursor ?? true;
  const pageIndexes = Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage - 1 + index,
  );

  const statusEl = document.getElementById('sb-message');
  const originalStatus = statusEl?.innerHTML ?? '';
  const overlay = new PrintProgressOverlay();
  const abortSignal = overlay.show('PDF 미리보기 준비 중');
  const svgPages: string[] = [];
  const startedAt = performance.now();
  const svgStartedAt = performance.now();

  try {
    for (let startIndex = 0; startIndex < pageIndexes.length; startIndex += svgBatchSize) {
      if (abortSignal.aborted) {
        throw new Error('PDF 미리보기 준비가 취소되었습니다.');
      }

      const batchPageIndexes = pageIndexes.slice(startIndex, startIndex + svgBatchSize);
      for (const pageIndex of batchPageIndexes) {
        if (abortSignal.aborted) {
          throw new Error('PDF 미리보기 준비가 취소되었습니다.');
        }
        svgPages.push(wasm.renderPageSvg(pageIndex));
      }

      const completedPages = Math.min(startIndex + batchPageIndexes.length, pageIndexes.length);
      statusEl && renderPrintProgress(statusEl, completedPages, pageIndexes.length);
      overlay.updateProgress(
        completedPages,
        pageIndexes.length,
        `PDF 미리보기 준비 중... (${startPage + completedPages - 1}/${endPage}페이지)`,
      );

      if (completedPages < pageIndexes.length) {
        await yieldToBrowser();
      }
    }

    const svgExtractElapsedMs = Math.round(performance.now() - svgStartedAt);
    const svgCharLength = svgPages.reduce((total, svg) => total + svg.length, 0);
    const firstPageInfo = wasm.getPageInfo(pageIndexes[0]);
    statusEl && renderPrintProgress(statusEl, pageIndexes.length, pageIndexes.length);
    overlay.updateProgress(
      pageIndexes.length,
      pageIndexes.length,
      `PDF 생성 중... (${startPage}-${endPage}페이지)`,
    );
    console.log('[print-pdf-analysis] frontend before invoke', {
      startPage,
      endPage,
      pageCount: pageIndexes.length,
      batchSize,
      svgBatchSize,
      svgExtractElapsedMs,
      svgCount: svgPages.length,
      svgCharLength,
      approxSvgBytes: svgCharLength * 2,
      heapUsedBytes:
        typeof performance !== 'undefined' && 'memory' in performance
          ? (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize
          : undefined,
    });
    const invokeStartedAt = performance.now();
    const messages = await invoke('debug_run_print_worker_pdf_export_for_current_doc', {
      payload: {
        jobId: `menu-pdf-preview-${Date.now()}`,
        sourceFileName: wasm.fileName,
        widthPx: Math.max(1, Math.round(firstPageInfo.width)),
        heightPx: Math.max(1, Math.round(firstPageInfo.height)),
        batchSize,
        svgPages,
      },
    }) as Array<{
      type?: string;
      result?: {
        ok?: boolean;
        outputPdfPath?: string;
        errorCode?: string;
        errorMessage?: string;
      };
    }>;
    const invokeElapsedMs = Math.round(performance.now() - invokeStartedAt);
    console.log('[print-pdf-analysis] frontend after invoke', {
      startPage,
      endPage,
      pageCount: pageIndexes.length,
      invokeElapsedMs,
      totalElapsedMs: Math.round(performance.now() - startedAt),
      messageCount: messages.length,
    });

    const resultMessage = [...messages].reverse().find((message) => message.type === 'result')?.result;
    const outputPdfPath = resultMessage?.ok ? resultMessage.outputPdfPath : undefined;
    if (!outputPdfPath) {
      throw new Error(
        resultMessage?.errorMessage
          ? `PDF 미리보기 생성 실패 (${resultMessage.errorCode ?? 'UNKNOWN'}): ${resultMessage.errorMessage}`
          : 'PDF 미리보기 생성 결과를 확인할 수 없습니다.',
      );
    }

    if (openExternally) {
      await invoke('debug_open_generated_pdf', { path: outputPdfPath });
    } else {
      const bytes = await invoke('debug_read_generated_pdf', { path: outputPdfPath }) as number[];
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const canGoPrev = startPage > 1;
      const canGoNext = endPage < wasm.pageCount;
      await workerPdfPreview.open(blob, {
        title: `${wasm.fileName} PDF 미리보기`,
        statusText: `${startPage}-${endPage} / ${wasm.pageCount}쪽`,
        canGoPrev,
        canGoNext,
        onPrev: canGoPrev
          ? async () => {
            await previewCurrentDocPdfChunk(services, {
              startPage: Math.max(1, startPage - chunkSize),
              chunkSize,
              batchSize,
              svgBatchSize,
            });
          }
          : undefined,
        onNext: canGoNext
          ? async () => {
            await previewCurrentDocPdfChunk(services, {
              startPage: endPage + 1,
              chunkSize,
              batchSize,
              svgBatchSize,
            });
          }
          : undefined,
      });
    }

    if (trackCursor) {
      currentPdfChunkCursor = {
        sourceFileName: wasm.fileName,
        startPage,
        endPage,
        nextStartPage: endPage + 1,
        chunkSize,
        batchSize,
        svgBatchSize,
        totalPages: wasm.pageCount,
      };
    }

    statusEl && (statusEl.innerHTML = originalStatus);
    overlay.hide();
    showToast({
      message: openExternally
        ? `PDF ${startPage}-${endPage}페이지를 외부 뷰어로 열었습니다.`
        : `PDF 미리보기 ${startPage}-${endPage}페이지를 열었습니다.`,
      durationMs: 3000,
    });
  } catch (error) {
    statusEl && (statusEl.textContent = error instanceof Error ? error.message : String(error));
    overlay.hide();
    throw error;
  }
}

async function runLegacyPrintPreview(
  services: Parameters<NonNullable<CommandDef['execute']>>[0],
  params?: Record<string, unknown>,
): Promise<void> {
  const wasm = services.wasm;
  const pageCount = wasm.pageCount;
  const samplePageLimit = typeof params?.samplePageLimit === 'number'
    ? Math.max(1, Math.min(pageCount, Math.floor(params.samplePageLimit)))
    : undefined;
  const renderPageCount = samplePageLimit ?? pageCount;
  const traceId = `print-svg:${Date.now()}`;

  if (pageCount === 0) return;

  const statusEl = document.getElementById('sb-message');
  const origStatus = statusEl?.innerHTML || '';
  const printOverlay = new PrintProgressOverlay();
  const abortSignal = printOverlay.show('인쇄 준비 중');

  try {
    console.time(`[${traceId}] svg.generate`);
    console.log('[Print Baseline] start', {
      totalPageCount: pageCount,
      renderPageCount,
      sampled: samplePageLimit !== undefined,
      batchSize: DEFAULT_SVG_BATCH_SIZE,
    });
    const svgPages = await generateSvgPagesInBatches({
      wasm,
      pageCount: renderPageCount,
      batchSize: DEFAULT_SVG_BATCH_SIZE,
      abortSignal,
      onProgress: (processedPages, totalPages, batchIndex, batchStart, batchEnd) => {
        if (statusEl) {
          statusEl.textContent = `인쇄 준비 중... (${processedPages}/${totalPages})`;
        }
        printOverlay.updateProgress(
          processedPages,
          totalPages,
          `정확한 인쇄 미리보기를 위해 SVG 페이지를 생성하고 있습니다... (배치 ${batchIndex}, ${batchStart}-${batchEnd}페이지)`,
        );
      },
    });
    console.timeEnd(`[${traceId}] svg.generate`);

    const pageInfo = wasm.getPageInfo(0);
    const widthMm = Math.round(pageInfo.width * 25.4 / 96);
    const heightMm = Math.round(pageInfo.height * 25.4 / 96);

    await printSvgPages(wasm.fileName, widthMm, heightMm, svgPages, traceId);

    if (statusEl) statusEl.innerHTML = origStatus;
    printOverlay.hide();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[file:print:legacy]', msg);
    if (statusEl) statusEl.textContent = `인쇄 실패: ${msg}`;
    printOverlay.hide();
    throw err;
  }
}

async function printSvgPages(
  fileName: string,
  widthMm: number,
  heightMm: number,
  svgPages: string[],
  traceId = `print-svg:${Date.now()}`,
): Promise<void> {
  const printRoot = document.createElement('div');
  const printStyle = document.createElement('style');
  const cleanupDelayMs = 1200;

  const cleanup = () => {
    document.body.removeAttribute('data-printing');
    printRoot.remove();
    printStyle.remove();
    window.removeEventListener('afterprint', handleAfterPrint);
  };

  let resolvePrint!: () => void;
  let rejectPrint!: (error: Error) => void;
  const completion = new Promise<void>((resolve, reject) => {
    resolvePrint = resolve;
    rejectPrint = reject;
  });

  const handleAfterPrint = () => {
    cleanup();
    resolvePrint();
  };

  printRoot.id = 'tauri-print-root';
  printRoot.setAttribute('aria-hidden', 'true');

  const printShell = document.createElement('div');
  printShell.className = 'tauri-print-shell';

  console.time(`[${traceId}] dom.insert`);
  for (let start = 0; start < svgPages.length; start += DEFAULT_DOM_INSERT_BATCH_SIZE) {
    const end = Math.min(start + DEFAULT_DOM_INSERT_BATCH_SIZE, svgPages.length);
    const fragment = document.createDocumentFragment();

    for (let index = start; index < end; index += 1) {
      const page = document.createElement('div');
      page.className = 'tauri-print-page';
      page.innerHTML = svgPages[index];
      fragment.appendChild(page);
    }

    printShell.appendChild(fragment);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  printRoot.appendChild(printShell);
  console.timeEnd(`[${traceId}] dom.insert`);

  printStyle.textContent = `
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
body[data-printing="true"] > :not(#tauri-print-root):not(script):not(style) {
  display: none !important;
}
#tauri-print-root {
  display: none;
}
body[data-printing="true"] #tauri-print-root {
  display: block;
}
body[data-printing="true"] {
  margin: 0 !important;
  padding: 0 !important;
  background: #fff !important;
}
.tauri-print-shell {
  background: #fff;
}
.tauri-print-page {
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  overflow: hidden;
  break-after: page;
  page-break-after: always;
}
.tauri-print-page:last-child {
  break-after: auto;
  page-break-after: auto;
}
.tauri-print-page svg {
  display: block;
  width: 100%;
  height: 100%;
}
@media screen {
  body[data-printing="true"] #tauri-print-root {
    position: fixed;
    inset: 0;
    overflow: auto;
    background: rgba(255, 255, 255, 0.98);
    z-index: 99999;
  }
}
`;

  try {
    console.time(`[${traceId}] dom.attach`);
    document.head.appendChild(printStyle);
    document.body.appendChild(printRoot);
    document.body.setAttribute('data-printing', 'true');
    window.addEventListener('afterprint', handleAfterPrint, { once: true });
    console.timeEnd(`[${traceId}] dom.attach`);

    setTimeout(() => {
      void (async () => {
        try {
          console.time(`[${traceId}] layout.waitBeforePrint`);
          await waitForPrintLayout();
          console.timeEnd(`[${traceId}] layout.waitBeforePrint`);
          console.time(`[${traceId}] window.print`);
          window.focus();
          await Promise.resolve(window.print());
          console.timeEnd(`[${traceId}] window.print`);
          setTimeout(() => {
            if (document.body.contains(printRoot)) {
              cleanup();
              resolvePrint();
            }
          }, cleanupDelayMs);
        } catch (error) {
          cleanup();
          rejectPrint(error instanceof Error ? error : new Error(String(error)));
        }
      })();
    }, 100);
  } catch (error) {
    cleanup();
    rejectPrint(error instanceof Error ? error : new Error(String(error)));
  }

  return completion;
}

export const fileCommands: CommandDef[] = [
  {
    id: 'file:new-doc',
    label: '새로 만들기',
    icon: 'icon-new-doc',
    shortcutLabel: 'Alt+N',
    canExecute: () => true,
    async execute(services) {
      const ctx = services.getContext();
      if (ctx.hasDocument) {
        const ok = await showConfirm(
          '새로 만들기',
          '현재 문서를 닫고 새 문서를 만드시겠습니까?\n저장하지 않은 내용은 사라집니다.',
        );
        if (!ok) return;
      }
      services.eventBus.emit('create-new-document');
    },
  },
  {
    id: 'file:open',
    label: '열기',
    async execute(services) {
      try {
        const handle = await pickOpenFileHandle(window as FileSystemWindowLike);
        if (!handle) {
          document.getElementById('file-input')?.click();
          return;
        }

        const { bytes, name } = await readFileFromHandle(handle);
        services.eventBus.emit('open-document-bytes', {
          bytes,
          fileName: name,
          fileHandle: handle,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[file:open] 열기 실패:', msg);
        alert(`파일 열기에 실패했습니다:\n${msg}`);
      }
    },
  },
  {
    id: 'file:save',
    label: '저장',
    icon: 'icon-save',
    shortcutLabel: 'Ctrl+S',
    // #196: HWPX 출처는 저장 비활성화 (베타 단계, #197 완전 변환기 완료 시까지)
    canExecute: (ctx) => ctx.hasDocument && ctx.sourceFormat !== 'hwpx',
    async execute(services) {
      try {
        const saveName = services.wasm.fileName;
        const sourceFormat = services.wasm.getSourceFormat();
        const isHwpx = sourceFormat === 'hwpx';
        const bytes = isHwpx ? services.wasm.exportHwpx() : services.wasm.exportHwp();
        const mimeType = isHwpx ? 'application/hwp+zip' : 'application/x-hwp';
        const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
        console.log(`[file:save] format=${sourceFormat}, isHwpx=${isHwpx}, ${bytes.length} bytes`);

        // 1) 기존 파일 handle이 있으면 같은 파일에 저장, 없으면 save picker 시도
        try {
          const saveResult = await saveDocumentToFileSystem({
            blob,
            suggestedName: saveName,
            currentHandle: services.wasm.currentFileHandle,
            windowLike: window as FileSystemWindowLike,
          });

          if (saveResult.method !== 'fallback') {
            services.wasm.currentFileHandle = saveResult.handle;
            services.wasm.fileName = saveResult.fileName;
            console.log(`[file:save] ${saveResult.fileName} (${(bytes.length / 1024).toFixed(1)}KB)`);
            return;
          }
        } catch (e) {
          // 사용자가 취소하면 AbortError 발생 — 무시
          if (e instanceof DOMException && e.name === 'AbortError') return;
          // 그 외 오류는 폴백으로 진행
          console.warn('[file:save] File System Access API 실패, 폴백:', e);
        }

        // 2) 폴백: 새 문서인 경우 자체 파일이름 대화상자 표시
        let downloadName = saveName;
        if (services.wasm.isNewDocument) {
          const baseName = saveName.replace(/\.hwp$/i, '');
          const result = await showSaveAs(baseName);
          if (!result) return;
          downloadName = result;
          services.wasm.fileName = downloadName;
        }

        // 3) Blob 다운로드
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        console.log(`[file:save] ${downloadName} (${(bytes.length / 1024).toFixed(1)}KB)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[file:save] 저장 실패:', msg);
        alert(`파일 저장에 실패했습니다:\n${msg}`);
      }
    },
  },
  {
    id: 'file:page-setup',
    label: '편집 용지',
    icon: 'icon-page-setup',
    shortcutLabel: 'F7',
    canExecute: (ctx) => ctx.hasDocument,
    execute(services) {
      const dialog = new PageSetupDialog(services.wasm, services.eventBus, 0);
      dialog.show();
    },
  },
  {
    id: 'file:print',
    label: '인쇄',
    icon: 'icon-print',
    shortcutLabel: 'Ctrl+P',
    canExecute: (ctx) => ctx.hasDocument,
    async execute(services) {
      const currentPage = getCurrentPageFromStatusBar();
      try {
        const options = await showPrintOptionsDialog(currentPage, services.wasm.pageCount);
        if (!options) return;

        if (options.mode === 'legacy') {
          await runLegacyPrintPreview(services);
          return;
        }

        await previewCurrentDocPdfChunk(services, {
          startPage: options.startPage,
          chunkSize: options.endPage - options.startPage + 1,
          batchSize: DEFAULT_PDF_WORKER_BATCH_SIZE,
          svgBatchSize: DEFAULT_PDF_WORKER_SVG_BATCH_SIZE,
          openExternally: true,
          trackCursor: false,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[file:print]', msg);
        alert(`인쇄 작업에 실패했습니다.\n${msg}`);
      }
    },
  },
  {
    id: 'file:print-legacy',
    label: '기존 인쇄 미리보기',
    icon: 'icon-print',
    canExecute: (ctx) => ctx.hasDocument,
    async execute(services, params) {
      try {
        await runLegacyPrintPreview(services, params);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        alert(`기존 인쇄 미리보기에 실패했습니다.\n${msg}`);
      }
    },
  },
  {
    id: 'file:pdf-preview-chunk',
      label: 'PDF 미리보기 (10쪽)',
    canExecute: (ctx) => ctx.hasDocument,
    async execute(services) {
      try {
        await previewCurrentDocPdfChunk(services);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[file:pdf-preview-chunk]', message);
        alert(`PDF 미리보기에 실패했습니다.\n${message}`);
      }
    },
  },
  {
    id: 'file:pdf-preview-current-chunk',
      label: '현재 10쪽 PDF 미리보기',
    canExecute: (ctx) => ctx.hasDocument,
    async execute(services) {
      const currentPage = getCurrentPageFromStatusBar();

      try {
        await previewCurrentDocPdfChunk(services, {
          startPage: currentPage,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[file:pdf-preview-current-chunk]', message);
        alert(`현재 위치 PDF 미리보기에 실패했습니다.\n${message}`);
      }
    },
  },
  {
    id: 'file:pdf-preview-range',
    label: '페이지 범위 PDF 미리보기',
    canExecute: (ctx) => ctx.hasDocument,
    async execute(services) {
      const maxPage = services.wasm.pageCount;
      const defaultStartPage = getCurrentPageFromStatusBar();
      const suggestedEndPage = Math.min(maxPage, defaultStartPage + DEFAULT_PDF_PREVIEW_CHUNK_SIZE - 1);
      const input = window.prompt(
        `PDF 미리보기할 페이지 범위를 입력하세요.\n예: ${defaultStartPage}-${suggestedEndPage} 또는 ${defaultStartPage}`,
        `${defaultStartPage}-${suggestedEndPage}`,
      );

      if (!input) return;

      const parsed = parsePageRangeInput(input, maxPage);
      if (!parsed) {
        alert('페이지 범위를 올바르게 입력해주세요. 예: 21-40 또는 35');
        return;
      }

      try {
        await previewCurrentDocPdfChunk(services, {
          startPage: parsed.startPage,
          chunkSize: parsed.endPage - parsed.startPage + 1,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[file:pdf-preview-range]', message);
        alert(`페이지 범위 PDF 미리보기에 실패했습니다.\n${message}`);
      }
      },
    },
    {
      id: 'file:pdf-export-full',
      label: '전체 인쇄용 PDF 생성',
      icon: 'icon-print',
      canExecute: (ctx) => ctx.hasDocument,
      async execute(services) {
        try {
          await previewCurrentDocPdfChunk(services, {
            startPage: 1,
            chunkSize: services.wasm.pageCount,
            batchSize: DEFAULT_PDF_WORKER_BATCH_SIZE,
            svgBatchSize: DEFAULT_PDF_WORKER_SVG_BATCH_SIZE,
            openExternally: true,
            trackCursor: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[file:pdf-export-full]', message);
          alert(`전체 인쇄용 PDF 생성에 실패했습니다.\n${message}`);
        }
      },
    },
    {
      id: 'file:pdf-preview-next-chunk',
      label: '다음 10쪽 PDF 미리보기',
    canExecute: (ctx) => ctx.hasDocument,
    async execute(services) {
      if (!isPdfChunkCursorCurrentDocument(currentPdfChunkCursor, services)) {
        currentPdfChunkCursor = null;
          alert('먼저 [파일] → [PDF 미리보기 (10쪽)]를 실행해주세요.');
        return;
      }

      if (currentPdfChunkCursor.nextStartPage > currentPdfChunkCursor.totalPages) {
        alert('더 이상 미리보기할 다음 페이지 구간이 없습니다.');
        return;
      }

      try {
        await previewCurrentDocPdfChunk(services, {
          startPage: currentPdfChunkCursor.nextStartPage,
          chunkSize: currentPdfChunkCursor.chunkSize,
          batchSize: currentPdfChunkCursor.batchSize,
          svgBatchSize: currentPdfChunkCursor.svgBatchSize,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[file:pdf-preview-next-chunk]', message);
        alert(`다음 PDF 미리보기에 실패했습니다.\n${message}`);
      }
    },
  },
  {
    id: 'file:pdf-preview-prev-chunk',
      label: '이전 10쪽 PDF 미리보기',
    canExecute: (ctx) => ctx.hasDocument,
    async execute(services) {
      const activeCursor = isPdfChunkCursorCurrentDocument(currentPdfChunkCursor, services)
        ? currentPdfChunkCursor
        : null;
      const chunkSize = activeCursor?.chunkSize ?? DEFAULT_PDF_PREVIEW_CHUNK_SIZE;
      const startPage = activeCursor
        ? Math.max(1, activeCursor.startPage - chunkSize)
        : Math.max(1, getCurrentPageFromStatusBar() - chunkSize);

      try {
        await previewCurrentDocPdfChunk(services, {
          startPage,
          chunkSize,
          batchSize: activeCursor?.batchSize ?? DEFAULT_PDF_WORKER_BATCH_SIZE,
          svgBatchSize: activeCursor?.svgBatchSize ?? DEFAULT_PDF_WORKER_SVG_BATCH_SIZE,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[file:pdf-preview-prev-chunk]', message);
        alert(`이전 PDF 미리보기에 실패했습니다.\n${message}`);
      }
    },
  },
  {
    id: 'file:about',
    label: '제품 정보',
    icon: 'icon-help',
    execute() {
      new AboutDialog().show();
    },
  },
];

async function waitForPrintLayout(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function generateSvgPagesInBatches(params: {
  wasm: typeof import('@/core/wasm-bridge').WasmBridge.prototype;
  pageCount: number;
  batchSize: number;
  abortSignal: AbortSignal;
  onProgress?: (
    processedPages: number,
    totalPages: number,
    batchIndex: number,
    batchStartPage: number,
    batchEndPage: number,
  ) => void;
}): Promise<string[]> {
  const {
    wasm,
    pageCount,
    batchSize,
    abortSignal,
    onProgress,
  } = params;

  const svgPages: string[] = [];
  let processedPages = 0;
  let batchIndex = 0;

  for (let start = 0; start < pageCount; start += batchSize) {
    if (abortSignal.aborted) {
      throw new Error('인쇄 준비가 취소되었습니다.');
    }

    batchIndex += 1;
    const end = Math.min(start + batchSize, pageCount);
    for (let page = start; page < end; page += 1) {
      if (abortSignal.aborted) {
        throw new Error('인쇄 준비가 취소되었습니다.');
      }

      svgPages.push(wasm.renderPageSvg(page));
      processedPages += 1;
    }

    onProgress?.(processedPages, pageCount, batchIndex, start + 1, end);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return svgPages;
}

function renderPrintProgress(
  statusEl: HTMLElement,
  processedPages: number,
  totalPages?: number,
): void {
  const safeTotalPages = totalPages && totalPages > 0 ? totalPages : undefined;
  const clampedProcessedPages = safeTotalPages
    ? Math.min(processedPages, safeTotalPages)
    : processedPages;
  const percent = safeTotalPages
    ? Math.max(0, Math.min(100, Math.round((clampedProcessedPages / safeTotalPages) * 100)))
    : 0;

  statusEl.innerHTML = `
<div style="display:flex; align-items:center; gap:8px; min-width:280px;">
  <span style="white-space:nowrap;">인쇄 준비 중... (${clampedProcessedPages}${safeTotalPages ? `/${safeTotalPages}` : ''}페이지)</span>
  <div style="flex:1; min-width:120px; height:8px; background:#d6dce5; border-radius:999px; overflow:hidden;">
    <div style="width:${percent}%; height:100%; background:linear-gradient(90deg, #2a6cf0 0%, #58a6ff 100%); border-radius:999px;"></div>
  </div>
  <span style="font-variant-numeric:tabular-nums; min-width:40px; text-align:right;">${percent}%</span>
</div>`;
}
