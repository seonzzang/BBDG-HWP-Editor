import { createInterface } from 'node:readline';
import { access, appendFile, readFile } from 'node:fs/promises';
import { stdin, stdout, stderr } from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

async function appendAnalysisLog(request: PrintJobRequest, message: string, details: Record<string, unknown> = {}): Promise<void> {
  const logPath = resolve(request.tempDir, 'print-worker-analysis.log');
  const payload = {
    at: new Date().toISOString(),
    elapsedMs: Date.now() - analysisStartedAt,
    jobId: request.jobId,
    message,
    ...details,
  };

  await appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf8').catch(() => undefined);
}

let analysisStartedAt = Date.now();

function getWorkspaceRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, '..');
}

async function loadPuppeteerCore(): Promise<typeof import('puppeteer-core')> {
  const modulePath = resolve(
    getWorkspaceRoot(),
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

function buildPdfHtmlDocument(
  request: PrintJobRequest,
  svgMarkupPages: string[],
): string {
  const pageWidth = request.pageSize.widthPx;
  const pageHeight = request.pageSize.heightPx;
  const pageSections = svgMarkupPages
    .map((svgMarkup) => `<section class="page">${svgMarkup}</section>`)
    .join('\n');

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <style>
      @page {
        size: ${pageWidth}px ${pageHeight}px;
        margin: 0;
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: white;
      }
      body {
        width: ${pageWidth}px;
      }
      .page {
        width: ${pageWidth}px;
        height: ${pageHeight}px;
        break-after: page;
        page-break-after: always;
        overflow: hidden;
      }
      .page:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .page > svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    ${pageSections}
  </body>
</html>`;
}

async function launchBrowserForJob(): Promise<{
  browser: import('puppeteer-core').Browser;
  executablePath: string;
}> {
  const executablePath = await detectBrowserExecutablePath();
  if (!executablePath) {
    throw new Error('사용 가능한 Chromium/Edge/Chrome 실행 파일을 찾지 못했습니다.');
  }

  const puppeteer = await loadPuppeteerCore();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  });

  return { browser, executablePath };
}

async function handlePdfJob(request: PrintJobRequest): Promise<void> {
  analysisStartedAt = Date.now();
  const startedAt = Date.now();
  const totalPages = request.svgPagePaths.length;
  const batchSize = Math.max(1, request.batchSize);
  const svgMarkupPages: string[] = [];
  await appendAnalysisLog(request, 'pdf job started', {
    totalPages,
    batchSize,
    outputPdfPath: request.outputPdfPath,
  });

  writeProgress({
    jobId: request.jobId,
    phase: 'spawned',
    completedPages: 0,
    totalPages,
    batchIndex: 0,
    message: `PDF worker spawned for ${request.sourceFileName}`,
  });

  await appendAnalysisLog(request, 'launching browser');
  const browserStartedAt = Date.now();
  const { browser, executablePath } = await launchBrowserForJob();
  await appendAnalysisLog(request, 'browser launched', {
    executablePath,
    browserLaunchMs: Date.now() - browserStartedAt,
  });
  try {
    writeProgress({
      jobId: request.jobId,
      phase: 'loading',
      completedPages: 0,
      totalPages,
      batchIndex: 0,
      message: `Browser ready: ${executablePath}`,
    });

    const svgReadStartedAt = Date.now();
    for (let start = 0; start < totalPages; start += batchSize) {
      const batchPaths = request.svgPagePaths.slice(start, start + batchSize);
      const batchSvgMarkup = await Promise.all(
        batchPaths.map((path) => readFile(path, 'utf8')),
      );
      svgMarkupPages.push(...batchSvgMarkup);

      const completedPages = Math.min(start + batchPaths.length, totalPages);
      writeProgress({
        jobId: request.jobId,
        phase: 'rendering-batch',
        completedPages,
        totalPages,
        batchIndex: Math.floor(start / batchSize) + 1,
        message: `Loaded ${completedPages}/${totalPages} SVG pages`,
      });
      await appendAnalysisLog(request, 'svg batch loaded', {
        completedPages,
        totalPages,
        batchIndex: Math.floor(start / batchSize) + 1,
        batchReadMs: Date.now() - svgReadStartedAt,
        loadedSvgChars: svgMarkupPages.reduce((total, svg) => total + svg.length, 0),
      });

      if (request.debugDelayMs && request.debugDelayMs > 0) {
        await sleep(request.debugDelayMs);
      }
    }
    await appendAnalysisLog(request, 'all svg pages loaded', {
      readAllSvgMs: Date.now() - svgReadStartedAt,
      svgCount: svgMarkupPages.length,
      totalSvgChars: svgMarkupPages.reduce((total, svg) => total + svg.length, 0),
    });

    const pageStartedAt = Date.now();
    const page = await browser.newPage();
    await appendAnalysisLog(request, 'browser page created', {
      newPageMs: Date.now() - pageStartedAt,
    });
    await page.setViewport({
      width: request.pageSize.widthPx,
      height: request.pageSize.heightPx,
      deviceScaleFactor: 1,
    });
    await appendAnalysisLog(request, 'building html document');
    const htmlStartedAt = Date.now();
    const htmlDocument = buildPdfHtmlDocument(request, svgMarkupPages);
    await appendAnalysisLog(request, 'html document built', {
      htmlBuildMs: Date.now() - htmlStartedAt,
      htmlChars: htmlDocument.length,
      approxHtmlBytes: htmlDocument.length * 2,
    });

    await appendAnalysisLog(request, 'page.setContent started');
    const setContentStartedAt = Date.now();
    await page.setContent(htmlDocument, {
      waitUntil: 'load',
      timeout: 300_000,
    });
    await appendAnalysisLog(request, 'page.setContent finished', {
      setContentMs: Date.now() - setContentStartedAt,
    });

    writeProgress({
      jobId: request.jobId,
      phase: 'writing-pdf',
      completedPages: totalPages,
      totalPages,
      batchIndex: Math.ceil(totalPages / batchSize),
      message: `Writing PDF to ${request.outputPdfPath}`,
    });

    await appendAnalysisLog(request, 'page.pdf started');
    const pdfStartedAt = Date.now();
    await page.pdf({
      path: request.outputPdfPath,
      width: `${request.pageSize.widthPx}px`,
      height: `${request.pageSize.heightPx}px`,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
      },
      printBackground: true,
      preferCSSPageSize: true,
    });
    await appendAnalysisLog(request, 'page.pdf finished', {
      pdfWriteMs: Date.now() - pdfStartedAt,
    });
    await page.close();
    await appendAnalysisLog(request, 'browser page closed', {
      durationMs: Date.now() - startedAt,
    });

    writeResult({
      jobId: request.jobId,
      ok: true,
      outputPdfPath: request.outputPdfPath,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendAnalysisLog(request, 'pdf job failed', {
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    writeResult({
      jobId: request.jobId,
      ok: false,
      outputPdfPath: request.outputPdfPath,
      durationMs: Date.now() - startedAt,
      errorCode: 'PDF_EXPORT_FAILED',
      errorMessage: message,
    });
  } finally {
    await browser.close().catch(() => undefined);
    await appendAnalysisLog(request, 'browser closed', {
      durationMs: Date.now() - startedAt,
    });
  }
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

  if (mode === '--generate-pdf') {
    const manifestPath = process.argv[3];
    if (!manifestPath) {
      writeResult({
        jobId: 'unknown',
        ok: false,
        durationMs: 0,
        errorCode: 'WORKER_MANIFEST_ERROR',
        errorMessage: 'PDF mode requires a manifest path argument.',
      });
      return;
    }

    try {
      const request = await loadRequestFromManifest(manifestPath);
      await handlePdfJob(request);
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
