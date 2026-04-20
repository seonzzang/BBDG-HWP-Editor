/**
 * 제품 정보 / 라이센스 다이얼로그
 *
 * HWP 공개 스펙(hwp_spec_5.0) 저작권 조항에 따른 필수 고지 문구를 포함한다.
 * 사용된 외부 크레이트의 오픈소스 라이선스 목록도 표시한다.
 */
import { ModalDialog } from './dialog';

/** 외부 크레이트 라이선스 정보 */
const THIRD_PARTY_LICENSES = [
  { name: 'wasm-bindgen', license: 'MIT / Apache-2.0' },
  { name: 'web-sys', license: 'MIT / Apache-2.0' },
  { name: 'js-sys', license: 'MIT / Apache-2.0' },
  { name: 'cfb', license: 'MIT' },
  { name: 'flate2', license: 'MIT / Apache-2.0' },
  { name: 'byteorder', license: 'MIT / Unlicense' },
  { name: 'base64', license: 'MIT / Apache-2.0' },
  { name: 'console_error_panic_hook', license: 'MIT / Apache-2.0' },
];

export class AboutDialog extends ModalDialog {
  constructor() {
    super('제품 정보', 460);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'about-body';

    // 로고 추가 (BBDG Logo)
    const logoContainer = document.createElement('div');
    logoContainer.style.textAlign = 'center';
    logoContainer.style.marginBottom = '1.5rem';
    
    const logoImg = document.createElement('img');
    logoImg.src = 'C:\\Users\\BBDG\\Pictures\\bbdg_logo_only.png';
    logoImg.style.width = '64px';
    logoImg.style.height = 'auto';
    logoContainer.appendChild(logoImg);
    body.appendChild(logoContainer);

    // 제품명
    const titleKo = document.createElement('div');
    titleKo.className = 'about-product-name-ko';
    titleKo.style.fontSize = '1.4rem';
    titleKo.style.fontWeight = '800';
    titleKo.style.marginBottom = '0.5rem';
    titleKo.textContent = 'BBDG HWP Editor';
    body.appendChild(titleKo);

    const titleEn = document.createElement('div');
    titleEn.className = 'about-product-name';
    titleEn.style.fontSize = '0.9rem';
    titleEn.style.color = '#64748b';
    titleEn.style.marginBottom = '1.5rem';
    titleEn.textContent = 'Open Source HWP/HWPX Editor';
    body.appendChild(titleEn);

    // 버전
    const version = document.createElement('div');
    version.className = 'about-version';
    version.textContent = `Version ${__APP_VERSION__}`;
    body.appendChild(version);

    // 기술 스택
    const tech = document.createElement('div');
    tech.className = 'about-tech';
    tech.textContent = 'Rust Core + WebAssembly Runtime';
    body.appendChild(tech);

    // 라이선스 요약 명시
    const licenseSummary = document.createElement('div');
    licenseSummary.style.margin = '1.5rem 0';
    licenseSummary.style.padding = '1rem';
    licenseSummary.style.background = '#f8fafc';
    licenseSummary.style.borderRadius = '8px';
    licenseSummary.style.fontSize = '0.85rem';
    licenseSummary.style.lineHeight = '1.6';
    licenseSummary.style.textAlign = 'left';
    licenseSummary.innerHTML = `
      본 제품은 <strong>MIT 라이선스</strong>에 따라 상업적·비상업적 용도 제한 없이 자유롭게 사용 및 배포가 가능한 오픈소스 소프트웨어입니다.
    `;
    body.appendChild(licenseSummary);

    // HWP 스펙 고지
    const notice = document.createElement('div');
    notice.className = 'about-notice';
    notice.style.fontSize = '0.8rem';
    notice.style.color = '#94a3b8';
    notice.style.marginBottom = '1.5rem';
    notice.textContent = '본 제품은 한글과컴퓨터의 HWP 공개 문서를 참고하여 개발되었습니다.';
    body.appendChild(notice);

    // 오픈소스 링크 및 저작권
    const copyright = document.createElement('div');
    copyright.className = 'about-copyright';
    copyright.style.marginTop = '2rem';
    copyright.style.borderTop = '1px solid #e2e8f0';
    copyright.style.paddingTop = '1rem';
    copyright.innerHTML = `
      <div style="font-family: monospace; font-size: 0.85rem; margin-bottom: 0.5rem;">
        MIT License — Copyright &copy; 2025-2026 Edward Kim
      </div>
      <div style="font-size: 0.8rem; color: #64748b;">
        Based on Source Project: <a href="https://github.com/edwardkim/rhwp" target="_blank" style="color: #2563eb; text-decoration: none;">rhwp</a>
      </div>
    `;
    body.appendChild(copyright);

    return body;
  }

  protected onConfirm(): void {
    // 정보 표시 전용 — 확인 동작 없음
  }

  override show(): void {
    super.show();
    // footer를 "닫기" 버튼 하나로 교체
    const footer = this.dialog.querySelector('.dialog-footer');
    if (footer) {
      footer.innerHTML = '';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'dialog-btn dialog-btn-primary';
      closeBtn.textContent = '닫기';
      closeBtn.addEventListener('click', () => this.hide());
      footer.appendChild(closeBtn);
    }
  }
}
