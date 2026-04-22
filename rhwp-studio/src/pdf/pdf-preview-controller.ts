export interface PdfPreviewOpenOptions {
  title?: string;
  statusText?: string;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void | Promise<void>;
  onNext?: () => void | Promise<void>;
}

export class PdfPreviewController {
  private container: HTMLDivElement | null = null;
  private headerTitleEl: HTMLDivElement | null = null;
  private headerStatusEl: HTMLDivElement | null = null;
  private closeButtonEl: HTMLButtonElement | null = null;
  private prevButtonEl: HTMLButtonElement | null = null;
  private nextButtonEl: HTMLButtonElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private currentUrl: string | null = null;
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dispose();
    }
  };

  async open(blob: Blob, options: PdfPreviewOpenOptions = {}): Promise<void> {
    this.dispose();

    this.currentUrl = URL.createObjectURL(blob);

    const container = document.createElement('div');
    container.className = 'pdf-preview-shell';

    const header = document.createElement('div');
    header.className = 'pdf-preview-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'pdf-preview-title';
    titleEl.textContent = options.title ?? 'PDF 미리보기';

    const statusEl = document.createElement('div');
    statusEl.className = 'pdf-preview-status';
    statusEl.textContent = options.statusText ?? '';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'pdf-preview-title-group';
    titleGroup.append(titleEl, statusEl);

    const actions = document.createElement('div');
    actions.className = 'pdf-preview-actions';

    const prevButton = document.createElement('button');
    prevButton.className = 'dialog-btn';
    prevButton.type = 'button';
    prevButton.textContent = '이전';
    prevButton.disabled = !options.canGoPrev;
    prevButton.addEventListener('click', async () => {
      if (!options.onPrev) return;
      prevButton.disabled = true;
      nextButton.disabled = true;
      try {
        await options.onPrev();
      } finally {
        prevButton.disabled = !options.canGoPrev;
        nextButton.disabled = !options.canGoNext;
      }
    });

    const nextButton = document.createElement('button');
    nextButton.className = 'dialog-btn';
    nextButton.type = 'button';
    nextButton.textContent = '다음';
    nextButton.disabled = !options.canGoNext;
    nextButton.addEventListener('click', async () => {
      if (!options.onNext) return;
      prevButton.disabled = true;
      nextButton.disabled = true;
      try {
        await options.onNext();
      } finally {
        prevButton.disabled = !options.canGoPrev;
        nextButton.disabled = !options.canGoNext;
      }
    });

    const closeButton = document.createElement('button');
    closeButton.className = 'dialog-btn dialog-btn-primary';
    closeButton.type = 'button';
    closeButton.textContent = '편집기로 돌아가기';
    closeButton.addEventListener('click', () => {
      this.dispose();
    });

    actions.append(prevButton, nextButton, closeButton);
    header.append(titleGroup, actions);

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-label', options.title ?? 'PDF Preview');
    iframe.className = 'pdf-preview-frame';
    iframe.src = this.currentUrl;

    container.append(header, iframe);
    document.body.appendChild(container);

    window.addEventListener('keydown', this.handleKeyDown);

    this.container = container;
    this.headerTitleEl = titleEl;
    this.headerStatusEl = statusEl;
    this.closeButtonEl = closeButton;
    this.prevButtonEl = prevButton;
    this.nextButtonEl = nextButton;
    this.iframe = iframe;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.container?.remove();
    this.container = null;
    this.headerTitleEl = null;
    this.headerStatusEl = null;
    this.closeButtonEl = null;
    this.prevButtonEl = null;
    this.nextButtonEl = null;
    this.iframe?.remove();
    this.iframe = null;

    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }
}
