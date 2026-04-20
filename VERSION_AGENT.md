# Version Agent

## Purpose
Automatically manage version bumps and release note generation whenever code changes are committed.

## What It Does
- Detects staged code changes during `git commit`
- Bumps the patch version automatically
- Updates version values in:
  - `Cargo.toml`
  - `rhwp-studio/package.json`
  - `src-tauri/Cargo.toml` (when present)
  - `src-tauri/tauri.conf.json` (when present)
- Prepends an automated release note entry to `CHANGELOG.md`

## Files
- Hook: `.githooks/pre-commit`
- Agent script: `tools/version-agent.ps1`
- Commit helper: `tools/commit-agent.ps1`

## Notes
- The automation runs at commit time, which is the most reliable point for Git-based versioning.
- Metadata-only commits such as changelog-only edits do not trigger another bump.
