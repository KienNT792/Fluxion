# Internal Alpha Smoke - 2026-05-15

Workspace: `D:\codex-workflow\Fluxion`  
Reference commit: `a250d6c` (`Provenance, Lineage, and Trace Eval Baseline`)  
Verification mode: automated alpha-hardening baseline plus non-GUI smoke evidence

## Environment

- Windows: `Microsoft Windows [Version 10.0.22621.4317]`
- Node.js: `v26.1.0`
- npm: `11.13.0`
- Codex CLI: `0.128.0`
- Codex auth: `codex login status` reports logged in using an API key
- Build command used for packaging verification: `npm run smoke:win`

## Automated Baseline

- `npm run lint`: pass clean
- `npm run typecheck`: pass
- `npm test`: pass (`47` files, `272` tests)
- `npm run build`: pass
- `npm run smoke:win`: pass
  - verifies typecheck, tests, production build, Windows unpacked packaging
  - confirms `dist\win-unpacked\fluxion.exe` and `dist\win-unpacked\resources\app.asar`
- `npm run eval:workflow -- --workspace <temp-workspace> --run alpha-hardening`: pass with `ok: true`
  - temp workspace: `C:\Users\Asus\AppData\Local\Temp\fluxion-alpha-hardening-smoke`
  - synthetic trace includes `workflow.started`, `node.context_compiled`, `node.output_saved`, `node.process_exited`, and `workflow.completed`

## Manual Desktop Smoke Status

The interactive Electron checklist in [internal-alpha-smoke.md](internal-alpha-smoke.md) was not fully executed in this session.

Blocked manual items:

- Workspace trust prompt, recent workspace management, and multi-workspace reopen flows
- Workflow editing persistence through the live desktop UI
- Runtime run/abort/retry/review flows in the actual Electron app
- Output preview, open/reveal/copy path actions in the rendered UI
- Context Init modal, onboarding packet export, and AGENTS preview/apply flows

Reason:

- Current session has shell access and packaging/test verification, but no interactive desktop control to complete the GUI checklist end to end.

## Current Call

- Automated internal alpha baseline: `PASS`
- Desktop interactive alpha smoke: `PENDING`
- Release blocker still open: complete the manual runtime/context checklist in the packaged or dev app and record pass/fail per item

## Notes

- `npm` emits warnings for legacy Electron mirror config keys (`electron_mirror`, `electron_builder_binaries_mirror`). These do not block current verification but should be cleaned before a future npm major upgrade.
- Node 26 shows deprecation warnings during build/smoke (`module.register()` and shell-args warning in child process paths). These are non-blocking for the current alpha batch and should be tracked separately from runtime UX validation.
