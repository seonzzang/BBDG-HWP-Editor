/**
 * BBDG HWP Editor - Premium Loading Overlay
 */
export class LoadingOverlay {
  private element: HTMLElement;
  private statusText: HTMLElement;
  private progressFill: HTMLElement;
  private visible = false;

  constructor() {
    this.element = this.createOverlay();
    document.body.appendChild(this.element);
    this.statusText = this.element.querySelector('.loading-status')!;
    this.progressFill = this.element.querySelector('.loading-progress-fill')!;
  }

  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'bbdg-loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-logo-container">
          <img src="bbdg_logo_dark.png" alt="BBDG Logo" class="loading-logo">
        </div>
        <div class="loading-title">BBDG HWP Editor</div>
        <div class="loading-subtitle">문서를 최적화하여 불러오고 있습니다...</div>
        
        <div class="loading-progress-container">
          <div class="loading-progress-bar">
            <div class="loading-progress-fill"></div>
          </div>
        </div>
        
        <div class="loading-status">초기화 중...</div>
      </div>
    `;

    return overlay;
  }

  show(status?: string) {
    if (status) this.statusText.textContent = status;
    this.element.style.display = 'flex';
    this.visible = true;
    
    // 강제 리플로우로 애니메이션 보장
    this.element.offsetHeight;
    this.element.classList.add('active');
  }

  hide() {
    this.element.classList.remove('active');
    setTimeout(() => {
      if (!this.visible) return;
      this.element.style.display = 'none';
      this.visible = false;
    }, 300);
  }

  updateProgress(percent: number, status?: string) {
    this.progressFill.style.width = `${percent}%`;
    if (status) this.statusText.textContent = status;
  }
}
