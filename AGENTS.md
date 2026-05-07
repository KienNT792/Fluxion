# Fluxion AGENTS.md

Project-specific instructions for Codex working in this repository.

## Repository intent

- Fluxion is a Windows-first Electron desktop app for designing and running Codex-based workflows.
- The core product turns repeatable `codex exec` work into a visual DAG with logs, review checkpoints, and workspace-local artifacts.
- The primary runtime is the local Codex CLI. Do not describe the OpenAI adapter as the main execution path unless the user explicitly asks for it.

## What matters most

- Preserve behavior unless the user asked for a change.
- Keep changes practical, local, and easy to review.
- Prefer accurate repository-specific instructions over generic architecture advice.
- Keep the app responsive. Long-running work belongs in the main process, not the renderer.
- Favor Windows-safe behavior in code, commands, path handling, and process management.

## Repository map

- `src/core`: framework-agnostic workflow, DAG, artifact, runner, and run-state contracts
- `src/main`: Electron main process, IPC handlers, workspace services, runners, adapters, and process management
- `src/preload`: `contextBridge` API exposed to the renderer
- `src/renderer`: React UI, React Flow canvas, Zustand stores, terminal viewer, and dialogs
- `src/shared`: shared workflow types, provider metadata, and IPC payloads
- `scripts/smoke/windows-build.mjs`: Windows smoke verification for packaging
- `docs/`: backlog and assessment notes
- `DESIGN.md`: detailed design language and visual direction
- `README.md`: current product overview, setup, commands, and architecture summary

## Architecture boundaries

- Keep `src/core` free of Electron and React imports.
- Keep filesystem access, process execution, provider discovery, and workflow orchestration in `src/main`.
- Keep `src/preload` as a thin typed bridge only.
- Keep `src/renderer` focused on editing, visualization, and user interaction. Do not move backend logic into the renderer for convenience.
- When an IPC contract changes, update `src/shared` first, then `preload`, `main`, and `renderer`.

## Workspace and runtime rules

- Fluxion persists state locally under `.fluxion/`. Keep these contracts stable unless the task explicitly changes them:
  - `.fluxion/context.json`
  - `.fluxion/workflows/*.fluxion.json`
  - `.fluxion/workflow.json` for legacy compatibility
  - `.fluxion/memory/**/*.md` with frontmatter
  - `.fluxion/runs/*.json`
- Workflow execution must continue to respect DAG validation, retry behavior, review gates, and run-state persistence.
- If you touch workflow execution, review `src/core`, `src/main/services/workflow-engine.ts`, and the related tests before changing behavior.

## Windows-first rules

- Use `path.join()` and `path.resolve()` instead of hardcoded separators.
- Do not assume Unix-only tools or shell syntax.
- Prefer PowerShell-safe commands and existing npm scripts.
- Be careful with process cleanup and abort flows. Windows process-tree cleanup is part of the product contract.
- Do not introduce behavior that only works in WSL unless the user explicitly asks for it.

## Security and credentials

- Never hardcode API keys, tokens, or secrets.
- Prefer environment variables or the existing settings flow in `src/main/services/settings.service.ts`.
- Do not weaken sandbox, approval, or security-related behavior casually.
- Treat Codex permissions and workspace boundaries as product behavior, not incidental implementation details.

## OpenAI and Codex docs

- For OpenAI API, Codex, MCP, AGENTS, model, or prompting questions, use the `openaiDeveloperDocs` MCP server first.
- If the MCP server does not answer the question, fall back only to official OpenAI sources such as `developers.openai.com` or `platform.openai.com`.
- Do not invent OpenAI product behavior, model capabilities, MCP configuration, or Codex features.

## How to work in this repo

- Read `README.md` and the relevant source files before making non-trivial changes.
- Search for existing implementations before adding new abstractions.
- Prefer updating the nearest existing module instead of introducing parallel patterns.
- Keep changes scoped. Do not widen a task into a refactor unless the user asks for it or the current design blocks the fix.
- If the requested change affects app UX, preserve the existing "editorial calm" design direction and consult `DESIGN.md` for details.

## Commands

Use the existing npm scripts unless there is a good reason not to.

```powershell
npm install
npm run dev
npm run typecheck
npm test
npm run lint
npm run build
npm run build:win
npm run smoke:win
```

## Verification expectations

- Type and contract changes: run `npm run typecheck`
- Behavior changes: run `npm test`
- Lint-sensitive edits: run `npm run lint`
- Build or packaging changes: run `npm run build` and, when relevant, `npm run smoke:win`
- If you cannot run a relevant check, say so clearly in the final response

## Testing guidance

- Add or update the closest tests when behavior changes:
  - `src/core/test` for schema, DAG, artifact, and runner contracts
  - `src/main/test` for services, runners, and workflow execution behavior
  - renderer component tests when UI logic changes materially
- Avoid broad test rewrites for a local fix.

## Done means

- The requested behavior is implemented or the requested analysis is completed.
- Relevant commands have been run when practical.
- Any skipped verification, known risk, or follow-up gap is stated explicitly.
- The diff stays aligned with Fluxion's current architecture and Windows-first runtime model.

## Do not

- Do not treat the unfinished OpenAI adapter as the default runtime.
- Do not move core runtime logic into the renderer.
- Do not introduce blocking child process execution in UI-facing flows.
- Do not add new dependencies unless the existing stack clearly cannot support the change.
- Do not silently change `.fluxion/` file shapes, IPC payload contracts, or workflow semantics without updating all affected layers.
- Do not replace practical project rules with generic boilerplate.
