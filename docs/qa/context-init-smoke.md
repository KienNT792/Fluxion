# Context Init Smoke Checklist

Date: 2026-05-10  
Scope: Context Init, onboarding packet, context persistence, and export actions  
Audience: Tech Lead, UX/UI Lead, Solution Architecture Office

Run this checklist on Windows with a disposable workspace. Record pass, fail, or blocked for each
case and attach the Fluxion commit SHA, Windows version, Node/npm versions, and Codex CLI version.

## Setup

- Start from a clean Fluxion worktree or record intentional local changes.
- Confirm `npm run typecheck`, `npm test`, and `npm run build` pass or record blockers.
- Prepare one blank folder, one existing Node/TypeScript repository, and one repository with an
  older or incomplete `.fluxion/context.json`.
- Confirm Codex CLI readiness in Settings. If Codex is unavailable, keep that state for the
  fallback cases below before fixing it.

## Blank Workspace

- Open the blank folder and confirm Context Init opens automatically.
- Confirm the Detect Workspace step identifies the folder as blank and keeps kickoff intent fields
  available.
- Fill project name, goal, target users, first milestone, kickoff intent, and at least one stack
  signal.
- Confirm `Save Context` remains disabled until required blank-project fields are present.
- Save final context and confirm `.fluxion/context.json` and `.fluxion/memory/global-context.md`
  are written.

## Existing Repository

- Open an existing repository without context and confirm the Detect Workspace step shows stack,
  package manager, command, important path, component, and evidence signals.
- Confirm warnings appear when verification commands are missing or scan output is truncated.
- Review Stable Rules, Project Brief, and Agent Focus fields for readable prefill.
- Confirm Step 4 fields, including First Milestone and Architecture, are visible at the expected
  desktop window size and do not hide behind the modal footer.
- Save final context and reopen the workspace to confirm values persist.

## Legacy Or Incomplete Context

- Open a repository with legacy or incomplete context.
- Confirm Fluxion opens the review path instead of overwriting existing context.
- Confirm manual fields survive deterministic scan suggestions unless the user explicitly applies
  packet suggestions.
- Confirm the final Review step clearly separates draft context, final context, and export actions.

## Codex Unavailable Fallback

- Simulate Codex unavailable, not logged in, or blocked readiness.
- Confirm deterministic scan still produces a usable draft.
- Confirm `Run Codex Onboarding` is disabled or clearly marked unavailable.
- Confirm `Save Draft` and deterministic `Save Context` remain available when required fields are
  complete.

## Codex-Assisted Onboarding

- With Codex ready, click `Run Codex Onboarding`.
- Confirm progress states advance through Reading, Mapping, Reviewing, and Done.
- Confirm result tabs show Summary, Architecture, Commands, Risks, and Evidence.
- Confirm command category/risk aliases from Codex output are normalized or rejected with a clear
  actionable error.
- Apply packet suggestions to the context draft and verify only the intended fields change.

## Export Actions

- From Review & Export, preview and save the onboarding packet.
- Confirm `.fluxion/memory/long-term/onboarding.md` contains the packet summary, diagnostics, and
  evidence without dumping secrets or generated/vendor paths.
- Create the onboarding workflow and confirm a valid workflow appears under `.fluxion/workflows/`.
- Preview `AGENTS.md`, apply it in a disposable workspace, and confirm manual content outside the
  Fluxion-managed block is preserved.
- Preview repo-local onboarding skill export and confirm no `.agents/skills/fluxion-onboarding/`
  files are written until the apply action is confirmed.

## Release Gate Notes

- Runtime-blocking failures in context save, packet generation, or artifact apply block release.
- Visual issues block release only when they prevent completing the Context Init flow.
- Codex-assisted failures do not block release if deterministic context save remains usable and the
  error message is actionable.
