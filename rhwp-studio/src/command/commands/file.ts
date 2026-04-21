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

const DEFAULT_SVG_BATCH_SIZE = 50;
const DEFAULT_DOM_INSERT_BATCH_SIZE = 50;

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
    async execute(services, params) {
      const wasm = services.wasm;
      const pageCount = wasm.pageCount;
      const samplePageLimit = typeof params?.samplePageLimit === 'number'
        ? Math.max(1, Math.min(pageCount, Math.floor(params.samplePageLimit)))
        : undefined;
      const renderPageCount = samplePageLimit ?? pageCount;
      const traceId = `print-svg:${Date.now()}`;

      if (pageCount === 0) return;

      // 진행률 표시
      const statusEl = document.getElementById('sb-message');
      const origStatus = statusEl?.innerHTML || '';
      const printOverlay = new PrintProgressOverlay();
      const abortSignal = printOverlay.show('인쇄 준비 중');

      try {
        // SVG 페이지 생성
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

        // 첫 페이지 정보로 용지 크기 결정
        const pageInfo = wasm.getPageInfo(0);
        const widthMm = Math.round(pageInfo.width * 25.4 / 96);
        const heightMm = Math.round(pageInfo.height * 25.4 / 96);

        await printSvgPages(wasm.fileName, widthMm, heightMm, svgPages, traceId);

        if (statusEl) statusEl.innerHTML = origStatus;
        printOverlay.hide();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[file:print]', msg);
        if (statusEl) statusEl.textContent = `인쇄 실패: ${msg}`;
        printOverlay.hide();
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
