import { ModalDialog } from './dialog';

export class AboutDialog extends ModalDialog {
  constructor() {
    super('제품 정보', 550);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'about-body';
    body.style.padding = '25px';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.alignItems = 'center';

    // 로고 (센터 정렬)
    const logo = document.createElement('img');
    logo.src = '/logo.png';
    logo.style.width = '120px';
    logo.style.marginBottom = '20px';
    body.appendChild(logo);

    // 제품명 및 버전
    const title = document.createElement('div');
    title.style.fontSize = '22px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '4px';
    title.textContent = 'BBDG HWP Editor';
    body.appendChild(title);

    const version = document.createElement('div');
    version.style.fontSize = '13px';
    version.style.color = '#64748b';
    version.style.marginBottom = '20px';
    version.textContent = 'Version 2026.04.17.V.1.0.0';
    body.appendChild(version);

    // 정책 전문 영역 (스크롤 가능)
    const licenseBox = document.createElement('div');
    licenseBox.style.width = '100%';
    licenseBox.style.height = '300px';
    licenseBox.style.overflowY = 'auto';
    licenseBox.style.background = '#f8fafc';
    licenseBox.style.padding = '15px';
    licenseBox.style.border = '1px solid #e2e8f0';
    licenseBox.style.borderRadius = '6px';
    licenseBox.style.textAlign = 'left';
    licenseBox.style.fontSize = '12px';
    licenseBox.style.lineHeight = '1.6';
    licenseBox.style.color = '#334155';
    licenseBox.style.whiteSpace = 'pre-wrap';

    licenseBox.innerHTML = `
<div style="font-weight: bold; font-size: 13px; margin-bottom: 10px;">[ 1. 제품 및 제조사 정보 ]</div>
제품명: BBDG HWP Editor
버전: 2026.04.17.V.1.0.0
제조사: 비비디글로벌(주) (BBD Global Co., Ltd.)
Copyright: © 2026 BBD Global Co., Ltd. All rights reserved.

<div style="font-weight: bold; font-size: 13px; margin-top: 15px; margin-bottom: 10px;">[ 2. 상표권 및 권리 고지 (Notice & Trademark) ]</div>
본 제품은 주식회사 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발되었습니다.

"한글", "한컴", "HWP", "HWPX"는 주식회사 한글과컴퓨터의 등록 상표입니다. 본 소프트웨어는 비비디글로벌(주)에서 리패키징 및 최적화한 도구이며, 주식회사 한글과컴퓨터와 제휴, 후원, 승인 관계가 없는 독립적인 오픈소스 기반 프로젝트입니다.

"Hangul", "Hancom", "HWP", and "HWPX" are registered trademarks of Hancom Inc. This project is an independent open-source project with no affiliation, sponsorship, or endorsement by Hancom Inc.

<div style="font-weight: bold; font-size: 13px; margin-top: 15px; margin-bottom: 10px;">[ 3. 원저작자 고지 (Original Author) ]</div>
This software is based on "rhwp", an open-source project.
Copyright (c) 2025-2026 Edward Kim

<div style="font-weight: bold; font-size: 13px; margin-top: 15px; margin-bottom: 10px;">[ 4. MIT 라이선스 전문 (MIT License Text) ]</div>
The MIT License (MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

<div style="font-weight: bold; font-size: 13px; margin-top: 15px; margin-bottom: 10px;">[ 5. 사내 보안 정책 안내 (Internal Security Policy) ]</div>
본 소프트웨어는 BBDG 사내 보안 정책 및 정부 부처 상주 인력의 업무 환경을 고려하여, 외부 서버 통신 기능을 배제하고 모든 문서 처리를 로컬 시스템 내에서만 수행하도록 설계되었습니다.
    `.trim();

    body.appendChild(licenseBox);

    const copyright = document.createElement('div');
    copyright.style.marginTop = '15px';
    copyright.style.fontSize = '11px';
    copyright.style.color = '#94a3b8';
    copyright.textContent = '© 2026 BBD Global Co., Ltd. All rights reserved.';
    body.appendChild(copyright);

    return body;
  }

  protected onConfirm(): void { }

  override show(): void {
    super.show();
    const footer = this.dialog.querySelector('.dialog-footer');
    if (footer) {
      footer.innerHTML = '';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'dialog-btn dialog-btn-primary';
      closeBtn.textContent = '확인';
      closeBtn.style.minWidth = '120px';
      closeBtn.addEventListener('click', () => this.hide());
      footer.appendChild(closeBtn);
    }
  }
}
