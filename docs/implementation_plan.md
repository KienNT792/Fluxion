# Fluxion Implementation Status

Date: 2026-05-06
Workspace: `D:\codex-workflow\Fluxion`
Scope: `FX-027`, `FX-018`, `FX-025`

This document replaces the older forward plan and records what is now implemented in the repo.

## Summary

- `FX-027` is implemented: Fluxion now discovers Codex capabilities from the local CLI via `codex debug models`.
- `FX-018` is implemented: workflow-level `Auto` / `Manual` execution mode is persisted and enforced by the engine.
- `FX-025` is partially implemented: local Windows smoke baseline is in place, but CI baseline is still missing.

## Verification Snapshot

- `npm run typecheck`: pass
- `npm test`: pass (`13` files, `65` tests)
- `npm run smoke:win`: pass

## Delivered Changes

### FX-027 Dynamic Codex capability integration

- `ProviderType` now accepts `codex` and legacy `openai` data for backward compatibility.
- Provider capabilities are exposed through the existing `PROVIDERS_GET_CAPABILITIES` flow; no dedicated Codex IPC channel was added.
- `getCodexCapabilities()` uses `codex debug models` as the source of truth for the local catalog.
- `stdout` is parsed as JSON. `stderr` is used only for diagnostics and auth hints.
- Discovery handles 3 explicit states:
  - CLI missing -> `available=false`, empty model list, clear install error
  - auth missing -> `available=true`, `auth.status='missing'`, empty model list, `codex login` hint
  - success -> authenticated catalog with default model resolved from the CLI data
- Renderer behavior is capability-driven:
  - model dropdown reads from `providerCapabilities.codex.models`
  - unknown or legacy slugs are preserved via a `Legacy / Custom` option
  - `Reasoning Effort` is shown only when the selected model exposes supported reasoning levels
  - `Temperature` and `Max Tokens` stay hidden for Codex in this ticket
- Runtime wiring stays conservative:
  - model selection still maps to `--model <slug>`
  - `reasoningLevel` maps to `--config model_reasoning_effort=<level>` only when the selected model supports it
  - explicit `codex.config.model_reasoning_effort` still wins over the UI-level `reasoningLevel`
  - existing config mappings for `approval_policy`, `sandbox_mode`, and `windows.sandbox` are preserved
- Legacy workflow compatibility is preserved:
  - old workflow data containing `provider: 'openai'` still loads
  - new or resaved authoring data normalizes to `provider: 'codex'`
  - legacy/custom model strings are not silently remapped

### FX-018 Workflow-level Auto / Manual Accept

- `Workflow.executionMode?: 'auto' | 'manual'` is now persisted in workflow data.
- `WorkflowRunPayload` and run-state data carry `executionMode`.
- The topbar exposes a workflow-level segmented control for `Auto` and `Manual`.
- The control is disabled while the workflow is `running` or `paused`.
- Engine behavior:
  - `auto`: keeps the previous behavior; pause only when `node.data.humanReview` is enabled
  - `manual`: every completed node pauses for review before downstream nodes unlock
- Run-state now records:
  - root `executionMode`
  - per-node `reviewSource?: 'node' | 'manual'`
- Existing review actions are reused:
  - `Approve`
  - `Reject`
  - `Rerun`
- Final approval on the last paused node now completes the run normally instead of leaving it stuck in `paused`.

### FX-025 Local Windows smoke baseline

- Added `scripts/smoke/windows-build.mjs`.
- Added `npm run smoke:win`.
- The script runs:
  1. `npm run typecheck`
  2. `npm run test`
  3. `npm run build`
  4. unpacked Windows packaging via `electron-builder --dir --config.win.signAndEditExecutable=false`
- The smoke script fails fast and verifies:
  - `dist/win-unpacked/`
  - `dist/win-unpacked/fluxion.exe`
  - `dist/win-unpacked/resources/app.asar`
- Manual smoke steps are documented in `docs/windows-smoke-checklist.md`.

## Current Gaps

- `FX-020`: `Explain with AI` is still missing from the error surface.
- `FX-023`: invalid frontmatter/metadata is not fully blocked before downstream context compilation.
- `FX-024`: provider auth/config validation is still incomplete across all runtime paths.
- `FX-025`: CI baseline for `lint` / `typecheck` / `test` / Windows smoke is still missing.
- `FX-026`: lint baseline and product metadata cleanup are still open.
- `FX-016`: a second real adapter is still required to close the MVP "2 adapters" gap.

## References

- [Using GPT-5.5](https://developers.openai.com/api/docs/guides/latest-model)
- [Codex config reference](https://developers.openai.com/codex/config-reference)
- [Agent approvals & security](https://developers.openai.com/codex/agent-approvals-security#sandbox-and-approvals)
