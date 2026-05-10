# Fluxion Dogfood Workflows

These workflows are versioned examples for using Fluxion to develop Fluxion. They intentionally
live under `docs/dogfood` instead of `.fluxion/` because `.fluxion/` is local runtime state and is
ignored by Git.

## Import

Copy a workflow from `docs/dogfood/workflows` into a workspace's `.fluxion/workflows/` directory,
then reopen or reload that workspace in Fluxion.

## Defaults

- Codex CLI is the runtime path.
- Audit and review workflows use `sandboxMode: read-only`.
- The implementation workflow uses `sandboxMode: workspace-write`.
- All workflows use `approvalPolicy: never` so they match Fluxion's non-interactive runner path.

## Included Workflows

- `current-diff-review.fluxion.json`: inspect current changes and produce review findings.
- `renderer-size-audit.fluxion.json`: scan renderer TSX sizes and recommend extraction targets.
- `verification-triage.fluxion.json`: run or interpret verification commands and summarize
  failures.
- `runtime-smoke-prep.fluxion.json`: prepare a run-specific smoke plan from the alpha checklist.
- `plan-to-implementation.fluxion.json`: turn an approved plan into implementation work with a
  review checkpoint before edit-oriented steps.
