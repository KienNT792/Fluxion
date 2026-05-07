# Fluxion Project Assessment

Date: 2026-05-07
Workspace: `C:\Personal\Personal_workspace\Fluxion`
Assessment status: updated after runtime action smoothing, Codex approval guardrail Phase 1, Codex approval protocol probe Phase 2A, and probe evidence was documented.

## Executive Summary

Fluxion da chuyen tu "desktop alpha co runtime foundation" sang trang thai gan hon voi mot Codex-first workflow runner co guardrail van hanh ro rang.

Trong ngay 2026-05-07, trong tam khong con la them feature moi nhu `Explain with AI`, ma la lam tron cac action runtime dang co:

- Terminal khong nen la noi doc final markdown output; output markdown can co preview rieng.
- Run / abort / retry / rerun / review action can co state ro, khong gay nham lan khi workflow dang dung, stopping, hoac pending.
- Codex approval policy can duoc chan truoc khi spawn neu Fluxion chua co interactive approval protocol on dinh.
- Phase 2A da probe thuc te `codex exec --json` va ket luan current Codex CLI la `unsupported` cho interactive approval host.

Danh gia hien tai:

**"Fluxion van la Codex-first desktop alpha, nhung runtime operator UX da ro hon va approval risk da duoc khoa bang guardrail. Chua nen lam Phase 2B approval host; nen tiep tuc polish runtime UX hien co truoc `Explain with AI`."**

## Validation Snapshot

- `npm run typecheck`: pass
- Targeted Phase 2A/runtime tests: pass
  - `npm test -- src/shared/codex-approval-guardrail.test.ts src/main/test/provider-registry.service.test.ts src/renderer/src/lib/workflow-session.test.ts scripts/probe/codex-approval-protocol.test.mjs`
  - Result: `4` files, `24` tests passed
- Probe parser test: pass
  - `npm test -- scripts/probe/codex-approval-protocol.test.mjs`
  - Result: `1` file, `4` tests passed
- Full `npm test`: environment-blocked
  - Vitest reports `22` files passed and `92` tests passed.
  - `src/main/test/codex-cli-runner.test.ts` and `src/main/test/workflow-engine.test.ts` fail before tests run because Electron is not installed correctly in `node_modules/electron`.
  - Error: `Electron failed to install correctly, please delete node_modules/electron and try installing again`

Note: this validation was run on the current remote machine. npm global prefix,
Codex CLI resolution, Electron install state, and absolute paths can differ when
the same workspace is used later on the local machine. Treat remote-specific
paths and install errors as environment evidence, not as guaranteed local
machine state.

## Completed Today

### Runtime action smoothing before `Explain with AI` [PARTIAL -> CURRENT]

The earlier direction was corrected: `Explain with AI` should not be implemented before existing workflow actions feel reliable.

Implemented source-level runtime UX improvements include:

- Terminal/log cleanup path.
  - Codex final markdown output is treated as node output, not terminal stdout noise.
  - Terminal path is scoped back toward runtime logs, stderr, status, exit, and errors.
- Output preview path.
  - Shared IPC channel exists for workspace-bound text file reads: `WORKSPACE_READ_TEXT_FILE`.
  - Main process validates workspace boundaries before reading output text.
  - Renderer has `OutputPreview` for markdown output outside xterm.
- Abort state clarity.
  - Renderer workflow status includes `stopping`.
  - Abort is Promise-based and does not immediately mark workflow `aborted`.
  - Run/project-changing actions are disabled while stopping.
- Review UX split.
  - Topbar can surface `Review Required`.
  - Review actions moved into a dedicated review section instead of being mixed into node config.
  - Review action pending state disables duplicate approve/rerun/reject actions.
- Retry/rerun attempt clarity.
  - Retry and review rerun append attempt separators instead of silently clearing history.
  - Output remains latest-attempt oriented.

Remaining risk: these changes are verified by typecheck and targeted tests, but still need a manual end-to-end desktop run after Electron install is healthy.

### Codex approval guardrail Phase 1 [DONE]

Fluxion now treats Codex approval policy as product runtime behavior, not just config text.

Implemented behavior:

- Uses the flat Codex approval values currently exposed by Fluxion:
  - `approval_policy = never | on-request | untrusted`
  - `sandbox_mode = read-only | workspace-write | danger-full-access`
  - `windows.sandbox = unelevated | elevated`
- Default remains `workspace-write + never`.
- `on-request` and `untrusted` are blocked unless approval protocol support is explicitly known.
- `danger-full-access + never` warns but does not block.
- `read-only + never` warns but does not block.
- Renderer blocks before `resetExecution`, so existing logs/state are not erased by a config-only guardrail failure.
- Main process performs the same guardrail check before `workflowEngine.start`, so renderer bypass cannot spawn an unsupported interactive policy.
- `PropertiesPanel` now has a separate `Codex Permissions` section.

OpenAI docs checked on 2026-05-07 also list a newer granular approval-policy
object form. Fluxion should explicitly block or design support for that shape
before any Phase 2B approval-host implementation.

This closes the immediate risk where a non-interactive Fluxion workflow could hang waiting for a Codex approval prompt.

### Codex approval protocol probe Phase 2A [DONE]

Phase 2A did not implement interactive approval UI. It added a compatibility probe and kept the runtime fail-safe.

Implemented artifacts:

- Shared capability result:
  - `CodexApprovalProtocolStatus = supported | unsupported | unknown`
  - `CodexApprovalProtocolProbeResult`
- Provider capability plumbing:
  - Codex capabilities expose `approvalProtocol`.
  - Default status is `unknown`.
- Guardrail update:
  - Interactive approval policies are allowed only when protocol status is `supported`.
  - Current default/cached state keeps them blocked.
- Standalone probe:
  - `scripts/probe/codex-approval-protocol.mjs`
  - Uses `codex exec --json --sandbox read-only --config approval_policy=on-request`.
  - Uses `--skip-git-repo-check` because the probe temp workspace is not a Git repo.
  - Captures JSONL stdout, stderr, exit code, timeout state, observed event types, and capped event previews.
  - Does not parse terminal prompt text.

Probe evidence is recorded in:

- `docs/runtime/codex-approval-protocol-probe.md`

Observed result:

- Status: `unsupported`
- Events: `thread.started`, `turn.started`, `item.completed`, `turn.completed`
- No structured approval request event
- No correlation id
- No programmatic reply channel
- Approve/reject deterministic behavior cannot be tested

Decision:

**Do not implement Phase 2B approval host from current evidence.**

### Environment finding: WindowsApps Codex alias [DONE]

During probe setup, the WindowsApps Codex alias was identified as a spawn-risk path:

- Windows could find Codex under `C:\Program Files\WindowsApps\OpenAI.Codex_...\app\resources\codex.exe`.
- Node spawn through the probe failed with `spawn EPERM`.
- Installing `@openai/codex` via npm global produced a spawnable CLI path:
  - `C:\nvm4w\nodejs\node.exe C:\nvm4w\nodejs\node_modules\@openai\codex\bin\codex.js`

This should become a product-facing readiness improvement: Fluxion should detect WindowsApps/App Execution Alias failures and recommend npm global Codex CLI.

Remote-machine caveat:

- The observed npm global path and WindowsApps alias belong to the current remote machine.
- On the local machine, rerun `where.exe codex`, `npm prefix -g`, `codex --version`, and the probe before making a final local setup decision.
- The product recommendation still stands: Fluxion should prefer a spawnable Windows-native Codex CLI and report App Execution Alias / `EPERM` failures clearly.

## Current Project State

### Strengths

- Runtime actions now have clearer state boundaries: running, stopping, paused, review pending, retry/rerun attempts.
- Output markdown has a dedicated preview direction instead of being forced through terminal output.
- Codex permission config is visible where the user edits node parameters, but runtime/review state is no longer treated as config.
- Approval risk is now fail-before-spawn in both renderer and main process.
- Phase 2A evidence prevents premature implementation of an approval host based on undocumented behavior.
- The project remains aligned with a Windows-first Codex CLI execution model.

### Highest-Impact Gaps

- Full test suite is currently blocked by broken Electron install in `node_modules/electron`.
- Runtime UX polish still has source-level changes that need manual desktop verification:
  - Terminal log cleanup
  - Output preview
  - Clear Terminal store behavior
  - Abort stopping state
  - Review Required CTA
  - Retry/rerun separators
- Codex CLI readiness should handle WindowsApps/App Execution Alias failures explicitly.
- `Explain with AI` remains deferred.
- CI baseline is still missing.
- A second real adapter on the main execution path is still missing.

## Recommended Next Priorities

1. Fix local Electron install / `npm install` environment enough for full `npm test`.
   - Current blocker is not a failing assertion; it is Electron package install state.

2. Manual smoke the runtime UX batch in the desktop app.
   - Successful workflow output should render in output preview, not as raw markdown terminal spam.
   - Abort should show `Stopping` until completion/aborted event.
   - Review Required should bring the user to the review panel.
   - Retry/rerun should preserve old log context with attempt separators.

3. Improve Codex CLI readiness for WindowsApps alias.
   - Detect `C:\Program Files\WindowsApps` candidates that fail with `EPERM`.
   - Prefer npm global/node-script candidate when present.
   - Show actionable setup copy: install `@openai/codex` globally on Windows.

4. Keep Phase 2B approval host blocked.
   - Re-run probe only after Codex CLI version changes or docs expose a stable reply protocol.
   - Use the blocked design note in `docs/runtime/codex-approval-phase-2b-plan.md` as the next-session starting point.

5. Re-evaluate `Explain with AI` after runtime actions are smooth.
   - The feature will be more useful once terminal, output, review, retry, and abort states are reliable.

## Next Session References

Use these files as the starting context for the next implementation session:

- `docs/runtime/codex-approval-protocol-probe.md`
  - Phase 2A evidence and current `unsupported` result.
- `docs/runtime/codex-approval-phase-2b-plan.md`
  - Blocked Phase 2B design and entry criteria if the protocol becomes supported.
- `docs/backlog/fluxion-master-backlog.md`
  - Broader runtime/product backlog.
- `docs/assessments/fluxion-project-assessment-2026-05-06.md`
  - Previous baseline before the 2026-05-07 runtime and approval work.

Official docs to re-check before implementing anything approval-related:

- `https://developers.openai.com/codex/config-reference#configtoml`
- `https://developers.openai.com/codex/concepts/sandboxing#configure-defaults`
- `https://developers.openai.com/codex/agent-approvals-security#sandbox-and-approvals`

Session warning:

- Current validation and Codex CLI path evidence came from the remote machine.
- Before local implementation, rerun `where.exe codex`, `npm prefix -g`, `codex --version`, and the probe on the local machine.
- Phase 2B is documented only as a blocked design. It is not approved for implementation until probe status becomes `supported`.

## Final Verdict

Compared with 2026-05-06, Fluxion did not add a headline agent feature. It improved the product in a more important place: runtime confidence.

The project now has:

- better terminal/output separation,
- clearer review and retry action state,
- safer abort semantics,
- explicit Codex permission guardrails,
- and a documented decision not to build against an unsupported approval protocol.

The next best step is not `Explain with AI` or Phase 2B approval UI. The next best step is to finish runtime UX hardening and verify it in the desktop app after resolving the Electron install/test blocker.
