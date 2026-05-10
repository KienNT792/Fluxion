# Internal Alpha Smoke Checklist

Run this checklist on Windows before treating an internal alpha build as usable for daily Fluxion
work.

## Setup

- Start from a clean Git worktree or record any intentional local changes.
- Confirm Codex CLI is installed in the Windows PATH, not only inside WSL.
- Confirm `codex login status` reports an authenticated account.
- Use a disposable test workspace for runtime-write scenarios.

## Workspace Open

- Open an untrusted workspace and confirm the trust prompt appears before Fluxion writes workspace
  metadata.
- Approve trust and confirm the main editor loads.
- Reopen the same workspace from Recent Workspaces and confirm no duplicate trust prompt appears.
- Reveal and remove a recent workspace entry.
- Open a second trusted workspace and confirm the previous workspace state does not leak.

## Workflow Editing

- Create a workflow, switch to it, save it, then switch back to another workflow.
- Delete a workflow from the library and confirm the active workflow remains valid.
- Add a Codex agent node and edit its label, prompt, model, reasoning effort, human-review flag,
  sandbox mode, approval policy, and Windows sandbox option.
- Save, close/reopen the workspace, and confirm the node settings persist.
- Modify the active `.fluxion/workflows/*.fluxion.json` file externally and confirm the activity
  popover shows a reload action.

## Runtime

- Run a minimal Codex CLI workflow and confirm terminal output streams into the runtime dock.
- Abort a running workflow and confirm the status transitions through stopping without leaving a
  process behind.
- Create a failing node, run it, then retry from that node.
- Run a workflow with a human-review checkpoint, then approve, rerun, and reject from the review UI.
- Confirm output previews and output file actions open, reveal, and copy the expected path.

## Context And Settings

- Run the Context Init smoke checklist in `docs/qa/context-init-smoke.md` for blank, existing,
  legacy/incomplete, Codex unavailable, and Codex-assisted onboarding cases.
- Open context setup, save a draft, reopen it, and confirm values persist.
- Complete required fields and save final context.
- Save the onboarding packet and create the onboarding workflow from Review & Export.
- Create an AGENTS.md preview, clear it, recreate it, and apply the export in a disposable
  workspace.
- Open Global Settings, refresh Codex readiness, add an OpenAI key, clear it, and confirm Codex CLI
  readiness remains the primary runtime signal.

## Recording

- Record the Fluxion commit SHA, Windows version, Node/npm versions, Codex CLI version, and build
  command used.
- Record the Context Init smoke result and link any screenshots or artifact diffs used for review.
- Mark each item as pass, fail, or blocked.
- Runtime-path failures block the alpha. Visual polish issues only block if they prevent completing
  the workflow.
