import type { DocumentInfo, PageInfo } from './types';

export class WasmWorkerProxy {
  private worker: Worker;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

  constructor() {
    // Vite의 Worker 문법 사용
    this.worker = new Worker(new URL('./wasm-worker.ts', import.meta.url), {
      type: 'module'
    });

    this.worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(result);
        }
      }
    };
  }

  public sendRequest(method: string, params?: any): Promise<any> {
    const id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ id, method, params });
    });
  }

  async initialize(): Promise<void> {
    await this.sendRequest('initialize');
  }

  async loadDocument(data: Uint8Array, fileName: string): Promise<DocumentInfo> {
    return await this.sendRequest('loadDocument', { data, fileName });
  }

  async getPageInfo(pageNum: number): Promise<PageInfo> {
    return await this.sendRequest('getPageInfo', { pageNum });
  }

  async getPageCount(): Promise<number> {
    return await this.sendRequest('pageCount');
  }

  // 필요한 다른 메서드들도 Worker 및 Proxy 양쪽에 추가 필요
}
