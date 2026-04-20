# Memory Optimization Plan

## Goal
Reduce perceived slowdown and memory spikes for large HWP documents without breaking document loading, editing, or rendering stability.

## Working Principles
- Change one small layer at a time.
- Verify after every change.
- Stop immediately when an error appears.
- Fix the current step before moving forward.
- Keep every step easy to roll back with a small Git commit.

## Target Strategy
The optimization will focus on heavy page-side artifacts, not the whole document model.

- Keep the full document model alive.
- Limit heavy render-related memory to a moving page window.
- Prefer incremental work over full upfront computation.
- Release out-of-range page artifacts aggressively.

## Step Breakdown

### Step 1. Design And Logging Baseline
Scope:
- Define the optimization phases.
- Add explicit logging points before any behavioral change.

Verification:
- No runtime behavior change.
- `cargo check`
- `npx tsc --noEmit`

### Step 2. Viewport Window Policy
Scope:
- Define a page window such as current page plus/minus 5 to 10 pages.
- Make the window size configurable in one place.

Verification:
- No document loading regression.
- Visible pages still render correctly while scrolling.

### Step 3. Frontend Cache Release
Scope:
- Ensure canvases and page render artifacts outside the window are released.
- Confirm scrolling re-creates released pages correctly.

Verification:
- Scroll forward and backward across a large document.
- Check that released pages are re-rendered on demand.

### Step 4. Incremental Pagination Bridge
Scope:
- Add progressive paging hooks between Rust and TypeScript.
- Avoid full upfront page computation on large loads.

Verification:
- First visible pages appear early.
- Remaining pages are computed progressively.

### Step 5. Rust Pagination State Split
Scope:
- Introduce incremental pagination state in Rust.
- Keep current stable pagination path intact while adding a step-based path.

Verification:
- `cargo check`
- No regression on normal documents.

### Step 6. Large Document Validation
Scope:
- Validate memory behavior and perceived responsiveness with large files.

Verification:
- File open
- Drag and drop
- Scroll deep into document
- Return to earlier pages
- Confirm no loading or editing regression

## Logging Checklist
Add or keep logs at these points when implementation begins:

- Document load start/end
- Page window recalculation
- Page cache release
- Page cache recreate
- Progressive paging start/step/finish
- Error and early-stop conditions

## Stop Conditions
Pause implementation and fix immediately if any of these appear:

- File load failure
- Blank page rendering
- Page count mismatch
- Rust panic or borrow error
- Null pointer or freed-object access
- Scroll position corruption
- Input or caret regression

## First Safe Code Change
The first code change after this document should be:

- Add a single shared page-window constant and debug logs in the frontend only.
- No Rust behavior change yet.
