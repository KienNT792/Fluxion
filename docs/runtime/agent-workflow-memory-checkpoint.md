# Agent Workflow, Memory, and Evaluation Checkpoint

Date: 2026-05-10

Purpose: checkpoint the current research baseline for future updates to Fluxion's workflow runtime, node lifecycle, workflow memory, process telemetry, and agent evaluation model.

This document is written as an implementation-oriented reference for Fluxion. It should be updated whenever the workflow engine, memory manager, process runtime, run-state schema, review gates, or evaluation model changes materially.

## Scope

This checkpoint covers:

- Agent workflow architecture and lifecycle.
- Workflow memory, session memory, and long-term memory management.
- Node-agent evaluation criteria.
- Workflow-level lifecycle evaluation criteria.
- Current Fluxion baseline and gaps.
- Practical next updates for Fluxion.

It does not redefine Fluxion's primary runtime. Fluxion remains a Windows-first desktop orchestrator around local `codex exec` execution.

## Source Baseline

Primary OpenAI sources:

- [OpenAI Agents SDK overview](https://developers.openai.com/api/docs/guides/agents)
- [OpenAI Agents SDK: running agents](https://developers.openai.com/api/docs/guides/agents/running-agents)
- [OpenAI Agents SDK: orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration)
- [OpenAI Agents SDK: guardrails and human review](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals)
- [OpenAI Agents SDK: results and state](https://developers.openai.com/api/docs/guides/agents/results)
- [OpenAI Agents SDK: integrations and observability](https://developers.openai.com/api/docs/guides/agents/integrations-observability)
- [OpenAI: evaluate agent workflows](https://developers.openai.com/api/docs/guides/agent-evals)
- [OpenAI cookbook: session memory](https://cookbook.openai.com/examples/agents_sdk/session_memory)
- [OpenAI Codex with Agents SDK](https://developers.openai.com/codex/guides/agents-sdk)

Additional reference sources:

- [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangSmith trajectory evaluations](https://docs.langchain.com/langsmith/trajectory-evals)
- [LlamaIndex agent memory](https://developers.llamaindex.ai/python/framework/module_guides/deploying/agents/memory/)
- [AutoGen memory and RAG](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html)
- [Agent Workflow Memory paper](https://arxiv.org/abs/2409.07429)

Local Fluxion source files relevant to this checkpoint:

- `src/main/services/workflow-engine.ts`
- `src/main/runners/codex-cli-runner.ts`
- `src/main/services/process-manager.ts`
- `src/main/services/run-state-store.ts`
- `src/main/services/memory-manager.ts`
- `src/main/services/artifact-gate-service.ts`
- `src/renderer/src/stores/execution.store.ts`
- `src/renderer/src/hooks/useIpcListeners.ts`
- `src/shared/workflow.types.ts`
- `src/shared/ipc.payloads.ts`

## Core Concepts

### Workflow vs Agent

A workflow is a controlled execution structure. It defines graph shape, gates, dependencies, retry boundaries, and persisted run state.

An agent is an autonomous or semi-autonomous runtime unit. It may call tools, inspect state, produce artifacts, or hand control to another specialist.

For Fluxion, each visual node is best treated as a bounded agent execution unit inside a deterministic workflow DAG. The workflow owns ordering, persistence, review gates, and recovery. The Codex CLI owns local coding behavior inside a node.

### Agent Loop

OpenAI's Agents SDK describes the runtime loop as:

1. Call the current agent model with prepared input.
2. Inspect model output.
3. Execute tool calls if produced.
4. Switch agents on handoff if needed.
5. Return a final result when there is no more tool work.

Fluxion's current node loop is analogous but CLI-centered:

1. Validate required artifacts.
2. Compile context.
3. Build a prompt.
4. Spawn `codex exec`.
5. Stream stdout/stderr.
6. Validate produced artifacts.
7. Save output and run state.
8. Pause for review or unlock downstream nodes.

### Orchestration Patterns

Common multi-agent patterns:

- Prompt chaining: one node's output becomes another node's input.
- Routing: choose a branch or specialist based on task classification.
- Parallelization: run independent work in the same batch.
- Orchestrator-workers: a manager delegates bounded subtasks and synthesizes.
- Evaluator-optimizer: one agent generates output and another checks/improves it.
- Handoffs: ownership moves to a specialist agent.
- Agents-as-tools: a manager remains owner and calls specialists as tools.

Fluxion currently implements prompt chaining and parallel DAG batches. It has review gates and retry-from-node. It does not yet model handoff ownership, agents-as-tools, conditional routing, loops, or evaluator-optimizer as first-class workflow constructs.

## Memory Model

### Memory Layers

Recommended memory layers for Fluxion:

| Layer | Role | Current Fluxion Equivalent | Notes |
| --- | --- | --- | --- |
| Runtime state | Exact run/node state for resume, retry, review, and status | `.fluxion/runs/<runId>.json` | Must remain exact, structured, and schema-versioned. |
| Short-term memory | Recent node outputs and immediate workflow context | `.fluxion/memory/short-term/<workflowId>/<nodeId>.md` plus `.history/<runId>/<nodeId>/attempt-<n>.md` | Latest path remains compatibility path; history preserves rerun/review attempts. |
| Global workspace context | Durable project rules and high-level context | `.fluxion/memory/global-context.md` | Good anchor for project-level context. |
| Long-term memory | Summaries, repeated findings, durable lessons | `.fluxion/memory/long-term/index.md` if present | Currently optional and not actively managed. |
| Workflow memory | Reusable procedural patterns from past successful workflows | Not implemented | Candidate for future AWM-style routine extraction. |
| Trace memory | Structured execution record for debugging/evals | `.fluxion/runs/<runId>.trace.jsonl` | Schema v1 trace now records workflow/node lifecycle, process telemetry, context provenance, and output lineage. |

### Session Memory Strategies

OpenAI's session-memory guidance highlights two core strategies:

| Strategy | Strength | Risk | Good Fit |
| --- | --- | --- | --- |
| Context trimming | Deterministic, low latency, easy to reproduce | Abruptly loses older constraints | Short workflows, ops automations, tool-heavy local tasks |
| Context summarization | Retains long-range context compactly | Summary drift, context poisoning, added latency/cost | Long analysis, planning, multi-step related tasks |

Fluxion currently uses direct upstream output injection rather than trimming or summarization. That is simple and predictable, but it can become noisy for long workflows and does not preserve durable lessons across runs.

### Memory Lifecycle

A robust memory lifecycle should have explicit phases:

1. Capture: record raw output, tool events, artifacts, logs, and decisions.
2. Stage: keep run-scoped memory isolated until it is validated.
3. Distill: summarize only after enough signal exists.
4. Validate: check facts against artifacts, traces, or user-approved output.
5. Consolidate: promote durable facts/rules/patterns into long-term memory.
6. Retrieve: select relevant memories for a future node or workflow.
7. Inject: include memory in context with provenance and bounded size.
8. Expire: age out stale or low-confidence memories.

Memory should not be treated as an append-only dump. It needs provenance, confidence, freshness, and conflict handling.

### Memory Risks

Main risks:

- Stale memory: obsolete decisions or old file shapes get reused.
- Context poisoning: a bad summary becomes future truth.
- Over-injection: too much memory lowers instruction fidelity.
- Missing provenance: no way to trace why a fact entered context.
- Cross-run leakage: unrelated workflow output affects a new run.
- Summary drift: summaries compress away important constraints.

Recommended controls:

- Store memory entries with source run ID, node ID, artifact path, timestamp, and confidence.
- Keep raw output separate from distilled memory.
- Use review-approved outputs as stronger promotion candidates.
- Add TTL or freshness scoring.
- Log summary prompts and summary outputs.
- Require citations to artifacts or trace events for promoted facts.

## Node Agent Evaluation Rubric

Use this rubric when evaluating a single node. Score each dimension from 0 to 5.

| Dimension | What To Check | Strong Signal |
| --- | --- | --- |
| Contract clarity | Purpose, owner, prompt, model, runner, permissions, tools, expected output | A reviewer can predict what the node may do and produce. |
| Input validity | Required artifacts, upstream outputs, workspace state, schema | Node fails early on missing or invalid inputs. |
| Context quality | Global context, upstream memory, long-term memory relevance | Context is sufficient, current, bounded, and source-labeled. |
| Prompt fidelity | User instruction and system instruction are preserved | Prompt does not hide or override important constraints. |
| Tool/action correctness | Commands/tool calls are necessary and correctly parameterized | No unnecessary side effects or incorrect tool choice. |
| Output correctness | Output satisfies requested task and acceptance criteria | Output can be consumed by downstream nodes. |
| Artifact contract | Declared `produces` paths are created or updated as expected | Artifacts are validated after execution. |
| Safety and permissions | Sandbox, approval policy, workspace boundary, secrets handling | Sensitive actions are gated or blocked. |
| Review behavior | Human review triggers where required | Paused output can be approved, rejected, or rerun. |
| Retry behavior | Failure and rerun semantics are predictable | Retry affects the intended subtree and does not corrupt prior state. |
| Observability | Logs, exit code, duration, prompt/context summary, artifact writes | The node can be debugged without rerunning. |
| Resource behavior | Runtime, peak RAM, CPU, log growth, token/cost estimate | Expensive or stuck nodes are visible. |
| Memory behavior | What it reads/writes/promotes is explicit | No unbounded or unreviewed memory mutation. |
| Determinism | Same input produces comparable behavior when expected | Variance is explainable by model/tool behavior. |
| Eval readiness | There is a grader or assertion for the node behavior | Node can be regression-tested. |

Suggested rating:

- 5: production-ready for that dimension.
- 4: strong, minor gaps.
- 3: usable but missing observability or edge-case handling.
- 2: fragile or hard to debug.
- 1: mostly implicit.
- 0: absent.

## Workflow Lifecycle Evaluation

Evaluate the whole workflow across these stages.

### 1. Design

Checks:

- DAG shape is intentional.
- Each edge represents a real dependency.
- Parallel nodes are truly independent.
- Review gates are placed before irreversible or risky continuation.
- Node labels and prompts make ownership clear.

### 2. Preflight Validation

Checks:

- Workflow schema is valid.
- Graph has no cycle.
- Every node has a prompt.
- Every edge references existing nodes.
- Runtime/provider readiness is checked.
- Codex approval/sandbox guardrails are checked before execution.

### 3. Run Initialization

Checks:

- New `runId` is created.
- Run-scoped node set is known.
- Run state is persisted before node execution starts.
- Memory directories exist.
- Retry-from-node scopes the run to downstream nodes only.

### 4. Scheduling

Checks:

- Topological batches are correct.
- Independent nodes can run in parallel.
- Downstream nodes unlock only when all upstream dependencies complete.
- Failure halts downstream execution.
- Abort stops active node processes.

### 5. Context Preparation

Checks:

- Global context is included.
- Direct upstream outputs are included.
- Long-term context is included only when relevant.
- Context sources are labeled.
- Context size is bounded or at least observable.

### 6. Node Execution

Checks:

- Process is spawned outside renderer.
- Prompt is passed safely.
- stdout/stderr stream in real time.
- Exit code and errors are captured.
- Temporary output paths are cleaned up.
- Process lifecycle is tracked by PID.

### 7. Artifact and Output Validation

Checks:

- `requires` validates before execution.
- `produces` snapshots before execution.
- Produced artifacts are validated after execution.
- Required outputs must be created or updated.
- Output markdown is saved with frontmatter.

### 8. Review and Approval

Checks:

- Auto mode pauses only on node `humanReview`.
- Manual mode pauses after each node.
- Approval unlocks downstream nodes.
- Rejection finalizes workflow as rejected.
- Rerun overwrites stale node output and increments attempts.
- Review recovery after app restart is defined.

### 9. Persistence

Checks:

- Run state is written atomically.
- State transitions are schema-validated.
- Current node IDs are accurate during parallel batches.
- Awaiting review IDs are persisted.
- Node output path is available to renderer.

### 10. Observability and Eval

Checks:

- Timeline shows status per node.
- Terminal log is inspectable per node.
- Output file is visible.
- Structured traces can reconstruct prompt, context sources, commands, artifacts, duration, and errors.
- Dataset/eval runs exist for repeated workflows.

### 11. Memory Consolidation

Checks:

- Raw output is not automatically promoted to long-term memory.
- Summaries are logged and attributable.
- Durable facts are reviewable.
- Old/conflicting memories can be retired.
- Future nodes know which memory entries were injected.

## Current Fluxion Baseline

| Area | Current Score | Notes |
| --- | ---: | --- |
| DAG lifecycle | 4/5 | Topological scheduling, parallel batches, retry-from-node, halt-on-failure are implemented. |
| Node I/O contract | 4/5 | `requires` and `produces` artifact gates exist and validate workspace-relative paths. |
| Run state | 4/5 | `.fluxion/runs/<runId>.json` tracks node attempts, status, review, exit code, artifacts. |
| Short-term memory | 3.5/5 | Upstream output injection works; latest path is stable and attempt history is now retained. |
| Long-term memory | 1.5/5 | Optional `long-term/index.md` is read but no lifecycle manages it. |
| Review lifecycle | 3.5/5 | Manual mode and node review gates work; restart recovery for paused review is not implemented. |
| Process lifecycle | 3.5/5 | Child process spawn, stdout/stderr streaming, and Windows process-tree abort exist. |
| Process telemetry | 3/5 | PID, display command, start/end, duration, exit code, abort reason, and stdout/stderr bytes are traced; peak RAM, CPU, token/cost, timeout, and heartbeat remain future work. |
| Renderer RAM control | 3/5 | Terminal logs are capped at 1000 entries per node. |
| Observability | 4/5 | Terminal logs, run state, trace JSONL, process telemetry, context provenance, and output lineage exist. |
| Eval readiness | 2.5/5 | A deterministic local trace evaluator exists; datasets/model graders are still future work. |
| Memory safety | 2.5/5 | Context sources are traced, but poisoning, freshness, conflict, and promotion controls remain future work. |

## Key Gaps

### Structured Trace Baseline

Fluxion writes one append-only JSONL trace per run:

```text
.fluxion/runs/<runId>.trace.jsonl
```

Event shape:

```json
{
  "schemaVersion": 1,
  "runId": "run-id",
  "workflowId": "workflow-id",
  "nodeId": "node-id",
  "type": "node.context_compiled",
  "timestamp": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Current trace events:

- `workflow.started`
- `workflow.completed`
- `workflow.failed`
- `workflow.aborted`
- `workflow.rejected`
- `node.ready`
- `node.requires_validated`
- `node.produces_snapshot`
- `node.running`
- `node.context_compiled`
- `node.execution_started`
- `node.execution_completed`
- `node.process_spawned`
- `node.process_exited`
- `node.produces_validated`
- `node.output_saved`
- `node.review_requested`
- `node.review_approved`
- `node.review_rejected`
- `node.rerun_requested`
- `node.failed`
- `node.aborted`

`node.context_compiled.data` includes `previousNodeIds`, `contextBytes`, `contextChars`, `contextHash`, and `sources`. Each source has `type`, `path`, `included`, and optional `nodeId`, `runId`, `bytes`, `hash`, and `warning`.

`node.output_saved.data` includes the compatibility output path, the attempt number, and the attempt history path when available.

### Process Telemetry Gap

Fluxion currently tracks child process lifecycle but not resource usage.

Useful future metrics:

- PID
- process command/display command
- startedAt/completedAt
- durationMs
- peakWorkingSetBytes on Windows
- CPU time
- stdout/stderr byte counts
- exit code/signal
- abort reason
- process-tree kill result

### Memory Manager Gap

Current memory is a simple context compiler. Future memory should track:

- memory entry ID
- memory type: `raw_output`, `summary`, `decision`, `fact`, `procedure`, `artifact_note`
- source workflow/run/node
- source artifact path
- confidence
- freshness/TTL
- review status
- injectedInto run/node IDs
- conflict set or supersedes link

### Eval Gap

Fluxion should support both node-level and workflow-level evals.

Node-level eval examples:

- Did the node create all declared artifacts?
- Did the output match a schema?
- Did the node use the expected sandbox?
- Did the node avoid forbidden paths?
- Did context include required upstream output?

Workflow-level eval examples:

- Did all required gates occur?
- Did downstream nodes wait for upstream artifacts?
- Did manual mode pause after every node?
- Did retry from a node avoid rerunning unrelated upstream nodes?
- Did final outputs satisfy acceptance criteria?

Trajectory eval examples:

- Did the workflow call the right node/tool at the right time?
- Did review happen before side effects?
- Did a failure halt downstream execution?
- Did memory injection come from approved or relevant sources?

## Recommended Update Roadmap

### P1: Structured Runtime Trace [DONE]

Add an append-only trace file:

```text
.fluxion/runs/<runId>.trace.jsonl
```

Minimum event fields:

```json
{
  "schemaVersion": 1,
  "runId": "uuid",
  "workflowId": "workflow-id",
  "nodeId": "node-id",
  "type": "node.process_spawned",
  "timestamp": "2026-05-10T00:00:00.000Z",
  "data": {}
}
```

Benefits:

- Better debugging than terminal-only logs.
- Supports future trace grading.
- Enables runtime timeline reconstruction.

### P2: Process Telemetry

Extend process tracking with resource snapshots.

Minimum Windows-first fields:

- `pid`
- `startedAt`
- `completedAt`
- `durationMs`
- `exitCode`
- `abortReason`
- `stdoutBytes`
- `stderrBytes`
- `peakWorkingSetBytes` when available

This should stay in main process, not renderer.

### P3: Memory Entry Model

Keep current markdown output compatibility, but add a structured memory index:

```text
.fluxion/memory/index.json
```

Candidate entry:

```json
{
  "id": "memory-entry-id",
  "type": "summary",
  "scope": "workflow",
  "workflowId": "workflow-id",
  "runId": "run-id",
  "nodeId": "node-id",
  "sourcePath": ".fluxion/memory/short-term/workflow/node.md",
  "createdAt": "2026-05-10T00:00:00.000Z",
  "confidence": 0.8,
  "reviewStatus": "unreviewed",
  "content": "Concise durable note."
}
```

### P4: Memory Injection Report [BASELINE DONE]

For each node, persist which memory/context sources were injected:

```json
{
  "nodeId": "node-b",
  "contextSources": [
    {
      "type": "global",
      "path": ".fluxion/memory/global-context.md",
      "included": true
    },
    {
      "type": "short-term",
      "nodeId": "node-a",
      "path": ".fluxion/memory/short-term/workflow/node-a.md",
      "included": true
    }
  ],
  "compiledContextHash": "sha256..."
}
```

### P5: Eval Harness [BASELINE DONE]

Add a local eval runner for saved workflows and traces.

Current deterministic command:

```powershell
npm run eval:workflow -- --workspace <path> --run <runId>
```

Initial graders can be deterministic:

- workflow start/end consistency
- node start/end consistency
- process spawn/exit consistency
- artifact validation before output save
- review requested before approve/reject
- no events after terminal workflow final

Model graders can come later.

## Fluxion-Specific Acceptance Criteria

Any future workflow-runtime update should answer these questions before it is considered complete:

1. Does it preserve `.fluxion/` compatibility?
2. Does it keep execution orchestration in main process?
3. Does it avoid moving filesystem/process logic into renderer?
4. Does it keep Windows process cleanup safe?
5. Does it improve or preserve run-state durability?
6. Does it expose enough trace data to debug one failed node?
7. Does it preserve current DAG validation, retry, review, and artifact behavior?
8. Does it include tests in the nearest layer when behavior changes?

## Checkpoint Summary

Fluxion already has a strong base for deterministic local workflow orchestration:

- DAG validation and topological scheduling.
- Codex CLI node execution.
- Artifact gates.
- Run-state persistence.
- Short-term node output memory.
- Terminal streaming.
- Manual and per-node review gates.
- Windows process-tree cleanup.

The next quality step is not more agent autonomy. The next step is better runtime evidence:

- structured traces,
- process telemetry,
- memory provenance,
- memory lifecycle controls,
- and repeatable evals.

Those additions will make workflow updates safer because every node can be evaluated by contract, context, process behavior, memory behavior, and final artifacts rather than by final output alone.
