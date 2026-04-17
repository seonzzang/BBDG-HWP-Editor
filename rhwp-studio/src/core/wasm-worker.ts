import init, { HwpDocument } from '@wasm/rhwp.js';

// WASM 인스턴스를 Worker 내부에서 관리
let doc: any = null;
let initialized = false;

/**
 * Worker 메시지 핸들러
 */
self.onmessage = async (e: MessageEvent) => {
  const { id, method, params } = e.data;

  try {
    switch (method) {
      case 'initialize':
        if (!initialized) {
          await init();
          initialized = true;
        }
        self.postMessage({ id, result: true });
        break;

      case 'loadDocument': {
        const { data, fileName } = params;
        if (doc) doc.free();
        doc = new HwpDocument(data);
        doc.convertToEditable();
        doc.setFileName(fileName || 'document.hwp');
        const info = JSON.parse(doc.getDocumentInfo());
        self.postMessage({ id, result: info });
        break;
      }

      case 'getPageInfo': {
        if (!doc) throw new Error('Document not loaded');
        const info = JSON.parse(doc.getPageInfo(params.pageNum));
        self.postMessage({ id, result: info });
        break;
      }

      case 'pageCount':
        self.postMessage({ id, result: doc ? doc.pageCount() : 0 });
        break;

      case 'renderPageSvg':
        self.postMessage({ id, result: doc.renderPageSvg(params.pageNum) });
        break;

      case 'getPageRenderTree':
        self.postMessage({ id, result: doc.getPageRenderTree(params.pageNum) });
        break;

      case 'hitTest':
        self.postMessage({ id, result: JSON.parse(doc.hitTest(params.x, params.y)) });
        break;

      case 'getCursorRect':
        self.postMessage({ id, result: JSON.parse(doc.getCursorRect()) });
        break;

      case 'insertText': {
        const info = JSON.parse(doc.insertText(params.text));
        self.postMessage({ id, result: info });
        break;
      }

      case 'deleteText': {
        const info = JSON.parse(doc.deleteText(params.count, params.forward));
        self.postMessage({ id, result: info });
        break;
      }

      case 'setCharProperties':
        self.postMessage({ id, result: doc.setCharProperties(JSON.stringify(params.props)) });
        break;

      case 'setParaProperties':
        self.postMessage({ id, result: doc.setParaProperties(JSON.stringify(params.props)) });
        break;

      case 'setShowControlCodes':
        doc.setShowControlCodes(params.show);
        self.postMessage({ id, result: true });
        break;

      case 'getShowControlCodes':
        self.postMessage({ id, result: doc.getShowControlCodes() });
        break;

      case 'createBlankDocument': {
        if (!doc) doc = (HwpDocument as any).createEmpty();
        const info = JSON.parse(doc.createBlankDocument());
        self.postMessage({ id, result: info });
        break;
      }

      // 필요한 다른 메서드들도 여기에 추가
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error: any) {
    self.postMessage({ id, error: error.message || String(error) });
  }
};
