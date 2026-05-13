# Workflow Optimization Backlog and Sprint Plan

Date: 2026-05-10
Source checkpoint: `docs/runtime/agent-workflow-memory-checkpoint.md`
Workspace: `D:\codex-workflow\Fluxion`

## Purpose

Backlog nay gom cac viec can lam de toi uu Fluxion workflow runtime theo huong:

1. Node nao chay cung co bang chung runtime ro rang.
2. Workflow memory co provenance, khong chi la output markdown noi tiep.
3. Process Codex CLI co telemetry toi thieu de debug treo/cham/ngon RAM.
4. Review, retry, abort, va artifact gates co trace du de kiem tra lai.
5. Workflow co nen tang eval lap lai duoc, bat dau bang deterministic graders.

Pham vi nay khong doi runtime chinh cua Fluxion. Runtime chinh van la local Codex CLI qua `codex exec`.

## Sprint Theme

Runtime evidence before deeper autonomy.

Fluxion da co DAG execution, artifact gates, run-state persistence, terminal stream, va review gates. Sprint toi uu workflow nen tap trung vao viec lam moi node/run co the audit, evaluate, va recover tot hon truoc khi them routing, loop nodes, hay agent autonomy phuc tap.

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

## Proposed Sprint 2 - Memory Provenance and Context Injection

### FX-WO-006 Add memory source report for compiled context [READY]

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

- [ ] Global context source duoc listed.
- [ ] Upstream node output source duoc listed voi nodeId/path.
- [ ] Missing optional long-term source khong fail.
- [ ] Context hash stable cho cung content.
- [ ] Existing `MEMORY_CONTEXT_READY` IPC van hoat dong.

Files likely touched:

- `src/main/services/memory-manager.ts`
- `src/main/services/workflow-engine.ts`
- `src/main/test/memory-manager.test.ts`

### FX-WO-007 Preserve output lineage across attempts [DISCOVERY]

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

- [ ] Existing latest path remains available to downstream context.
- [ ] Attempt history file is written for every completed/paused attempt.
- [ ] Review rerun keeps previous output available.
- [ ] UI can still preview latest output without changes.

Files likely touched:

- `src/main/services/memory-manager.ts`
- `src/main/services/workflow-engine.ts`
- `src/main/test/workflow-engine.test.ts`
- `src/main/test/memory-manager.test.ts`

### FX-WO-008 Add memory index schema [BLOCKED]

Priority: `P2`
Blocked by: `FX-WO-006`

Outcome: Fluxion co structured index cho raw output, summaries, decisions, facts, procedures.

Deliverable:

- Add `.fluxion/memory/index.json`.
- Schema-versioned entries.
- Support at least `raw_output` entries created from node output.

Acceptance:

- [ ] Index initialized on workspace memory init.
- [ ] Node output save can append/update memory index entry.
- [ ] Entries include workflowId, runId, nodeId, sourcePath, type, createdAt.
- [ ] Invalid index file degrades safely with clear warning.

Files likely touched:

- `src/main/services/memory-manager.ts`
- `src/core/schema/memory-index.schema.ts`
- `src/shared/memory.types.ts`

## Proposed Sprint 3 - Deterministic Workflow Evals

### FX-WO-009 Add local workflow trace evaluator [BLOCKED]

Priority: `P2`
Blocked by: `FX-WO-001`, `FX-WO-002`

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

- [ ] Eval returns pass/fail plus JSON summary.
- [ ] Bad/missing event order is reported with runId/nodeId.
- [ ] Script works on Windows PowerShell.
- [ ] No model call required.

Files likely touched:

- `scripts/eval/workflow-trace-eval.mjs`
- `package.json`
- `src/core/test` or script tests if pattern exists

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

### FX-WO-012 Add memory promotion guardrails [BLOCKED]

Priority: `P3`
Blocked by: `FX-WO-008`

Outcome: Long-term memory is not an unreviewed dump.

Deliverable:

- Define promotion states: `raw`, `candidate`, `approved`, `rejected`, `superseded`.
- Only approved or deterministic summaries can be injected by default.
- Add provenance fields and optional TTL.

Acceptance:

- [ ] Memory entries have review/promotion status.
- [ ] Context compiler can filter by status.
- [ ] Trace records which memory entries were injected.

## Backlog Summary

| Item | Priority | Status | Sprint |
| --- | --- | --- | --- |
| FX-WO-001 Structured runtime trace writer | P0 | DONE | 1 |
| FX-WO-002 Instrument WorkflowEngine trace events | P0 | DONE | 1 |
| FX-WO-003 Codex process telemetry counters | P0 | DONE | 1 |
| FX-WO-004 Persist process telemetry into trace | P1 | DONE | 1 |
| FX-WO-005 Trace smoke assertions | P1 | DONE | 1 |
| FX-WO-006 Memory source report | P1 | READY | 2 |
| FX-WO-007 Output lineage across attempts | P1 | DISCOVERY | 2 |
| FX-WO-008 Memory index schema | P2 | BLOCKED | 2 |
| FX-WO-009 Local workflow trace evaluator | P2 | BLOCKED | 3 |
| FX-WO-010 Node rubric markdown template | P2 | READY | 3 |
| FX-WO-011 Paused review recovery design | P1 | DISCOVERY | 4 |
| FX-WO-012 Memory promotion guardrails | P3 | BLOCKED | 4 |

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

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Trace writes slow down streaming | UI/runtime latency | Append compact events only; do not write every terminal chunk initially. |
| Trace failure breaks workflow | Bad UX | Trace writer should warn and degrade, not halt execution. |
| Schema churn | Hard to consume traces later | Version trace schema from day one. |
| Process telemetry differs by platform | Windows-first complexity | Start with universal fields; add Windows Working Set later. |
| Run-state schema gets overloaded | Compatibility risk | Keep detailed evidence in trace JSONL, not run-state JSON. |
| Memory index too early | Scope creep | Defer memory index until context source report is stable. |

## Non-Goals For Sprint 1

- No conditional nodes.
- No loop nodes.
- No model-based graders.
- No OpenAI adapter runtime migration.
- No long-term memory summarizer.
- No UI redesign for trace viewer yet.
- No cloud sync or shared traces.

## Follow-Up After Sprint 1

After Sprint 1 lands, update:

- `docs/runtime/agent-workflow-memory-checkpoint.md` with actual trace schema.
- `docs/backlog/fluxion-master-backlog.md` with new `FX-WO-*` status if accepted into master backlog.
- Runtime smoke checklist to include trace file inspection.

Then start Sprint 2 with memory source reports and attempt lineage.
