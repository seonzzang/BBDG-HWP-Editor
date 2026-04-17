import type { DocumentInfo, PageInfo, PageDef, SectionDef, CursorRect, HitTestResult, LineInfo, TableDimensions, CellInfo, CellBbox, CellProperties, TableProperties, DocumentPosition, MoveVerticalResult, SelectionRect, CharProperties, ParaProperties, CellPathEntry, NavContextEntry, FieldInfoResult, BookmarkInfo } from './types';
import { WasmWorkerProxy } from './wasm-worker-proxy';

/**
 * WASM 브릿지 - Web Worker를 통한 비동기 API 제공 (BBDG 최적화)
 */
export class WasmBridge {
  private proxy: WasmWorkerProxy;
  private _fileName = 'document.hwp';
  private _pageCount = 0;

  constructor() {
    this.proxy = new WasmWorkerProxy();
  }

  async initialize(): Promise<void> {
    await this.proxy.initialize();
  }

  async loadDocument(data: Uint8Array, fileName?: string): Promise<DocumentInfo> {
    this._fileName = fileName ?? 'document.hwp';
    const info = await this.proxy.loadDocument(data, this._fileName);
    this._pageCount = info.pageCount;
    return info;
  }

  async createNewDocument(): Promise<DocumentInfo> {
    const info = await this.proxy.sendRequest('createBlankDocument');
    this._fileName = '새 문서.hwp';
    this._pageCount = info.pageCount;
    return info;
  }

  get fileName(): string { return this._fileName; }
  set fileName(name: string) { this._fileName = name; }
  get isNewDocument(): boolean { return this._fileName === '새 문서.hwp'; }
  get pageCount(): number { return this._pageCount; }

  async exportHwp(): Promise<Uint8Array> {
    return await this.proxy.sendRequest('exportHwp');
  }

  async getPageInfo(pageNum: number): Promise<PageInfo> {
    return await this.proxy.getPageInfo(pageNum);
  }

  async renderPageToCanvas(pageNum: number, canvas: HTMLCanvasElement, scale = 1.0): Promise<void> {
    const tree = await this.proxy.sendRequest('getPageRenderTree', { pageNum });
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // TODO: 전용 RenderTree 렌더러 구현 (현재는 임시로 SVG로 대체 가능성 검토)
    // 여기서는 Worker에서 생성된 RenderTree를 기반으로 직접 Canvas에 그리는 로직이 들어감
    // 하지만 현재 Rust 엔진의 직접 렌더링을 활용하기 위해 OffscreenCanvas 또는 SVG 지원 필요
    const svg = await this.proxy.sendRequest('renderPageSvg', { pageNum });
    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve) => {
      img.onload = () => {
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });
  }

  // --- 편집 및 질의 API ---

  async hitTest(x: number, y: number): Promise<HitTestResult> {
    return await this.proxy.sendRequest('hitTest', { x, y });
  }

  async getCursorRect(): Promise<CursorRect> {
    return await this.proxy.sendRequest('getCursorRect');
  }

  async insertText(text: string): Promise<void> {
    const result = await this.proxy.sendRequest('insertText', { text });
    if (result && result.pageCount) this._pageCount = result.pageCount;
  }

  async deleteText(count: number, forward = false): Promise<void> {
    const result = await this.proxy.sendRequest('deleteText', { count, forward });
    if (result && result.pageCount) this._pageCount = result.pageCount;
  }

  async setCharProperties(props: Partial<CharProperties>): Promise<void> {
    await this.proxy.sendRequest('setCharProperties', { props });
  }

  async setParaProperties(props: Partial<ParaProperties>): Promise<void> {
    await this.proxy.sendRequest('setParaProperties', { props });
  }

  async getShowControlCodes(): Promise<boolean> {
    return await this.proxy.sendRequest('getShowControlCodes');
  }

  async setShowControlCodes(show: boolean): Promise<void> {
    await this.proxy.sendRequest('setShowControlCodes', { show });
  }

  // ... 기타 필요한 50+ 메서드들을 동일한 방식으로 위임 ...
}
