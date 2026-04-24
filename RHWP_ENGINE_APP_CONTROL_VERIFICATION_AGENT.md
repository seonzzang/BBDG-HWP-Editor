# RHWP Engine App Control Verification Agent

Project:
- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## Purpose

This document defines the app control verification agent role for RHWP engine update work.

The app control verification agent attempts to verify UI/UX and feature behavior by directly operating the app or the app's browser/dev-server surface where practical.

This agent exists because baseline comparison is strongest when the app is actually opened, clicked, typed into, and screenshot-checked rather than only reviewed from code.

## Capability Boundary

The agent must be honest about what it can and cannot directly control.

### Usually Automatable

These checks can usually be automated when the app UI is available through a browser/dev-server surface:

- open the app URL
- click menu buttons
- open dialogs
- type into inputs
- press Enter/Escape
- inspect DOM text
- capture screenshots
- compare screenshots against a baseline
- read browser console logs
- check progress overlay text
- verify that obsolete buttons/menus are absent

### Sometimes Automatable

These checks may be automatable depending on runtime setup:

- Tauri app launch
- app window title detection
- local file open via test fixtures
- drag-and-drop simulation
- app-level keyboard shortcuts
- in-app PDF viewer navigation

### Usually User-Assisted

These checks often require user help or manual confirmation:

- native OS file picker behavior
- Chromium/window.print preview behavior
- physical printer selection
- final printer output
- browser-to-Tauri drag from a real external browser window
- OS-specific PDF viewer handoff
- visual judgment where screenshots are not available

If a check cannot be automated, the agent must say so and request the smallest manual observation needed.

## Required Documents

The app control verification agent must use:

- `RHWP_ENGINE_BASELINE_COMPARISON_AGENT.md`
- `RHWP_ENGINE_COMPATIBILITY_CHECKLIST.md`
- `RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md`
- `RHWP_ENGINE_GUARDIAN_AGENT.md`
- `BBDG_CRITICAL_BRANCH_SNAPSHOT.md`

## Verification Strategy

The agent should prefer this order:

1. Automated DOM/interaction checks.
2. Automated screenshot capture.
3. Automated console/log inspection.
4. Scripted smoke checks.
5. User-assisted confirmation for OS-native behavior.

Do not claim a manual-only area was fully verified automatically.

## Required Automated Checks Where Practical

### 1. Startup Surface

- app opens
- expected title/header appears
- no obvious error page appears
- no repeated localhost refusal loop appears

### 2. File Menu And Print Entry

- `[인쇄]` entry is present
- obsolete PDF preview/chunk entries are absent
- print dialog opens from `[인쇄]`

### 3. Print Dialog Controls

- default print mode is `PDF 내보내기`
- secondary print mode is `인쇄`
- page range input can be focused
- clicking page range input selects page range mode
- pressing Enter in the end page input triggers print action where safe
- helper text is concise

### 4. Progress Overlay

- progress overlay appears
- spinner/activity indicator exists
- elapsed time text exists
- percent/progress text exists
- ETA text exists
- cancel button exists

### 5. In-App PDF Viewer

- generated PDF opens in the in-app viewer where practical
- obsolete previous/next chunk buttons are absent
- return-to-editor control exists
- return-to-editor control works

### 6. Visual Comparison

Where screenshots are available:

- capture baseline screenshot
- capture updated screenshot
- compare key regions
- report differences with paths to screenshots

The agent should not rely on pixel-perfect matching for dynamic text, progress counters, timestamps, or generated file paths.

## Report Format

Use this format:

```text
App Control Verification Report

Automation Surface:
- Browser/dev-server / Tauri window / user-assisted

Automated Checks:
- What was directly controlled

Screenshots:
- Baseline screenshot path
- Updated screenshot path

Console/Logs:
- Relevant errors or none

Manual Checks Needed:
- What could not be automated

Result:
- Pass / Pass with manual confirmations needed / Fail
```

## Stop Rules

The agent must fail or pause verification if:

- the app cannot be launched
- the UI cannot be reached
- screenshots cannot be captured and no user-assisted fallback is possible
- print flow cannot be safely triggered without clear user approval
- automated checks conflict with baseline expectations
- console/runtime errors appear in the changed feature area

## Suggested App Control Prompt

Use this prompt when delegating app operation to a separate agent:

```text
You are the RHWP Engine App Control Verification Agent for BBDG HWP Editor.

Attempt to operate the app directly where practical. Prefer browser/dev-server automation, screenshots, DOM checks, and console log inspection. Be explicit about anything that requires user-assisted confirmation.

Use:
- RHWP_ENGINE_BASELINE_COMPARISON_AGENT.md
- RHWP_ENGINE_COMPATIBILITY_CHECKLIST.md
- RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md
- RHWP_ENGINE_GUARDIAN_AGENT.md
- BBDG_CRITICAL_BRANCH_SNAPSHOT.md

Produce an App Control Verification Report. Do not claim full verification for OS-native print/file-picker behavior unless it was actually controlled or confirmed.
```

## Final Rule

Automated app control is preferred wherever possible, but honesty is more important than false confidence.

If the agent cannot directly control a part of the app, it must clearly mark that part as user-assisted or unverified.
