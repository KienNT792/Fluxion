# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read first

Before non-trivial work, read in this order:

1. `README.md`
2. `CLAUDE.md`
3. `ARCHITECTURE.md` if the task touches runtime, IPC, persistence, or workflow execution
4. `DESIGN.md` if the task touches UX or visual behavior

## Common commands

Use `pnpm` in this repo.

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm build:win
pnpm smoke:win
```

Targeted test runs use Vitest directly:

```bash
pnpm vitest run src/path/to/file.test.ts
pnpm vitest run -t "test name"
pnpm vitest
```

Useful additional scripts:

```bash
pnpm start
pnpm build:unpack
pnpm cli
pnpm eval:workflow
```

## High-level architecture

Fluxion is a Windows-first Electron desktop app for designing and running Codex workflows as visual DAGs. The main product path is the local Codex CLI; the OpenAI adapter exists in the codebase but is not the default runtime.

### Layer boundaries

```text
src/core     framework-agnostic workflow schemas, DAG validation, artifacts, run-state contracts
src/shared   shared workflow, provider, context, and IPC types
src/main     Electron main process, IPC handlers, services, runners, adapters, workspace orchestration
src/preload  thin typed contextBridge bridge to the renderer
src/renderer React UI, React Flow canvas, Zustand stores, runtime panels, onboarding/context flows
```

Keep these boundaries intact:

- `src/core` must stay free of Electron and React imports.
- `src/main` owns filesystem access, process execution, provider discovery, workflow orchestration, and workspace persistence.
- `src/preload` should only expose typed IPC APIs.
- `src/renderer` should stay focused on UI, editing, visualization, and interaction.
- If an IPC contract changes, update `src/shared` first, then `src/preload`, `src/main`, and `src/renderer`.

### Runtime shape

The app boots from `src/main/index.ts`, creates the Electron window, and registers workflow IPC handlers in `src/main/ipc/workflow.handlers.ts`. The renderer root is `src/renderer/src/App.tsx`, which wires global IPC listeners and workflow persistence before rendering `AppShell`.

Most product behavior lives in main-process services:

- `src/main/services/workflow-engine.ts`: DAG scheduling, node execution, review checkpoints, run lifecycle, reruns
- `src/main/runners/codex-cli-runner.ts`: local Codex CLI execution
- `src/main/adapters/codex-cli.adapter.ts`: production agent adapter
- `src/main/services/provider-registry.service.ts`: provider discovery/readiness/model capability handling
- `src/main/services/workspace.service.ts`: workspace loading, `.fluxion/` lifecycle, workflow persistence
- `src/main/services/memory-manager.ts`: compiled context, node output memory, long-term summaries
- `src/main/services/run-state-store.ts` and `flow-context-store.ts`: persisted run/context state

On the renderer side, Zustand stores are the backbone:

- `src/renderer/src/stores/workflow.store.ts`: workflow graph, workspace state, context status, provider capabilities, save/load state
- `src/renderer/src/stores/execution.store.ts`: runtime status, terminal logs, node execution state

### Workflow model

Workflows are DAGs made of typed nodes and edges from `src/shared/workflow.types.ts`. Nodes carry provider/model settings, prompt + system instruction, review settings, retry policy, artifacts, and Codex runtime options such as sandbox and approval policy.

Execution flow is:

1. Renderer sends a workflow run request over IPC.
2. Main validates the workflow schema and DAG.
3. `workflow-engine` performs topological scheduling.
4. Nodes execute through the Codex adapter/runner.
5. Status, logs, outputs, and review events stream back to the renderer.
6. Run state persists under `.fluxion/runs`.

### Persistence contract

Workspace-local state under `.fluxion/` is part of the product contract and should not be changed casually:

```text
.fluxion/context.json
.fluxion/workflow.json                 # legacy compatibility
.fluxion/workflows/*.fluxion.json
.fluxion/memory/**/*.md
.fluxion/runs/*.json
```

App-level settings such as trusted workspaces and recent workspaces live in Electron `userData` via main-process services.

### Important product constraints

- Preserve Windows-safe behavior in path handling, shelling, and process cleanup.
- Long-running execution belongs in the main process, not the renderer.
- Review checkpoints, retry behavior, DAG validation, and run-state persistence are core behavior.
- Context diagnostics and memory reuse are first-class product features, not incidental implementation details.
- Runtime notes in `docs/runtime/` are supporting material; prefer `CLAUDE.md`, `README.md`, and `ARCHITECTURE.md` when they conflict.

## Testing and verification guidance

- Type or contract changes: `pnpm typecheck`
- Behavior changes: `pnpm test`
- Lint-sensitive edits: `pnpm lint`
- Build or packaging changes: `pnpm build` and, when relevant, `pnpm smoke:win`

Tests live primarily in:

- `src/core/test` for DAG/schema/artifact/run-state behavior
- `src/main/test` for services, runners, provider/runtime behavior
- `src/**/*.test.ts` and `scripts/**/*.test.mjs` are included by Vitest

Vitest is configured to run serially (`maxWorkers: 1`, `fileParallelism: false`), so avoid assuming parallel test execution.
