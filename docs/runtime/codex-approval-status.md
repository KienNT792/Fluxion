# Codex Approval Status

Status updated: 2026-05-17
Decision: `blocked / unsupported`
Scope: interactive approval host for Codex CLI inside Fluxion

## Current Status

Do not implement an interactive Codex approval host yet.

Current evidence shows that `codex exec --json` does not expose a stable structured approval protocol that Fluxion can safely drive.

Observed conclusion from the latest retained probe batch:

- no structured approval request event
- no stable request id or correlation key
- no documented or observed programmatic reply channel
- approve/reject behavior cannot be validated deterministically

Because of that, Fluxion must keep the existing guardrail:

- `approval_policy=never`: allowed
- `approval_policy=on-request`: blocked
- `approval_policy=untrusted`: blocked

## Why This Is Blocked

Fluxion is a Windows-first desktop runner and cannot rely on parsing human terminal prompts such as `Approve? y/n`.

A future implementation is allowed only if the CLI exposes all of the following:

1. structured approval request events
2. stable request correlation
3. a programmatic reply channel
4. deterministic approve and reject behavior
5. Windows-native behavior that remains safe under abort and process cleanup

## What To Re-check Before Unblocking

- a newer Codex CLI version
- current OpenAI Codex approval and sandbox docs
- a fresh local probe on Windows using Fluxion's expected execution path

## Current Next Step

Do not continue Phase 2B approval-host design work.

The practical next step remains runtime hardening that does not depend on an approval protocol:

- desktop smoke for run/retry/review/abort flows
- Windows CLI readiness clarity
- output preview and operator UX polish

## Canonical References

- Current project assessment: [`docs/assessments/fluxion-project-assessment.md`](../assessments/fluxion-project-assessment.md)
- Master backlog: [`docs/backlog/fluxion-master-backlog.md`](../backlog/fluxion-master-backlog.md)
- Paused review recovery: [`docs/runtime/paused-review-recovery.md`](./paused-review-recovery.md)
