export class PrintProgressOverlay {
  private overlay: HTMLDivElement | null = null;
  private titleEl: HTMLDivElement | null = null;
  private messageEl: HTMLDivElement | null = null;
  private progressFillEl: HTMLDivElement | null = null;
  private progressTextEl: HTMLDivElement | null = null;
  private cancelButtonEl: HTMLButtonElement | null = null;
  private abortController: AbortController | null = null;

  show(title = '인쇄 준비 중'): AbortSignal {
    if (this.overlay) {
      return this.abortController?.signal ?? new AbortController().signal;
    }

    this.abortController = new AbortController();

    const overlay = document.createElement('div');
    overlay.className = 'print-progress-overlay';

    const card = document.createElement('div');
    card.className = 'print-progress-card';

    const titleEl = document.createElement('div');
    titleEl.className = 'print-progress-title';
    titleEl.textContent = title;

    const messageEl = document.createElement('div');
    messageEl.className = 'print-progress-message';
    messageEl.textContent = '인쇄용 페이지를 준비하고 있습니다...';

    const bar = document.createElement('div');
    bar.className = 'print-progress-bar';

    const fill = document.createElement('div');
    fill.className = 'print-progress-bar-fill';
    bar.appendChild(fill);

    const progressTextEl = document.createElement('div');
    progressTextEl.className = 'print-progress-text';
    progressTextEl.textContent = '0%';

    const cancelButton = document.createElement('button');
    cancelButton.className = 'dialog-btn';
    cancelButton.textContent = '취소';
    cancelButton.addEventListener('click', () => {
      this.abortController?.abort();
      this.updateMessage('인쇄 준비를 취소하는 중...');
      cancelButton.disabled = true;
    });

    card.append(titleEl, messageEl, bar, progressTextEl, cancelButton);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.titleEl = titleEl;
    this.messageEl = messageEl;
    this.progressFillEl = fill;
    this.progressTextEl = progressTextEl;
    this.cancelButtonEl = cancelButton;

    return this.abortController.signal;
  }

  updateProgress(processed: number, total: number, message?: string): void {
    const safeTotal = Math.max(1, total);
    const percent = Math.max(0, Math.min(100, Math.round((processed / safeTotal) * 100)));

    if (message) {
      this.updateMessage(message);
    }

    if (this.progressFillEl) {
      this.progressFillEl.style.width = `${percent}%`;
    }
    if (this.progressTextEl) {
      this.progressTextEl.textContent = `${percent}% (${processed}/${total})`;
    }
  }

  updateMessage(message: string): void {
    if (this.messageEl) {
      this.messageEl.textContent = message;
    }
  }

  get aborted(): boolean {
    return this.abortController?.signal.aborted ?? false;
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.titleEl = null;
    this.messageEl = null;
    this.progressFillEl = null;
    this.progressTextEl = null;
    this.cancelButtonEl = null;
    this.abortController = null;
  }
}
