# Fluxion Master Backlog

Date: 2026-05-06
Workspace: `D:\codex-workflow\Fluxion`
Source baseline: `README.md`, `docs/assessments/fluxion-project-assessment-2026-05-06.md`, repo verification on `2026-05-06`

## Purpose

Backlog nay dung de dua Fluxion di tu prototype hien tai thanh mot Windows-first desktop orchestrator co the dung duoc cho workflow agent that. Thu tu uu tien o day van la:

1. Runtime correctness
2. Workspace-first flow
3. Real agent integration
4. Error handling and operator UX
5. Product hardening

## Priority Legend

- `P0`: Blocker. Phai xong de co mot alpha build dang tin cay.
- `P1`: Core MVP. Thieu la app chua dung dung muc tieu cot loi.
- `P2`: Important enhancement. Nen lam truoc public beta.
- `P3`: Nice-to-have. Lam sau khi core da on.

## Status Legend

- `[DONE]`: Delivered va da duoc xac nhan bang repo state hien tai.
- `[PARTIAL]`: Da ship mot phan quan trong, nhung acceptance van con gap.
- `[CURRENT]`: Viec uu tien cao nhat nen lam tiep theo repo state hien tai.

## Current Snapshot

- `git status`: working tree contains local implementation changes for `FX-018`, `FX-025`, `FX-027`, Codex readiness onboarding, UI onboarding clarity/accessibility, docs, and supporting tests.
- `npm run typecheck`: pass
- `npm test`: pass (`14` files, `73` tests)
- `npm run smoke:win`: pass
- P0/P0.1/P1 runtime foundation cho Codex CLI tren Windows da xong.
- Run-state persistence, artifact gates, va V2 memory frontmatter da co trong code va test.
- Workflow-level `Auto` / `Manual` execution mode, dynamic Codex capability discovery, va local Windows unpacked smoke baseline da duoc wire xong.
- Codex runtime readiness onboarding da co: app check `codex login status`, live/bundled model catalog, force refresh, va chi block run khi CLI missing hoac auth missing.
- UI onboarding clarity pass da co: Welcome readiness, Settings copy cleanup, Topbar node/save state, empty-state `Add Agent` / `Try Simple Chain`, va modal/icon accessibility pass.
- Gap con lai co tac dong lon nhat hien nay la `Explain with AI`, retry attempt lineage, provider config validation, CI baseline, va product hardening.

## Release Gates

### Alpha Gate [DONE]

- [x] Mock workflow A -> B chay dung end-to-end.
- [x] Node loi thi dung la `error`, khong bi ghi nham `completed`.
- [x] Abort dung tren Windows, khong de zombie process.
- [x] Workspace co the duoc mo va luu workflow.

### Beta Gate [PARTIAL]

- [x] Co it nhat 1 adapter that de chay agent that.
- [ ] Co `Retry` va `Explain with AI`. Current state: `Retry` da co, `Explain with AI` chua co.
- [ ] Co file watch, context init, instruction file generation. Current state: file watch va context init da co; instruction file generation chua co.
- [x] UI phan anh dung trang thai workflow va node.

### MVP Gate [PARTIAL]

- [ ] Co it nhat 2 adapter that tren main execution path. Current state: Codex CLI runtime da co; adapter khac chua duoc wire vao execution path hien tai.
- [x] Ho tro Auto Accept va Manual Accept o cap workflow.
- [x] Data piping `.md` + frontmatter on dinh.
- [x] Build Windows co the dong goi va smoke test duoc. Current state: local `smoke:win` da verify unpacked Electron build; CI baseline van chua co.

## Definition of Done

- Typecheck pass
- Lint pass hoac backlog item co ghi ro ly do tam chap nhan
- Build pass tren Windows
- Co test hoac smoke validation phu hop muc thay doi
- Khong hardcode secret
- Dung `path.join()` va xu ly dung duong dan Windows
- UI khong bi freeze trong luong stream log

## Phase A - Runtime Reliability

### FX-001 Fix adapter asset packaging and runtime path resolution [DONE]
- Priority: `P0`
- Outcome: Adapter assets va runtime paths da du on dinh cho `dev` va current build path.

### FX-002 Enforce correct success/failure semantics in WorkflowEngine [DONE]
- Priority: `P0`
- Outcome: Engine chi ghi `completed` khi execution that su thanh cong.

### FX-003 Synchronize workflow status between main and renderer [DONE]
- Priority: `P0`
- Outcome: Topbar, node status, abort flow, va completion state da dong bo.

### FX-004 Forward full execution event set to renderer [DONE]
- Priority: `P0`
- Outcome: Renderer nhan du `node-output`, `terminal-error`, `terminal-exit`, review events, va status updates.

### FX-005 Add DAG validation before run [DONE]
- Priority: `P0`
- Outcome: Workflow loi cau truc khong the chay.

### FX-006 Harden Windows abort and process cleanup [DONE]
- Priority: `P0`
- Outcome: Abort tren Windows on dinh va khong de process mo coi.

## Phase B - Workspace and Persistence

### FX-007 Implement workspace open flow [DONE]
- Priority: `P1`
- Outcome: App mo folder du an that su thay vi fallback ve `.`.

### FX-008 Add workspace bootstrap and `workflow.json` persistence [DONE]
- Priority: `P1`
- Outcome: Workflow, memory, va workspace bootstrap co the khoi phuc giua cac session.

### FX-009 Add `chokidar` file watch and renderer event stream [DONE]
- Priority: `P1`
- Outcome: Workspace change stream da duoc day vao renderer.

### FX-010 Add autosave and recovery [DONE]
- Priority: `P1`
- Outcome: User khong mat flow khi app crash hoac dong dot ngot.

## Phase C - Context and Instruction System

### FX-011 Build context initialization wizard [DONE]
- Priority: `P1`
- Outcome: App da co context init modal de thu thap thong tin chien luoc ban dau.

### FX-012 Add source-scan assisted context draft

- Priority: `P2`
- Outcome: Giam thao tac tay khi setup workspace moi.
- Deliverable: Co che quet repo de goi y muc tieu, stack, architecture, style.
- Acceptance:
- App tao duoc ban nhap context tu source tree.
- User co the review va sua truoc khi luu.

### FX-013 Generate instruction files with frontmatter

- Priority: `P1`
- Outcome: Tao `GEMINI.md`, `CODEX.md`, `CLAUDE.md` va file data lien quan theo chuan.
- Deliverable: Instruction file generator co schema frontmatter ro rang.
- Acceptance:
- Moi file duoc sinh ra deu co frontmatter hop le.
- Metadata co `node id`, `status`, `agent name` khi phu hop.
- Template co the tuy bien theo workspace context.

### FX-014 Add editable global context and long-term memory surface

- Priority: `P2`
- Outcome: User co noi quan ly rules chung thay vi chi sua file tay.
- Deliverable: UI editor cho `global-context.md` va tom tat long-term memory.
- Acceptance:
- User sua va luu duoc `global-context.md` trong app.
- Memory compiler doc dung metadata da chuan hoa.

## Phase D - Agent Integration and Execution Modes

### FX-015 Harden adapter contract for real providers [DONE]

- Priority: `P1`
- Outcome: Adapter/runner contract da on dinh cho execute, abort, chunk stream, exit result, va run-state integration.
- Acceptance:
- [x] Adapter co the bao `stdout`, `stderr`, `status`, `exitCode`, `abortReason`.
- [x] Engine khong can biet chi tiet runner implementation.

### FX-016 Implement Gemini adapter

- Priority: `P1`
- Outcome: Co them mot runtime that ngoai Codex.
- Deliverable: Gemini CLI hoac API adapter theo huong Windows-first.
- Acceptance:
- Prompt + context duoc gui dung.
- Streaming log len UI duoc.
- Abort, error va output file hoat dong dung.

### FX-017 Implement Codex adapter [DONE]

- Priority: `P1`
- Outcome: Codex CLI da la runtime that cho workflow node.
- Acceptance:
- [x] Co the chay mot node Codex that tu UI/runtime path hien tai.
- [x] Chunk stream, completion, abort deu thong suot.

### FX-018 Implement Auto Accept and Manual Accept modes [DONE]

- Priority: `P1`
- Outcome: Workflow-level execution mode da duoc persist trong workflow, hien tren topbar, va duoc engine/run-state ton trong trong moi run.
- Deliverable: Run mode selector va execution gate giua cac node.
- Acceptance:
- [x] Auto Accept: node sau tu chay khi upstream xong neu khong co review gate.
- [x] Manual Accept: moi node completed dung lai o `paused` / `awaiting_review` va chi unlock downstream sau approve.
- [x] UI the hien mode dang dung ro rang o cap workflow.

### FX-019 Add Retry node and rerun subtree [PARTIAL]

- Priority: `P1`
- Outcome: Retry from node va rerun paused review node da co, nhung attempt history van con toi gian.
- Deliverable: Retry cho node loi hoac rerun tu node duoc chon.
- Acceptance:
- [x] Retry mot node reset dung subtree lien quan.
- [x] Review node co the rerun trong cung workflow run.
- [ ] Logs va output cu duoc danh dau ro rang giua cac attempt.

### FX-027 Align Codex capability discovery with current CLI [DONE]

- Priority: `P1`
- Outcome: UI va runtime Codex da khop voi `codex debug models`, reuse channel capability hien co, va degrade ro rang khi CLI/auth khong san sang.
- Deliverable: Codex capability discovery service, IPC exposure, va capability-driven renderer.
- Acceptance:
- [x] Parse JSON tu `codex debug models` hoac machine-readable source tuong duong.
- [x] Renderer dung danh sach model/capability dong cho Codex.
- [x] Fluxion hien trang thai unavailable ro rang neu Codex CLI khong co trong PATH.
- [x] Legacy/custom model slug van load/save duoc.

### FX-028 Codex runtime readiness onboarding [DONE]

- Priority: `P1`
- Outcome: Fluxion phan biet ro may da san sang Codex CLI, thieu CLI, thieu login, auth unknown, va catalog warning truoc khi run.
- Deliverable: Runtime-local readiness state, force refresh, setup copy, va run preflight.
- Acceptance:
- [x] `codex login status` duoc chay truoc catalog discovery.
- [x] Live catalog dung `codex debug models`, fallback dung `codex debug models --bundled`.
- [x] `cli_missing` va `auth_missing` block `Run` voi message co action ro.
- [x] `auth_unknown`, `catalog_failed`, bundled catalog, va legacy/custom model chi warning va van cho run.
- [x] Refresh capabilities co force refresh va da duoc toi uu de tranh duplicate in-flight discovery.

### FX-029 Codex-first onboarding and UI clarity pass [DONE]

- Priority: `P2`
- Outcome: Onboarding va toolbar giam nham lan giua Codex CLI va OpenAI API key, dong thoi dua user vao workflow that nhanh hon.
- Deliverable: Welcome readiness, Settings copy cleanup, Topbar node/save state, empty-state quick actions, va accessibility pass.
- Acceptance:
- [x] Welcome co Codex readiness card, gear settings, va chi mot CTA chinh `Open Project Folder`.
- [x] Global Settings lam ro `OpenAI API Key` la optional cho Codex CLI workflows.
- [x] Topbar hien node count va save state ro hon.
- [x] Empty canvas co `Add Agent` va `Try Simple Chain` de tao nhanh DAG `A -> B`.
- [x] Icon-only controls co `aria-label`, modal co focus trap, focus ring dung design token hien co.

## Phase E - Error Handling and Operator UX

### FX-020 Add node-level error surface with actions [CURRENT]

- Priority: `P1`
- Outcome: Node-level status/error surface va `Retry` action da co; `Explain with AI` van chua co.
- Deliverable: Tooltip/panel loi tren node va trong properties panel.
- Acceptance:
- [x] Node loi hien icon/trang thai ro.
- [x] Co nut `Retry`.
- [ ] Co nut `Explain with AI`.

### FX-021 Implement diagnostic agent flow

- Priority: `P2`
- Outcome: App co the phan tich loi bang model chi phi thap.
- Deliverable: Diagnostic adapter/flow cho stderr + context loi.
- Acceptance:
- User bam `Explain with AI` thi co phan tich nguyen nhan.
- Mac dinh dung model re hoac local neu cau hinh co san.

### FX-022 Add markdown output preview and artifact links

- Priority: `P2`
- Outcome: User nhin thay san pham cua moi node ngay trong app.
- Deliverable: Markdown viewer va link mo output file.
- Acceptance:
- Node completed co the preview body markdown.
- Co link toi file `.md` output that.

## Phase F - Data Integrity, Security, and Hardening

### FX-023 Normalize frontmatter schema and memory parsing [PARTIAL]

- Priority: `P1`
- Outcome: Writer/reader gap da giam ro, nhung memory compiler van chua schema-enforce day du downstream artifacts.
- Deliverable: Schema thong nhat cho output md va memory compiler.
- Acceptance:
- [x] Parser khong con phu thuoc vao field `agent` cu.
- [x] Writer da dung V2 frontmatter voi `runId`, `runner`, `status`, `startedAt`, `completedAt`.
- [ ] Metadata khong hop le bi chan truoc khi dua vao downstream context.

### FX-024 Add credential storage and provider config management [PARTIAL]

- Priority: `P1`
- Outcome: OpenAI key storage/settings da co, nhung provider config management chua bao phu toan bo runtime path.
- Deliverable: Secure local settings storage va provider config surface.
- Acceptance:
- [x] API key khong nam trong source code.
- [x] User co the cau hinh OpenAI provider trong app.
- [x] Codex CLI readiness preflight chan CLI missing va auth missing truoc khi run.
- [ ] App validate thieu auth/config truoc khi run cho tat ca provider/runtime lien quan.

### FX-025 Establish test matrix and CI baseline [PARTIAL]

- Priority: `P1`
- Outcome: Unit tests cho engine/runtime core va local Windows smoke baseline da co, nhung CI baseline va lint gate van chua khop DoD.
- Deliverable: Unit test, integration test, build smoke, lint/typecheck pipeline.
- Acceptance:
- [x] Co test cho engine success/error/abort.
- [x] Co test cho memory frontmatter parsing.
- [x] Co build smoke tren Windows.
- [ ] Co CI baseline cho lint/typecheck/test.

### FX-026 Clean lint baseline and align product metadata [PARTIAL]

- Priority: `P2`
- Outcome: README da gan hon voi product that, nhung metadata starter va lint baseline van can don dep.
- Deliverable: Giam lint noise va sua `package.json`, README, docs theo identity Fluxion.
- Acceptance:
- [ ] `npm run lint` pass clean.
- [ ] `package.json` khong con metadata starter.
- [x] README mo ta dung tinh nang hien co hon truoc.

## Suggested Implementation Order

1. `FX-020`, `FX-023`, `FX-025`
2. `FX-024`, `FX-026`, `FX-016`
3. `FX-013`, `FX-014`, `FX-012`
4. `FX-021`, `FX-022`

## Suggested Next Sprint

Sprint tiep theo nen tap trung vao 6 item:

- `FX-020` Hoan tat `Explain with AI` tren error surface da co.
- `FX-023` Chan metadata/frontmatter khong hop le truoc khi dua vao downstream context.
- `FX-025` Dua local `smoke:win` thanh CI baseline cho `typecheck` / `test` / smoke build.
- `FX-024` Mo rong validate auth/config truoc khi run cho tat ca runtime/provider lien quan ngoai Codex CLI readiness da co.
- `FX-026` Don dep lint baseline va metadata san pham.
- `FX-016` Bat dau adapter that thu hai de dong MVP gap "2 real adapters".

Neu xong 6 item nay, Fluxion se chuyen tu "Codex-first desktop alpha da co smoke baseline va onboarding ro rang" sang "beta candidate co verification lap lai duoc, error intelligence, va product hardening tot hon".

## Deferred for Later

- Loop nodes hoac recursive workflows
- Cloud sync
- Multi-user collaboration
- Cost analytics chi tiet
- Plugin marketplace
- Cross-platform parity ngoai Windows
