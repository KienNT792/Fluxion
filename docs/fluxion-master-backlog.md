# Fluxion Master Backlog

Date: 2026-05-02
Workspace: `D:\Fluxion`
Source baseline: `docs/fluxion-project-assessment-2026-05-02.md`

## Purpose

Backlog nay dung de dua Fluxion di tu prototype hien tai thanh mot Windows-first desktop orchestrator co the dung duoc cho workflow agent that. Thu tu uu tien o day uu tien:

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

## Release Gates

### Alpha Gate

- Mock workflow A -> B chay dung end-to-end
- Node loi thi dung la `error`, khong duoc ghi `completed`
- Abort dung tren Windows, khong de zombie process
- Workspace co the duoc mo va luu `workflow.json`

### Beta Gate

- Co it nhat 1 adapter that de chay agent that
- Co Retry va Explain with AI
- Co file watch, context init, instruction file generation
- UI phan anh dung trang thai workflow va node

### MVP Gate

- Co it nhat 2 adapter that
- Ho tro Auto Accept va Manual Accept
- Data piping `.md` + frontmatter on dinh
- Build Windows co the dong goi va smoke test duoc

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
- Outcome: Mock adapter và cac adapter sau nay co the chay dung trong `dev` va `build`.

### FX-002 Enforce correct success/failure semantics in WorkflowEngine [DONE]
- Priority: `P0`
- Outcome: Engine chi ghi `completed` khi agent that su thanh cong.

### FX-003 Synchronize workflow status between main and renderer [DONE]
- Priority: `P0`
- Outcome: Topbar, abort button va workflow badge phan anh dung trang thai.

### FX-004 Forward full execution event set to renderer [DONE]
- Priority: `P0`
- Outcome: Renderer nhan day du `node-output`, `terminal-error`, `terminal-exit`.

### FX-005 Add DAG validation before run [DONE]
- Priority: `P0`
- Outcome: Khong cho chay workflow loi cau truc.

### FX-006 Harden Windows abort and process cleanup [DONE]
- Priority: `P0`
- Outcome: Abort tren Windows on dinh va khong de process mo coi.

## Phase B - Workspace and Persistence

### FX-007 Implement workspace open flow [DONE]
- Priority: `P1`
- Outcome: App that su mo mot folder du an thay vi fallback ve `.`.

### FX-008 Add workspace bootstrap and `workflow.json` persistence [DONE]
- Priority: `P1`
- Outcome: Workflow va memory co the khoi phuc giua cac session.

### FX-009 Add `chokidar` file watch and renderer event stream [DONE]
- Priority: `P1`
- Outcome: Fluxion bat dau dung nhu mot workspace orchestrator dung nghia.

### FX-010 Add autosave and recovery [DONE]
- Priority: `P1`
- Outcome: User khong mat flow khi app crash hoac dong dot ngot.

## Phase C - Context and Instruction System

### FX-011 Build context initialization wizard [DONE]
- Priority: `P1`
- Outcome: App ho tro dung 5 cau hoi chien luoc de hieu du an con.


### FX-012 Add source-scan assisted context draft

- Priority: `P2`
- Outcome: Giam thao tac tay khi setup workspace moi.
- Deliverable: Co che quet repo de goi y muc tieu, stack, architecture, style.
- Acceptance:
- App tao duoc ban nhap context tu source tree
- User co the review va sua truoc khi luu

### FX-013 Generate instruction files with frontmatter

- Priority: `P1`
- Outcome: Tao `GEMINI.md`, `CODEX.md`, `CLAUDE.md` va file data lien quan theo chuan.
- Deliverable: Instruction file generator co schema frontmatter ro rang.
- Acceptance:
- Moi file duoc sinh ra deu co frontmatter hop le
- Metadata co `node id`, `status`, `agent name` khi phu hop
- Template co the tuy bien theo workspace context

### FX-014 Add editable global context and long-term memory surface

- Priority: `P2`
- Outcome: User co noi quan ly rules chung thay vi chi sua file tay.
- Deliverable: UI editor cho `global-context.md` va tom tat long-term memory.
- Acceptance:
- User sua va luu duoc `global-context.md` trong app
- Memory compiler doc dung metadata da chuan hoa

## Phase D - Agent Integration and Execution Modes

### FX-015 Harden adapter contract for real providers

- Priority: `P1`
- Outcome: Adapter layer san sang cho CLI/API that.
- Deliverable: Standard hoa lifecycle execute, abort, parse chunk, exit result.
- Acceptance:
- Adapter co the bao `stdout`, `stderr`, `status`, `exitCode`, `abortReason`
- Engine khong can biet chi tiet tung provider

### FX-016 Implement Gemini adapter

- Priority: `P1`
- Outcome: Co it nhat 1 agent that chay duoc.
- Deliverable: Gemini CLI hoac API adapter theo huong Windows-first.
- Acceptance:
- Prompt + context duoc gui dung
- Streaming log len UI duoc
- Abort, error va output file hoat dong dung

### FX-017 Implement Codex adapter

- Priority: `P1`
- Outcome: Phu hop muc tieu da-agent collaboration.
- Deliverable: Codex adapter theo cung contract.
- Acceptance:
- Co the chay mot node Codex that tu UI
- Chunk stream, completion, abort deu thong suot

### FX-018 Implement Auto Accept and Manual Accept modes

- Priority: `P1`
- Outcome: App dat dung operational workflow da dat ra.
- Deliverable: Run mode selector va execution gate giua cac node.
- Acceptance:
- Auto Accept: node sau tu chay khi upstream xong
- Manual Accept: node sau dung lai o `paused` cho user duyet
- UI the hien mode dang dung ro rang

### FX-019 Add Retry node and rerun subtree

- Priority: `P1`
- Outcome: User co the xu ly loi ma khong phai run lai toan bo graph.
- Deliverable: Retry cho node loi hoac rerun tu node duoc chon.
- Acceptance:
- Retry mot node se reset dung subtree lien quan
- Logs va output cu duoc danh dau ro rang

## Phase E - Error Handling and Operator UX

### FX-020 Add node-level error surface with actions

- Priority: `P1`
- Outcome: Dung theo yeu cau "Retry" va "Explain with AI".
- Deliverable: Tooltip/panel loi tren node va trong properties panel.
- Acceptance:
- Node loi hien icon/trang thai ro
- Co nut `Retry`
- Co nut `Explain with AI`

### FX-021 Implement diagnostic agent flow

- Priority: `P2`
- Outcome: App co the phan tich loi bang model chi phi thap.
- Deliverable: Diagnostic adapter/flow cho stderr + context loi.
- Acceptance:
- User bam `Explain with AI` thi co phan tich nguyen nhan
- Mac dinh dung model re hoac local neu cau hinh co san

### FX-022 Add markdown output preview and artifact links

- Priority: `P2`
- Outcome: User nhin thay san pham cua moi node ngay trong app.
- Deliverable: Markdown viewer va link mo output file.
- Acceptance:
- Node completed co the preview body markdown
- Co link toi file `.md` output that

## Phase F - Data Integrity, Security, and Hardening

### FX-023 Normalize frontmatter schema and memory parsing

- Priority: `P1`
- Outcome: Khong con lech giua `provider/model` va field parser.
- Deliverable: Schema thong nhat cho output md va memory compiler.
- Acceptance:
- Parser khong con doc `agent` khi writer ghi `provider`
- Metadata hop le moi duoc dung lam context downstream

### FX-024 Add credential storage and provider config management

- Priority: `P1`
- Outcome: Khong hardcode key va co UX cau hinh an toan.
- Deliverable: `.env`, `electron-store`, hoac Windows Credential Manager abstraction.
- Acceptance:
- API key khong nam trong source code
- User co the cau hinh provider trong app
- App validate thieu key truoc khi run

### FX-025 Establish test matrix and CI baseline

- Priority: `P1`
- Outcome: Giam nguy co vo workflow khi tang truong codebase.
- Deliverable: Unit test, integration test, build smoke, lint/typecheck pipeline.
- Acceptance:
- Co test cho engine success/error/abort
- Co test cho memory frontmatter parsing
- Co build smoke tren Windows

### FX-026 Clean lint baseline and align product metadata

- Priority: `P2`
- Outcome: Repo chuyen tu prototype sang product-ready workspace.
- Deliverable: Giam lint error ve 0 va sua `package.json`, README, docs theo identity Fluxion.
- Acceptance:
- `npm run lint` pass
- `package.json` khong con metadata starter
- README mo ta dung tinh nang hien co, khong marketing vuot implementation

## Suggested Implementation Order

1. `FX-001` -> `FX-006`
2. `FX-007` -> `FX-010`
3. `FX-015` -> `FX-018`
4. `FX-020` -> `FX-024`
5. `FX-025` -> `FX-026`
6. `FX-011` -> `FX-014`

## Suggested First Sprint

Sprint 1 nen chi tap trung vao 6 item:

- `FX-001` Fix runtime path packaging
- `FX-002` Fix execution semantics
- `FX-003` Sync workflow status
- `FX-004` Forward full runtime events
- `FX-005` DAG validation
- `FX-007` Workspace open flow

Neu xong 6 item nay, Fluxion se chuyen tu "UI prototype" thanh "alpha orchestrator co the demo duoc".

## Deferred for Later

- Loop nodes hoac recursive workflows
- Cloud sync
- Multi-user collaboration
- Cost analytics chi tiet
- Plugin marketplace
- Cross-platform parity ngoai Windows
