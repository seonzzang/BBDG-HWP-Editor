import type { PrintBlock, PrintChunk, PrintCursor, PrintRangeRequest } from '../core/types';
import { WasmBridge } from '../core/wasm-bridge';

const DEFAULT_PRINT_CHUNK_SIZE = 24;
const DEFAULT_PRINT_PAGE_BATCH_SIZE = 5;

export interface PrintTaskOptions {
  range?: PrintRangeRequest;
  pageBatchSize?: number;
}

export class PrintTask {
  constructor(
    private readonly wasm: WasmBridge,
    private readonly chunkSize: number = DEFAULT_PRINT_CHUNK_SIZE,
    private readonly options: PrintTaskOptions = {},
  ) {}

  begin(): PrintCursor {
    return this.wasm.beginPrintTask(this.options.range);
  }

  extract(cursor: PrintCursor): PrintChunk {
    return this.wasm.extractPrintChunk(cursor, this.chunkSize);
  }

  end(): void {
    this.wasm.endPrintTask();
  }

  async run(onChunk: (html: string, chunk: PrintChunk) => Promise<void> | void): Promise<void> {
    let cursor = this.begin();
    let pendingBlocks: PrintBlock[] = [];
    let pendingPages = 0;

    try {
      while (true) {
        const chunk = this.extract(cursor);
        pendingBlocks.push(...chunk.blocks);
        pendingPages += countCompletedPages(chunk.blocks);
        const shouldFlush = pendingPages >= (this.options.pageBatchSize ?? DEFAULT_PRINT_PAGE_BATCH_SIZE)
          || chunk.done
          || !chunk.nextCursor;

        if (shouldFlush && pendingBlocks.length > 0) {
          const html = this.renderChunkHtml(pendingBlocks);
          if (html) {
            await yieldToIdle();
            await onChunk(html, {
              done: chunk.done,
              nextCursor: chunk.nextCursor,
              blocks: pendingBlocks,
            });
          }
          pendingBlocks = [];
          pendingPages = 0;
        }

        if (chunk.done || !chunk.nextCursor) {
          break;
        }

        cursor = chunk.nextCursor;
        await yieldToBrowser();
      }
    } finally {
      this.end();
    }
  }

  renderChunkHtml(blocks: PrintBlock[]): string {
    return blocks.map((block) => this.renderBlockHtml(block)).join('');
  }

  private renderBlockHtml(block: PrintBlock): string {
    switch (block.type) {
      case 'paragraph':
        return `<section class="print-block print-block--paragraph">${block.html}</section>`;
      case 'table':
        return `<section class="print-block print-block--table">${block.html}</section>`;
      case 'image':
        return `<section class="print-block print-block--image">${normalizeImageHtml(block.src, block.alt)}</section>`;
      case 'pageBreak':
        return '<div class="print-block print-block--page-break"></div>';
      default:
        return '';
    }
  }
}

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function yieldToIdle(): Promise<void> {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    await new Promise<void>((resolve) => {
      window.requestIdleCallback(() => resolve(), { timeout: 100 });
    });
    return;
  }

  await yieldToBrowser();
}

function normalizeImageHtml(src: string, alt: string): string {
  const trimmed = src.trim();
  if (trimmed.startsWith('<img') || trimmed.startsWith('<figure') || trimmed.startsWith('<div')) {
    return trimmed;
  }

  const safeSrc = escapeHtml(src);
  const safeAlt = escapeHtml(alt);
  return `<img src="${safeSrc}" alt="${safeAlt}" />`;
}

function countCompletedPages(blocks: PrintBlock[]): number {
  return blocks.filter((block) => block.type === 'pageBreak').length;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
