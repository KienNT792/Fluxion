# Agent Setup

## What Fluxion Is

Fluxion is a Windows-first Electron desktop app for building and running Codex-based workflows.

The main product path is:

- local workspace
- local Codex CLI runtime
- visual DAG authoring
- workspace-local `.fluxion/` persistence

Do not present the OpenAI adapter as the primary runtime unless the user explicitly asks for it.

## Architecture Guardrails

- Keep `src/core` free of Electron and React
- Keep filesystem access and child-process work in `src/main`
- Keep `src/preload` thin
- Keep `src/renderer` focused on UI, editing, and presentation
- Update IPC contracts in `src/shared` first

## Verification Defaults

- `npm run typecheck` for type and contract edits
- `npm test` for behavior changes
- `npm run lint` for lint-sensitive edits
- `npm run build` and `npm run smoke:win` for build or packaging work

## Windows-First Rules

- Use `path.join()` and `path.resolve()`
- Prefer PowerShell-safe commands
- Be careful with process cleanup and abort semantics
- Do not introduce WSL-only assumptions

## Persistence Contracts

Treat these as stable unless the task explicitly changes them:

- `.fluxion/context.json`
- `.fluxion/workflows/*.fluxion.json`
- `.fluxion/workflow.json`
- `.fluxion/memory/**/*.md`
- `.fluxion/runs/*.json`

