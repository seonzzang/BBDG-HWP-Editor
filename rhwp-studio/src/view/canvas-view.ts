import { WasmBridge } from '@/core/wasm-bridge';
import { EventBus } from '@/core/event-bus';
import type { PageInfo } from '@/core/types';
import { VirtualScroll } from './virtual-scroll';
import { CanvasPool } from './canvas-pool';
import { PageRenderer } from './page-renderer';
import { ViewportManager } from './viewport-manager';
import { CoordinateSystem } from './coordinate-system';

export class CanvasView {
  private virtualScroll: VirtualScroll;
  private canvasPool: CanvasPool;
  private pageRenderer: PageRenderer;
  private viewportManager: ViewportManager;
  private coordinateSystem: CoordinateSystem;

  private scrollContent: HTMLElement;
  private pages: PageInfo[] = [];
  private currentVisiblePages: number[] = [];
  private unsubscribers: (() => void)[] = [];

  constructor(
    private container: HTMLElement,
    private wasm: WasmBridge,
    private eventBus: EventBus,
  ) {
    this.virtualScroll = new VirtualScroll();
    this.canvasPool = new CanvasPool();
    this.pageRenderer = new PageRenderer(wasm);
    this.viewportManager = new ViewportManager(eventBus);
    this.coordinateSystem = new CoordinateSystem(this.virtualScroll);

    this.scrollContent = container.querySelector('#scroll-content')!;
    this.viewportManager.attachTo(container);

    this.unsubscribers.push(
      eventBus.on('viewport-scroll', () => this.updateVisiblePages()),
      eventBus.on('viewport-resize', () => this.onViewportResize()),
      eventBus.on('zoom-changed', (zoom) => this.onZoomChanged(zoom as number)),
      eventBus.on('document-changed', () => this.refreshPages()),
    );
  }

  /** 문서 로드 후 호출 — 페이지 정보 지연 로딩 및 가상 스크롤 초기화 */
  loadDocument(): void {
    this.reset();

    const pageCount = this.wasm.pageCount;
    this.pages = [];
    
    // 1단계: 초기 렌더링에 필요한 페이지만 즉시 로드 (최대 20페이지)
    const initialBatch = Math.min(pageCount, 20);
    this.fetchPageInfos(0, initialBatch);

    if (this.pages.length === 0) {
      console.error('[CanvasView] 로드된 페이지가 없습니다');
      return;
    }

    // 모바일: 문서 로드 시 폭 맞춤 줌 자동 적용
    if (window.innerWidth < 1024 && this.pages.length > 0) {
      const containerWidth = this.container.clientWidth - 20;
      const firstPage = this.pages[0];
      if (firstPage && firstPage.width > 0 && containerWidth > 0) {
        const fitZoom = containerWidth / firstPage.width;
        this.viewportManager.setZoom(Math.max(0.1, Math.min(fitZoom, 4.0)));
      }
    }

    this.recalcLayout();
    this.container.scrollTop = 0;
    this.updateVisiblePages();

    // 2단계: 나머지 페이지는 백그라운드에서 지연 로딩 (UI 프리징 방지)
    if (pageCount > initialBatch) {
      this.deferredFetchPages(initialBatch, pageCount);
    }

    console.log(`[CanvasView] 초기 ${this.pages.length}/${pageCount}페이지 로드, 레이아웃 준비 완료`);
  }

  /** 특정 범위의 페이지 정보를 가져온다 */
  private fetchPageInfos(start: number, end: number): void {
    for (let i = start; i < end; i++) {
      try {
        this.pages[i] = this.wasm.getPageInfo(i);
      } catch (e) {
        console.error(`[CanvasView] 페이지 ${i} 정보 조회 실패:`, e);
      }
    }
  }

  /** 백그라운드에서 페이지 정보를 나누어 수집한다 */
  private deferredFetchPages(start: number, total: number): void {
    const BATCH_SIZE = 50;
    let current = start;

    const fetchNext = () => {
      const end = Math.min(current + BATCH_SIZE, total);
      this.fetchPageInfos(current, end);
      current = end;

      // 레이아웃 정보 갱신 (스크롤바 크기 업데이트)
      this.recalcLayout();
      this.updateVisiblePages();

      if (current < total) {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(fetchNext);
        } else {
          setTimeout(fetchNext, 10);
        }
      } else {
        console.log(`[CanvasView] 총 ${total}페이지 전체 로드 완료`);
      }
    };

    fetchNext();
  }

  /** 레이아웃을 재계산한다 (줌/리사이즈 공통) */
  private recalcLayout(): void {
    const zoom = this.viewportManager.getZoom();
    const { width: vpWidth } = this.viewportManager.getViewportSize();
    this.virtualScroll.setPageDimensions(this.pages, zoom, vpWidth);
    this.scrollContent.style.height = `${this.virtualScroll.getTotalHeight()}px`;
    this.scrollContent.style.width = `${this.virtualScroll.getTotalWidth()}px`;

    // 그리드 모드 CSS 클래스 토글
    this.scrollContent.classList.toggle('grid-mode', this.virtualScroll.isGridMode());
  }

  /** 스크롤/리사이즈 시 보이는 페이지를 갱신한다 */
  private updateVisiblePages(): void {
    const scrollY = this.viewportManager.getScrollY();
    const { height: vpHeight } = this.viewportManager.getViewportSize();

    const prefetchPages = this.virtualScroll.getPrefetchPages(scrollY, vpHeight);
    const visiblePages = this.virtualScroll.getVisiblePages(scrollY, vpHeight);

    // 벗어난 페이지 해제
    const prefetchSet = new Set(prefetchPages);
    for (const pageIdx of this.canvasPool.activePages) {
      if (!prefetchSet.has(pageIdx)) {
        this.pageRenderer.cancelReRender(pageIdx);
        this.canvasPool.release(pageIdx);
      }
    }

    // 새로 보이는 페이지 렌더링
    for (const pageIdx of prefetchPages) {
      if (!this.canvasPool.has(pageIdx)) {
        this.renderPage(pageIdx);
      }
    }

    // 현재 페이지 번호 갱신
    if (visiblePages.length > 0) {
      const vpCenter = scrollY + vpHeight / 2;
      const currentPage = this.virtualScroll.getPageAtY(vpCenter);
      this.eventBus.emit(
        'current-page-changed',
        currentPage,
        this.virtualScroll.pageCount,
      );
    }

    this.currentVisiblePages = visiblePages;
  }

  /** 단일 페이지를 렌더링한다 */
  private renderPage(pageIdx: number): void {
    const canvas = this.canvasPool.acquire(pageIdx);
    const zoom = this.viewportManager.getZoom();
    const rawDpr = window.devicePixelRatio || 1;

    // iOS WebKit Canvas 최대 크기 제한 (64MP = 67,108,864 pixels)
    // 물리 크기 = pageSize × zoom × dpr 가 제한을 초과하면 dpr을 낮춘다
    const pageInfo = this.pages[pageIdx];
    const MAX_CANVAS_PIXELS = 67108864;
    let dpr = rawDpr;
    if (pageInfo) {
      const physW = pageInfo.width * zoom * dpr;
      const physH = pageInfo.height * zoom * dpr;
      if (physW * physH > MAX_CANVAS_PIXELS) {
        dpr = Math.sqrt(MAX_CANVAS_PIXELS / (pageInfo.width * zoom * pageInfo.height * zoom));
        dpr = Math.max(1, Math.floor(dpr)); // 최소 1, 정수로 내림
      }
    }
    const renderScale = zoom * dpr;

    // Canvas를 DOM에 추가하고 위치를 설정한다
    canvas.style.top = `${this.virtualScroll.getPageOffset(pageIdx)}px`;

    // 그리드 모드: 고정 left 좌표, 단일 열: CSS 중앙 정렬
    const pageLeft = this.virtualScroll.getPageLeft(pageIdx);
    if (pageLeft >= 0) {
      canvas.style.left = `${pageLeft}px`;
      canvas.style.transform = 'none';
    } else {
      canvas.style.left = '50%';
      canvas.style.transform = 'translateX(-50%)';
    }

    this.scrollContent.appendChild(canvas);

    // WASM이 Canvas 크기를 자동 설정한다 (물리 픽셀 = 페이지크기 × zoom × DPR)
    try {
      this.pageRenderer.renderPage(pageIdx, canvas, renderScale);
    } catch (e) {
      console.error(`[CanvasView] 페이지 ${pageIdx} 렌더링 실패:`, e);
      this.canvasPool.release(pageIdx);
      return;
    }

    // CSS 표시 크기 = 물리 픽셀 / DPR (= 페이지크기 × zoom)
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
  }

  /** 뷰포트 리사이즈 처리 */
  private onViewportResize(): void {
    if (this.pages.length === 0) {
      this.updateVisiblePages();
      return;
    }

    // 그리드 모드에서 열 수가 바뀔 수 있으므로 레이아웃 재계산
    const wasGrid = this.virtualScroll.isGridMode();
    this.recalcLayout();
    const isGrid = this.virtualScroll.isGridMode();

    if (wasGrid || isGrid) {
      // 그리드 관련 변경 시 전체 재렌더링
      this.canvasPool.releaseAll();
      this.pageRenderer.cancelAll();
    }
    this.updateVisiblePages();
  }

  /** 줌 변경 처리 */
  private onZoomChanged(zoom: number): void {
    if (this.pages.length === 0) return;

    // 현재 보이는 페이지 기억
    const scrollY = this.viewportManager.getScrollY();
    const { height: vpHeight } = this.viewportManager.getViewportSize();
    const vpCenter = scrollY + vpHeight / 2;
    const focusPage = this.virtualScroll.getPageAtY(vpCenter);
    const oldOffset = this.virtualScroll.getPageOffset(focusPage);
    const relativeY = vpCenter - oldOffset;
    const oldHeight = this.virtualScroll.getPageHeight(focusPage);
    const ratio = oldHeight > 0 ? relativeY / oldHeight : 0;

    // 페이지 크기 재계산
    this.recalcLayout();

    // 스크롤 위치 보정
    const newOffset = this.virtualScroll.getPageOffset(focusPage);
    const newHeight = this.virtualScroll.getPageHeight(focusPage);
    const newCenter = newOffset + newHeight * ratio;
    this.viewportManager.setScrollTop(newCenter - vpHeight / 2);

    // 모든 Canvas 재렌더링
    this.canvasPool.releaseAll();
    this.pageRenderer.cancelAll();
    this.updateVisiblePages();

    this.eventBus.emit('zoom-level-display', zoom);
  }

  /** 편집 후 보이는 페이지를 재렌더링한다 */
  refreshPages(): void {
    if (this.pages.length === 0) return;

    // 페이지 정보 재수집 (페이지 수/크기가 변경될 수 있음)
    const pageCount = this.wasm.pageCount;
    this.pages = [];
    for (let i = 0; i < pageCount; i++) {
      try {
        this.pages.push(this.wasm.getPageInfo(i));
      } catch (e) {
        console.error(`[CanvasView] 페이지 ${i} 정보 조회 실패:`, e);
      }
    }

    this.recalcLayout();

    // 보이는 페이지 재렌더링
    this.canvasPool.releaseAll();
    this.pageRenderer.cancelAll();
    this.updateVisiblePages();
  }

  /** 리소스를 정리한다 */
  private reset(): void {
    this.pageRenderer.cancelAll();
    this.canvasPool.releaseAll();
    this.currentVisiblePages = [];
    this.pages = [];
    this.scrollContent.innerHTML = '';
  }

  /** 전체 정리 */
  dispose(): void {
    this.reset();
    this.viewportManager.detach();
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  getVirtualScroll(): VirtualScroll {
    return this.virtualScroll;
  }

  getViewportManager(): ViewportManager {
    return this.viewportManager;
  }

  getCoordinateSystem(): CoordinateSystem {
    return this.coordinateSystem;
  }
}
