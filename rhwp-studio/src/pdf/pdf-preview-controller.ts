export interface PdfPreviewOpenOptions {
  title?: string;
}

export class PdfPreviewController {
  private iframe: HTMLIFrameElement | null = null;
  private currentUrl: string | null = null;

  async open(blob: Blob, options: PdfPreviewOpenOptions = {}): Promise<void> {
    this.dispose();

    this.currentUrl = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-label', options.title ?? 'PDF Preview');
    iframe.style.position = 'fixed';
    iframe.style.inset = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.background = '#f3f5f8';
    iframe.style.zIndex = '25000';
    iframe.src = this.currentUrl;

    document.body.appendChild(iframe);
    this.iframe = iframe;
  }

  dispose(): void {
    this.iframe?.remove();
    this.iframe = null;

    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }
}
