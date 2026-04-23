# RHWP Engine App Control Verification Report 2026-04-23

## Branch

`chore/rhwp-engine-update-devel-20260423`

## Verified Commit

`1b6587b feat: port rhwp devel chart ole emf engine support`

## Automation Surface

Browser/dev-server automation with Microsoft Edge headless.

Vite URL:

`http://127.0.0.1:7700`

## Automated Checks

Passed:

- App loaded successfully.
- WASM initialized.
- Menu bar exists.
- Scroll/editor container exists.
- New document canvas rendered.
- File menu has a single `file:print` command entry.
- Obsolete PDF preview/chunk development menu entries are absent.
- Print dialog opens through the app print command.
- Print dialog contains `인쇄 범위`.
- Print dialog contains `인쇄 방식`.
- `PDF 내보내기` mode is visible.
- Legacy `인쇄` mode is visible.
- Bottom helper text is concise.
- Clicking/focusing the page range number input selects `페이지 범위`.
- No fatal console/page errors were observed.

## Screenshots

Generated locally during verification:

- `output/app-control/01-startup.png`
- `output/app-control/02-new-document.png`
- `output/app-control/03-print-dialog.png`

Generated result JSON:

- `output/app-control/app-control-result.json`

These files are local verification artifacts and are not committed.

## Console/Logs

No fatal console or page errors were detected by the app-control script.

Font decode/OTS warnings, if present, are treated as non-fatal because they are known fallback-font behavior and not introduced by this engine update phase.

## Manual Checks Needed

The following areas are intentionally not claimed as fully automated:

- Native OS file picker behavior.
- Real external browser-to-app drag operation.
- Chromium/window.print preview window.
- Physical printer output.
- Full long-document PDF export timing after this engine update.

## Result

`Pass with manual confirmations needed`

Reason:
- Browser/dev-server UI surface preserved the key BBDG UX flow.
- This phase did not change `rhwp-studio`, `src-tauri`, `scripts`, or `pkg`.
- OS-native print and real drag/drop behaviors still require user-assisted confirmation before final product acceptance.
