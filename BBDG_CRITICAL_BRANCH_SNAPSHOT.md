# BBDG Critical Branch Snapshot

## Snapshot Date

2026-04-23

## Remote Branch

`origin/bbdg-rebuild-0.7.32`

## Version

`0.7.127`

## Commit

`f8e606d feat: polish print pdf workflow and document engine integration`

## Meaning

This snapshot is an important product baseline for BBDG HWP Editor.

It captures the current upgraded BBDG feature set before future RHWP engine integration or upstream RHWP engine replacement work.

## Preserved Feature Set

The following BBDG features must be preserved after future RHWP engine updates:

- Print dialog UX
- PDF export flow
- Large document PDF chunk generation
- PDF merge pipeline
- PDF progress overlay
- Cancelable PDF generation
- Full remaining-time ETA
- Learned ETA estimates from previous print jobs
- In-app PDF viewer
- Return from PDF viewer to editor
- Legacy browser print option inside the print dialog
- Remote HWP/HWPX link drop support
- Temporary remote download cleanup
- Web font load retry suppression
- WASM document replacement stability improvements

## Engine Integration Principle

Future RHWP engine updates must not remove or regress the BBDG feature set captured in this snapshot.

The intended long-term direction is:

- Keep RHWP core engine as close to upstream as possible.
- Keep BBDG-specific product features in `rhwp-studio`, `src-tauri`, `scripts`, and adapter layers.
- Use `wasm-bridge` as the boundary between BBDG application code and RHWP engine APIs.
- Treat this snapshot as the minimum behavior baseline for future engine integration work.

## Notes

`origin/main` had already diverged into a separate `v0.8.0 performance optimization` line at the time of this snapshot.

The current working baseline was therefore pushed to:

`origin/bbdg-rebuild-0.7.32`

