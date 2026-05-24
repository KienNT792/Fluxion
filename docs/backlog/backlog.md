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
| FX-030 | Manual runtime UX smoke pass | P1 | CURRENT | Chot vong desktop verification cho runtime flow that |
| FX-023 | Frontmatter and downstream metadata validation hardening | P1 | PARTIAL | Chan context/doc artifacts xau truoc khi vao flow |
| FX-024 | Provider/runtime config validation expansion | P1 | PARTIAL | Giam run fail do setup/config |
| FX-WO-022 | Context lifecycle trace evaluator | P1 | READY | Giu flow-owned context contract dung va auditable |
| FX-WO-026 | Context redaction and secret reference policy | P0 | READY | Bat buoc truoc khi provider/context state phong phu hon |
| FX-AI-001 | Repo-native workflow export/import format | P2 | NEW | Hoc tu `aidlc`: workflow co the review, diff, sua tay ngoai canvas |
| FX-AI-002 | Reusable markdown skill/prompt library | P2 | NEW | Giam duplication prompt va tang reuse giua workflows |
| FX-AI-003 | Workflow preset/template starter pack | P2 | NEW | Giam startup friction cho workflow authoring |
| FX-AI-004 | Upstream review cascade semantics | P1 | NEW | Cho workflow docs/review co reject semantics thuc te hon |

### High Impact / High Effort

Day la nhom viec can lam, nhung nen sequence can than.

| ID | Item | Priority | Status | Why it matters |
| --- | --- | --- | --- | --- |
| FX-013 | Instruction file generation with frontmatter | P1 | READY | Bien onboarding/context thanh repo-governed asset that su |
| FX-014 | Editable global context and long-term memory surface | P2 | READY | Lam memory/project rules first-class trong product |
| FX-016 | Secondary real adapter implementation | P1 | READY | Dat MVP gate 2 provider duong chay that |
| FX-021 | Explain with AI diagnostic flow | P2 | READY | Tang operator UX khi runtime da on dinh |
| FX-WO-023 | Provider-state aware adapter result | P1 | DISCOVERY | Nen tang cho OpenAI Responses va provider-aware context |
| FX-WO-024 | OpenAI Responses state wiring | P1 | DEFERRED | Provider-state continuity cho non-Codex path |
| FX-WO-025 | Flow context inspector UI | P2 | DEFERRED | Debug/operator UX cho context-heavy runtime |
| FX-AI-005 | Lightweight headless/CLI companion mode | P2 | NEW | Hoc tu `aidlc`: mo rong automation path ngoai desktop app |
| FX-AI-006 | Canonical text workflow format + round-trip editor contract | P2 | NEW | Neu lam, phai quyet dinh source-of-truth giua canvas va text |
| FX-AI-007 | Core extraction pass for engine-facing policy logic | P2 | NEW | Giam host/service coupling, mo duong cho headless mode |

## Unified Current State

### Done foundations

Nhung khoi nen da xong va khong nen lap lai backlog rieng:

- Runtime trace JSONL, telemetry, evaluator baseline, context lineage, flow-owned context foundation.
- Codex readiness/discovery, Windows smoke baseline, CI baseline.
- DAG validation, run-state persistence, review flow co ban, retry/rerun co ban.
- Context init wizard, source-assisted context drafting.

Nhung item nay da duoc track o `FX-*` va `FX-WO-*` duoi day voi trang thai `[DONE]`.

## Unified Backlog

### Track A - Runtime correctness and operator reliability

| ID | Priority | Status | Summary | Source |
| --- | --- | --- | --- | --- |
| FX-030 | P1 | CURRENT | Manual desktop smoke pass for runtime UX: output preview, abort/stopping, review CTA, retry/rerun clarity | master |
| FX-023 | P1 | PARTIAL | Enforce valid frontmatter/metadata before downstream context ingestion | master |
| FX-024 | P1 | PARTIAL | Validate auth/config for all active providers/runtimes before run | master |
| FX-020 | P1 | PARTIAL | Node-level error surface complete with `Explain with AI` handoff still missing | master |
| FX-021 | P2 | READY | Low-cost diagnostic/Explain-with-AI flow for failure analysis | master |
| FX-WO-022 | P1 | READY | Extend evaluator for context lifecycle ordering and invalid commit detection | optimization |
| FX-WO-026 | P0 | READY | Context redaction and secret reference policy | optimization |

### Track B - Workspace-first, repo-governed assets

| ID | Priority | Status | Summary | Source |
| --- | --- | --- | --- | --- |
| FX-013 | P1 | READY | Generate instruction/config files with valid frontmatter | master |
| FX-014 | P2 | READY | Editable global context and long-term memory UI | master |
| FX-AI-001 | P2 | NEW | Add repo-native workflow export/import format for reviewable text workflows | aidlc-derived |
| FX-AI-002 | P2 | NEW | Introduce reusable markdown skill/prompt library with workspace-scoped asset discovery | aidlc-derived |
| FX-AI-003 | P2 | NEW | Ship starter workflow presets/templates for common orchestration patterns | aidlc-derived |
| FX-AI-006 | P2 | NEW | Define canonical round-trip contract between canvas DAG and text workflow representation | aidlc-derived |

Notes:

- `FX-AI-001` khong co nghia thay canvas bang text. Muc tieu la co export/import format co the diff, review, va bootstrap nhanh.
- `FX-AI-006` phu thuoc vao `FX-AI-001`; khong nen lam big-bang rewrite source of truth.

### Track C - Workflow runtime semantics

| ID | Priority | Status | Summary | Source |
| --- | --- | --- | --- | --- |
| FX-019 | P1 | PARTIAL | Retry/rerun subtree with clearer attempt lineage in UX | master |
| FX-AI-004 | P1 | NEW | Add upstream review cascade semantics: reject current node and reopen selected upstream subgraph | aidlc-derived |
| FX-WO-023 | P1 | DISCOVERY | Provider-state aware adapter result | optimization |
| FX-WO-024 | P1 | DEFERRED | OpenAI Responses state wiring | optimization |
| FX-WO-025 | P2 | DEFERRED | Flow context inspector UI | optimization |

Notes:

- `FX-AI-004` nen reuse run-state/context trace hien co, khong duoc reset mutating mo ho.
- Reject cascade phai tuong thich voi DAG scheduling, review recovery, va context snapshot/version rules.

### Track D - Architecture and portability

| ID | Priority | Status | Summary | Source |
| --- | --- | --- | --- | --- |
| FX-016 | P1 | READY | Add a second real adapter/runtime path | master |
| FX-AI-005 | P2 | NEW | Lightweight headless/CLI companion mode for automation-heavy users | aidlc-derived |
| FX-AI-007 | P2 | NEW | Extract more engine-facing policy/contracts out of Electron main services and into core | aidlc-derived |

Notes:

- `FX-AI-005` chi nen bat dau sau khi `FX-AI-007` dat moc toi thieu; neu khong headless mode se duplicate runtime logic.
- `FX-AI-007` khong phai refactor trang tri. Chi tach nhung logic co gia tri lap lai: workflow contract transforms, review transition rules, artifact gate policies, text-format import/export.

## Proposed New Items From `aidlc`

### FX-AI-001 Repo-native workflow export/import format

Priority: `P2`
Status: `NEW`
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
Status: `NEW`
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
Status: `NEW`
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
Status: `NEW`
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
Status: `NEW`
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
Status: `NEW`
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
Status: `NEW`
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

1. `FX-030`
2. `FX-023`
3. `FX-024`
4. `FX-WO-022`
5. `FX-WO-026`

Reason:

- Day la nhom reliability + data integrity + operator confidence can chot truoc.

### Next

6. `FX-AI-003`
7. `FX-AI-002`
8. `FX-013`
9. `FX-AI-001`
10. `FX-AI-004`

Reason:

- Day la nhom hoc tu `aidlc` co impact cao nhat ma khong doi canh san pham Fluxion.

### After that

11. `FX-021`
12. `FX-016`
13. `FX-WO-023`
14. `FX-WO-024`
15. `FX-WO-025`

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

1. `FX-030` Manual runtime UX smoke pass
2. `FX-023` Frontmatter/downstream metadata validation
3. `FX-AI-003` Starter workflow presets/templates
4. `FX-AI-002` Reusable markdown skill/prompt library discovery + minimal implementation

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
