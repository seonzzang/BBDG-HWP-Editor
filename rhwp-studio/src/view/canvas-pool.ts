export class CanvasPool {
  private available: HTMLCanvasElement[] = [];
  private inUse = new Map<number, HTMLCanvasElement>();
  private readonly MAX_POOL_SIZE = 15; // 최대 대기 캔버스 수 제한

  /** Canvas를 할당한다 (풀에서 꺼내거나 새로 생성) */
  acquire(pageIdx: number): HTMLCanvasElement {
    let canvas = this.available.pop();
    if (!canvas) {
      canvas = document.createElement('canvas');
    }
    this.inUse.set(pageIdx, canvas);
    return canvas;
  }

  /** Canvas를 반환한다 (DOM에서 제거 후 풀에 반환) */
  release(pageIdx: number): void {
    const canvas = this.inUse.get(pageIdx);
    if (canvas) {
      canvas.parentElement?.removeChild(canvas);
      this.inUse.delete(pageIdx);
      
      // 풀이 가득 찼으면 메모리 해제 후 폐기
      if (this.available.length >= this.MAX_POOL_SIZE) {
        this.disposeCanvas(canvas);
      } else {
        this.available.push(canvas);
      }
    }
  }

  /** Canvas의 메모리 점유를 강제로 해제한다 */
  private disposeCanvas(canvas: HTMLCanvasElement): void {
    canvas.width = 0;
    canvas.height = 0;
  }

  /** 특정 페이지에 할당된 Canvas를 조회한다 */
  getCanvas(pageIdx: number): HTMLCanvasElement | undefined {
    return this.inUse.get(pageIdx);
  }

  /** 특정 페이지가 이미 할당되어 있는지 확인한다 */
  has(pageIdx: number): boolean {
    return this.inUse.has(pageIdx);
  }

  /** 모든 Canvas를 반환한다 */
  releaseAll(): void {
    const pages = Array.from(this.inUse.keys());
    for (const pageIdx of pages) {
      this.release(pageIdx);
    }
    
    // 대기 중인 풀도 모두 정리하여 메모리 확보
    while (this.available.length > 0) {
      const c = this.available.pop();
      if (c) this.disposeCanvas(c);
    }
  }

  /** 현재 사용 중인 페이지 인덱스 목록 */
  get activePages(): number[] {
    return Array.from(this.inUse.keys());
  }

  /** 사용 중 + 풀 대기 Canvas 총 수 */
  get totalCount(): number {
    return this.inUse.size + this.available.length;
  }
}
