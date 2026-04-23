# RHWP Engine API Inventory

## Purpose

This document tracks the RHWP engine APIs that BBDG HWP Editor depends on. Use it during RHWP engine updates to quickly identify breakage points and adapter changes.

## Boundary Rule

BBDG app code should depend on `WasmBridge` instead of directly depending on raw RHWP WASM APIs.

Preferred call chain:

```text
BBDG UI / Services -> WasmBridge -> RHWP WASM HwpDocument
```

## Primary Adapter

File:

`rhwp-studio/src/core/wasm-bridge.ts`

Role:

- Initialize RHWP WASM
- Own current `HwpDocument`
- Manage document replacement
- Expose stable app-facing document API
- Hide RHWP API changes from the rest of the app

## Raw RHWP Import

Current import:

```ts
import init, { HwpDocument, version } from '@wasm/rhwp.js';
```

Expected location:

- `rhwp-studio/src/core/wasm-bridge.ts`
- controlled dev-only helpers may import preview utilities, but product code should avoid raw engine calls.

## App-Facing WasmBridge API

The following methods/properties are treated as BBDG stable adapter API.

### Initialization

- `initialize()`
- `installMeasureTextWidth()`

Risk if broken:
- App cannot initialize RHWP.
- Text measurement/fallback rendering may fail.

### Document Lifecycle

- `loadDocument(data, fileName?)`
- `createNewDocument()`
- `freeDocument(doc, reason)`
- retired document handling

Risk if broken:
- HWP/HWPX load failure.
- Repeated link drops may crash.
- WASM null pointer/free errors may return.

### Document Identity

- `fileName`
- `currentFileHandle`
- `isNewDocument`
- `getSourceFormat()`

Risk if broken:
- Save/export behavior may be incorrect.
- UI title/status may be wrong.

### Export

- `exportHwp()`
- `exportHwpx()`

Risk if broken:
- Save/export fails.

### Validation And Repair

- `getValidationWarnings()`
- `reflowLinesegs()`

Risk if broken:
- Non-standard HWPX warning flow may fail.
- User repair/as-is choice may break.

### Page And Rendering

Expected functions include:

- `pageCount`
- `getPageInfo(pageIndex)`
- `renderPageSvg(pageIndex)`
- page rendering related helpers

Risk if broken:
- Editor canvas cannot render.
- PDF export cannot collect SVG pages.
- Page count display may be wrong.

### Input And HitTest

Expected functions include:

- `hitTest(...)`
- cursor/selection related calls
- vertical movement/navigation calls

Risk if broken:
- Mouse click editing fails.
- Caret movement fails.
- Pre-load input guard may regress.

### Editing

Expected functions include:

- text insertion/deletion
- formatting operations
- table/cell operations
- picture/control operations
- field/bookmark operations

Risk if broken:
- Editing features fail even if rendering still works.

## RHWP Generated Package

Generated files:

- `pkg/rhwp.js`
- `pkg/rhwp_bg.wasm`
- `pkg/rhwp.d.ts`
- `pkg/rhwp_bg.wasm.d.ts`

Rules:

- Do not manually edit generated package files.
- Regenerate them from RHWP Rust source.
- Treat manual changes as disposable.

## High-Risk RHWP Source APIs

Files:

- `src/wasm_api.rs`
- `src/lib.rs`
- renderer modules under `src/renderer/**`
- document model/parser modules under `src/model/**`

Rules:

- Do not add BBDG product UX here.
- Only add general RHWP engine behavior here.
- Prefer upstreamable changes.

## Known BBDG Feature Dependencies

### PDF Export

Depends on:

- `pageCount`
- `getPageInfo(pageIndex)`
- `renderPageSvg(pageIndex)`
- `fileName`

Implemented outside engine:

- PDF worker
- chunk generation
- merge
- progress
- cancel
- ETA
- in-app PDF viewer

### Remote Link Drop

Depends on:

- `loadDocument(data, fileName)`
- validation warning flow

Implemented outside engine:

- URL candidate detection
- download
- header detection
- temp cleanup

### Editor Rendering

Depends on:

- document load
- page count
- page info
- render page
- hitTest

Implemented outside engine:

- canvas window
- canvas pool
- UI status
- input guards

## Update Checklist For API Changes

When RHWP API changes:

- [ ] Identify changed raw API.
- [ ] Update `WasmBridge`.
- [ ] Keep app-facing method name stable if possible.
- [ ] Run TypeScript build.
- [ ] Run document load test.
- [ ] Run rendering test.
- [ ] Run PDF export test.
- [ ] Run link drop test.
- [ ] Document any app-facing API change.

## Open Inventory Task

This document should be expanded during Phase 1 by automatically listing every `this.doc.*` and `HwpDocument.*` usage in `wasm-bridge.ts`.

