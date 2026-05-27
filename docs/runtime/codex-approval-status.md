# Codex Approval Status

Updated: 2026-05-26
Decision: `guarded, partially implemented`
Scope: how Fluxion models Codex approvals, reviewer mode, and sandbox posture

Status: focused runtime note, not a replacement for `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, or the backlog

## Current Position

Do not treat approval support as a simple `supported / unsupported` binary.

Recent Codex config guidance shows a richer approval and security model than Fluxion's older assumptions, including:

- `approval_policy` with granular categories
- `approvals_reviewer`
- MCP tool approval modes
- richer sandbox and network policy combinations

## What Fluxion Already Supports

Fluxion has already landed the first approval-model pass:

1. workflow and node data can preserve richer approval config
2. guardrails distinguish hard blockers from risky-but-allowed posture
3. reviewer mode is part of the surfaced config model
4. runtime serialization preserves Codex-native config keys instead of inventing a parallel approval model
5. effective config and workflow policy surfaces now explain trust, ignored project-local config, and MCP readiness warnings with more fidelity than the earlier pass

## Current Guardrail Posture

Current implementation direction:

- `never`: supported
- `on-request`: supported with runtime guardrail messaging
- granular policies: supported in config/runtime modeling and guardrail evaluation
- `approvals_reviewer`: surfaced as reviewer mode (`user` or `auto_review`)

## Remaining Gaps

- app-level tool approval modes are not yet a first-class authoring surface
- approval diagnostics are better tied to effective-config explainability, but app/tool-level approval authoring is still incomplete
- MCP approval visibility is stronger than before, but not yet exhaustive in the UI

## Next Step

Related backlog items:

- `FX-CX-001` Effective Codex config diagnostics view
- `FX-CX-004` MCP readiness and topology surface
- `FX-CX-007` MCP tool scoping in node UX

## Canonical Reference

- Backlog: [`docs/backlog/backlog.md`](../backlog/backlog.md)
