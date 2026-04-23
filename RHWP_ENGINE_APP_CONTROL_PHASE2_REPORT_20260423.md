# RHWP Engine App Control Phase 2 Report - 2026-04-23

## Summary

After Phase 2 engine layout integration, the BBDG editor UI and print UX were checked through a headless Edge app-control smoke test against the Vite dev server.

## Checks

- WASM/editor startup: pass
- New document creation: pass
- File menu has a single `인쇄` entry: pass
- Obsolete PDF preview/chunk menu entries are absent: pass
- Print dialog opens through the app command path: pass
- `PDF 내보내기` option is visible: pass
- legacy `인쇄` option is visible: pass
- Dialog helper text mentions the internal PDF viewer: pass
- Dialog helper text no longer mentions an external PDF viewer: pass
- Page range numeric input becomes focusable: pass
- Fatal console/page errors: none

## Evidence

Generated local smoke artifacts:

- `output/app-control-phase2/01-startup.png`
- `output/app-control-phase2/02-new-document.png`
- `output/app-control-phase2/03-print-dialog.png`
- `output/app-control-phase2/app-control-result.json`

These generated artifacts are intentionally not committed.

## Result

The Phase 2 engine update preserves the current BBDG editor UI/UX and print workflow at version `0.7.137`.
