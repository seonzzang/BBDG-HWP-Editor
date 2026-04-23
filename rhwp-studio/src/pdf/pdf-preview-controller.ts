export interface PdfPreviewOpenOptions {
  title?: string;
  statusText?: string;
}

export class PdfPreviewController {
  private container: HTMLDivElement | null = null;
  private headerTitleEl: HTMLDivElement | null = null;
  private headerStatusEl: HTMLDivElement | null = null;
  private closeButtonEl: HTMLButtonElement | null = null;
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

    const closeButton = document.createElement('button');
    closeButton.className = 'pdf-preview-return-button';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '편집기로 돌아가기');
    closeButton.title = '편집기로 돌아가기';
    closeButton.innerHTML = '<span class="pdf-preview-return-icon" aria-hidden="true">‹</span>';
    closeButton.addEventListener('click', () => {
      this.dispose();
    });

    const titleEl = document.createElement('div');
    titleEl.className = 'pdf-preview-title';
    titleEl.textContent = options.title ?? 'PDF 미리보기';

    const statusEl = document.createElement('div');
    statusEl.className = 'pdf-preview-status';
    statusEl.textContent = options.statusText ?? '생성된 PDF를 확인 중입니다.';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'pdf-preview-title-group';
    titleGroup.append(titleEl, statusEl);

    header.append(closeButton, titleGroup);

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
    this.iframe = iframe;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.container?.remove();
    this.container = null;
    this.headerTitleEl = null;
    this.headerStatusEl = null;
    this.closeButtonEl = null;
    this.iframe?.remove();
    this.iframe = null;

    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }
}
