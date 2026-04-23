# RHWP Engine Update Phase 2 Report - 2026-04-23

## Summary

Phase 2 selectively ports upstream `rhwp/devel` layout engine improvements while preserving the BBDG editor application layer, print/PDF workflow, link-drop behavior, and progressive paging compatibility.

## Scope

Included:

- `src/renderer/layout.rs`
- `src/renderer/layout/paragraph_layout.rs`
- `src/renderer/layout/table_cell_content.rs`
- `src/renderer/layout/table_layout.rs`
- `src/renderer/layout/table_partial.rs`
- `src/renderer/layout/tests.rs`
- `src/renderer/layout/text_measurement.rs`
- `src/renderer/layout/utils.rs`

Excluded:

- `rhwp-studio/**`
- `src-tauri/**`
- `scripts/**`
- `pkg/**`
- `src/wasm_api.rs`
- `src/renderer/pagination/**`
- `src/renderer/height_measurer.rs`
- `src/parser/cfb_reader.rs`

## Gate Results

Error verification:

- `cargo test`: pass, 947 passed, 1 ignored
- `cargo check --manifest-path src-tauri/Cargo.toml`: pass
- `npm run build` in `rhwp-studio`: pass

Feature preservation verification:

- No BBDG application, print, link-drop, Tauri command, WASM package, or progressive paging files were changed in this phase.
- `src/renderer/height_measurer.rs` was intentionally kept on the BBDG implementation because upstream removed the `measure_chunk` API required by progressive pagination.
- `src/parser/cfb_reader.rs` was intentionally kept on the BBDG implementation because the upstream stricter object-name handling broke existing HWP save/roundtrip tests.

## Supervisor Decision

Phase 2 is allowed to proceed only as a narrow renderer-layout update. Broader upstream parser/CFB and pagination changes remain blocked until they can pass both error verification and feature preservation verification.

## Resulting Version

- BBDG HWP Editor version: `0.7.135`
