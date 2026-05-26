# Agent Review Checklist

Use this checklist before closing non-trivial work in Fluxion.

## Scope

- Did the change stay local to the user request?
- Did it preserve existing behavior unless a behavior change was requested?
- Did it avoid moving backend logic into the renderer?

## Contracts

- If IPC changed, were `src/shared`, `src/preload`, `src/main`, and `src/renderer` updated in that order?
- If workflow execution changed, were `src/core` and `src/main/services/workflow-engine.ts` reviewed?
- If `.fluxion/` shapes changed, were all affected readers and writers updated?

## Windows Safety

- Are paths built with Node path utilities?
- Does process handling still behave safely on Windows?
- Were shell assumptions kept PowerShell-safe?

## Verification

- Was the relevant command set run?
- If not, is the gap stated explicitly?
- Were the closest tests updated when behavior changed?

## Docs

- If durable repo behavior changed, does `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, or the closest doc now reflect it?

