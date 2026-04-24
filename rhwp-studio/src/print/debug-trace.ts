const TRACE_LIMIT = 10;
const PANEL_ID = 'pdf-preview-debug-trace';

type TraceEntry = {
  time: string;
  message: string;
};

declare global {
  interface Window {
    __pdfPreviewTrace?: TraceEntry[];
  }
}

function isDev(): boolean {
  return import.meta.env.DEV;
}

function ensurePanel(): HTMLDivElement | null {
  if (!isDev()) return null;

  const existing = document.getElementById(PANEL_ID);
  if (existing instanceof HTMLDivElement) {
    return existing;
  }

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.position = 'fixed';
  panel.style.right = '16px';
  panel.style.bottom = '16px';
  panel.style.zIndex = '30000';
  panel.style.width = '320px';
  panel.style.maxHeight = '220px';
  panel.style.overflow = 'auto';
  panel.style.padding = '10px 12px';
  panel.style.borderRadius = '12px';
  panel.style.background = 'rgba(17, 24, 39, 0.88)';
  panel.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.28)';
  panel.style.backdropFilter = 'blur(10px)';
  panel.style.color = '#f8fafc';
  panel.style.fontSize = '12px';
  panel.style.lineHeight = '1.5';
  panel.style.fontFamily = 'Consolas, monospace';
  panel.style.pointerEvents = 'none';
  document.body.appendChild(panel);
  return panel;
}

function render(entries: TraceEntry[]): void {
  const panel = ensurePanel();
  if (!panel) return;
  panel.innerHTML = entries
    .map((entry) => `<div>[${entry.time}] ${entry.message}</div>`)
    .join('');
}

export function pushPdfPreviewTrace(message: string): void {
  if (!isDev()) return;
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  const entries = window.__pdfPreviewTrace ?? [];
  entries.push({ time, message });
  window.__pdfPreviewTrace = entries.slice(-TRACE_LIMIT);
  render(window.__pdfPreviewTrace);
  console.log('[pdf-preview-trace]', message);
}

export function clearPdfPreviewTrace(): void {
  if (!isDev()) return;
  window.__pdfPreviewTrace = [];
  render([]);
}
