# Context Init P3 Benchmark Notes

Date: 2026-05-10  
Scope: Deterministic scan and onboarding evidence collection before any parallel scan refactor

## Goal

Collect repeatable local timings before changing scan concurrency. P3 should only introduce bounded
parallel scan if measurements show a clear bottleneck and the change does not weaken path/security
guards.

## Baseline Cases

- Blank workspace with no source files.
- Small Node/TypeScript repository under 500 files.
- Medium monorepo with multiple package manifests.
- Repository with generated/vendor directories such as `node_modules`, `dist`, `build`,
  `coverage`, and `vendor`.
- Repository with sensitive-name fixtures such as `.env.local`, `.pem`, `.key`, and `id_rsa`.

## Metrics To Record

- Total Context Init scan time.
- Evidence files considered, accepted, skipped, and truncated.
- Total evidence bytes read.
- Largest skipped directory category.
- Whether required final-save signals were detected.
- Any UI-visible delay before the Detect Workspace step becomes usable.

## Constraints For P3

- Keep filesystem work in the main process.
- Keep writes explicit and workspace-scoped.
- Preserve deterministic ordering of evidence and diagnostics.
- Do not add dependencies unless benchmark data shows the standard library approach is insufficient.
- Do not implement parallel scan before comparing baseline and candidate timings on Windows.
