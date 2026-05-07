# Codex Approval Phase 2B Plan

Date: 2026-05-07
Status: `BLOCKED / NOT READY TO IMPLEMENT`
Scope: Fluxion interactive approval host for Codex CLI

## Decision

Do not implement Phase 2B yet.

Phase 2B can start only after Phase 2A proves that `codex exec --json` exposes a stable, structured approval protocol that Fluxion can drive programmatically.

Current probe evidence is `unsupported`:

- No structured approval request event was observed.
- No request id or correlation key was observed.
- No programmatic reply channel was observed.
- Approve/reject deterministic behavior could not be tested.

Therefore Fluxion must keep Phase 1 guardrail behavior: block interactive approval policies before spawning a workflow unless protocol status becomes `supported`.

## Source References

Local project references:

- Probe evidence: `docs/runtime/codex-approval-protocol-probe.md`
- Today assessment: `docs/assessments/fluxion-project-assessment-2026-05-07.md`
- Runtime backlog: `docs/backlog/fluxion-master-backlog.md`

Official OpenAI references checked for this plan:

- `https://developers.openai.com/codex/config-reference#configtoml`
- `https://developers.openai.com/codex/concepts/sandboxing#configure-defaults`
- `https://developers.openai.com/codex/agent-approvals-security#sandbox-and-approvals`

Relevant documented config values:

- `sandbox_mode = read-only | workspace-write | danger-full-access`
- `approval_policy = untrusted | on-request | never | { granular = { ... } }`
- `windows.sandbox = unelevated | elevated`

Docs currently describe what approvals mean, but do not document a stable `codex exec --json` approval reply protocol that an external host can use.

## Entry Criteria

Phase 2B may start only when all criteria below are true:

1. Phase 2A probe returns `status: "supported"`.
2. `codex exec --json` emits a structured approval request event.
3. The event contains a stable request id or correlation key.
4. There is a documented or observed programmatic reply channel that does not rely on terminal prompt text.
5. `approve` and `reject` both continue or end the process deterministically.
6. The probe covers native Windows execution, including abort while waiting for approval.
7. Current OpenAI docs are rechecked before implementation, especially `approval_policy` values and any new protocol notes.

## Non-Goals

- Do not parse human terminal text such as `Approve? y/n`.
- Do not add UI buttons that cannot send a real programmatic reply.
- Do not keep `CodexCliRunner` stdin open unless the probe proves this is required and stable.
- Do not persist raw long approval events into `.fluxion/runs`.
- Do not change Phase 1 default behavior of `workspace-write + never`.

## Proposed Architecture If Unblocked

### Main Process Approval Host

Add approval-session ownership in the main process, close to the Codex runner path:

- `CodexCliRunner` continues to own process spawn, stdout JSONL parsing, stderr, stdin lifecycle, and process cleanup.
- A new approval host layer tracks pending approval requests per running node.
- Approval requests are derived only from structured JSON events.
- Approval replies are written only through the verified programmatic channel.
- Abort must clear pending approval requests and kill the Windows process tree.

The renderer must not own protocol parsing or child process lifecycle.

### Shared Types And IPC

Potential shared additions after protocol support is confirmed:

- `CodexApprovalRequest`
- `CodexApprovalDecision = approve-once | approve-session | reject`
- `WorkflowApprovalRequiredPayload`
- `WorkflowApprovalActionPayload`
- `WorkflowApprovalActionResult`

Potential channels:

- `WORKFLOW_CODEX_APPROVAL_REQUIRED`
- `WORKFLOW_CODEX_APPROVAL_RESOLVE`

Exact payload fields must be derived from the observed protocol, not invented ahead of evidence.

### Renderer UX

Renderer should reuse the existing runtime/review model:

- Topbar CTA: `Codex Approval Required`
- Select the waiting node on click.
- Dedicated approval section in `PropertiesPanel`, separate from config.
- Pending state per node and approval request id.
- Disable duplicate approve/reject actions while an action is in flight.
- Surface command summary, sandbox reason, and risk level from the structured event only.

The UI should not show Phase 2B controls when protocol status is `unknown` or `unsupported`.

### Guardrail Update

Guardrail behavior after support is proven:

- `approval_policy = never`: allowed, still non-interactive.
- `approval_policy = on-request`: allowed only when protocol status is `supported`.
- `approval_policy = untrusted`: allowed only when protocol status is `supported`.
- `approval_policy = { granular = ... }`: require explicit Phase 2B design before allowing; if unsupported by Fluxion schema/UI, block with a clear message.
- `sandbox_mode = danger-full-access`: warning-only if runnable.
- `sandbox_mode = read-only`: warning-only if runnable, but likely to produce approval requests on writes.

### Memory And OS Constraints

- Store only lightweight pending approval metadata in memory.
- Cap raw event previews for debugging.
- Do not persist long raw JSONL events unless a debug mode explicitly opts in.
- Fail before spawn when protocol is unsupported to avoid hung processes.
- Keep Windows process cleanup in the main process and reuse existing process-manager behavior.
- Avoid polling or long-lived renderer subscriptions beyond existing workflow IPC events.

## Implementation Tasks

1. Re-run Phase 2A probe after Codex CLI update or docs change.
2. Capture real supported approval request and reply fixtures.
3. Add parser tests using captured JSONL fixtures.
4. Add main-process approval session host.
5. Update `CodexCliRunner` stdin lifecycle only if the verified protocol requires it.
6. Add shared IPC payloads and preload bridge.
7. Add renderer approval panel and pending action state.
8. Update guardrail to allow interactive policies only with `supported` protocol status.
9. Add Windows abort cleanup test while approval is pending.
10. Run manual smoke with approve and reject flows.

## Verification Plan

Required automated checks:

- Probe parser fixtures for approval request, approve, reject, malformed events, and process timeout.
- Guardrail tests for `supported`, `unsupported`, and `unknown`.
- Runner tests that preserve current `approval_policy=never` behavior.
- Workflow-engine tests for approval pause/resume/abort if Phase 2B introduces runtime states.
- Renderer tests for pending approval buttons and duplicate-click prevention.

Required manual checks on Windows:

- `where.exe codex`
- `npm prefix -g`
- `codex --version`
- `node scripts/probe/codex-approval-protocol.mjs --timeout-ms 60000`
- Workflow run with `on-request` approval that approves.
- Workflow run with `on-request` approval that rejects.
- Abort while approval is pending.

## Current Next Step

Do not start this implementation. The next practical work should remain runtime UX hardening:

- WindowsApps/App Execution Alias readiness error handling.
- Terminal log clarity.
- Output preview desktop smoke.
- Retry/rerun/review pending polish.
