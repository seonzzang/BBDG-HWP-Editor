import { buildPrintDocumentCss } from './print-styles';

export class PrintSandbox {
  private iframe: HTMLIFrameElement | null = null;
  private container: HTMLElement | null = null;
  private disposed = false;

  open(title: string): void {
    if (this.iframe) {
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      iframe.remove();
      throw new Error('인쇄용 iframe 문서를 초기화할 수 없습니다.');
    }

    iframeDoc.open();
    iframeDoc.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body><div class="print-document"></div></body></html>`);
    iframeDoc.close();

    const style = iframeDoc.createElement('style');
    style.textContent = buildPrintDocumentCss();
    iframeDoc.head.appendChild(style);

    this.iframe = iframe;
    this.container = iframeDoc.querySelector('.print-document');

    if (!this.container) {
      this.dispose();
      throw new Error('인쇄용 컨테이너를 생성할 수 없습니다.');
    }
  }

  appendChunk(html: string): void {
    if (!this.container || this.disposed) {
      throw new Error('인쇄 샌드박스가 준비되지 않았습니다.');
    }

    this.container.insertAdjacentHTML('beforeend', html);
  }

  async triggerPrint(): Promise<void> {
    if (!this.iframe || this.disposed) {
      throw new Error('인쇄용 iframe이 없습니다.');
    }

    const win = this.iframe.contentWindow;
    if (!win) {
      throw new Error('인쇄용 window를 찾을 수 없습니다.');
    }

    win.focus();
    await Promise.resolve(win.print());
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.container = null;

    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
