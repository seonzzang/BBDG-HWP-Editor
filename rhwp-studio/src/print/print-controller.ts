import { WasmBridge } from '../core/wasm-bridge';
import type { PrintRangeRequest } from '../core/types';
import { PrintSandbox } from './print-sandbox';
import { PrintTask } from './print-task';

export interface PrintControllerOptions {
  title?: string;
  onProgress?: (processedBlocks: number) => void;
  range?: PrintRangeRequest;
}

export class PrintController {
  constructor(
    private readonly wasm: WasmBridge,
    private readonly sandbox: PrintSandbox = new PrintSandbox(),
  ) {}

  async run(options: PrintControllerOptions = {}): Promise<void> {
    const title = options.title ?? `${this.wasm.fileName || 'document.hwp'} - Print`;
    const task = new PrintTask(this.wasm, undefined, {
      range: options.range,
    });
    let processedBlocks = 0;

    this.sandbox.open(title);

    try {
      await task.run(async (html, chunk) => {
        this.sandbox.appendChunk(html);
        processedBlocks += chunk.blocks.length;
        options.onProgress?.(processedBlocks);
      });

      await this.sandbox.triggerPrint();
    } finally {
      this.sandbox.dispose();
    }
  }
}
