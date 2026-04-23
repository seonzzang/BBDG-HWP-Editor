# RHWP Engine Update Rehearsal 2026-04-23

## Branch

`chore/rhwp-engine-update-devel-20260423`

## Baseline

- Product baseline branch: `origin/bbdg-rebuild-0.7.32`
- Starting commit: `d6d218a`
- Starting version: `0.7.132`

## Supervisor Decision

`upstream/main` was inspected first because it is the smaller update target.

Result:
- `upstream/main` contains mostly documentation/manual updates after the shared base.
- Directly diffing against `upstream/main` would remove BBDG-side generated `pkg/*` and remove progressive paging APIs.
- Therefore `upstream/main` is not a useful engine update target for BBDG at this point.

Decision:
- Do not merge `upstream/main`.
- Use `upstream/devel` only through selective, phase-gated engine migration.

## Implemented Scope

Selected from `upstream/devel`:

- EMF parser/converter modules
- OOXML chart parser/renderer modules
- OLE container parser module
- Chart/OLE shape model support
- Chart/OLE shape parsing support
- Chart/OLE layout/render support
- Chart/OLE serializer preservation support
- Required render tree/style resolver/object command compatibility
- `image` crate dependency for EMF bitmap decoding

Excluded from this phase:

- `pkg/*` changes
- `src-tauri/*` changes
- `scripts/*` changes
- `rhwp-studio/*` UI/UX changes
- `wasm_api` progressive paging removal from upstream
- pagination API simplification that would remove BBDG behavior

## Error Verification Gate

Passed:

- `cargo check`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run build` in `rhwp-studio`
- `cargo test`

Notes:
- `cargo test` passed with existing warnings only.
- No build failure remains in the selected scope.

## Feature Preservation Gate

Passed for this phase.

Reason:
- No BBDG app UI files were changed.
- No Tauri files were changed.
- No print worker files were changed.
- No generated WASM `pkg/*` files were changed.
- No remote link-drop files were changed.
- Existing progressive paging APIs were preserved.

## Guardian Review

Decision: `Continue with caution`

Reason:
- Engine-side feature additions were applied without touching BBDG product workflow.
- The update is not a full RHWP engine replacement.
- Further upstream/devel migration must continue in smaller scoped phases.

## Momentum Check

Current phase is not stalled.

Next concrete action:
- Run app control verification where practical.
- Commit the isolated engine migration phase.
- Continue with the next scoped upstream/devel area only after this phase is stable.

## Baseline Comparison

Automated full baseline comparison has not yet been completed in this phase.

Preliminary feature preservation check:
- App UI/UX source files are unchanged.
- Product workflow files are unchanged.
- Build/test checks passed.

Required before final update acceptance:
- Launch app.
- Verify startup/menu/print dialog/PDF export/link-drop smoke flow where practical.

## Result

Phase result:

`Pass with documented follow-up verification`
