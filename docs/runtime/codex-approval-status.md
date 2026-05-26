# Codex Approval Status

Updated: 2026-05-26
Decision: `guarded, needs redesign`
Scope: how Fluxion should model Codex approvals and sandbox posture

Status: focused runtime note, not a replacement for `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, or the backlog

## Current Position

Do not treat approval hosting as a simple `supported / unsupported` binary.

Recent research shows the Codex config and security model are richer than the older Fluxion assumptions, including:

- `approval_policy` granular
- `approvals_reviewer`
- MCP/app tool approval modes
- richer sandbox and network policy combinations

## What This Means For Fluxion

Fluxion needs a small redesign of the approval surface:

1. map the actual policy combinations
2. distinguish runtime blockers from risk warnings
3. show approval categories more clearly
4. keep the product `Codex-first` and Windows-safe

## Current Guardrail

Until Fluxion supports richer policy modeling:

- `never`: supported
- `on-request`: should be evaluated against runtime support and workflow mode instead of being hard-blocked without explanation
- granular policies: not yet surfaced properly in the UI

## Next Step

Related backlog items:

- `FX-CX-001` Effective Codex config diagnostics view
- `FX-CX-002` Rich approval policy mapping
- `FX-CX-004` MCP readiness and topology surface

## Canonical Reference

- Backlog: [`docs/backlog/backlog.md`](../backlog/backlog.md)
