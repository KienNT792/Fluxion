# Agent Docs

This folder is the agent-facing documentation entrypoint for Fluxion.

Use it when you need repository-specific operating context beyond the short rules in the root `AGENTS.md`.

## Read Order

1. Root [`AGENTS.md`](../../AGENTS.md)
2. This file
3. [`agent-setup.md`](./agent-setup.md)
4. [`agent-doc-map.md`](./agent-doc-map.md)
5. [`agent-review-checklist.md`](./agent-review-checklist.md)
6. [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) only when the task touches runtime, IPC, persistence, or workflow execution

## Purpose

OpenAI's Codex guidance recommends keeping `AGENTS.md` short and pushing detailed, task-specific instructions into referenced docs. This folder is that second layer for Fluxion.

Use these docs to answer:

- what an agent should read first
- how to verify work in this repo
- which docs are canonical versus historical or situational
- where to find runtime notes without bloating `AGENTS.md`

## Canonical Sources

- Root [`AGENTS.md`](../../AGENTS.md): durable repo rules
- Root [`README.md`](../../README.md): product overview and contributor quickstart
- Root [`ARCHITECTURE.md`](../../ARCHITECTURE.md): current architecture and contracts
- Root [`DESIGN.md`](../../DESIGN.md): UX and visual rules
- [`../backlog/backlog.md`](../backlog/backlog.md): open work and sequencing

## Non-Canonical but Useful

- [`../runtime/`](../runtime/): deeper implementation and runtime notes
- [`../qa/`](../qa/): smoke and verification checklists
- [`../dogfood/`](../dogfood/): sample Fluxion workflows checked into the repo

Useful current runtime notes include:

- [`../runtime/codex-approval-status.md`](../runtime/codex-approval-status.md): current approval/reviewer/runtime posture
- `Flow Context` and provider diagnostics in the running app: current source of truth for policy/config/MCP/context pressure inspection, effective node policy inspection, long-term summary reuse, and rerun compaction guidance

Treat runtime notes as supporting material, not source-of-truth planning. If a runtime note conflicts with root docs or the current backlog, prefer:

1. `AGENTS.md`
2. `README.md`
3. `ARCHITECTURE.md`
4. `docs/backlog/backlog.md`

