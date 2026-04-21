# Print Extraction API Spec

Version baseline: `v1.2.3.V.0.0.1`

## Scope

This document freezes the Step 1-5 contract for the print refactor groundwork.

Included in this baseline:

- Rust print extraction data structures
- WASM-exported print extraction API surface
- TypeScript typed bridge contracts
- JSON serialization and diagnostic logging points

Not included yet:

- Real paragraph/table/image extraction logic
- Print sandbox orchestration
- Chunked HTML insertion flow
- Production print task controller

## Rust Module

Source files:

- [print_module.rs](D:\BBDG_PROJECTS\BBDG_HWP_Editor_Rebuild\rhwp\src\print_module.rs)
- [wasm_api.rs](D:\BBDG_PROJECTS\BBDG_HWP_Editor_Rebuild\rhwp\src\wasm_api.rs)

### PrintCursor

```rust
pub struct PrintCursor {
    pub section_index: usize,
    pub paragraph_index: usize,
    pub control_index: Option<usize>,
}
```

### PrintBlock

Supported variants in the contract:

- `Paragraph`
- `Table`
- `Image`
- `PageBreak`

All variants are JSON-serializable through `serde`.

### PrintChunk

```rust
pub struct PrintChunk {
    pub done: bool,
    pub next_cursor: Option<PrintCursor>,
    pub blocks: Vec<PrintBlock>,
}
```

### HwpDocument Methods

Exported WASM methods:

- `beginPrintTask() -> string`
- `extractPrintChunk(cursor_json: string, max_blocks: number) -> string`
- `endPrintTask() -> void`

Current behavior:

- `beginPrintTask` starts a stub print task and returns the initial cursor JSON.
- `extractPrintChunk` validates task state, parses cursor JSON, and returns an empty done chunk.
- `endPrintTask` clears internal task state.

## TypeScript Contract

Source files:

- [types.ts](D:\BBDG_PROJECTS\BBDG_HWP_Editor_Rebuild\rhwp\rhwp-studio\src\core\types.ts)
- [wasm-bridge.ts](D:\BBDG_PROJECTS\BBDG_HWP_Editor_Rebuild\rhwp\rhwp-studio\src\core\wasm-bridge.ts)

### Interfaces

- `PrintCursor`
- `PrintBlock`
- `PrintChunk`

### WasmBridge Methods

- `beginPrintTask(): PrintCursor`
- `extractPrintChunk(cursor: PrintCursor, maxBlocks: number): PrintChunk`
- `endPrintTask(): void`

These methods currently provide typed access to the Rust stub API and log JSON boundary diagnostics.

## Logging Points

Rust-side logs:

- `begin_print_task start/done`
- `extract_print_chunk start/done`
- `end_print_task start/done`

Logged fields:

- JSON byte length
- active task state
- chunk block count
- done flag

TS-side logs:

- raw JSON byte length from WASM
- parsed cursor/chunk summaries
- begin/extract/end call lifecycle

## Safety Notes

This baseline is intentionally low-risk:

- Existing file loading is untouched
- Existing page rendering is untouched
- Existing CanvasView print flow is not yet replaced by the new extraction pipeline
- New API is additive and isolated

## Validation Checklist

Step 5 baseline is valid when all are true:

- `cargo check` passes in repo root
- `npx tsc --noEmit` passes in `rhwp-studio`
- `pkg/rhwp.d.ts` exposes `beginPrintTask`, `extractPrintChunk`, `endPrintTask`
- `WasmBridge` returns typed print extraction data
- no existing load/save/render path is modified by this baseline
