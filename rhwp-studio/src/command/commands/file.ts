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
import { invoke } from '@tauri-apps/api/core';
import { showToast } from '@/ui/toast';
import { showPrintOptionsDialog } from '@/ui/print-options-dialog';
import { PdfPreviewController } from '@/pdf/pdf-preview-controller';

const DEFAULT_SVG_BATCH_SIZE = 50;
const DEFAULT_DOM_INSERT_BATCH_SIZE = 50;
const DEFAULT_PDF_WORKER_BATCH_SIZE = 30;
const DEFAULT_PDF_WORKER_SVG_BATCH_SIZE = 30;
const PDF_PROGRESS_TOTAL_UNITS = 1000;
const ESTIMATED_PDF_RENDER_SECONDS_PER_CHUNK = 5;
const ESTIMATED_PDF_MERGE_SECONDS_PER_CHUNK = 12;
const ESTIMATED_PDF_SAVE_SECONDS = 8;
const PRINT_ESTIMATE_STORAGE_KEY = 'bbdg.print.pdf.estimate.v1';
const workerPdfPreview = new PdfPreviewController();

type PrintWorkerAnalysisLogEntry = {
  message?: string;
  elapsedMs?: number;
  completedPages?: number;
  totalPages?: number;
  chunkIndex?: number;
  totalChunkCount?: number;
  chunkStartPage?: number;
  chunkEndPage?: number;
  chunkCount?: number;
  mergedPageCount?: number;
  pageCount?: number;
  errorMessage?: string;
  readAllSvgMs?: number;
  pdfWriteMs?: number;
  setContentMs?: number;
  htmlBuildMs?: number;
  readMs?: number;
  loadMs?: number;
  copyMs?: number;
  saveMs?: number;
};

type PrintEstimateStats = {
  dataSecondsPerPage: number;
  renderSecondsPerChunk: number;
  mergeSecondsPerChunk: number;
  saveSeconds: number;
  sampleCount: number;
  updatedAt: number;
};

type PrintWorkerProgressEstimator = {
  stats: PrintEstimateStats;
  svgStartedElapsedMs?: number;
  renderStartedElapsedMs?: number;
  mergeStartedElapsedMs?: number;
};

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function parseLatestWorkerAnalysisEntry(logText: string): PrintWorkerAnalysisLogEntry | null {
  const lines = logText.trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]) as PrintWorkerAnalysisLogEntry;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Ignore a partially written line and keep walking backward.
    }
  }
  return null;
}

function parseWorkerAnalysisEntries(logText: string): PrintWorkerAnalysisLogEntry[] {
  return logText
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as PrintWorkerAnalysisLogEntry;
        return parsed && typeof parsed === 'object' ? [parsed] : [];
      } catch {
        return [];
      }
    });
}

function formatWorkerChunkRange(entry: PrintWorkerAnalysisLogEntry): string {
  if (
    typeof entry.chunkStartPage === 'number'
    && typeof entry.chunkEndPage === 'number'
  ) {
    return `, ${entry.chunkStartPage}-${entry.chunkEndPage}쪽`;
  }
  return '';
}

function estimateRemainingSeconds(params: {
  startedElapsedMs?: number;
  currentElapsedMs?: number;
  completed: number;
  total: number;
}): number | null {
  const { startedElapsedMs, currentElapsedMs, completed, total } = params;
  if (
    startedElapsedMs === undefined
    || currentElapsedMs === undefined
    || completed <= 0
    || total <= 0
    || completed >= total
  ) {
    return completed >= total ? 0 : null;
  }

  const elapsedSeconds = Math.max(0, (currentElapsedMs - startedElapsedMs) / 1000);
  if (elapsedSeconds < 3) return null;

  const rate = completed / elapsedSeconds;
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return Math.max(0, (total - completed) / rate);
}

function defaultPrintEstimateStats(): PrintEstimateStats {
  return {
    dataSecondsPerPage: 0.015,
    renderSecondsPerChunk: ESTIMATED_PDF_RENDER_SECONDS_PER_CHUNK,
    mergeSecondsPerChunk: ESTIMATED_PDF_MERGE_SECONDS_PER_CHUNK,
    saveSeconds: ESTIMATED_PDF_SAVE_SECONDS,
    sampleCount: 0,
    updatedAt: 0,
  };
}

function loadPrintEstimateStats(): PrintEstimateStats {
  try {
    const raw = window.localStorage.getItem(PRINT_ESTIMATE_STORAGE_KEY);
    if (!raw) return defaultPrintEstimateStats();
    const parsed = JSON.parse(raw) as Partial<PrintEstimateStats>;
    const defaults = defaultPrintEstimateStats();
    return {
      dataSecondsPerPage: positiveNumberOr(parsed.dataSecondsPerPage, defaults.dataSecondsPerPage),
      renderSecondsPerChunk: positiveNumberOr(parsed.renderSecondsPerChunk, defaults.renderSecondsPerChunk),
      mergeSecondsPerChunk: positiveNumberOr(parsed.mergeSecondsPerChunk, defaults.mergeSecondsPerChunk),
      saveSeconds: positiveNumberOr(parsed.saveSeconds, defaults.saveSeconds),
      sampleCount: Math.max(0, Math.floor(positiveNumberOr(parsed.sampleCount, 0))),
      updatedAt: Math.max(0, Math.floor(positiveNumberOr(parsed.updatedAt, 0))),
    };
  } catch {
    return defaultPrintEstimateStats();
  }
}

function positiveNumberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampEstimate(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function blendEstimate(previous: number, next: number, sampleCount: number): number {
  const alpha = sampleCount <= 0 ? 1 : 0.28;
  return (previous * (1 - alpha)) + (next * alpha);
}

function savePrintEstimateStats(stats: PrintEstimateStats): void {
  try {
    window.localStorage.setItem(PRINT_ESTIMATE_STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.warn('[print-pdf-analysis] estimate stats save failed', error);
  }
}

function estimateMergeAndSaveSeconds(
  chunkCount: number,
  completedChunkProgress = 0,
  stats = loadPrintEstimateStats(),
): number {
  const safeChunkCount = Math.max(1, chunkCount);
  const remainingChunks = Math.max(0, safeChunkCount - completedChunkProgress);
  return (remainingChunks * stats.mergeSecondsPerChunk) + stats.saveSeconds;
}

function estimateRenderSeconds(
  chunkCount: number,
  completedChunkProgress = 0,
  stats = loadPrintEstimateStats(),
): number {
  const safeChunkCount = Math.max(1, chunkCount);
  const remainingChunks = Math.max(0, safeChunkCount - completedChunkProgress);
  return remainingChunks * stats.renderSecondsPerChunk;
}

function estimateWorkerChunkCount(pageCount: number): number {
  return Math.max(1, Math.ceil(Math.max(1, pageCount) / DEFAULT_PDF_WORKER_BATCH_SIZE));
}

function estimateRemainingPostDataSeconds(pageCount: number, stats = loadPrintEstimateStats()): number {
  const chunkCount = estimateWorkerChunkCount(pageCount);
  return estimateRenderSeconds(chunkCount, 0, stats) + estimateMergeAndSaveSeconds(chunkCount, 0, stats);
}

function updatePrintEstimateStatsFromEntries(entries: PrintWorkerAnalysisLogEntry[]): void {
  const currentStats = loadPrintEstimateStats();
  const nextStats = { ...currentStats };
  const sampleCount = currentStats.sampleCount;

  const allSvgLoaded = [...entries].reverse().find((entry) => entry.message === 'all svg pages loaded');
  if (
    typeof allSvgLoaded?.readAllSvgMs === 'number'
    && typeof allSvgLoaded?.totalPages === 'number'
    && allSvgLoaded.totalPages > 0
  ) {
    const secondsPerPage = clampEstimate(
      allSvgLoaded.readAllSvgMs / 1000 / allSvgLoaded.totalPages,
      0.001,
      2,
    );
    nextStats.dataSecondsPerPage = blendEstimate(
      currentStats.dataSecondsPerPage,
      secondsPerPage,
      sampleCount,
    );
  }

  const renderFinished = [...entries].reverse().find(
    (entry) => entry.message === 'browser page closed after chunk rendering',
  );
  const browserCreated = entries.find((entry) => entry.message === 'browser page created');
  if (
    typeof renderFinished?.elapsedMs === 'number'
    && typeof browserCreated?.elapsedMs === 'number'
    && typeof renderFinished.totalChunkCount === 'number'
    && renderFinished.totalChunkCount > 0
    && renderFinished.elapsedMs > browserCreated.elapsedMs
  ) {
    const secondsPerChunk = clampEstimate(
      (renderFinished.elapsedMs - browserCreated.elapsedMs) / 1000 / renderFinished.totalChunkCount,
      0.5,
      180,
    );
    nextStats.renderSecondsPerChunk = blendEstimate(
      currentStats.renderSecondsPerChunk,
      secondsPerChunk,
      sampleCount,
    );
  }

  const mergeSaveStarted = entries.find((entry) => entry.message === 'pdf merge save started');
  const mergeStarted = entries.find((entry) => entry.message === 'pdf merge started');
  const mergeChunkCount = Math.max(
    0,
    ...entries
      .filter((entry) => entry.message?.startsWith('pdf merge chunk') && typeof entry.chunkCount === 'number')
      .map((entry) => entry.chunkCount ?? 0),
  );
  if (
    typeof mergeSaveStarted?.elapsedMs === 'number'
    && typeof mergeStarted?.elapsedMs === 'number'
    && mergeChunkCount > 0
    && mergeSaveStarted.elapsedMs > mergeStarted.elapsedMs
  ) {
    const secondsPerChunk = clampEstimate(
      (mergeSaveStarted.elapsedMs - mergeStarted.elapsedMs) / 1000 / mergeChunkCount,
      0.5,
      240,
    );
    nextStats.mergeSecondsPerChunk = blendEstimate(
      currentStats.mergeSecondsPerChunk,
      secondsPerChunk,
      sampleCount,
    );
  }

  const saveFinished = [...entries].reverse().find((entry) => entry.message === 'pdf merge save finished');
  if (typeof saveFinished?.saveMs === 'number') {
    const saveSeconds = clampEstimate(saveFinished.saveMs / 1000, 0.5, 180);
    nextStats.saveSeconds = blendEstimate(currentStats.saveSeconds, saveSeconds, sampleCount);
  }

  nextStats.sampleCount = sampleCount + 1;
  nextStats.updatedAt = Date.now();
  savePrintEstimateStats(nextStats);
  console.log('[print-pdf-analysis] estimate stats updated', nextStats);
}

async function updatePrintEstimateStatsFromWorkerLog(jobId: string): Promise<void> {
  try {
    const logText = await invoke('debug_read_print_worker_analysis_log', { jobId }) as string;
    const entries = parseWorkerAnalysisEntries(logText);
    if (entries.length === 0) return;
    updatePrintEstimateStatsFromEntries(entries);
  } catch (error) {
    console.warn('[print-pdf-analysis] estimate stats update failed', error);
  }
}

function updateOverlayFromWorkerLogEntry(
  overlay: PrintProgressOverlay,
  entry: PrintWorkerAnalysisLogEntry,
  estimator: PrintWorkerProgressEstimator,
): void {
  const message = entry.message ?? '';

  if (message === 'pdf job failed') {
    overlay.updateProgress(
      1,
      PDF_PROGRESS_TOTAL_UNITS,
      `PDF 생성 실패: ${entry.errorMessage ?? '원인을 확인하는 중입니다.'}`,
      { animationMs: 0 },
    );
    return;
  }

  if (message === 'svg batch loaded') {
    const completedPages = Math.max(0, entry.completedPages ?? 0);
    const totalPages = Math.max(1, entry.totalPages ?? completedPages);
    const units = 320 + Math.round((completedPages / totalPages) * 120);
    if (estimator.svgStartedElapsedMs === undefined) {
      estimator.svgStartedElapsedMs = entry.elapsedMs ?? 0;
    }
    const dataEtaSeconds = estimateRemainingSeconds({
      startedElapsedMs: estimator.svgStartedElapsedMs,
      currentElapsedMs: entry.elapsedMs,
      completed: completedPages,
      total: totalPages,
    });
    const totalEtaSeconds = dataEtaSeconds === null
      ? null
      : dataEtaSeconds + estimateRemainingPostDataSeconds(totalPages, estimator.stats);
    overlay.updateEta(totalEtaSeconds, '전체 남은 시간');
    overlay.updateProgress(
      units,
      PDF_PROGRESS_TOTAL_UNITS,
      `PDF 데이터 읽는 중... (${completedPages}/${totalPages}쪽)`,
      { animationMs: 450 },
    );
    return;
  }

  if (message === 'all svg pages loaded' || message === 'browser page created') {
    estimator.renderStartedElapsedMs = entry.elapsedMs ?? estimator.renderStartedElapsedMs;
    overlay.updateEta(null, '전체 남은 시간');
    overlay.updateProgress(450, PDF_PROGRESS_TOTAL_UNITS, 'PDF 엔진 준비 중...', { animationMs: 1200 });
    return;
  }

  if (
    message.includes('html document chunk')
    || message.includes('page.setContent chunk')
    || message.includes('page.pdf chunk')
    || message === 'browser page closed after chunk rendering'
  ) {
    const chunkIndex = Math.max(1, entry.chunkIndex ?? entry.totalChunkCount ?? 1);
    const totalChunkCount = Math.max(1, entry.totalChunkCount ?? chunkIndex);
    const chunkBase = Math.max(0, chunkIndex - 1);
    const chunkWeight = 1 / totalChunkCount;
    const inChunkProgress = (() => {
      if (message === 'browser page closed after chunk rendering') return 1;
      if (message === 'building html document chunk') return 0.02;
      if (message === 'html document chunk built') return 0.04;
      if (message === 'page.setContent chunk started') return 0.08;
      if (message === 'page.setContent chunk finished') return 0.18;
      if (message === 'page.pdf chunk started') return 0.25;
      if (message === 'page.pdf chunk finished') return 1;
      return 0.02;
    })();
    const units = 450 + Math.round(((chunkBase + inChunkProgress) * chunkWeight) * 250);
    if (estimator.renderStartedElapsedMs === undefined) {
      estimator.renderStartedElapsedMs = entry.elapsedMs ?? 0;
    }
    const renderEtaSeconds = estimateRemainingSeconds({
      startedElapsedMs: estimator.renderStartedElapsedMs,
      currentElapsedMs: entry.elapsedMs,
      completed: chunkBase + inChunkProgress,
      total: totalChunkCount,
    });
    const totalEtaSeconds = renderEtaSeconds === null
      ? null
      : renderEtaSeconds + estimateMergeAndSaveSeconds(totalChunkCount, 0, estimator.stats);
    overlay.updateEta(totalEtaSeconds, '전체 남은 시간');
    const animationMs = (() => {
      if (message === 'page.pdf chunk started') return 3200;
      if (message === 'page.setContent chunk started') return 2200;
      if (message === 'browser page closed after chunk rendering') return 700;
      return 700;
    })();
    const phase = message.includes('page.pdf')
      ? 'PDF 파일 생성 중'
      : 'PDF 레이아웃 생성 중';
    overlay.updateProgress(
      units,
      PDF_PROGRESS_TOTAL_UNITS,
      `${phase}... (청크 ${chunkIndex}/${totalChunkCount}${formatWorkerChunkRange(entry)})`,
      { animationMs },
    );
    return;
  }

  if (message === 'pdf merge started') {
    estimator.mergeStartedElapsedMs = entry.elapsedMs ?? estimator.mergeStartedElapsedMs;
    overlay.updateEta(null, '전체 남은 시간');
    overlay.updateProgress(710, PDF_PROGRESS_TOTAL_UNITS, 'PDF 병합 준비 중...', { animationMs: 1000 });
    return;
  }

  if (message.startsWith('pdf merge chunk')) {
    const chunkIndex = Math.max(1, entry.chunkIndex ?? 1);
    const chunkCount = Math.max(1, entry.chunkCount ?? chunkIndex);
    const chunkBase = Math.max(0, chunkIndex - 1);
    const chunkWeight = 1 / chunkCount;
    const inChunkProgress = (() => {
      if (message === 'pdf merge chunk started') return 0.02;
      if (message === 'pdf merge chunk read') return 0.18;
      if (message === 'pdf merge chunk loaded') return 0.82;
      if (message === 'pdf merge chunk copied') return 0.93;
      if (message === 'pdf merge chunk appended') return 1;
      return 0.02;
    })();
    const units = 710 + Math.round(((chunkBase + inChunkProgress) * chunkWeight) * 240);
    if (estimator.mergeStartedElapsedMs === undefined) {
      estimator.mergeStartedElapsedMs = entry.elapsedMs ?? 0;
    }
    const mergeEtaSeconds = estimateRemainingSeconds({
      startedElapsedMs: estimator.mergeStartedElapsedMs,
      currentElapsedMs: entry.elapsedMs,
      completed: chunkBase + inChunkProgress,
      total: chunkCount,
    });
    const totalEtaSeconds = mergeEtaSeconds === null
      ? estimateMergeAndSaveSeconds(chunkCount, chunkBase + inChunkProgress, estimator.stats)
      : mergeEtaSeconds + estimator.stats.saveSeconds;
    overlay.updateEta(totalEtaSeconds, '전체 남은 시간');
    const animationMs = message === 'pdf merge chunk read' ? 14000 : 650;
    overlay.updateProgress(
      units,
      PDF_PROGRESS_TOTAL_UNITS,
      `PDF 병합 중... (청크 ${chunkIndex}/${chunkCount}, 병합된 쪽 ${entry.mergedPageCount ?? '-'})`,
      { animationMs },
    );
    return;
  }

  if (message === 'pdf merge save started') {
    overlay.updateEta(estimator.stats.saveSeconds, '전체 남은 시간');
    overlay.updateProgress(
      965,
      PDF_PROGRESS_TOTAL_UNITS,
      `PDF 저장 중... (${entry.pageCount ?? '-'}쪽)`,
      { animationMs: 2800 },
    );
    return;
  }

  if (message === 'pdf merge save finished') {
    overlay.updateEta(0, 'PDF 저장 남은 시간');
    overlay.updateProgress(985, PDF_PROGRESS_TOTAL_UNITS, 'PDF 저장 완료 처리 중...', { animationMs: 500 });
    return;
  }

  if (message === 'pdf merge finished' || message === 'chunk pdf cleanup finished') {
    overlay.updateEta(0, '남은 시간');
    overlay.updateProgress(995, PDF_PROGRESS_TOTAL_UNITS, 'PDF 열기 준비 중...', { animationMs: 500 });
  }
}

function startPrintWorkerLogPolling(
  jobId: string,
  overlay: PrintProgressOverlay,
): () => void {
  let stopped = false;
  let polling = false;
  const estimator: PrintWorkerProgressEstimator = {
    stats: loadPrintEstimateStats(),
  };

  const poll = async () => {
    if (stopped || polling) return;
    polling = true;
    try {
      const logText = await invoke('debug_read_print_worker_analysis_log', { jobId }) as string;
      const entry = parseLatestWorkerAnalysisEntry(logText);
      if (entry) {
        updateOverlayFromWorkerLogEntry(overlay, entry, estimator);
      }
    } catch (error) {
      console.warn('[print-pdf-analysis] worker log polling failed', error);
    } finally {
      polling = false;
    }
  };

  const timer = window.setInterval(() => {
    void poll();
  }, 1000);
  void poll();

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

function getCurrentPageFromStatusBar(): number {
  const statusText = document.getElementById('sb-page')?.textContent ?? '';
  const match = statusText.match(/^\s*(\d+)\s*\/\s*\d+\s*쪽/);
  if (!match) return 1;
  const currentPage = Number.parseInt(match[1], 10);
  return Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
}

async function previewCurrentDocPdfChunk(
  services: Parameters<NonNullable<CommandDef['execute']>>[0],
  params: {
    startPage?: number;
    chunkSize?: number;
    batchSize?: number;
    svgBatchSize?: number;
  } = {},
): Promise<void> {
  const wasm = services.wasm;
  if (wasm.pageCount <= 0) {
    throw new Error('문서가 로드되지 않았습니다.');
  }

  const startPage = Math.max(1, Math.min(params.startPage ?? 1, wasm.pageCount));
  const chunkSize = Math.max(1, Math.round(params.chunkSize ?? wasm.pageCount));
  const endPage = Math.min(wasm.pageCount, startPage + chunkSize - 1);
  const batchSize = Math.max(1, Math.round(params.batchSize ?? DEFAULT_PDF_WORKER_BATCH_SIZE));
  const svgBatchSize = Math.max(1, Math.round(params.svgBatchSize ?? DEFAULT_PDF_WORKER_SVG_BATCH_SIZE));
  const pageIndexes = Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage - 1 + index,
  );

  const statusEl = document.getElementById('sb-message');
  const originalStatus = statusEl?.innerHTML ?? '';
  const overlay = new PrintProgressOverlay();
  const abortSignal = overlay.show('PDF 미리보기 준비 중');
  const svgPages: string[] = [];
  const jobId = `menu-pdf-preview-${Date.now()}`;
  let stopWorkerLogPolling: (() => void) | null = null;
  let cancelRequested = false;
  const requestWorkerCancel = () => {
    cancelRequested = true;
    overlay.updateEta(null, '취소 처리');
    overlay.updateProgress(
      1,
      PDF_PROGRESS_TOTAL_UNITS,
      'PDF 작업을 취소하는 중입니다...',
      { animationMs: 0 },
    );
    void invoke('debug_cancel_print_worker_pdf_export', { jobId })
      .catch((error) => console.warn('[print-pdf-analysis] cancel request failed', error));
  };
  const startedAt = performance.now();
  const svgStartedAt = performance.now();
  abortSignal.addEventListener('abort', requestWorkerCancel, { once: true });

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
      const progressUnits = Math.max(
        1,
        Math.round((completedPages / pageIndexes.length) * 320),
      );
      const svgElapsedSeconds = (performance.now() - svgStartedAt) / 1000;
      const svgEtaSeconds = svgElapsedSeconds >= 3 && completedPages > 0 && completedPages < pageIndexes.length
        ? ((pageIndexes.length - completedPages) / (completedPages / svgElapsedSeconds))
        : null;
      const estimateStats = loadPrintEstimateStats();
      overlay.updateEta(
        svgEtaSeconds === null
          ? null
          : svgEtaSeconds + estimateRemainingPostDataSeconds(pageIndexes.length, estimateStats),
        '전체 남은 시간',
      );
      overlay.updateProgress(
        progressUnits,
        PDF_PROGRESS_TOTAL_UNITS,
        `PDF 데이터 준비 중... (${startPage + completedPages - 1}/${endPage}페이지)`,
        { animationMs: 450 },
      );

      if (completedPages < pageIndexes.length) {
        await yieldToBrowser();
      }
    }

    const svgExtractElapsedMs = Math.round(performance.now() - svgStartedAt);
    const svgCharLength = svgPages.reduce((total, svg) => total + svg.length, 0);
    const firstPageInfo = wasm.getPageInfo(pageIndexes[0]);
    statusEl && renderPrintProgress(statusEl, pageIndexes.length, pageIndexes.length);
    overlay.updateEta(
      estimateRemainingPostDataSeconds(pageIndexes.length, loadPrintEstimateStats()),
      '전체 남은 시간',
    );
    overlay.updateProgress(
      330,
      PDF_PROGRESS_TOTAL_UNITS,
      `PDF 생성 작업 시작 중... (${startPage}-${endPage}페이지)`,
      { animationMs: 900 },
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
    stopWorkerLogPolling = startPrintWorkerLogPolling(jobId, overlay);
    const messages = await invoke('debug_run_print_worker_pdf_export_for_current_doc', {
      payload: {
        jobId,
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
      if (resultMessage?.errorCode === 'CANCELLED') {
        cancelRequested = true;
        throw new Error(resultMessage.errorMessage ?? 'PDF 생성이 취소되었습니다.');
      }
      throw new Error(
        resultMessage?.errorMessage
          ? `PDF 미리보기 생성 실패 (${resultMessage.errorCode ?? 'UNKNOWN'}): ${resultMessage.errorMessage}`
          : 'PDF 미리보기 생성 결과를 확인할 수 없습니다.',
      );
    }

    await updatePrintEstimateStatsFromWorkerLog(jobId);

    const pdfBytes = await invoke('debug_read_generated_pdf', { path: outputPdfPath }) as number[];
    const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    await workerPdfPreview.open(pdfBlob, {
      title: `${wasm.fileName} (${startPage}-${endPage})`,
    });

    stopWorkerLogPolling?.();
    stopWorkerLogPolling = null;
    abortSignal.removeEventListener('abort', requestWorkerCancel);
    statusEl && (statusEl.innerHTML = originalStatus);
    overlay.hide();
    showToast({
      message: `PDF ${startPage}-${endPage}페이지를 앱 내부 뷰어로 열었습니다.`,
      durationMs: 3000,
    });
  } catch (error) {
    stopWorkerLogPolling?.();
    stopWorkerLogPolling = null;
    abortSignal.removeEventListener('abort', requestWorkerCancel);
    statusEl && (statusEl.textContent = error instanceof Error ? error.message : String(error));
    overlay.hide();
    if (
      cancelRequested
      || (error instanceof Error && error.message.includes('취소'))
    ) {
      statusEl && (statusEl.innerHTML = originalStatus);
      showToast({
        message: 'PDF 작업을 취소했습니다.',
        durationMs: 2500,
      });
      return;
    }
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
@media print {
  body[data-printing="true"] #tauri-print-root {
    display: block;
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
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[file:print]', msg);
        alert(`인쇄 작업에 실패했습니다.\n${msg}`);
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
