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

## Non-Goals For Sprint 1

- No conditional nodes.
- No loop nodes.
- No model-based graders.
- No OpenAI adapter runtime migration.
- No long-term memory summarizer.
- No UI redesign for trace viewer yet.
- No cloud sync or shared traces.

## Follow-Up After Sprint 1

After Sprint 1 lands, `S2-000` tracks:

- `docs/runtime/agent-workflow-memory-checkpoint.md` with actual trace schema.
- `docs/backlog/fluxion-master-backlog.md` with new `FX-WO-*` status if accepted into master backlog.
- Runtime smoke checklist to include trace file inspection.

Then start Sprint 2 with `S2-000`, `FX-WO-006`, `FX-WO-007`, `FX-WO-009`, and `FX-WO-013`.
