import { createInterface } from 'node:readline';
import { stdin, stdout, stderr } from 'node:process';
import type {
  PrintJobProgress,
  PrintJobRequest,
  PrintJobResult,
  PrintWorkerMessage,
} from '../rhwp-studio/src/print/worker-types.ts';

function writeMessage(message: PrintWorkerMessage): void {
  stdout.write(`${JSON.stringify(message)}\n`);
}

function writeProgress(progress: PrintJobProgress): void {
  writeMessage({
    type: 'progress',
    progress,
  });
}

function writeResult(result: PrintJobResult): void {
  writeMessage({
    type: 'result',
    result,
  });
}

async function handleJob(request: PrintJobRequest): Promise<void> {
  const startedAt = Date.now();

  writeProgress({
    jobId: request.jobId,
    phase: 'spawned',
    completedPages: 0,
    totalPages: request.pageCount,
    batchIndex: 0,
    message: `Print worker spawned for ${request.sourceFileName}`,
  });

  writeProgress({
    jobId: request.jobId,
    phase: 'loading',
    completedPages: 0,
    totalPages: request.pageCount,
    batchIndex: 0,
    message: `Echo worker received ${request.svgPagePaths.length} svg paths`,
  });

  const completedPages = Math.min(request.batchSize, request.pageCount);
  writeProgress({
    jobId: request.jobId,
    phase: 'rendering-batch',
    completedPages,
    totalPages: request.pageCount,
    batchIndex: 1,
    message: `Echo batch processed ${completedPages} pages`,
  });

  writeResult({
    jobId: request.jobId,
    ok: true,
    outputPdfPath: request.outputPdfPath,
    durationMs: Date.now() - startedAt,
  });
}

async function main(): Promise<void> {
  const rl = createInterface({
    input: stdin,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const request = JSON.parse(trimmed) as PrintJobRequest;
      await handleJob(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr.write(`[print-worker] ${message}\n`);
      writeResult({
        jobId: 'unknown',
        ok: false,
        durationMs: 0,
        errorCode: 'WORKER_PARSE_ERROR',
        errorMessage: message,
      });
    }
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  stderr.write(`[print-worker:fatal] ${message}\n`);
  process.exitCode = 1;
});
