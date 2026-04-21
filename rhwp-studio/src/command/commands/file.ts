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
import { PrintController } from '@/print/print-controller';
import type { PrintRangeRequest } from '@/core/types';

function printSvgPages(
  fileName: string,
  widthMm: number,
  heightMm: number,
  svgPages: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const printRoot = document.createElement('div');
    const printStyle = document.createElement('style');
    const cleanupDelayMs = 1200;

    const cleanup = () => {
      document.body.removeAttribute('data-printing');
      printRoot.remove();
      printStyle.remove();
      window.removeEventListener('afterprint', handleAfterPrint);
    };

    const handleAfterPrint = () => {
      cleanup();
      resolve();
    };

    printRoot.id = 'tauri-print-root';
    printRoot.setAttribute('aria-hidden', 'true');
    printRoot.innerHTML = `
<div class="tauri-print-shell">
  ${svgPages.map(svg => `<div class="tauri-print-page">${svg}</div>`).join('\n')}
</div>`;

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
      document.head.appendChild(printStyle);
      document.body.appendChild(printRoot);
      document.body.setAttribute('data-printing', 'true');
      window.addEventListener('afterprint', handleAfterPrint, { once: true });

      setTimeout(() => {
        void (async () => {
          try {
            window.focus();
            await Promise.resolve(window.print());
            setTimeout(() => {
              if (document.body.contains(printRoot)) {
                cleanup();
                resolve();
              }
            }, cleanupDelayMs);
          } catch (error) {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        })();
      }, 100);
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
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
      const usePrintExtraction = params?.usePrintExtraction === true;
      const requestedPrintRange = isPrintRangeRequest(params?.printRange)
        ? params.printRange
        : undefined;
      const wasm = services.wasm;
      const pageCount = wasm.pageCount;

      if (pageCount === 0) return;

      // 진행률 표시
      const statusEl = document.getElementById('sb-message');
      const origStatus = statusEl?.innerHTML || '';

      try {
        if (usePrintExtraction) {
          try {
            const controller = new PrintController(wasm);
            await controller.run({
              title: wasm.fileName,
              range: requestedPrintRange,
              totalPages: getRequestedPrintPageCount(requestedPrintRange, pageCount),
              onProgress: ({ processedPages, totalPages }) => {
                if (statusEl) {
                  renderPrintProgress(statusEl, processedPages, totalPages);
                }
              },
            });
            if (statusEl) statusEl.innerHTML = origStatus;
            return;
          } catch (extractionError) {
            console.warn('[file:print] print extraction failed, falling back to svg print', extractionError);
            if (statusEl) {
              statusEl.textContent = '인쇄 추출 경로 실패, 기본 인쇄로 전환 중...';
            }
          }
        }

        // SVG 페이지 생성
        const svgPages: string[] = [];
        for (let i = 0; i < pageCount; i++) {
          if (statusEl) statusEl.textContent = `인쇄 준비 중... (${i + 1}/${pageCount})`;
          const svg = wasm.renderPageSvg(i);
          svgPages.push(svg);
          // UI 갱신을 위한 양보
          if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
        }

        // 첫 페이지 정보로 용지 크기 결정
        const pageInfo = wasm.getPageInfo(0);
        const widthMm = Math.round(pageInfo.width * 25.4 / 96);
        const heightMm = Math.round(pageInfo.height * 25.4 / 96);

        await printSvgPages(wasm.fileName, widthMm, heightMm, svgPages);

        if (statusEl) statusEl.innerHTML = origStatus;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[file:print]', msg);
        if (statusEl) statusEl.textContent = `인쇄 실패: ${msg}`;
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

function isPrintRangeRequest(value: unknown): value is PrintRangeRequest {
  if (!value || typeof value !== 'object') return false;

  const type = (value as { type?: unknown }).type;
  if (type === 'all') {
    return true;
  }

  if (type === 'currentPage') {
    return typeof (value as { page?: unknown }).page === 'number';
  }

  if (type === 'pageRange') {
    return typeof (value as { start?: unknown }).start === 'number'
      && typeof (value as { end?: unknown }).end === 'number';
  }

  return false;
}

function getRequestedPrintPageCount(
  range: PrintRangeRequest | undefined,
  totalPageCount: number,
): number {
  if (!range || range.type === 'all') {
    return totalPageCount;
  }

  if (range.type === 'currentPage') {
    return 1;
  }

  return Math.max(0, range.end - range.start + 1);
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
