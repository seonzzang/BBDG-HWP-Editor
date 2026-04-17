# BBDG HWP Editor

**BBDG HWP Editor**는 오픈소스 한글 문서 엔진인 [rhwp](https://github.com/pureink-studio/rhwp)를 기반으로 하여 비비디글로벌(주)에서 리패키징 및 폐쇄망 환경에 최적화한 전문 HWPX 에디터입니다.

## 🚀 비비디글로벌(주) 전용 개선 사항

본 에디터는 원본 엔진의 강력한 성능을 유지하면서, 사내 보안 정책 및 현장 실무 편의성을 위해 아래와 같은 기능이 추가/최적화되었습니다.

### 1. 3종 배포 버전 최적화 (Multi-Platform Bundling)
표준화된 업무 환경에 즉시 적용할 수 있도록 세 가지 형태의 빌드를 동시에 지원합니다.
- **Portable EXE**: 별도의 설치 없이 즉시 실행 가능한 무설치 버전
- **Setup EXE**: 윈도우 설치 마법사를 통한 표준 환경 배포 버전
- **MSI Installer**: 대규모 사네 배포 및 시스템 관리를 위한 윈도우 인스톨러 버전

### 2. 네이티브 드래그 앤 드롭 (Native Drag & Drop) 지원
웹 에디터의 한계를 넘어, 윈도우 바탕화면이나 탐색기에서 파일을 에디터 창으로 직접 끌어다 놓아(Drag & Drop) 즉시 문서를 열 수 있는 최신 네이티브 연동 기능을 구현했습니다.

### 3. 완전한 폐쇄망 대응 (Offline Optimized)
외부 CDN이나 통신 라이브러리 의존성을 제거하고 모든 폰트 및 웹 어셋을 로컬에 포함하였습니다. 통신이 차단된 보안 구역 및 정부 부처 상주 인력 업무 환경에서 완벽하게 작동합니다.

---

## 🏗️ Core Engine: rhwp
본 소프트웨어의 핵심 렌더링 엔진은 `rhwp` 오픈소스 프로젝트를 기반으로 합니다.

### 알(R), 모두의 한글 — 알에서 시작하다
**All HWP, Open for Everyone**

`rhwp`는 Rust와 WebAssembly를 사용하여 웹 브라우저에서 한글(.hwp) 문서를 별도의 서버 처리 없이 100% 로컬에서 렌더링하고 편집할 수 있는 도구입니다.

---

## ⚖️ Legal & License Policy
- **상표권 고지**: "한글", "한컴", "HWP", "HWPX"는 주식회사 한글과컴퓨터의 등록 상표입니다. 본 프로젝트는 한글과컴퓨터와 제휴 관계가 없는 독립적인 프로젝트입니다.
- **라이선스**: 본 리패키징 버전은 원본 소스의 **MIT License**를 따릅니다.
- **Copyright**: © 2026 BBD Global Co., Ltd. & 2025 Edward Kim. All rights reserved.

---

[README](https://github.com/seonzzang/BBDG-HWP-Editor/blob/main/README.md) | [Code of Conduct](https://github.com/seonzzang/BBDG-HWP-Editor/blob/main/CODE_OF_CONDUCT.md) | [Contributing](https://github.com/seonzzang/BBDG-HWP-Editor/blob/main/CONTRIBUTING.md)
