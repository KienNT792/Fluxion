# Codex Approval Protocol Probe

Date: 2026-05-07
Workspace: `C:\Personal\Personal_workspace\Fluxion`
Probe script: `scripts/probe/codex-approval-protocol.mjs`
Decision status: `unsupported`

## Purpose

Tai lieu nay ghi lai ket qua Phase 2A cho Codex approval protocol.

Muc tieu cua Phase 2A la xac minh truoc khi mo lai `approval_policy=on-request`
hoac `approval_policy=untrusted` trong Fluxion. Fluxion chi duoc chuyen sang
Phase 2B interactive approval host neu `codex exec --json` co protocol on dinh
de:

1. Phat structured approval request event.
2. Co request id hoac correlation key.
3. Co kenh reply programmatically ro rang.
4. Approve va reject deu lam process tiep tuc hoac ket thuc deterministic.

Khong parse terminal text prompt kieu `Approve? y/n`.

## Probe Setup

Command da chay:

```powershell
node scripts/probe/codex-approval-protocol.mjs --timeout-ms 60000
```

Codex CLI duoc resolve thanh:

```text
C:\nvm4w\nodejs\node.exe C:\nvm4w\nodejs\node_modules\@openai\codex\bin\codex.js
```

Probe chay `codex exec --json` trong temp workspace voi:

```text
--skip-git-repo-check
--sandbox read-only
--config approval_policy=on-request
--output-last-message <temp>\last-message.md
-
```

`--skip-git-repo-check` la can thiet vi probe tao temp workspace khong phai Git
repo. Truoc khi them flag nay, Codex CLI thoat som voi:

```text
Not inside a trusted directory and --skip-git-repo-check was not specified.
```

## Observed Result

Probe result:

```json
{
  "status": "unsupported",
  "message": "No structured approval request event was observed in codex exec --json output.",
  "observedEventTypes": [
    "thread.started",
    "turn.started",
    "item.completed",
    "turn.completed"
  ],
  "hasStructuredApprovalRequest": false,
  "hasCorrelationId": false,
  "hasProgrammaticReplyChannel": false,
  "approveDeterministic": false,
  "rejectDeterministic": false
}
```

Codex emitted normal JSONL turn events, but no structured approval request event.
The model reported that the write was blocked by the read-only sandbox and that
approval escalation was disabled in the session.

Relevant stderr excerpt:

```text
error=patch rejected: writing is blocked by read-only sandbox; rejected by user approval settings
```

## Interpretation

This is a useful probe result because it proves the npm global Codex CLI can be
spawned by Node on Windows. It does not prove an interactive approval protocol.

Observed state:

- `codex exec --json` starts and emits JSONL events.
- The read-only write request does not produce a structured approval event.
- No correlation id or reply channel is available.
- Approve and reject cannot be tested deterministically.

Therefore Fluxion must keep Phase 2A guardrail behavior:

- `approval_policy=never`: allowed.
- `approval_policy=on-request`: blocked unless a future probe returns `supported`.
- `approval_policy=untrusted`: blocked unless a future probe returns `supported`.
- `sandbox_mode=read-only` and `danger-full-access`: warning-only when approval policy is runnable.

## Decision

Do not implement Phase 2B interactive approval host from this evidence.

The current Codex CLI behavior is `unsupported` for Fluxion's requirements.
Fluxion should continue to fail before spawn for interactive approval policies
unless a later Codex CLI version exposes a stable structured approval request and
programmatic reply protocol.

The blocked implementation design is tracked in
`docs/runtime/codex-approval-phase-2b-plan.md`.

## Follow-Up Runtime UX Polish

Return focus to existing runtime actions instead of approval host work:

1. Make Codex CLI environment errors more actionable.
   - Detect WindowsApps/App Execution Alias spawn failures separately from real CLI failures.
   - Recommend npm global Codex CLI when the resolver sees `C:\Program Files\WindowsApps`.

2. Improve terminal/runtime log clarity.
   - Keep final markdown output out of xterm.
   - Keep terminal scoped to runtime events, stderr, exit code, and concise status messages.

3. Polish output preview and latest-attempt visibility.
   - Make output preview the primary place to inspect markdown output.
   - Label output as latest attempt when retry/rerun overwrites the current node output.

4. Tighten retry/rerun/review pending feedback.
   - Keep attempt separators visible.
   - Disable duplicate review actions while one is pending.
   - Keep abort/stopping states deterministic.

5. Keep `Explain with AI` deferred.
   - It should be added after existing run, retry, review, abort, and output surfaces are smooth.
