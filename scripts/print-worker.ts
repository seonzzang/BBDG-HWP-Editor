import { createInterface } from 'node:readline';
import { access, readFile } from 'node:fs/promises';
import { stdin, stdout, stderr } from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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

async function loadPuppeteerCore(): Promise<typeof import('puppeteer-core')> {
  const modulePath = resolve(
    process.cwd(),
    'rhwp-studio',
    'node_modules',
    'puppeteer-core',
    'lib',
    'esm',
    'puppeteer',
    'puppeteer-core.js',
  );

  return import(pathToFileURL(modulePath).href);
}

async function detectBrowserExecutablePath(): Promise<string | null> {
  const configuredPath = process.env.BBDG_PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    configuredPath,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // 다음 후보 검사
    }
  }

  return null;
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

  if (request.debugDelayMs && request.debugDelayMs > 0) {
    await sleep(request.debugDelayMs);
  }

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

async function handleProbeJob(): Promise<void> {
  const startedAt = Date.now();
  const jobId = 'puppeteer-runtime-probe';

  writeProgress({
    jobId,
    phase: 'spawned',
    completedPages: 0,
    totalPages: 0,
    batchIndex: 0,
    message: 'Puppeteer runtime probe started',
  });

  const executablePath = await detectBrowserExecutablePath();
  if (!executablePath) {
    writeResult({
      jobId,
      ok: false,
      durationMs: Date.now() - startedAt,
      errorCode: 'BROWSER_NOT_FOUND',
      errorMessage: '사용 가능한 Chromium/Edge/Chrome 실행 파일을 찾지 못했습니다.',
    });
    return;
  }

  writeProgress({
    jobId,
    phase: 'loading',
    completedPages: 0,
    totalPages: 0,
    batchIndex: 0,
    message: `Browser executable detected: ${executablePath}`,
  });

  let browser: import('puppeteer-core').Browser | null = null;
  try {
    const puppeteer = await loadPuppeteerCore();
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
    });

    const page = await browser.newPage();
    await page.goto('about:blank');

    writeProgress({
      jobId,
      phase: 'completed',
      completedPages: 0,
      totalPages: 0,
      batchIndex: 0,
      message: `Puppeteer runtime ready with ${executablePath}`,
    });

    writeResult({
      jobId,
      ok: true,
      outputPdfPath: executablePath,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeResult({
      jobId,
      ok: false,
      durationMs: Date.now() - startedAt,
      errorCode: 'PUPPETEER_LAUNCH_FAILED',
      errorMessage: message,
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

async function loadRequestFromManifest(manifestPath: string): Promise<PrintJobRequest> {
  const raw = await readFile(manifestPath, 'utf8');
  return JSON.parse(raw) as PrintJobRequest;
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === '--probe-browser') {
    await handleProbeJob();
    return;
  }

  const manifestPath = mode;
  if (manifestPath) {
    try {
      const request = await loadRequestFromManifest(manifestPath);
      await handleJob(request);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr.write(`[print-worker] ${message}\n`);
      writeResult({
        jobId: 'unknown',
        ok: false,
        durationMs: 0,
        errorCode: 'WORKER_MANIFEST_ERROR',
        errorMessage: message,
      });
      return;
    }
  }

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
