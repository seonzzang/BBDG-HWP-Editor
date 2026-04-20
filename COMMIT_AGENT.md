# Commit Agent

## Purpose
Create small, reversible Git commits during each verified step of the rebuild.

## Files
- Script: `tools/commit-agent.ps1`
- Version hook: `.githooks/pre-commit`

## How To Use
From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\commit-agent.ps1 -Message "feat: baseline desktop rebuild"
```

Commit only selected paths:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\commit-agent.ps1 -Message "feat: about dialog restore" -Paths rhwp-studio/src/ui/about-dialog.ts,rhwp-studio/src/assets/product-info.json
```

## Workflow Rule
- Change one small step
- Verify it
- Commit it immediately
- Stop and fix before the next step if any error appears

## Note
The existing pre-commit version agent still runs on every commit, so version bumping and release-note updates stay automatic.
