# RHWP Engine Compatibility Checklist

## Purpose

Use this checklist after any RHWP engine update to confirm that BBDG HWP Editor still preserves the current upgraded feature set, UI/UX flow, and performance expectations.

## Baseline

- Critical branch: `origin/bbdg-rebuild-0.7.32`
- Critical feature baseline commit: `f8e606d`
- Snapshot record commit: `4dc8497`
- Baseline document: `BBDG_CRITICAL_BRANCH_SNAPSHOT.md`

## Pass Rule

An RHWP engine update is not complete until every required item below is checked or explicitly documented as an accepted exception.

If any required item fails, stop the update work and fix that stage before proceeding.

The guardian review in `RHWP_ENGINE_GUARDIAN_AGENT.md` must also pass. A compatibility checklist without guardian review is incomplete.

Phase progression requires two gates:

- Error verification gate
- Feature preservation verification gate

Both must pass before the next phase starts.

## 1. Build And Startup

- [ ] Error verification gate passed for this phase.
- [ ] `cargo check` passes.
- [ ] `cargo test` passes where practical.
- [ ] `npm run build` passes in `rhwp-studio`.
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- [ ] App launches successfully.
- [ ] No repeated `localhost refused` failure after startup.
- [ ] No unexpected duplicate app windows.

## 2. Basic Document Loading

- [ ] Local `.hwp` file opens.
- [ ] Local `.hwpx` file opens.
- [ ] Document page count is displayed.
- [ ] First page renders.
- [ ] Current page indicator updates while scrolling.
- [ ] Large document opens without immediate crash.
- [ ] No WASM panic appears during normal load.
- [ ] No null pointer error appears during normal load.

## 3. Rendering And Interaction

- [ ] Canvas/page window rendering works.
- [ ] Scrolling forward renders later pages.
- [ ] Scrolling backward re-renders earlier pages.
- [ ] Page metadata remains consistent.
- [ ] Click/hitTest works after document load.
- [ ] Click before document load does not produce noisy fatal errors.
- [ ] Validation warning dialog still appears where applicable.
- [ ] User choice for validation warning is respected.

## 4. Font Loading

- [ ] OS font detection still runs.
- [ ] Web font loading does not retry known failed fonts repeatedly.
- [ ] Failed font logs do not spam infinitely.
- [ ] Documents with missing fonts still render with fallback fonts.

## 5. Remote HWP/HWPX Link Drop

- [ ] Browser-dragged direct `.hwp` URL is detected.
- [ ] Browser-dragged direct `.hwpx` URL is detected.
- [ ] `text/uri-list` candidate is detected.
- [ ] `text/plain` candidate is detected where available.
- [ ] Browser drag candidate selection logs are still useful.
- [ ] URL extension based detection works.
- [ ] Header based detection works when URL extension is hidden.
- [ ] Non-document download is rejected before WASM load.
- [ ] Failed download produces useful error message.
- [ ] Successful remote document opens.
- [ ] Repeated link drops do not crash the app.
- [ ] Temporary remote download cleanup runs.
- [ ] Stale cleanup warnings are suppressed or harmless.

## 6. Print Dialog UX

- [ ] File menu contains a single `[인쇄]` entry.
- [ ] Obsolete PDF chunk preview menu entries do not reappear.
- [ ] `[인쇄]` opens the print dialog.
- [ ] Print range section is visible.
- [ ] Print mode section is visible.
- [ ] Default mode is `PDF 내보내기`.
- [ ] Secondary mode is `인쇄`.
- [ ] Whole document range works.
- [ ] Current page range works.
- [ ] Page range selection works.
- [ ] Clicking a page range number input auto-selects `페이지 범위`.
- [ ] End page input accepts Enter to trigger print.
- [ ] Bottom helper text is concise.

## 7. PDF Export

- [ ] PDF export starts from the print dialog.
- [ ] Selected page range is respected.
- [ ] Whole document export is supported.
- [ ] Large document export is chunked.
- [ ] PDF generation does not freeze the UI without feedback.
- [ ] Generated PDF opens in the in-app PDF viewer.
- [ ] Generated PDF does not open unexpectedly in the external browser/PDF app.
- [ ] Output PDF pages are not broken or blank.
- [ ] Output PDF preserves page order.

## 8. PDF Progress Overlay

- [ ] Overlay appears immediately after print starts.
- [ ] Progress bar updates.
- [ ] Percent text updates.
- [ ] Spinner/activity indicator remains alive.
- [ ] Elapsed time updates.
- [ ] Full remaining-time ETA is shown.
- [ ] ETA includes data preparation, PDF generation, merge, save, and open stages.
- [ ] ETA is not limited to the current stage only.
- [ ] ETA uses learned averages after previous successful jobs.
- [ ] Cancel button is visible.
- [ ] Cancel button actually stops the worker job.
- [ ] Cancel does not leave stale overlay behind.
- [ ] Completion hides the overlay.

## 9. PDF Worker And Merge Pipeline

- [ ] Print worker launches.
- [ ] Worker manifest is created.
- [ ] SVG pages are written/read successfully.
- [ ] Chunk PDFs are generated.
- [ ] Chunk PDFs are merged.
- [ ] Merged PDF is saved.
- [ ] Worker analysis log is readable.
- [ ] Worker progress messages are parsed.
- [ ] Worker cancellation request file is respected.
- [ ] Worker process is killed on cancel.
- [ ] Temporary print files do not accumulate uncontrollably.

## 10. In-App PDF Viewer

- [ ] In-app viewer opens after PDF export.
- [ ] Viewer title shows document/range.
- [ ] Viewer header looks integrated with the app.
- [ ] Obsolete previous/next chunk buttons are absent.
- [ ] Return-to-editor control is present.
- [ ] Return-to-editor control does not look like an unrelated CTA.
- [ ] Return-to-editor works.
- [ ] Escape key closes viewer if supported.
- [ ] Editor state remains usable after returning.

## 11. Legacy Browser Print

- [ ] Selecting `인쇄` mode opens browser/window print flow.
- [ ] App internal preview screen is not shown before browser print.
- [ ] Browser/Chromium print preview limitation is accepted.
- [ ] Canceling browser print returns to editor.

## 12. Performance Checks

Record before/after values where possible.

- [ ] App startup time is not significantly worse.
- [ ] First document load time is not significantly worse.
- [ ] Large document first page time is not significantly worse.
- [ ] Scroll responsiveness is acceptable.
- [ ] PDF data preparation time is recorded.
- [ ] PDF generation time is recorded.
- [ ] PDF merge time is recorded.
- [ ] PDF save time is recorded.
- [ ] Total PDF export time is recorded.
- [ ] Memory growth is acceptable.
- [ ] No long silent freeze without progress feedback.

## 13. Engine Boundary

- [ ] BBDG-specific feature code is not added to RHWP core.
- [ ] `pkg/*` files are generated, not manually edited.
- [ ] RHWP API changes are absorbed in adapter layer where possible.
- [ ] App code does not spread raw RHWP API calls unnecessarily.
- [ ] Any engine-core change is documented as an exception.

## 14. Guardian Review

- [ ] `RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md` was read before implementation.
- [ ] `RHWP_ENGINE_MOMENTUM_MONITOR.md` was read before implementation.
- [ ] `RHWP_ENGINE_BASELINE_COMPARISON_AGENT.md` was read before implementation.
- [ ] `RHWP_ENGINE_APP_CONTROL_VERIFICATION_AGENT.md` was read before implementation.
- [ ] `RHWP_ENGINE_GUARDIAN_AGENT.md` was read before implementation.
- [ ] Guardian review was performed after each phase.
- [ ] Guardian review checked the approved requirements document.
- [ ] Guardian review checked the approved development spec.
- [ ] Guardian review checked the approved development plan.
- [ ] Guardian review checked the API inventory.
- [ ] Guardian review checked this compatibility checklist.
- [ ] Guardian review checked UI/UX preservation.
- [ ] Guardian review checked performance preservation.
- [ ] Guardian review checked upgraded feature preservation.
- [ ] Final guardian decision is `Continue`.

## 15. Momentum Monitor

- [ ] Current phase was identified.
- [ ] Current blocker was identified if progress stalled.
- [ ] Next concrete action was defined.
- [ ] Momentum monitor did not bypass error verification.
- [ ] Momentum monitor did not bypass feature preservation verification.
- [ ] Momentum monitor did not bypass guardian review.

## 16. Baseline Comparison

- [ ] App control verification was attempted where practical.
- [ ] Any user-assisted checks were clearly marked.
- [ ] Baseline comparison was performed before accepting the update.
- [ ] Updated app startup matches the baseline behavior.
- [ ] Updated file menu matches the baseline expected menu structure.
- [ ] Updated document loading behavior matches the baseline.
- [ ] Updated rendering/scrolling behavior matches the baseline.
- [ ] Updated remote link-drop behavior matches the baseline.
- [ ] Updated print dialog behavior matches the baseline.
- [ ] Updated PDF export behavior matches the baseline.
- [ ] Updated in-app PDF viewer behavior matches the baseline.
- [ ] Updated legacy print behavior matches the baseline.
- [ ] Any intentional UI/UX difference is documented.
- [ ] Any intentional feature difference is documented.
- [ ] Baseline comparison decision is `Pass` or `Pass with documented exceptions`.

## Result

Update result:

- [ ] Pass
- [ ] Pass with documented exceptions
- [ ] Fail

Gate result:

- [ ] Error verification passed.
- [ ] Feature preservation verification passed.

Notes:

```text

```
