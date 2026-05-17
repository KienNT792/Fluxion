# Flow-Owned Context ADR

## Problem

Fluxion already persists workflow execution evidence in several durable forms:

- run state in `.fluxion/runs/<runId>.json`
- workflow trace in `.fluxion/runs/<runId>.trace.jsonl`
- node outputs and memory files in `.fluxion/memory/**/*.md`
- workspace or project context in `.fluxion/context.json`

That is sufficient for the current local Codex CLI runtime, but it does not yet give Fluxion a durable context contract that is owned by the workflow run itself. Today, node context is primarily compiled as prompt text, then sent to a process-per-node runner. This makes it harder to reason about:

- which exact context version a node read
- which output should become durable downstream context
- how review and retry interact with context commits
- how optional provider state should be referenced without shifting Fluxion away from its local Codex CLI default runtime

Before adding new schema, storage, or execution behavior, Fluxion needs a frozen architecture decision for flow-owned context so Sprint 5 through Sprint 7 can implement against the same terms and invariants.

## Status

Status as of 2026-05-17:

- `FX-WO-018` prompt layout guard is implemented.
- `FX-WO-019` per-node `ContextSnapshot` creation is implemented.
- `FX-WO-020` commit-safe `ContextDelta` lifecycle is implemented.
- `FX-WO-021` parallel merge policy is implemented.
- The next backend context item is `FX-WO-022` context lifecycle trace evaluator rules.

## Repository Evidence

- `src/core/runs/run-state.types.ts` and `src/core/schema/run-state.schema.ts` persist `runId`, `workflowId`, workflow status, per-node status, and the additive optional `flowContextId`.
- `src/core/runs/workflow-trace.types.ts` and `src/core/schema/workflow-trace.schema.ts` persist `runId`, optional `flowContextId`, `workflowId`, `nodeId`, `type`, `timestamp`, and optional `data`.
- `src/main/services/workflow-engine.ts` initializes run state, emits trace events correlated by `runId` and `flowContextId`, compiles prompt input from memory context, builds a per-node `ContextSnapshot`, and commits `ContextDelta` only after commit-safe states.
- `src/main/services/workflow-engine.ts` now builds provider-specific `ExecutionPrompt` layouts: Codex keeps the legacy flat prompt shape, while OpenAI uses `instructions + input` with a debug `text` flattening.
- `src/main/services/workflow-engine.ts` already supports paused review hydration from persisted run state, which shows that workflow-level state can be durable across app restarts even when in-memory runtime state is gone.
- `src/main/adapters/base.adapter.ts` defines adapter execution in terms of `ExecutionPrompt` plus final `AgentResult`; snapshot/delta contracts remain engine-side and do not leak into IPC or renderer contracts.
- `src/shared/agent.types.ts` already exposes `runnerSessionId` and process telemetry in `AgentResult`, which is a suitable baseline for future `providerState` references.
- `src/main/services/flow-context-store.ts` persists run-local flow context, supports idempotent `commitDelta(...)` replay by `idempotencyKey`, and recomputes `latestSnapshot.hash` on real commits.
- `src/main/adapters/openai.adapter.ts` currently calls the Responses API with `store: false`, optional `instructions`, and `input`; it does not yet persist `previous_response_id`, `conversationId`, or other continuation state.

## Decision

Fluxion adopts a flow-owned context model.

The workflow run owns durable execution context. Nodes do not own context and do not mutate shared runtime state directly. Instead:

1. the engine builds an immutable `ContextSnapshot`
2. the node executes against that snapshot
3. the node returns a `ContextDelta`
4. the engine commits that delta only after a commit-safe state

Phase 1 decisions:

- `flowContextId` is the durable identity for context associated with a workflow run.
- Phase 1 sets `flowContextId = runId`.
- `.fluxion/context.json` remains workspace or project context and is not replaced by flow context.
- The phase 1 storage path is `.fluxion/runs/<runId>.context.json`.
- Future extraction to `.fluxion/contexts/<flowContextId>.json` remains open once the contract is stable.
- Fluxion remains Windows-first and process-per-node.
- Codex CLI remains the default runtime path.
- OpenAI Responses is an optional provider-state path, not the main execution path.
- `providerState` stores only minimal provider references and usage metadata that Fluxion needs for continuation, audit, or debugging. It must never store raw secrets, auth headers, or API keys.

## Contract Definitions

### `flowContextId`

`flowContextId` is the durable identity that ties together run state, trace, memory references, artifact references, and optional provider state for one workflow run.

Phase 1 rules:

- every new run receives a `flowContextId`
- the initial value equals `runId`
- older run files that do not contain `flowContextId` must resolve it lazily as `runId`
- `flowContextId` is additive and does not replace `runId`

### `ContextSnapshot`

`ContextSnapshot` is the immutable context package a node reads before execution.

Required fields for the phase 1 contract:

- `schemaVersion`
- `flowContextId`
- `runId`
- `workflowId`
- `version`
- `createdAt`
- `memorySourceRefs`
- `artifactRefs`
- `runStateRef`
- `providerState`
- `semanticSummary`
- `hash`

Contract rules:

- `memorySourceRefs` contains ordered references to memory or node output sources, not embedded secret material.
- `artifactRefs` contains durable artifact references and validation-relevant metadata.
- `runStateRef` points back to the persisted run-state document rather than duplicating the full run state.
- `providerState` contains provider-owned references such as `runnerSessionId`, `responseId`, or `conversationId` when applicable.
- `semanticSummary` is a compact Fluxion-owned summary field, not a replacement for raw artifacts or full transcripts.
- `hash` is calculated from the snapshot payload used for execution so trace and evaluator tooling can compare versions deterministically.

### `ContextDelta`

`ContextDelta` is the durable change proposal produced by a node execution attempt. It is not committed automatically just because a process exits.

Required fields for the phase 1 contract:

- `schemaVersion`
- `flowContextId`
- `runId`
- `workflowId`
- `nodeId`
- `attempt`
- `createdAt`
- `baseSnapshotVersion`
- `baseSnapshotHash`
- `idempotencyKey`
- `memoryRefsAdded`
- `artifactRefsAddedOrValidated`
- `runStateUpdates`
- `providerStateUpdates`
- `semanticSummaryUpdate`
- `redaction`
- optional `conflictMarkers`

Contract rules:

- `idempotencyKey` makes it safe to replay or de-duplicate a commit attempt.
- `baseSnapshotVersion` and `baseSnapshotHash` record the context snapshot the node executed against so stale parallel commits can be merged or rejected deterministically.
- `memoryRefsAdded` and `artifactRefsAddedOrValidated` are additive references to persisted outputs or validated artifacts.
- `runStateUpdates` carries only the minimal context-relevant run-state linkage needed by the context store. It does not replace the main run-state document.
- `providerStateUpdates` stores only provider references or usage metadata, never raw credentials or authorization material.
- `semanticSummaryUpdate` is optional and may be withheld for review-gated or failed paths.
- `redaction` records what was removed or replaced before persistence.
- `conflictMarkers` are optional phase 1 placeholders for deterministic merge or rejection logic in later work.

### `ContextCommitResult`

`ContextCommitResult` is the engine-side record of whether a delta actually became part of durable flow context.

Required fields for the phase 1 contract:

- `flowContextId`
- `version`
- `committed`
- `commitState`
- `deltaIdempotencyKey`
- optional `conflictPath`
- optional `conflictKind`
- optional `conflictReason`

Contract rules:

- `version` is the post-commit context version when `committed` is true.
- When `committed` is false, `version` is the current context version and the delta is not written.
- `commitState` records which safe lifecycle state authorized the commit.
- `conflictPath`, `conflictKind`, and `conflictReason` are only populated when a delta is rejected or deferred because of a deterministic merge rule.

### `providerState`

`providerState` is a Fluxion-owned container for provider-specific references that need to survive beyond a single in-memory process.

Phase 1 rules:

- Codex CLI may leave `providerState` empty or store runner sessions under `codex.runnerSessionsByNode.<nodeId>`.
- OpenAI provider work may later store `responseId`, `conversationId`, usage, or cached-token references when available.
- provider state is always subordinate to Fluxion-owned context, run state, trace, and artifacts.
- provider state must never become the only source of truth for workflow recovery.

### Commit-safe states

The engine may only commit a `ContextDelta` after a commit-safe state.

| Node lifecycle state | Commit behavior | Notes |
| --- | --- | --- |
| `completed` | Commit full success delta. | Output, artifact validation, provider references, and semantic updates may become durable downstream context. |
| `awaiting_review` | Commit review evidence only when needed. Do not commit final semantic state. | Reviewable evidence may persist, but downstream nodes must not treat the attempt as approved final context. |
| `review_approved` | Commit the final delta for the approved attempt. | This is the point where review-gated semantic state may become durable. |
| `failed` | Do not commit success delta. | Trace and failure evidence remain durable outside the success context path. |
| `aborted` | Do not commit success delta. | Abort evidence is traceable, but no success context is promoted. |
| `rejected` | Do not commit success delta. | A rejected review must not unblock downstream context. |

## Non-goals

This ADR does not introduce:

- shared shell state across nodes
- shared runspace or terminal reuse across nodes
- preservation of `cwd`, mutable environment variables, or background jobs between node executions
- renderer, preload, or IPC contract changes
- a replacement for `.fluxion/context.json`
- an OpenAI-first runtime model
- a database-backed memory or context store

## Compatibility

Phase 1 context work must preserve the current workspace contracts:

- `.fluxion/context.json`
- `.fluxion/workflows/*.fluxion.json`
- `.fluxion/workflow.json`
- `.fluxion/memory/**/*.md`
- `.fluxion/runs/<runId>.json`
- `.fluxion/runs/<runId>.trace.jsonl`

Compatibility requirements:

- any new flow-context data is additive
- existing run files remain readable when `flowContextId` is absent
- existing trace files remain readable even before flow-context correlation lands
- the Codex CLI runtime path keeps its current behavior until follow-up items explicitly change it
- renderer and preload contracts stay unchanged in this ADR

## Migration Path

Phase 1 migration:

1. add `flowContextId` as an optional run-state and trace correlation field
2. default new runs to `flowContextId = runId`
3. read older runs with a lazy fallback that resolves missing `flowContextId` to `runId`
4. create `.fluxion/runs/<runId>.context.json` as a sidecar store rather than replacing run-state or memory files

Future migration path:

- once the context store is stable, `flowContextId` may diverge from `runId`
- if that happens, `.fluxion/contexts/<flowContextId>.json` may become the durable storage path while preserving compatibility readers for the run-local sidecar
- no migration in this ADR changes `.fluxion/context.json`, because workspace context and flow-owned context solve different problems

## Rollback

FX-WO-014 is doc-only and introduces no runtime migration by itself.

When later items land, rollback must remain simple:

- if the new context store is disabled or deferred, workflow execution still relies on the existing run-state JSON, trace JSONL, and memory markdown files
- the new context store must remain a sidecar until it proves reliable
- failure to read or write a future context sidecar must not erase or invalidate existing run-state, trace, or memory evidence
- no later phase should require provider state as the sole recovery path

## Implementation Phases

### Phase 1: identity, storage, and contract baseline

- `FX-WO-015` add `flowContextId` to run state and trace [DONE]
- `FX-WO-016` add append-only flow context store [DONE]
- `FX-WO-017` define `ContextSnapshot` and `ContextDelta` contracts in code [DONE]
- `FX-WO-018` add prompt layout guard for cache-friendly providers [DONE]

### Phase 2: execution lifecycle and deterministic context commits

- `FX-WO-019` build per-node `ContextSnapshot` before execution [DONE]
- `FX-WO-020` commit `ContextDelta` only after commit-safe node states [DONE]
- `FX-WO-021` add parallel merge policy for context deltas [DONE]
- `FX-WO-022` extend trace evaluator for context lifecycle

### Phase 3: provider-state integration

- `FX-WO-023` add provider-state aware adapter result

## Backlog Links

The following backlog items implement this ADR in dependency order:

- [`FX-WO-015` add `flowContextId` to run state and trace](../backlog/workflow-optimization-sprint.md#fx-wo-015-add-flowcontextid-to-run-state-and-trace-done)
- [`FX-WO-016` add append-only flow context store](../backlog/workflow-optimization-sprint.md#fx-wo-016-add-append-only-flow-context-store-done)
- [`FX-WO-017` define `ContextSnapshot` and `ContextDelta` contracts](../backlog/workflow-optimization-sprint.md#fx-wo-017-define-contextsnapshot-and-contextdelta-contracts-done)
- [`FX-WO-018` add prompt layout guard for cache-friendly providers](../backlog/workflow-optimization-sprint.md#fx-wo-018-add-prompt-layout-guard-for-cache-friendly-providers-done)
- [`FX-WO-019` build per-node `ContextSnapshot` before execution](../backlog/workflow-optimization-sprint.md#fx-wo-019-build-per-node-contextsnapshot-before-execution-done)
- [`FX-WO-020` commit `ContextDelta` only after commit-safe node states](../backlog/workflow-optimization-sprint.md#fx-wo-020-commit-contextdelta-only-after-commit-safe-node-states-done)
- [`FX-WO-021` add parallel merge policy for context deltas](../backlog/workflow-optimization-sprint.md#fx-wo-021-add-parallel-merge-policy-for-context-deltas-done)
- [`FX-WO-022` extend trace evaluator for context lifecycle](../backlog/workflow-optimization-sprint.md#fx-wo-022-extend-trace-evaluator-for-context-lifecycle-ready)
- [`FX-WO-023` add provider-state aware adapter result](../backlog/workflow-optimization-sprint.md#fx-wo-023-add-provider-state-aware-adapter-result-discovery)

Code-facing additions completed by `FX-WO-015` through `FX-WO-021`:

- `WorkflowRunState.flowContextId`
- trace correlation by both `runId` and `flowContextId`
- run-local `.fluxion/runs/<runId>.context.json` sidecar initialization
- `FlowContextStore` create/read/reinitialize-existing behavior
- `FlowContextStore.commitDelta(...)` with idempotent replay and stable snapshot hashing
- `FlowContextDocument`, `ContextSnapshot`, `ContextDelta`, and `ContextCommitResult` types and schemas
- provider-specific `ExecutionPrompt` layout with Codex compatibility preserved
- per-node snapshot creation plus `node.context_snapshot_created`
- commit-safe delta lifecycle plus `node.context_delta_committed`
- review evidence commit on `awaiting_review`, final commit on `completed` and `review_approved`
- secret-like field rejection plus safe secret reference fields for flow-context payloads
- `ContextDelta.baseSnapshotVersion` and `ContextDelta.baseSnapshotHash`
- deterministic additive merge for memory/artifact refs
- deterministic provider-state and semantic-summary conflict rejection
- `node.context_delta_conflicted` trace event
- `contextWriter` ready-batch serialization

Remaining follow-up additions:

- `FX-WO-022` trace evaluator rules for context lifecycle
- `FX-WO-023` provider-state aware adapter result
