# Fluxion Unified Backlog

Date: 2026-05-24
Workspace: `D:\codex-workflow\Fluxion`
Merged sources:

- `docs/backlog/workflow-optimization-sprint.md`
- `docs/backlog/fluxion-master-backlog.md`
- comparative analysis against `references/aidlc`

## Purpose

Tai lieu nay hop nhat backlog runtime/workflow optimization va master product backlog thanh mot danh sach uu tien duy nhat cho Fluxion. Muc tieu la:

1. Giu mot backlog co thu tu uu tien nhat quan.
2. Gop cac item workflow optimization vao product roadmap chinh.
3. Them cac huong cai tien ma Fluxion nen hoc tu `aidlc`, nhung chi khi phu hop voi huong san pham Windows-first desktop orchestrator.

Tai lieu nay khong thay doi source of truth ve implementation da ship. Cac item `[DONE]` duoc giu lai de backlog co continuity.

## Planning Lens

Fluxion khong nen copy `aidlc` theo huong lam giam ban sac desktop-orchestrator cua minh. Nhung Fluxion nen hoc 5 y chinh tu `aidlc`:

1. Repo-native text config de de review va sua tay.
2. Reusable markdown skills/prompts nhu artifact first-class.
3. Review semantics linh hoat hon, nhat la reject cascade/upstream reset.
4. Lightweight/headless path cho power users va automation.
5. Core orchestration va workflow contract can tiep tuc tach khoi UI/runtime host toi muc toi da.

## Priority Legend

- `P0`: Blocker cho runtime correctness, data integrity, hoac alpha/beta reliability.
- `P1`: High-impact core capability cho product direction hien tai.
- `P2`: Important enhancement, nen co truoc public beta hoac de giam friction cho advanced users.
- `P3`: Strategic extension sau khi core da on.

## Effort / Impact Lens

### High Impact / Low Effort

Day la nhom viec nen uu tien neu muon lay gia tri nhanh.

| ID | Item | Priority | Status | Why it matters |
| --- | --- | --- | --- | --- |
| FX-030 | Manual runtime UX smoke pass | P1 | DONE | Windows smoke baseline green after onboarding category regression fix |
| FX-023 | Frontmatter and downstream metadata validation hardening | P1 | DONE | Context ingestion now rejects invalid global/short-term frontmatter before prompt compile |
| FX-024 | Provider/runtime config validation expansion | P1 | DONE | Run preflight now blocks unavailable Codex, missing auth, unsupported runners, and unfinished secondary providers |
| FX-WO-022 | Context lifecycle trace evaluator | P1 | DONE | Trace evaluator now checks context commit shape, version advance, and idempotency-key uniqueness |
| FX-WO-026 | Context redaction and secret reference policy | P0 | DONE | Flow context schema rejects secret-like keys/values and requires replacement refs for redaction entries |
| FX-AI-001 | Repo-native workflow export/import format | P2 | DONE | Hoc tu `aidlc`: workflow co the review, diff, sua tay ngoai canvas |
| FX-AI-002 | Reusable markdown skill/prompt library | P2 | DONE | Workspace skill assets are discoverable, summarized in onboarding, and referenced in repo-skill preview output |
| FX-AI-003 | Workflow preset/template starter pack | P2 | DONE | Empty canvas now offers five starter Codex workflow templates |
| FX-AI-004 | Upstream review cascade semantics | P1 | DONE | Cho workflow docs/review co reject semantics thuc te hon |

### High Impact / High Effort

Day la nhom viec can lam, nhung nen sequence can than.

| ID | Item | Priority | Status | Why it matters |
| --- | --- | --- | --- | --- |
| FX-013 | Instruction file generation with frontmatter | P1 | DONE | Bien onboarding/context thanh repo-governed asset that su |
| FX-014 | Editable global context and long-term memory surface | P2 | DONE | Lam memory/project rules first-class trong product |
| FX-016 | Secondary real adapter implementation | P1 | DONE | Dat MVP gate 2 provider duong chay that |
| FX-021 | Explain with AI diagnostic flow | P2 | DONE | Tang operator UX khi runtime da on dinh |
| FX-WO-023 | Provider-state aware adapter result | P1 | DONE | Nen tang cho OpenAI Responses va provider-aware context |
| FX-WO-024 | OpenAI Responses state wiring | P1 | DONE | Provider-state continuity cho non-Codex path |
| FX-WO-025 | Flow context inspector UI | P2 | DONE | Debug/operator UX cho context-heavy runtime |
| FX-AI-005 | Lightweight headless/CLI companion mode | P2 | DONE | Hoc tu `aidlc`: mo rong automation path ngoai desktop app |
| FX-AI-006 | Canonical text workflow format + round-trip editor contract | P2 | DONE | Neu lam, phai quyet dinh source-of-truth giua canvas va text |
| FX-AI-007 | Core extraction pass for engine-facing policy logic | P2 | DONE | Giam host/service coupling, mo duong cho headless mode |

## Unified Current State

### Done foundations

Nhung khoi nen da xong va khong nen lap lai backlog rieng:

- Runtime trace JSONL, telemetry, evaluator baseline, context lineage, flow-owned context foundation.
- Codex readiness/discovery, Windows smoke baseline, CI baseline.
- DAG validation, run-state persistence, review flow co ban, retry/rerun co ban.
- Context init wizard, source-assisted context drafting.

Nhung item nay da duoc track o `FX-*` va `FX-WO-*` duoi day voi trang thai `[DONE]`.

## Unified Backlog

### Implementation progress

- 2026-05-24: `FX-023` completed. Added core memory frontmatter schemas, enforced global and short-term memory metadata validation before downstream context compilation, excluded invalid/aborted node outputs from prompt context with source warnings, and covered the behavior with focused schema and memory-manager tests.
- 2026-05-24: `FX-024` completed. Added provider/runtime preflight before workflow start, reusing provider readiness capabilities to block missing Codex CLI/auth, unsupported runners, and OpenAI API provider execution until a real secondary adapter ships.
- 2026-05-24: `FX-WO-022` completed. Extended the local workflow trace evaluator to reject committed context deltas with missing replay metadata, non-advancing context versions, or duplicate non-replay idempotency keys.
- 2026-05-24: `FX-WO-026` completed. Hardened flow-context guarded payloads to reject raw secret-like values under neutral keys and require redaction entries to include a replacement reference plus timestamped redaction metadata.
- 2026-05-24: `FX-AI-003` completed. Added five renderer-side starter workflow templates for simple chain, review chain, implementation review, triage, and docs update, exposed them from the empty canvas, and covered deterministic template graph generation with focused tests.
- 2026-05-24: `FX-AI-002` completed. Added workspace-scoped skill asset discovery for `.agents/skills`, `.fluxion/skills`, and `.github/codex/prompts`, surfaced the detected assets in onboarding packets and repo-skill preview output, and covered discovery with focused tests.
- 2026-05-24: `FX-013` completed. Added repo-governed Codex instruction file generation with YAML frontmatter alongside AGENTS.md export, preserved merge-aware updates for existing instruction files, and covered the export contract with focused tests.
- 2026-05-24: `FX-AI-001` completed. Added repo-native workflow text export/import helpers on the workspace service, emitted canonical reviewable workflow markdown with metadata frontmatter, supported import back into `.fluxion/workflows/*.fluxion.json`, and covered the round-trip with focused tests.
- 2026-05-24: `FX-AI-004` completed. Added upstream review cascade support so reject can target a selected upstream node, reopen the upstream subgraph, reset downstream run-state deterministically, and surface the selected upstream target in review payloads and tests.
- 2026-05-24: `FX-014` completed. Added editable workspace memory surface for `.fluxion/memory/global-context.md` and `.fluxion/memory/long-term/index.md`, wired read/save bridges through the main process and setup modal, and covered the round-trip with focused workspace-memory tests.
- 2026-05-24: `FX-016` completed. Promoted OpenAI from a blocked secondary placeholder to a real runtime path in provider preflight, kept Codex as the default execution path, and verified the OpenAI adapter/runtime contract with focused tests.
- 2026-05-24: `FX-021` completed. Added an Explain workflow failure IPC path, wired renderer node-error handoff into main-process diagnostics summary generation, and surfaced a low-cost explain action on errored nodes with focused type and behavior verification.
- 2026-05-24: `FX-WO-023` completed. Made flow-context provider-state updates provider-aware in the workflow engine, persisted OpenAI response-linked state alongside Codex runner sessions, and covered the behavior with focused workflow-engine tests.
- 2026-05-24: `FX-WO-024` completed. Kept OpenAI provider-state continuity through flow-context reload/recovery, so OpenAI response-linked state remains available after the workflow engine restores a persisted run, with focused snapshot and workflow-engine verification.
- 2026-05-24: `FX-WO-025` completed. Added a flow-context inspector in the right rail that surfaces runtime status, active run metadata, provider-state keys, and tracked node context without introducing a new IPC surface.
- 2026-05-24: `FX-AI-005` completed. Added a lightweight CLI companion script with `workflows`, `validate`, and `run-state` commands so power users can inspect repo-local workflow and run artifacts outside the desktop app, and covered the new entrypoint with focused tests.
- 2026-05-24: `FX-AI-006` completed. Established the canonical text workflow round-trip contract in shared workflow-text metadata, kept export/import as a plain frontmatter-plus-JSON format, and covered representative workflow fidelity plus unsupported-field normalization with focused tests.
- 2026-05-24: `FX-AI-007` completed. Extracted the workflow text export/import policy into `src/core`, leaving `workspace.service` as a thin wiring layer, and covered the shared transform with focused core and workspace tests.
- 2026-05-24: `FX-019` progressed. Added a shared attempt-lineage helper and surfaced clearer attempt labels/previous-attempt counts in the canvas node card, review panel, and runtime output preview, with focused UI and helper tests to keep rerun lineage visible.
- 2026-05-24: `FX-019` progressed again. Harmonized the stale review banner with the shared attempt-lineage helper so retry/rerun labels are consistent across inspector surfaces, and kept the rerun workflow-engine path green under focused verification.
- 2026-05-24: `FX-019` progressed further. Applied the same attempt-lineage label to the runtime error banner so retry surfaces stay consistent, while keeping the retry/rerun subtree behavior itself open for the next pass.
- 2026-05-24: `FX-019` progressed again. When retrying from a node or rerunning a paused review, the renderer now re-focuses terminal output on the fresh attempt root and restores auto-follow mode, keeping subtree retries anchored to the active attempt with focused workflow-session coverage.
- 2026-05-24: `FX-019` progressed further. Rerunning a review node now clears persisted run-state for its downstream subtree instead of only resetting the review node, so dependent nodes cannot keep stale completed/review metadata across a fresh upstream attempt; covered with focused run-state-store and workflow-engine verification.
- 2026-05-24: `FX-019` progressed again. Invalidated subtree retries now remove latest short-term output evidence from the workspace memory index while preserving immutable attempt-history files, so repo-local latest-state evidence no longer points at stale outputs after a rerun/reset; covered with focused memory-manager, run-state-store, and workflow-engine verification.
- 2026-05-24: `FX-019` completed. Closed the retry/rerun subtree checkpoint with aligned attempt-lineage UX, terminal re-focus on fresh attempts, subtree run-state invalidation for review reruns, and stale latest-output evidence cleanup while preserving attempt history; focused renderer/main verification stayed green across workflow-session, run-state-store, workflow-engine, and memory-manager coverage.
- 2026-05-24: `FX-AI-004` progressed. Wired the upstream review target into the review banner so reject actions can visibly target an upstream node in the UI, while preserving the existing engine cascade path and workflow-engine coverage.
- 2026-05-24: `FX-AI-004` progressed again. Made the review-section reject action reflect when an upstream target is selected, so the UI now signals cascade intent consistently across review surfaces while keeping the existing engine behavior unchanged.
- 2026-05-24: Backlog status tables reconciled with implemented work. Marked `FX-AI-004`, `FX-AI-005`, `FX-AI-006`, `FX-AI-007`, and `FX-020` done in the planning summaries so they match the implementation log.
- 2026-05-24: `FX-AI-004` progressed further. Replaced the review-banner upstream freeform input with the same constrained upstream-node selector used by the review section, so cascade targets now stay aligned with valid review nodes and typecheck remains green.
- 2026-05-24: Backlog coherence pass completed. Reconciled the remaining summary and proposed-item status markers for `FX-AI-001`, `FX-013`, `FX-014`, `FX-016`, `FX-021`, `FX-WO-023`, `FX-WO-024`, and `FX-WO-025` so the planning document no longer advertises already-shipped checkpoints as `NEW`, `READY`, `DISCOVERY`, or `DEFERRED`.

### Track A - Runtime correctness and operator reliability

| ID | Priority | Status | Summary | Source |
| --- | --- | --- | --- | --- |
| FX-030 | P1 | DONE | Manual desktop smoke pass for runtime UX: output preview, abort/stopping, review CTA, retry/rerun clarity | master |
| FX-023 | P1 | DONE | Enforce valid frontmatter/metadata before downstream context ingestion | master |
| FX-024 | P1 | DONE | Validate auth/config for all active providers/runtimes before run | master |
| FX-020 | P1 | DONE | Node-level error surface with `Explain with AI` handoff wired into diagnostics flow | master |
| FX-021 | P2 | DONE | Low-cost diagnostic/Explain-with-AI flow for failure analysis | master |
| FX-WO-022 | P1 | DONE | Extend evaluator for context lifecycle ordering and invalid commit detection | optimization |
| FX-WO-026 | P0 | DONE | Context redaction and secret reference policy | optimization |

### Track B - Workspace-first, repo-governed assets

| ID | Priority | Status | Summary | Source |
| --- | --- | --- | --- | --- |
| FX-013 | P1 | DONE | Generate instruction/config files with valid frontmatter | master |
| FX-014 | P2 | DONE | Editable global context and long-term memory UI | master |
| FX-AI-001 | P2 | DONE | Add repo-native workflow export/import format for reviewable text workflows | aidlc-derived |
| FX-AI-002 | P2 | DONE | Introduce reusable markdown skill/prompt library with workspace-scoped asset discovery | aidlc-derived |
| FX-AI-003 | P2 | DONE | Ship starter workflow presets/templates for common orchestration patterns | aidlc-derived |
| FX-AI-006 | P2 | DONE | Define canonical round-trip contract between canvas DAG and text workflow representation | aidlc-derived |

Notes:

- `FX-AI-001` khong co nghia thay canvas bang text. Muc tieu la co export/import format co the diff, review, va bootstrap nhanh.
- `FX-AI-006` phu thuoc vao `FX-AI-001`; khong nen lam big-bang rewrite source of truth.

### Track C - Workflow runtime semantics

| ID | Priority | Status | Summary | Source |
| --- | --- | --- | --- | --- |
| FX-019 | P1 | DONE | Retry/rerun subtree with clearer attempt lineage in UX | master |
| FX-AI-004 | P1 | DONE | Add upstream review cascade semantics: reject current node and reopen selected upstream subgraph | aidlc-derived |
| FX-WO-023 | P1 | DONE | Provider-state aware adapter result | optimization |
| FX-WO-024 | P1 | DONE | OpenAI Responses state wiring | optimization |
| FX-WO-025 | P2 | DONE | Flow context inspector UI | optimization |

Notes:

- `FX-AI-004` nen reuse run-state/context trace hien co, khong duoc reset mutating mo ho.
- Reject cascade phai tuong thich voi DAG scheduling, review recovery, va context snapshot/version rules.

### Track D - Architecture and portability

| ID | Priority | Status | Summary | Source |
| --- | --- | --- | --- | --- |
| FX-016 | P1 | DONE | Add a second real adapter/runtime path | master |
| FX-AI-005 | P2 | DONE | Lightweight headless/CLI companion mode for automation-heavy users | aidlc-derived |
| FX-AI-007 | P2 | DONE | Extract more engine-facing policy/contracts out of Electron main services and into core | aidlc-derived |

Notes:

- `FX-AI-005` chi nen bat dau sau khi `FX-AI-007` dat moc toi thieu; neu khong headless mode se duplicate runtime logic.
- `FX-AI-007` khong phai refactor trang tri. Chi tach nhung logic co gia tri lap lai: workflow contract transforms, review transition rules, artifact gate policies, text-format import/export.

## Proposed New Items From `aidlc`

### FX-AI-001 Repo-native workflow export/import format

Priority: `P2`
Status: `DONE`
Impact/Effort: High impact / Low effort

Outcome:

- User co the export mot workflow thanh text artifact repo-local de review trong git.
- Team co the bootstrap workflow ma khong bat buoc mo Fluxion app truoc.

Recommended scope:

- Phase 1: read-only export tu DAG sang file text/JSON canonically ordered.
- Phase 2: import mot subset an toan tro lai canvas.

Acceptance:

- Export workflow tao file deterministic, stable ordering.
- File co du metadata de diff/review trong PR.
- Import khong lam mat thong tin can thiet cua canvas workflow.

### FX-AI-002 Reusable markdown skill/prompt library

Priority: `P2`
Status: `DONE`
Impact/Effort: High impact / Low effort

Outcome:

- Prompt/system instruction reusable tro thanh first-class asset thay vi chi nam trong node.

Recommended scope:

- Workspace-scoped folder vi du `.fluxion/skills/` hoac `.github/codex/prompts/`.
- Node co the reference skill/prompt asset by id.
- Renderer cho preview/edit asset va cho biet node dang consume asset nao.

Acceptance:

- It nhat mot node co the link toi prompt asset ngoai node JSON.
- Asset thay doi thi node su dung asset do reflect dung.
- Prompt compile ghi ro asset source trong trace/context source report.

### FX-AI-003 Starter workflow presets/templates

Priority: `P2`
Status: `DONE`
Impact/Effort: High impact / Low effort

Outcome:

- User moi co the bat dau tu workflow mau thay vi canvas trong.

Recommended scope:

- 3-5 templates: simple chain, review chain, implementation + review, triage, docs update.
- Co quick action tu empty state/welcome.

Acceptance:

- User tao workflow tu template trong < 3 clicks.
- Template save/load khong pha current workflow schema.

### FX-AI-004 Upstream review cascade semantics

Priority: `P1`
Status: `DONE`
Impact/Effort: High impact / Low effort

Outcome:

- Review khong chi approve/reject current node. User co the gui workflow ve upstream node phu hop va reset downstream phan anh huong.

Recommended scope:

- Review UI them action "Send back to upstream node".
- Engine reset selected upstream node thanh actionable state.
- Downstream nodes bi invalidated co kiem soat.
- Trace/context delta ghi ro ly do cascade.

Acceptance:

- Review reject co the target mot upstream node hop le trong DAG.
- Downstream invalidation la deterministic.
- Context store khong giu commit da het hieu luc nhu latest active state.

### FX-AI-005 Lightweight headless/CLI companion mode

Priority: `P2`
Status: `DONE`
Impact/Effort: High impact / High effort

Outcome:

- Power user co the inspect/export/run mot subset workflow ma khong phai vao full desktop app.

Recommended scope:

- Khong bat dau bang full parity.
- MVP chi can: validate workflow, list workflows, run workflow, inspect run state.

Acceptance:

- Headless path reuse core/main runtime contracts, khong fork business logic.
- Workspace files duoc ton trong nhu desktop path.

### FX-AI-006 Canonical text workflow format and round-trip contract

Priority: `P2`
Status: `DONE`
Impact/Effort: High impact / High effort

Outcome:

- Fluxion co mot text representation first-class ma canvas va automation deu co the dung.

Risk:

- Drift giua canvas graph va text format.
- Round-trip fidelity co the ton kem neu node config ngay cang phong phu.

Acceptance:

- Co ADR ro source-of-truth va unsupported fields neu co.
- Round-trip tests cover representative workflows.

### FX-AI-007 Core extraction pass

Priority: `P2`
Status: `DONE`
Impact/Effort: High impact / High effort

Outcome:

- Giam logic orchestration/policy nam trong Electron main services khi no co the song trong `src/core`.

Recommended scope:

- Khong move process spawning hay filesystem IO vao core.
- Move pure transition/policy pieces: review resolution policy, workflow text transforms, artifact contract transforms, maybe scheduler helpers.

Acceptance:

- New pure modules co test doc lap.
- Main-process services giam trach nhiem policy, giu IO/orchestration wiring.

## Merge Notes Against Existing Backlogs

### Already covered, so do not duplicate

- Runtime evidence, process telemetry, trace evaluator, context lifecycle: da duoc backlog optimization cover rat sau.
- Desktop runtime UX smoke, config validation, Explain with AI, instruction generation: da co trong master backlog.

### Added because current backlogs do not cover them directly

- Repo-native workflow text format
- Reusable prompt/skill asset library
- Starter workflow templates
- Upstream review cascade
- Headless/CLI companion mode
- Core extraction pass to support portability and lower coupling

## Unified Recommended Execution Order

### Now

Completed in the 2026-05-24 checkpoint batch:

- `FX-023`
- `FX-024`
- `FX-WO-022`
- `FX-WO-026`

Reason:

- Nhom reliability + data integrity + operator confidence da duoc chot truoc khi chuyen sang repo-governed asset work.

### Next

1. `FX-AI-005`
2. `FX-AI-006`
3. `FX-AI-007`

Reason:

- Day la nhom hoc tu `aidlc` co impact cao nhat ma khong doi canh san pham Fluxion.

### After that

11. `FX-016`
12. `FX-AI-005`
13. `FX-AI-006`
14. `FX-AI-007`
15. `FX-WO-023`

Reason:

- Khi runtime va repo-governed asset path da on, luc do provider-state va diagnostics moi co gia tri hon.

### Strategic

16. `FX-AI-007`
17. `FX-AI-005`
18. `FX-AI-006`
19. `FX-014`

Reason:

- Day la nhom can ADR ro va co nguy co tac dong rong len source-of-truth va app architecture.

## Suggested Next Sprint

Neu uu tien la hoc tu `aidlc` nhung van practical, sprint tiep theo nen lay 4 item:

1. `FX-AI-002` Reusable markdown skill/prompt library discovery + minimal implementation
2. `FX-013` Instruction file generation with frontmatter
3. `FX-AI-001` Repo-native workflow export/import format
4. `FX-AI-004` Upstream review cascade semantics

Expected result:

- Runtime desktop path dang tin hon.
- Workflow authoring friction giam ro.
- Fluxion bat dau co repo-governed reusable workflow asset thay vi chi canvas-local node prompts.

## Done / Inherited History

### Runtime foundation and optimization

- `FX-WO-001` Structured runtime trace writer [DONE]
- `FX-WO-002` Instrument WorkflowEngine trace events [DONE]
- `FX-WO-003` Codex process telemetry counters [DONE]
- `FX-WO-004` Persist process telemetry into trace [DONE]
- `FX-WO-005` Trace smoke assertions [DONE]
- `S2-000` Sprint 1 checkpoint/backlog hygiene [DONE]
- `FX-WO-006` Memory source report [DONE]
- `FX-WO-007` Output lineage across attempts [DONE]
- `FX-WO-009` Local workflow trace evaluator [DONE]
- `FX-WO-013` Trace health diagnostics and process cleanup [DONE]
- `FX-WO-008` Memory index schema [DONE]
- `FX-WO-014` Flow context ADR and contracts [DONE]
- `FX-WO-015` flowContextId in run state and trace [DONE]
- `FX-WO-016` Append-only flow context store [DONE]
- `FX-WO-017` ContextSnapshot and ContextDelta contracts [DONE]
- `FX-WO-018` Cache-friendly prompt layout guard [DONE]
- `FX-WO-019` Per-node ContextSnapshot lifecycle [DONE]
- `FX-WO-020` Commit ContextDelta after safe states [DONE]
- `FX-WO-021` Parallel delta merge policy [DONE]

### Product/master backlog history

- `FX-001` through `FX-012`, `FX-015`, `FX-017`, `FX-018`, `FX-025` through `FX-031` giu nguyen status tu master backlog.

## Deprecation Note

Sau khi doi chieu va merge:

- `docs/backlog/workflow-optimization-sprint.md` nen duoc giu lam implementation log / research-heavy planning record.
- `docs/backlog/fluxion-master-backlog.md` nen duoc xem la historical product backlog snapshot.
- `docs/backlog/fluxion-unified-backlog.md` nen tro thanh backlog planning chinh tu thoi diem nay.
