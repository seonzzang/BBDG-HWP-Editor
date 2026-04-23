# RHWP Engine Update Runbook

## Purpose

This runbook describes how to update the RHWP engine used by BBDG HWP Editor while preserving the current BBDG feature set and UI/UX behavior.

## Golden Rule

Do not trade away BBDG features for engine cleanliness.

The update is successful only if the upgraded BBDG functionality remains intact.

## Current Critical Baseline

- Branch: `origin/bbdg-rebuild-0.7.32`
- Feature baseline commit: `f8e606d`
- Snapshot record commit: `4dc8497`
- Snapshot document: `BBDG_CRITICAL_BRANCH_SNAPSHOT.md`

## Pre-Flight

1. Confirm clean working tree.

```bash
git status --short
```

2. Confirm current branch and remote.

```bash
git branch -vv
git remote -v
```

3. Run baseline verification before updating.

```bash
cargo check
cargo test
cd rhwp-studio
npm run build
cd ..
cargo check --manifest-path src-tauri/Cargo.toml
```

4. If baseline verification fails, stop. Do not start engine update.

5. Read the guardian agent document.

```text
RHWP_ENGINE_GUARDIAN_AGENT.md
```

6. Read the orchestration supervisor document.

```text
RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md
```

The orchestration supervisor controls phase sequencing. The guardian review is required before implementation starts and after each update phase.

Every phase must pass both gates before moving forward:

- Error verification
- Feature preservation verification

If either gate fails, stay in the current phase and fix the issue first.

## Step 1. Create Update Branch

Create a dedicated branch. Do not update engine directly on the critical branch.

```bash
git switch -c chore/update-rhwp-engine-YYYYMMDD
```

## Step 2. Fetch Upstream RHWP

```bash
git fetch upstream
```

Record the target upstream commit:

```bash
git show --no-patch --oneline upstream/main
```

If upstream uses `devel` as integration target, inspect that branch too:

```bash
git show --no-patch --oneline upstream/devel
```

## Step 3. Apply Engine Update

Prefer updating RHWP engine code separately from BBDG app changes.

Expected engine-related paths:

- `src/**`
- `pkg/**`
- `Cargo.toml`
- `Cargo.lock`

Do not mix unrelated UI/UX changes into this step.

## Step 4. Resolve Conflicts Conservatively

Conflict handling priority:

1. Preserve current BBDG feature behavior.
2. Preserve upstream RHWP engine changes.
3. Move BBDG-specific behavior to adapter/app layer where possible.
4. Avoid putting BBDG product UX into RHWP core.

If a conflict touches RHWP core, ask:

- Is this truly an engine feature?
- Can it move to `wasm-bridge`?
- Can it move to `rhwp-studio`?
- Can it move to `src-tauri` or `scripts`?
- Should this become an upstream RHWP PR?

## Step 5. Fix Adapter Boundary

First fix build errors in:

- `rhwp-studio/src/core/wasm-bridge.ts`
- `rhwp-studio/src/core/types.ts`

Goal:

The rest of BBDG app should keep calling the same adapter API whenever possible.

## Step 6. Build Verification

Run:

```bash
cargo check
cargo test
cd rhwp-studio
npm run build
cd ..
cargo check --manifest-path src-tauri/Cargo.toml
```

Stop if any command fails.

These commands satisfy only the error verification gate. They do not replace feature preservation verification.

## Step 7. Manual Compatibility Verification

Use:

`RHWP_ENGINE_COMPATIBILITY_CHECKLIST.md`

Do not skip:

- document loading
- rendering
- remote link drop
- print dialog
- PDF export
- cancel
- ETA
- in-app PDF viewer
- legacy print
- UI/UX flow
- performance checks

Also run the guardian review defined in:

`RHWP_ENGINE_GUARDIAN_AGENT.md`

Do not continue if the guardian decision is `Stop`.

Manual compatibility verification is the required feature preservation gate.

## Step 8. Performance Verification

At minimum, compare:

- large document load time
- first page render time
- scroll responsiveness
- PDF data preparation time
- PDF generation time
- PDF merge time
- PDF save time
- total PDF export time
- memory growth

If performance becomes significantly worse, stop and investigate before continuing.

## Step 9. Commit Structure

Recommended commit split:

1. `chore: update rhwp engine baseline`
2. `fix: adapt wasm bridge to updated rhwp engine`
3. `fix: preserve bbdg app compatibility after engine update`
4. `docs: record rhwp engine update verification`

Avoid one giant mixed commit if possible.

## Step 10. Failure Handling

If the update fails:

1. Do not force push.
2. Keep the failed branch for inspection if useful.
3. Record failure reason.
4. Return to critical baseline branch.
5. Decide whether to:
   - fix adapter
   - defer update
   - upstream a RHWP patch
   - keep current engine

## Step 11. Final Push

Push only after checks pass.

```bash
git push origin HEAD:<target-branch>
```

Do not push to `origin/main` unless branch divergence has been intentionally resolved.

Before push, the final guardian decision must be `Continue`.

## Required Final Record

After a successful update, record:

- previous RHWP baseline
- new RHWP baseline
- BBDG branch
- BBDG version
- compatibility checklist result
- performance comparison result
- guardian review result
- known exceptions
