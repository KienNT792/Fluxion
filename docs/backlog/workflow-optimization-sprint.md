# Workflow Optimization Backlog and Sprint Plan

Date: 2026-05-10
Last updated: 2026-05-15
Source checkpoint: `docs/runtime/agent-workflow-memory-checkpoint.md`
Workspace: `D:\codex-workflow\Fluxion`

## Purpose

Backlog nay gom cac viec can lam de toi uu Fluxion workflow runtime theo huong:

1. Node nao chay cung co bang chung runtime ro rang.
2. Workflow memory co provenance, khong chi la output markdown noi tiep.
3. Process Codex CLI co telemetry toi thieu de debug treo/cham/ngon RAM.
4. Review, retry, abort, va artifact gates co trace du de kiem tra lai.
5. Workflow co nen tang eval lap lai duoc, bat dau bang deterministic graders.
6. Flow la don vi so huu context; node chi la operation nhan context snapshot va tra context delta.

Pham vi nay khong doi runtime chinh cua Fluxion. Runtime chinh van la local Codex CLI qua `codex exec`.

## Sprint Theme

Runtime evidence before deeper autonomy.

Fluxion da co DAG execution, artifact gates, run-state persistence, terminal stream, va review gates. Sprint toi uu workflow nen tap trung vao viec lam moi node/run co the audit, evaluate, va recover tot hon truoc khi them routing, loop nodes, hay agent autonomy phuc tap.

Update 2026-05-15: Sau phan tich flow context, sprint line nay duoc mo rong tu "runtime evidence" sang "runtime evidence + flow-owned context". Huong dung la khong gan context vao node process. Flow/run giu `flowContextId` hoac `sessionId`; node nhan snapshot bat bien va tra delta co contract ro. Memory, artifact, va run-state la co che persist context. Codex CLI van la runtime chinh; OpenAI Responses state chi la provider-state optional cho cac workflow dung OpenAI adapter.

## Architecture Decision Update - Flow-Owned Context

Decision:

- Adopt `flowContextId` as the durable context identity for each workflow run.
- Phase 1 uses `flowContextId = runId` to avoid a broad migration and keep `.fluxion/runs/<runId>.json` compatibility.
- Keep `.fluxion/context.json` as workspace/project context. Do not replace it with flow context.
- Persist flow context as structured state built from:
  - memory: global/long-term memory and short-term node outputs with provenance.
  - artifacts: files produced/required by nodes, with validation status.
  - run-state: node status, attempts, review state, runner/session references, provider state.
- Node execution contract becomes:
  - input: `ContextSnapshot` plus node/workflow metadata.
  - output: runner result plus `ContextDelta`.
  - commit: delta is appended only after the node reaches a commit-safe state.
- Codex CLI path remains process-per-node for now. This update does not create a shared terminal, runspace, or shell worker.
- OpenAI Responses integration, when enabled, maps a flow to either a conversation id or a `previous_response_id` chain. Use compaction for long flows and `prompt_cache_key` for stable prompt prefixes.

Recommended first implementation:

- Do not run a big-bang rewrite.
- Add context identity, store, trace events, and tests first.
- Add snapshot/delta lifecycle after the store is stable.
- Add OpenAI Responses provider state after the Fluxion-owned context contract is reliable.

Estimate:

| Scope | Effort | Confidence | Risk |
| --- | ---: | --- | --- |
| Contract/ADR and schema spike | 2-4 days | Medium | Low |
| Flow context id + append-only store + trace events | 5-8 days | Medium | Medium |
| Engine snapshot/delta lifecycle | 8-14 days | Low-Medium | High |
| Provider state and prompt layout changes | 5-10 days | Medium | Medium-High |
| UI/debug/rollback hardening | 6-12 days | Medium | Medium |

MVP estimate: 4-6 weeks for one engineer. Robust version with merge policy, UI inspector, provider metrics, and rollback hardening: 7-10 weeks.

Go/no-go:

- Go for Phase 0-2 if Fluxion needs reliable multi-node context, better auditability, or OpenAI Responses readiness.
- Do not start full provider-state or UI-heavy work until flow context store and delta lifecycle tests pass.
- If the only goal is preserving shell state such as `cwd`, env vars, imported modules, or background jobs across nodes, defer this work and design a separate shared shell/session backend.

## Priority Legend

- `P0`: Bat buoc de workflow runtime co the tin cay hon.
- `P1`: Core workflow optimization, nen lam trong 1-2 sprint tiep theo.
- `P2`: Nen lam sau khi trace/telemetry/memory provenance da on dinh.
- `P3`: Future extension.

## Status Legend

- `[READY]`: Co the bat dau implement voi scope ro.
- `[DISCOVERY]`: Can doc code/design them truoc khi code.
- `[BLOCKED]`: Can item khac xong truoc.
- `[DEFERRED]`: Khong nam trong sprint gan.

## Sprint Goal

Trong sprint dau tien, Fluxion can co structured runtime trace va process telemetry toi thieu cho moi node Codex CLI run, dong thoi khong pha vo `.fluxion/` contracts hien tai.

Ket qua mong muon:

- Moi run tao duoc trace JSONL append-only.
- Moi node trace duoc context compile, process spawn, process exit, artifact validation, output save, review events.
- Process event co PID, duration, stdout/stderr byte count, exit code, abort reason.
- Existing terminal stream, output markdown, run-state JSON van hoat dong nhu cu.
- Main-process tests cover trace writer va engine integration path.

## Proposed Sprint 1 - Runtime Evidence Foundation

### FX-WO-001 Add structured runtime trace writer [DONE]

Priority: `P0`

Outcome: Moi workflow run co trace append-only de debug va lam input cho eval sau nay.

Deliverable:

- Them trace writer service trong `src/main/services`.
- Ghi `.fluxion/runs/<runId>.trace.jsonl`.
- Moi event la mot JSON object tren mot dong.
- Ghi atomic/append-safe theo Windows-friendly path handling.

Candidate event shape:

```json
{
  "schemaVersion": 1,
  "runId": "run-id",
  "workflowId": "workflow-id",
  "nodeId": "node-id",
  "type": "node.process_spawned",
  "timestamp": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Acceptance:

- [x] Trace file duoc tao khi workflow start.
- [x] Event `workflow.started` va `workflow.completed` duoc ghi cho happy path.
- [x] Event co schema validation test.
- [x] Trace writer khong lam workflow fail neu append loi; loi trace duoc log warning.
- [x] Path duoc build bang `path.join()`.

Files likely touched:

- `src/main/services/workflow-trace-store.ts`
- `src/core/schema/workflow-trace.schema.ts`
- `src/core/runs/workflow-trace.types.ts`
- `src/main/test/workflow-trace-store.test.ts`

### FX-WO-002 Instrument WorkflowEngine with trace events [DONE]

Priority: `P0`

Outcome: Engine ghi lai lifecycle quan trong cua workflow va node.

Deliverable:

- Inject trace store vao `WorkflowEngine`.
- Emit events o cac boundary hien co:
  - `workflow.started`
  - `node.ready`
  - `node.requires_validated`
  - `node.produces_snapshot`
  - `node.running`
  - `node.context_compiled`
  - `node.execution_started`
  - `node.execution_completed`
  - `node.produces_validated`
  - `node.output_saved`
  - `node.review_requested`
  - `node.review_approved`
  - `node.review_rejected`
  - `node.rerun_requested`
  - `node.failed`
  - `node.aborted`
  - `workflow.completed`

Acceptance:

- [x] Simple A -> B workflow trace co dung thu tu event.
- [x] Parallel nodes trace duoc ca hai `node.running`.
- [x] Failed node trace co `node.failed` va workflow `failed`.
- [x] Review node trace co `review_requested`, approve thi co `review_approved`.
- [x] Existing workflow-engine tests van pass sau khi mock/inject trace dependency.

Files likely touched:

- `src/main/services/workflow-engine.ts`
- `src/main/test/workflow-engine.test.ts`
- `src/main/services/workflow-trace-store.ts`

### FX-WO-003 Add Codex process telemetry counters [DONE]

Priority: `P0`

Outcome: Moi node Codex process co telemetry toi thieu de debug slow/hung/noisy runs.

Deliverable:

- Track process metadata trong `CodexCliRunner` va/hoac `ProcessManager`.
- Dem stdout/stderr bytes.
- Record PID, display command, startedAt, completedAt, durationMs, exitCode, aborted.
- Emit telemetry trong final runner result hoac structured event callback.

Acceptance:

- [x] Successful Codex runner result exposes process telemetry.
- [x] Failed spawn co error telemetry toi thieu va exit code.
- [x] Abort path ghi aborted=true va abort reason khi co.
- [x] Tests cover stdout/stderr byte counters.
- [x] Khong dua process management logic vao renderer.

Files likely touched:

- `src/core/runner/runner.types.ts`
- `src/shared/agent.types.ts`
- `src/main/runners/codex-cli-runner.ts`
- `src/main/services/process-manager.ts`
- `src/main/test/codex-cli-runner.test.ts`

### FX-WO-004 Persist process telemetry into run state or trace [DONE]

Priority: `P1`

Outcome: Telemetry khong mat sau khi workflow xong.

Recommended decision:

- Trace is the primary home for detailed process telemetry.
- Run state keeps only stable summary fields if needed.

Deliverable:

- Add `node.process_spawned` with PID/display command.
- Add `node.process_exited` with duration, exitCode, stdoutBytes, stderrBytes, aborted.
- Avoid changing `.fluxion/runs/<runId>.json` unless a UI feature requires it.

Acceptance:

- [x] Trace co PID khi process spawn thanh cong.
- [x] Trace co durationMs va byte counts khi process close.
- [x] Abort workflow co process exit/abort trace.
- [x] Existing run-state schema compatibility duoc giu.

Files likely touched:

- `src/main/runners/codex-cli-runner.ts`
- `src/main/services/workflow-engine.ts`
- `src/main/services/workflow-trace-store.ts`

### FX-WO-005 Add trace smoke assertions to tests [DONE]

Priority: `P1`

Outcome: Trace khong chi duoc tao, ma co event can thiet trong cac lifecycle quan trong.

Deliverable:

- Helper doc trace JSONL trong test.
- Add assertions vao workflow-engine tests:
  - happy path
  - parallel nodes
  - missing required artifact
  - produced artifact missing
  - human review approve
  - manual mode review
  - abort

Acceptance:

- [x] Tests verify event type order for A -> B.
- [x] Tests verify failed node emits failure event before workflow completed.
- [x] Tests verify review pause does not emit workflow completed until approve/reject.

Files likely touched:

- `src/main/test/workflow-engine.test.ts`
- `src/main/test/workflow-trace-store.test.ts`

## Proposed Sprint 2 - Provenance, Lineage, and Trace Eval Baseline

Sprint 2 goal:

Sau Sprint 1, Fluxion da co structured runtime trace va process telemetry. Sprint 2 nen bien trace do thanh nen tang audit/eval co ich hon bang cach lam ro context provenance, giu output lineage qua rerun/retry, va them local deterministic trace evaluator toi thieu.

Ket qua mong muon:

- Moi `node.context_compiled` trace co source list, hash, byte/char count.
- Upstream output va global/long-term context duoc source-labeled khi inject vao node.
- Review/rerun attempt cu khong bi mat evidence, trong khi latest output path van tuong thich nguoc.
- Trace evaluator doc duoc `.fluxion/runs/<runId>.trace.jsonl` va tra pass/fail deterministic.
- Trace write failures va process record lifecycle co diagnostic/hardening toi thieu.
- Existing `.fluxion/runs/<runId>.json`, IPC renderer/preload, va UI trace viewer khong nam trong scope.

### S2-000 Sprint 1 checkpoint and backlog hygiene [DONE]

Priority: `P1`

Outcome: Sprint 2 bat dau tren backlog/checkpoint dung voi hien trang Sprint 1.

Deliverable:

- Update `docs/runtime/agent-workflow-memory-checkpoint.md` voi actual trace schema/event names.
- Update `docs/backlog/fluxion-master-backlog.md` neu cac `FX-WO-*` da duoc chap nhan vao master backlog.
- Add runtime smoke checklist step de inspect trace file.
- Chuyen `FX-WO-009` tu blocked sang READY vi `FX-WO-001` va `FX-WO-002` da DONE.

Acceptance:

- [x] Checkpoint doc reflect actual trace schema version and event names.
- [x] Backlog khong con mark `FX-WO-009` blocked by completed work.
- [x] Runtime smoke checklist co buoc inspect `.trace.jsonl`.
- [x] Khong thay doi runtime behavior.

### FX-WO-006 Add memory source report for compiled context [DONE]

Priority: `P1`

Outcome: Moi node biet context den tu dau, khong chi co string compiledContext.

Deliverable:

- Extend `MemoryManager.compileContext` hoac add method moi tra ve:
  - compiled context
  - context sources
  - compiled context hash
  - byte/char length
- Emit trace `node.context_compiled` voi sources va hash.

Acceptance:

- [x] Global context source duoc listed.
- [x] Upstream node output source duoc listed voi nodeId/path.
- [x] Missing optional long-term source khong fail.
- [x] Context hash stable cho cung content.
- [x] Existing `MEMORY_CONTEXT_READY` IPC van hoat dong.

Files likely touched:

- `src/main/services/memory-manager.ts`
- `src/main/services/workflow-engine.ts`
- `src/main/test/memory-manager.test.ts`

### FX-WO-007 Preserve output lineage across attempts [DONE]

Priority: `P1`

Outcome: Retry/rerun khong xoa het evidence cua attempt truoc.

Problem:

Current short-term output path is `.fluxion/memory/short-term/<workflowId>/<nodeId>.md`, so latest attempt overwrites prior output.

Candidate design:

- Keep latest path for compatibility.
- Add attempt history under:

```text
.fluxion/memory/short-term/<workflowId>/<runId>/<nodeId>-attempt-<n>.md
```

or:

```text
.fluxion/memory/short-term/<workflowId>/.history/<runId>/<nodeId>/<attempt>.md
```

Acceptance:

- [x] Existing latest path remains available to downstream context.
- [x] Attempt history file is written for every completed/paused attempt.
- [x] Review rerun keeps previous output available.
- [x] UI can still preview latest output without changes.
- [x] Trace/run evidence can identify which attempt produced which output file.

Files likely touched:

- `src/main/services/memory-manager.ts`
- `src/main/services/workflow-engine.ts`
- `src/main/test/workflow-engine.test.ts`
- `src/main/test/memory-manager.test.ts`

### FX-WO-009 Add local workflow trace evaluator [DONE]

Priority: `P2`

Outcome: Co the score mot run trace bang deterministic checks.

Deliverable:

- Script doc `.fluxion/runs/<runId>.trace.jsonl`.
- Run graders deterministic:
  - required event presence
  - workflow start/end consistency
  - node start/end consistency
  - failed node halts downstream
  - review requested before approve/reject
  - produced artifacts validated before output saved

Candidate command:

```powershell
npm run eval:workflow -- --workspace <path> --run <runId>
```

Acceptance:

- [x] Eval returns pass/fail plus JSON summary.
- [x] Bad/missing event order is reported with runId/nodeId.
- [x] Script works on Windows PowerShell.
- [x] No model call required.

Files likely touched:

- `scripts/eval/workflow-trace-eval.mjs`
- `package.json`
- `src/core/test` or script tests if pattern exists

### FX-WO-013 Trace health diagnostics and process cleanup hardening [DONE]

Priority: `P1`

Outcome: Trace/process evidence khong bi im lang hong trong long-running desktop session.

Problem:

- `WorkflowTraceStore.append` hien warn va degrade dung huong, nhung warning chua du diagnostic context de debug nhanh.
- `ProcessManager` marks completed/error records but can keep them in memory until `killAll()`.

Deliverable:

- Keep trace append failure non-fatal.
- Make trace append warnings include useful context such as runId/type/trace path.
- Add or update tests to keep trace append failure behavior non-fatal.
- Cleanup completed/error process records, or add bounded cleanup path, without breaking active process concurrency checks.

Acceptance:

- [x] Trace append failure still does not fail workflow execution.
- [x] Trace warning includes enough run/path/event context for diagnosis.
- [x] Completed/error process records do not accumulate indefinitely in normal runs.
- [x] Abort and `killAll()` behavior remain Windows-safe.

Files likely touched:

- `src/main/services/workflow-trace-store.ts`
- `src/main/services/process-manager.ts`
- `src/main/test/workflow-trace-store.test.ts`
- `src/main/test/codex-cli-runner.test.ts`

## Proposed Sprint 3 - Memory Index and Manual Eval Assets

### FX-WO-008 Add memory index schema [DONE]

Priority: `P2`

Outcome: Fluxion co structured index cho raw output, summaries, decisions, facts, procedures.

Deliverable:

- Add `.fluxion/memory/index.json`.
- Schema-versioned entries.
- Support at least `raw_output` entries created from node output.

Acceptance:

- [x] Index initialized on workspace memory init.
- [x] Node output save can append/update memory index entry.
- [x] Entries include workflowId, runId, nodeId, sourcePath, type, createdAt.
- [x] Invalid index file degrades safely with clear warning.

Files likely touched:

- `src/main/services/memory-manager.ts`
- `src/core/schema/memory-index.schema.ts`
- `src/shared/memory.types.ts`

### FX-WO-010 Add node rubric markdown template [READY]

Priority: `P2`

Outcome: Reviewer co template de cham diem node agent theo checkpoint rubric.

Deliverable:

- Add `docs/qa/node-agent-evaluation-template.md`.
- Include 0-5 rubric for contract, input, context, tools, output, safety, retry, observability, resource, memory, eval readiness.

Acceptance:

- [ ] Template dung duoc cho manual review.
- [ ] Template link ve checkpoint source.
- [ ] Template co section "Evidence" de paste trace/run/output refs.

## Proposed Sprint 4 - Review Recovery and Memory Safety

### FX-WO-011 Design paused review recovery after app restart [DISCOVERY]

Priority: `P1`

Outcome: Review checkpoint khong bi mat neu app restart trong luc awaiting review.

Problem:

`WorkflowEngine.requireReviewRuntime` currently depends on active in-memory runtime. Paused review recovery after restart is not implemented.

Deliverable:

- Design doc cho resume paused review from persisted run state.
- Decide whether engine can reconstruct runtime from workflow + run state.
- Define UI behavior when workspace loads with `.fluxion/runs` awaiting review.

Acceptance:

- [ ] Doc explains current limitation.
- [ ] Proposed state machine covers approve, reject, rerun, abort after restart.
- [ ] Backward compatibility with existing run files is preserved.

Files likely touched later:

- `src/main/services/workflow-engine.ts`
- `src/main/services/run-state-store.ts`
- `src/main/ipc/workflow.handlers.ts`
- `src/renderer/src/stores/execution.store.ts`

### FX-WO-012 Add memory promotion guardrails [READY]

Priority: `P3`

Outcome: Long-term memory is not an unreviewed dump.

Deliverable:

- Define promotion states: `raw`, `candidate`, `approved`, `rejected`, `superseded`.
- Only approved or deterministic summaries can be injected by default.
- Add provenance fields and optional TTL.

Acceptance:

- [ ] Memory entries have review/promotion status.
- [ ] Context compiler can filter by status.
- [ ] Trace records which memory entries were injected.

## Proposed Sprint 5 - Flow Context Foundation

Sprint 5 goal:

Them nen tang flow-owned context ma khong doi runtime mac dinh cua local Codex CLI runner. Sprint nay tap trung vao identity, storage, contract, va prompt layout guard; chua thay doi sau execution lifecycle cua moi node.

Ket qua mong muon:

- Moi run co `flowContextId`, mac dinh bang `runId`.
- Run state, trace, memory, artifact, va provider-state co the quy chieu ve cung mot flow context.
- Co context store append-only theo run, khong pha vo `.fluxion/runs/<runId>.json` va `.fluxion/context.json`.
- Co contract `ContextSnapshot` va `ContextDelta` ro rang o tang core/shared.
- Prompt assembly co duong mo cho provider can stable prefix cache, nhung Codex CLI van giu behavior mac dinh.
- Secrets khong duoc persist trong context snapshot hoac delta.

### FX-WO-014 Write flow context ADR and contracts [READY]

Priority: `P0`

Outcome: Team co mot quyet dinh kien truc ngan gon va contract du de implement nhat quan.

Deliverable:

- Add ADR trong `docs/runtime` hoac `docs/architecture` mo ta flow-owned context.
- Dinh nghia:
  - `flowContextId`
  - `ContextSnapshot`
  - `ContextDelta`
  - `providerState`
  - `commit-safe state`
- Ghi ro non-goal: sprint nay khong bao toan shared shell state, runspace, `cwd`, env vars, hay background process giua nodes.
- Ghi ro Codex CLI la runtime mac dinh; OpenAI Responses la provider path optional.

Acceptance:

- [ ] ADR neu ro vi sao flow so huu context va node chi la operation.
- [ ] ADR co migration path tu `flowContextId = runId` sang context id rieng neu can.
- [ ] ADR co rollback strategy de bo qua context store moi ma workflow cu van chay.
- [ ] ADR link den cac backlog item Sprint 5-7.

Files likely touched:

- `docs/runtime/flow-owned-context.md`
- `docs/backlog/workflow-optimization-sprint.md`

### FX-WO-015 Add flowContextId to run state and trace [READY]

Priority: `P0`

Outcome: Moi run co identity on dinh de lien ket run-state, trace, memory, artifact, va provider state.

Deliverable:

- Add optional `flowContextId` vao run-state schema/types.
- Khi tao run moi, set `flowContextId = runId`.
- Add `flowContextId` vao trace event envelope hoac event data cho `workflow.started`.
- Keep old run files readable when missing `flowContextId`.
- Add lazy fallback: neu run cu khong co `flowContextId` thi resolve bang `runId`.

Acceptance:

- [ ] New run state file contains `flowContextId`.
- [ ] Old run state without `flowContextId` still parses.
- [ ] Trace for new run can be correlated by `runId` va `flowContextId`.
- [ ] Tests cover schema compatibility and fallback behavior.
- [ ] Renderer contracts khong bi mo rong tru khi can cho debug/display.

Files likely touched:

- `src/core/runs/run-state.types.ts`
- `src/core/schema/run-state.schema.ts`
- `src/core/runs/workflow-trace.types.ts`
- `src/core/schema/workflow-trace.schema.ts`
- `src/main/services/run-state-store.ts`
- `src/main/services/workflow-trace-store.ts`
- `src/main/test/run-state-store.test.ts`
- `src/main/test/workflow-engine.test.ts`

### FX-WO-016 Add append-only flow context store [READY]

Priority: `P0`

Outcome: Fluxion co durable context packet rieng cho flow ma khong overload memory markdown hay run-state JSON.

Recommended decision:

- Phase 1 path: `.fluxion/runs/<runId>.context.json`.
- Future path neu can tach rieng: `.fluxion/contexts/<flowContextId>.json`.
- MVP store co the la mot JSON document versioned append-only; neu write volume tang thi co the doi sang JSONL sau.

Candidate context packet:

```json
{
  "schemaVersion": 1,
  "flowContextId": "run-id",
  "runId": "run-id",
  "workflowId": "workflow-id",
  "version": 3,
  "createdAt": "2026-05-15T00:00:00.000Z",
  "updatedAt": "2026-05-15T00:01:00.000Z",
  "latestSnapshot": {
    "memorySourceRefs": [],
    "artifactRefs": [],
    "runStateRef": ".fluxion/runs/run-id.json",
    "providerState": {},
    "semanticSummary": ""
  },
  "deltas": []
}
```

Acceptance:

- [ ] Context store initializes when workflow starts.
- [ ] Store write is Windows-safe and path-built with `path.join()`.
- [ ] Store write failure is traced and fails the run only when context commit is required for correctness.
- [ ] Existing memory output files and run state remain unchanged except for optional references.
- [ ] Tests cover create/read/update and invalid JSON recovery behavior.

Files likely touched:

- `src/main/services/flow-context-store.ts`
- `src/core/schema/flow-context.schema.ts`
- `src/core/runs/flow-context.types.ts`
- `src/main/test/flow-context-store.test.ts`

### FX-WO-017 Define ContextSnapshot and ContextDelta contracts [READY]

Priority: `P0`

Outcome: Node input/output context contract duoc versioned truoc khi engine behavior thay doi.

Deliverable:

- Add shared/core types for `ContextSnapshot`, `ContextDelta`, va `ContextCommitResult`.
- Delta supports:
  - memory refs added
  - artifact refs added or validated
  - run-state refs updated
  - provider state refs updated
  - semantic summary updates
  - redaction metadata
- Delta explicitly does not support raw secret values.
- Add schema tests for valid/invalid delta and idempotency.

Acceptance:

- [ ] Types are exported from the core/shared boundary where engine and adapters can use them.
- [ ] Delta has `schemaVersion`, `nodeId`, `attempt`, `createdAt`, and `idempotencyKey`.
- [ ] Schema rejects or redacts direct secret-like fields where practical.
- [ ] Tests cover additive delta and conflict marker shape.

Files likely touched:

- `src/core/runs/flow-context.types.ts`
- `src/core/schema/flow-context.schema.ts`
- `src/shared/workflow.types.ts` or a new shared context types file
- `src/core/test/flow-context.schema.test.ts`

### FX-WO-018 Add prompt layout guard for cache-friendly providers [READY]

Priority: `P1`

Outcome: Fluxion prompt building can support stable prefix caching without changing Codex CLI default behavior unexpectedly.

Problem:

`WorkflowEngine.buildPrompt()` currently places compiled context before node instructions. Provider paths such as OpenAI Responses benefit from stable content at the beginning and dynamic snapshot near the end. The Codex CLI path should not be reshaped without tests because prompt order can affect behavior.

Deliverable:

- Introduce prompt assembly abstraction or provider-specific prompt layout.
- Keep Codex CLI prompt compatible by default.
- Add OpenAI-oriented layout where static instructions/tool policy come first and dynamic snapshot comes last.
- Add tests that assert prompt section order for each provider path.

Acceptance:

- [ ] Codex CLI prompt output remains behavior-compatible or has explicit snapshot update.
- [ ] OpenAI prompt layout supports stable prefix then dynamic snapshot.
- [ ] Prompt builder tests cover both layouts.
- [ ] No OpenAI adapter runtime migration is required in Sprint 5.

Files likely touched:

- `src/main/services/workflow-engine.ts`
- `src/main/adapters/base.adapter.ts`
- `src/main/adapters/openai.adapter.ts`
- `src/main/test/workflow-engine.test.ts`

## Proposed Sprint 6 - Snapshot/Delta Execution Lifecycle

Sprint 6 goal:

Dung context store trong workflow execution path mot cach co kiem soat. Node nhan snapshot theo version, engine commit delta sau khi node thanh cong, va cac node song song khong ghi de context cua nhau.

Ket qua mong muon:

- Moi node doc `ContextSnapshot` tu flow context version ro rang.
- Delta chi duoc commit sau commit-safe states.
- Parallel DAG batch co merge policy ro, khong du vao "last write wins".
- Trace evaluator score duoc context lifecycle.

### FX-WO-019 Build per-node ContextSnapshot before execution [DISCOVERY]

Priority: `P0`

Outcome: Moi node execution co input context ro rang va traceable.

Deliverable:

- Before `node.execution_started`, load latest flow context version.
- Build `ContextSnapshot` from memory source report, artifact refs, run-state summary, and provider state.
- Emit trace event `node.context_snapshot_created`.
- Keep existing `node.context_compiled` IPC behavior for renderer.

Acceptance:

- [ ] Snapshot includes `flowContextId`, `version`, source refs, and hash.
- [ ] Trace records snapshot hash/version.
- [ ] A -> B workflow shows B snapshot includes A output ref after A commit.
- [ ] Parallel sibling nodes from the same parent can read the same snapshot version without mutation.

Files likely touched:

- `src/main/services/workflow-engine.ts`
- `src/main/services/flow-context-store.ts`
- `src/main/test/workflow-engine.test.ts`

### FX-WO-020 Commit ContextDelta only after commit-safe node states [DISCOVERY]

Priority: `P0`

Outcome: Retry, rerun, failed node, and review gate khong lam context bi commit sai.

Commit-safe states:

- completed node: commit output/artifact/provider delta.
- review-paused node: commit chi evidence can cho review, khong commit final semantic state.
- review-approved node: commit final delta.
- failed/aborted node: khong commit success delta; chi trace failure evidence.

Acceptance:

- [ ] Failed node output is not added as successful context memory.
- [ ] Review-pending node does not unblock downstream context as final.
- [ ] Rerun creates a new delta with a new idempotency key.
- [ ] Replaying commit for the same idempotency key is safe.

Files likely touched:

- `src/main/services/workflow-engine.ts`
- `src/main/services/flow-context-store.ts`
- `src/main/test/workflow-engine.test.ts`

### FX-WO-021 Add parallel merge policy for context deltas [DISCOVERY]

Priority: `P0`

Outcome: Parallel DAG batches khong tao race condition trong flow context.

Recommended phase-1 policy:

- Most deltas are additive and can merge automatically.
- Conflicting writes to the same provider-state key or semantic summary path are rejected or serialized.
- Nodes marked as `contextWriter` run serially until a richer merge policy exists.

Acceptance:

- [ ] Parallel sibling nodes can append distinct memory/artifact refs.
- [ ] Conflicting provider-state writes produce deterministic failure or retryable conflict.
- [ ] Trace records conflict reason with nodeId and context version.
- [ ] Tests cover successful parallel additive merge and conflict path.

Files likely touched:

- `src/main/services/workflow-engine.ts`
- `src/main/services/flow-context-store.ts`
- `src/core/schema/flow-context.schema.ts`
- `src/main/test/workflow-engine.test.ts`

### FX-WO-022 Extend trace evaluator for context lifecycle [READY]

Priority: `P1`

Outcome: Context behavior co deterministic eval, khong chi co lifecycle/process trace.

Deliverable:

- Extend local workflow trace evaluator to validate:
  - context store initialized before first node snapshot
  - snapshot version is not older than required upstream commit
  - delta commit occurs after node success/review approval
  - failed/aborted nodes do not emit success context commit
  - parallel conflict event is followed by deterministic node failure or retry

Acceptance:

- [ ] Eval reports context lifecycle pass/fail per run.
- [ ] Bad event order includes runId, flowContextId, nodeId, and version.
- [ ] Script stays model-free and Windows PowerShell friendly.

Files likely touched:

- `scripts/eval/workflow-trace-eval.mjs`
- `src/main/test/workflow-trace-eval.test.ts`

## Proposed Sprint 7 - Provider State and Context UX

Sprint 7 goal:

Sau khi Fluxion-owned context contract on dinh, them provider state optional cho OpenAI Responses va bo sung UI/debug toi thieu de operator hieu context nao da duoc dung.

Ket qua mong muon:

- Adapter result co duong tra provider-state delta ma khong pha Codex CLI path.
- OpenAI Responses co the map flow vao `previous_response_id` chain hoac conversation id khi provider do duoc chon.
- UI co toi thieu mot flow context inspector read-only.
- Context persistence co redaction policy cho secrets.

### FX-WO-023 Add provider-state aware adapter result [DISCOVERY]

Priority: `P1`

Outcome: Adapter co the tra provider references ma khong pha Codex CLI path.

Deliverable:

- Extend `IAgentAdapter` result with optional `providerStateDelta`.
- Codex CLI adapter can leave provider state empty or store `runnerSessionId` only.
- OpenAI adapter can return `responseId`, `conversationId`, usage, and cached-token metrics when available.

Acceptance:

- [ ] Existing fake adapter tests compile with optional provider state.
- [ ] Codex CLI adapter behavior remains unchanged.
- [ ] Provider state is stored only through context delta, not ad hoc files.

Files likely touched:

- `src/main/adapters/base.adapter.ts`
- `src/main/adapters/codex-cli.adapter.ts`
- `src/main/adapters/openai.adapter.ts`
- `src/shared/agent.types.ts`
- `src/main/test/workflow-engine.test.ts`

### FX-WO-024 Wire OpenAI Responses previous_response_id or conversation [DEFERRED]

Priority: `P1`

Outcome: OpenAI provider can continue a flow using official Responses state patterns when that provider is selected.

Recommended decision:

- MVP: prefer `previous_response_id` chain per flow unless the product explicitly needs durable OpenAI conversation objects.
- Keep `store: false` when privacy-leaning behavior is required.
- If using manual stateless chaining later, preserve returned output items needed for reasoning or compaction.
- Use `context_management` compaction for long-running flows.
- Use stable `prompt_cache_key` based on project/workflow/static prompt version, not raw user identity.

Acceptance:

- [ ] OpenAI request can include previous response id from flow context.
- [ ] Response id is persisted as provider state delta.
- [ ] `conversation` and `previous_response_id` are not used together.
- [ ] Compaction config is feature-flagged or provider-configured.
- [ ] Usage/cached-token metrics are traced when returned.

Files likely touched:

- `src/main/adapters/openai.adapter.ts`
- `src/main/services/provider-registry.service.ts`
- `src/main/services/settings.service.ts`
- `src/main/test/openai.adapter.test.ts`

### FX-WO-025 Add flow context inspector UI [DEFERRED]

Priority: `P2`

Outcome: Operator co the xem context version, snapshot sources, delta commits, va provider refs ma khong doc file bang tay.

Deliverable:

- Add read-only context panel hoac run details section.
- Display `flowContextId`, latest version, source counts, artifact refs, and provider refs.
- Do not expose secret values.
- Keep filesystem reads in main process and expose through preload IPC.

Acceptance:

- [ ] UI shows active run `flowContextId`.
- [ ] UI can display latest context version and last delta summary.
- [ ] Renderer does not read `.fluxion` files directly.
- [ ] Secret-like values are redacted in payload and UI.

Files likely touched:

- `src/shared/ipc.payloads.ts`
- `src/preload/index.ts`
- `src/main/ipc/workflow.handlers.ts`
- `src/renderer/src/stores/execution.store.ts`
- `src/renderer/src/features/*`

### FX-WO-026 Add context redaction and secret reference policy [READY]

Priority: `P0`

Outcome: Context persistence khong bien transcript/snapshot thanh noi chua secret.

Deliverable:

- Define denylist patterns for known secret field names.
- Persist secret references such as `ref://secret/...`, never raw values.
- Add redaction metadata to context delta.
- Add tests for env-like or token-like fields in deltas.

Acceptance:

- [ ] Context store rejects or redacts direct secret fields.
- [ ] Trace records redaction count, not secret values.
- [ ] Provider state does not persist API keys or auth headers.
- [ ] Tests cover common names: `apiKey`, `token`, `authorization`, `password`, `secret`.

Files likely touched:

- `src/main/services/flow-context-store.ts`
- `src/core/schema/flow-context.schema.ts`
- `src/core/test/flow-context.schema.test.ts`

## Backlog Summary

| Item | Priority | Status | Sprint |
| --- | --- | --- | --- |
| FX-WO-001 Structured runtime trace writer | P0 | DONE | 1 |
| FX-WO-002 Instrument WorkflowEngine trace events | P0 | DONE | 1 |
| FX-WO-003 Codex process telemetry counters | P0 | DONE | 1 |
| FX-WO-004 Persist process telemetry into trace | P1 | DONE | 1 |
| FX-WO-005 Trace smoke assertions | P1 | DONE | 1 |
| S2-000 Sprint 1 checkpoint/backlog hygiene | P1 | DONE | 2 |
| FX-WO-006 Memory source report | P1 | DONE | 2 |
| FX-WO-007 Output lineage across attempts | P1 | DONE | 2 |
| FX-WO-009 Local workflow trace evaluator | P2 | DONE | 2 |
| FX-WO-013 Trace health diagnostics and process cleanup | P1 | DONE | 2 |
| FX-WO-008 Memory index schema | P2 | DONE | 3 |
| FX-WO-010 Node rubric markdown template | P2 | READY | 3 |
| FX-WO-011 Paused review recovery design | P1 | DISCOVERY | 4 |
| FX-WO-012 Memory promotion guardrails | P3 | READY | 4 |
| FX-WO-014 Flow context ADR and contracts | P0 | READY | 5 |
| FX-WO-015 flowContextId in run state and trace | P0 | READY | 5 |
| FX-WO-016 Append-only flow context store | P0 | READY | 5 |
| FX-WO-017 ContextSnapshot and ContextDelta contracts | P0 | READY | 5 |
| FX-WO-018 Cache-friendly prompt layout guard | P1 | READY | 5 |
| FX-WO-019 Per-node ContextSnapshot lifecycle | P0 | DISCOVERY | 6 |
| FX-WO-020 Commit ContextDelta after safe states | P0 | DISCOVERY | 6 |
| FX-WO-021 Parallel delta merge policy | P0 | DISCOVERY | 6 |
| FX-WO-022 Context lifecycle trace evaluator | P1 | READY | 6 |
| FX-WO-023 Provider-state aware adapter result | P1 | DISCOVERY | 7 |
| FX-WO-024 OpenAI Responses state wiring | P1 | DEFERRED | 7 |
| FX-WO-025 Flow context inspector UI | P2 | DEFERRED | 7 |
| FX-WO-026 Context redaction and secret refs | P0 | READY | 7 |

## Suggested Sprint 1 Task Breakdown

### Day 1 - Trace schema and writer

- Define trace event types and schema.
- Implement `WorkflowTraceStore`.
- Add unit tests for append/read behavior.

### Day 2 - Engine instrumentation

- Inject trace dependency into workflow engine.
- Emit workflow/node lifecycle events.
- Update existing workflow-engine tests with trace fixture.

### Day 3 - Codex runner telemetry

- Extend runner result or event path with process telemetry.
- Count stdout/stderr bytes.
- Add PID/start/end/duration metadata.
- Cover success/failure/abort in tests.

### Day 4 - Trace integration

- Emit process spawn/exit events into trace.
- Ensure trace errors do not fail workflow execution.
- Verify happy path, failure, review, abort.

### Day 5 - Stabilization

- Run `npm run typecheck`.
- Run targeted tests:

```powershell
npm test -- src/main/test/workflow-engine.test.ts src/main/test/codex-cli-runner.test.ts
```

- Update checkpoint if trace event names or schema differ from this plan.

## Sprint 1 Definition of Done

- Trace file exists for completed, failed, aborted, and review-paused runs.
- Trace event schema is documented and tested.
- Process telemetry is available in trace for spawned Codex CLI nodes.
- No renderer process owns filesystem/process logic.
- Existing `.fluxion/runs/<runId>.json` behavior is preserved unless explicitly changed with tests.
- Typecheck passes.
- Relevant main-process tests pass.
- Any skipped verification is documented in the final implementation note.

## Suggested Sprint 2 Task Breakdown

### Day 0 - Checkpoint and backlog hygiene

- Complete `S2-000`.
- Update runtime checkpoint with actual trace schema and event names.
- Move `FX-WO-009` to READY in any related backlog source.
- Add runtime smoke checklist step for `.trace.jsonl` inspection.

### Day 1-2 - Context provenance

- Implement `FX-WO-006`.
- Return compiled context plus source report/hash/size from memory compilation.
- Emit source report in `node.context_compiled`.
- Preserve existing `MEMORY_CONTEXT_READY` IPC behavior.

### Day 3 - Attempt lineage

- Finish discovery decision for `FX-WO-007` attempt history path.
- Keep latest short-term output path stable for downstream context.
- Write sidecar/history output for each completed or review-paused attempt.
- Cover review rerun output history in tests.

### Day 4 - Local trace evaluator

- Implement `FX-WO-009` script and npm command.
- Check required event presence, start/end consistency, review order, artifact validation order, and downstream halt behavior.
- Return pass/fail plus JSON summary.

### Day 5 - Hardening and stabilization

- Implement `FX-WO-013`.
- Improve trace append diagnostic context while keeping trace writes non-fatal.
- Cleanup completed/error process records without breaking abort/killAll.
- Run targeted tests and `npm run typecheck`.

Suggested verification:

```powershell
npm test -- src/main/test/memory-manager.test.ts src/main/test/workflow-engine.test.ts src/main/test/workflow-trace-store.test.ts src/main/test/codex-cli-runner.test.ts src/main/test/process-manager.test.ts src/main/test/workflow-trace-eval.test.ts
npm run typecheck
```

## Sprint 2 Definition of Done

- `node.context_compiled` includes context sources, stable hash, and byte/char size.
- Global context, long-term context when present, and upstream outputs are source-labeled.
- Review/rerun attempt history exists without breaking latest output path compatibility.
- Local trace evaluator can score a saved run trace without model calls.
- Trace append failures remain non-fatal but include enough diagnostic context.
- Completed/error process records do not accumulate indefinitely in normal runs.
- Existing `.fluxion/runs/<runId>.json` shape is preserved.
- Typecheck and relevant main-process tests pass.
- Any skipped verification is documented in the final implementation note.

## Recommended Execution Order For Flow-Owned Context

Do not start Sprint 6 or 7 as a big-bang rewrite. The safe dependency order is:

1. `FX-WO-014` ADR and contracts.
2. `FX-WO-015` flow context identity in run state and trace.
3. `FX-WO-016` append-only context store.
4. `FX-WO-017` snapshot/delta schemas and tests.
5. `FX-WO-018` prompt layout guard.
6. `FX-WO-019` snapshot creation in engine.
7. `FX-WO-020` commit-safe delta lifecycle.
8. `FX-WO-021` parallel merge policy.
9. `FX-WO-022` trace evaluator extension.
10. `FX-WO-023` provider-state aware adapter result.
11. `FX-WO-024` OpenAI Responses state wiring.
12. `FX-WO-025` UI inspector after backend contracts are stable.
13. `FX-WO-026` redaction policy should ship no later than Sprint 7 and may start earlier if store work begins.

## Suggested Sprint 5 Task Breakdown

### Day 1 - ADR and schema spike

- Complete `FX-WO-014`.
- Confirm file locations and schema ownership in `src/core`, `src/shared`, and `src/main`.
- Freeze terms: `flowContextId`, snapshot, delta, providerState, commit-safe state.

### Day 2 - Identity and trace linkage

- Implement `FX-WO-015`.
- Add `flowContextId` fallback in run-state read path.
- Add trace correlation fields and tests.

### Day 3 - Context store foundation

- Implement `FX-WO-016`.
- Add store init/read/write/update path.
- Cover invalid JSON and recovery behavior.

### Day 4 - Snapshot/delta contracts

- Implement `FX-WO-017`.
- Add schema validation tests, idempotency key rules, and redaction-friendly shape.

### Day 5 - Prompt layout guard and stabilization

- Implement `FX-WO-018`.
- Verify Codex CLI prompt compatibility.
- Run targeted tests and `npm run typecheck`.

Suggested verification:

```powershell
npm test -- src/main/test/run-state-store.test.ts src/main/test/workflow-engine.test.ts src/main/test/workflow-trace-store.test.ts src/main/test/flow-context-store.test.ts src/core/test/flow-context.schema.test.ts
npm run typecheck
```

## Sprint 5 Definition of Done

- New runs receive `flowContextId`, defaulting to `runId`.
- Existing run files without `flowContextId` still load correctly.
- A context store file exists per new run and can be read back after workflow completion.
- `ContextSnapshot` and `ContextDelta` are schema-validated and versioned.
- Prompt layout abstraction exists without regressing Codex CLI default behavior.
- No secret values are intentionally written by the new context store contract.
- Typecheck and relevant main-process tests pass.

## Suggested Sprint 6 Task Breakdown

### Day 1 - Snapshot creation

- Implement `FX-WO-019`.
- Emit `node.context_snapshot_created`.
- Assert version/hash behavior in tests.

### Day 2-3 - Commit-safe delta lifecycle

- Implement `FX-WO-020`.
- Handle completed, review-paused, review-approved, failed, and aborted states explicitly.
- Add idempotent replay behavior for repeated commit attempts.

### Day 4 - Parallel merge policy

- Implement phase-1 merge rules from `FX-WO-021`.
- Add deterministic conflict behavior and trace events.

### Day 5 - Evaluator and stabilization

- Implement `FX-WO-022`.
- Run trace eval against representative happy path, review, failure, and parallel cases.
- Run targeted tests and `npm run typecheck`.

Suggested verification:

```powershell
npm test -- src/main/test/workflow-engine.test.ts src/main/test/workflow-trace-eval.test.ts src/main/test/flow-context-store.test.ts
npm run eval:workflow -- --workspace <path> --run <runId>
npm run typecheck
```

## Sprint 6 Definition of Done

- Each executed node can be tied to a concrete snapshot version and hash.
- Successful nodes commit context deltas only once.
- Failed or aborted nodes do not pollute successful flow context.
- Review-paused nodes preserve evidence without publishing final downstream context.
- Parallel context writes follow deterministic additive or conflict behavior.
- Trace evaluator can fail runs with invalid context lifecycle ordering.

## Suggested Sprint 7 Task Breakdown

### Day 1 - Adapter/provider state contract

- Implement `FX-WO-023`.
- Keep Codex CLI adapter backward-compatible.

### Day 2-3 - OpenAI Responses integration

- Implement `FX-WO-024` behind a provider-specific path or feature flag.
- Persist `previous_response_id` or `conversation` references through context delta.
- Add compaction and prompt cache config hooks only for the OpenAI path.

### Day 4 - Context inspector and redaction

- Implement `FX-WO-025` and `FX-WO-026`.
- Keep secret redaction enforced in main-process payload shaping.

### Day 5 - Verification and rollout checks

- Run provider-path tests and smoke checks.
- Validate legacy Codex CLI workflows remain unchanged.

Suggested verification:

```powershell
npm test -- src/main/test/openai.adapter.test.ts src/main/test/workflow-engine.test.ts src/renderer/src/lib/workflow-session.test.ts
npm run typecheck
```

## Sprint 7 Definition of Done

- Optional provider-state deltas are supported without breaking Codex CLI runs.
- OpenAI Responses state references can be persisted and resumed when that provider is selected.
- Context inspector can show `flowContextId` and latest context version without reading files from the renderer.
- Secret-like values are redacted from stored context, IPC payloads, and UI.
- Codex CLI remains the default runtime path.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Trace writes slow down streaming | UI/runtime latency | Append compact events only; do not write every terminal chunk initially. |
| Trace failure breaks workflow | Bad UX | Trace writer should warn and degrade, not halt execution. |
| Schema churn | Hard to consume traces later | Version trace schema from day one. |
| Process telemetry differs by platform | Windows-first complexity | Start with universal fields; add Windows Working Set later. |
| Run-state schema gets overloaded | Compatibility risk | Keep detailed evidence in trace JSONL, not run-state JSON. |
| Memory index too early | Scope creep | Defer memory index until context source report is stable. |
| Trace exists but no evaluator consumes it | False confidence after Sprint 1 | Pull `FX-WO-009` into Sprint 2 after checkpoint hygiene. |
| Attempt lineage breaks downstream context | Workflow regression | Keep latest output path stable and add history as sidecar storage. |
| Completed process records accumulate | Long-session memory/diagnostic noise | Cleanup completed/error records while preserving active process tracking. |
| Parallel DAG deltas overwrite each other | Workflow regression | Add explicit merge policy; serialize `contextWriter` nodes in phase 1 when needed. |
| Retry/review commits duplicate or premature context | Wrong downstream context | Commit only on commit-safe states and enforce idempotency keys. |
| New context store silently diverges from run state | Hard-to-debug audit drift | Trace every context init/commit and cross-link version, runId, and flowContextId. |
| Prompt layout changes alter Codex CLI behavior | Execution regression | Keep provider-specific prompt layouts and test Codex CLI compatibility before rollout. |
| Provider state persistence increases retention/privacy risk | Security/compliance risk | Keep Fluxion-owned context as source of truth; store only minimal provider refs and redact secrets. |
| `.fluxion/` schema drift breaks old workspaces | Migration risk | Use additive optional fields and lazy fallback for missing `flowContextId`. |

## Non-Goals For Sprint 1

- No conditional nodes.
- No loop nodes.
- No model-based graders.
- No OpenAI adapter runtime migration.
- No long-term memory summarizer.
- No UI redesign for trace viewer yet.
- No cloud sync or shared traces.
- No shared shell worker or persistent terminal session across nodes in this update.

## Follow-Up After Sprint 1

After Sprint 1 lands, `S2-000` tracks:

- `docs/runtime/agent-workflow-memory-checkpoint.md` with actual trace schema.
- `docs/backlog/fluxion-master-backlog.md` with new `FX-WO-*` status if accepted into master backlog.
- Runtime smoke checklist to include trace file inspection.

Then start Sprint 2 with `S2-000`, `FX-WO-006`, `FX-WO-007`, `FX-WO-009`, and `FX-WO-013`.
