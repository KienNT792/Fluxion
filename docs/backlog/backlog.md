# Fluxion Backlog

Updated: 2026-05-26
Workspace: `C:\Personal\Fluxion`

## Purpose

Tai lieu nay la planning backlog chinh cua Fluxion. No thay the backlog cu da drift ve:

- workspace path
- current implementation status
- priority order
- reference tai lieu khong con ton tai

Backlog nay bam theo 3 nguon:

1. source hien tai trong repo
2. deep analysis cua kien truc Fluxion hien tai
3. research moi nhat ve Codex/OpenAI va workflow orchestration

## Product Direction

Fluxion la Windows-first desktop control plane cho Codex workflows.

Huong uu tien hien tai:

1. giu `Codex-first` runtime
2. nang cap Fluxion tu DAG runner thanh policy-aware, MCP-capable orchestration surface
3. bien workflow AI thanh repo-governed infrastructure thay vi terminal session tam thoi

## Priority Legend

- `P0`: correctness, data integrity, security posture, hoac blocking product contract
- `P1`: high-impact core capability cho huong san pham hien tai
- `P2`: enhancement quan trong, giam friction cho advanced users va beta readiness
- `P3`: strategic extension sau khi runtime/core UX da on

## Current Reality

Nhung nen tang da co trong repo:

- Codex CLI runtime path la primary execution path
- OpenAI adapter da ton tai, nhung product posture van nen Codex-first
- run-state persistence, review recovery, artifact gate, flow context, trace evaluator, onboarding, workspace trust, repo-governed memory da ship
- multi-workflow workspace catalog da ship
- repo-native workflow text import/export da ship
- workspace-scoped prompt/skill asset discovery da ship

Nhung khoi can uu tien tiep theo:

- richer Codex config/approval mapping
- MCP topology va tool governance
- config diagnostics
- context/token budget awareness
- repo/doc hygiene

## Priority Now

### P1 - Nen lam tiep ngay

| ID | Status | Item | Why it matters |
| --- | --- | --- | --- |
| FX-CX-001 | IN PROGRESS | Effective Codex config diagnostics view | Da co layer trace explainability o readiness/settings surfaces; con lai la mo rong den cac authoring/runtime surfaces khac |
| FX-CX-002 | DONE | Rich approval policy mapping | Granular approval + reviewer mode da di end-to-end qua schema, UI, runner, guardrail |
| FX-CX-003 | IN PROGRESS | Split run model va review model | Da co workflow-level fallback, runner wiring, va effective-value explainability trong workflow settings, node inspector, va runtime inspector; con lai la polish them cac surfaces authoring/runtime khac |
| FX-CX-004 | IN PROGRESS | MCP readiness and topology surface | Da co topology + live probe + readiness taxonomy + policy posture; node tool UX da biet dependency ready/warning/blocked theo server policy, con lai la workflow-level dependency UX va exhaustiveness trong renderer |
| FX-CX-005 | DONE | Context budget inspector | Da co diagnostics, breakdown, pressure, threshold hints trong runtime va inspector |
| FX-DOC-001 | IN PROGRESS | Repo document cleanup and source-of-truth pass | Backlog da duoc chuan hoa, nhung cleanup/doc drift toan repo chua xong |

### P2 - Sau khi P1 on

| ID | Status | Item | Why it matters |
| --- | --- | --- | --- |
| FX-CX-006 | IN PROGRESS | Workflow policy view | Da co summary band + policy drilldown co ich hon, con lai la polish severity va tiep tuc lam ro dangerous combinations |
| FX-CX-007 | IN PROGRESS | MCP tool scoping in node UX | Da co node-specific allowlist/denylist inline config, dependency state ready/warning/blocked theo MCP server, con lai la validation va preview fidelity |
| FX-CX-008 | IN PROGRESS | Context compaction policy UX | Da co policy UX, threshold plumbing, stale carry-over warning, compact priority, semantic summary primitive, long-term summary reuse, va manual compaction action tu inspector/retry/review flows; con lai la tu dong hoa workflow compaction |
| FX-WIN-001 | IN PROGRESS | Windows Terminal integration pass | Da mo duoc terminal ngoai, session repro theo node/run, deep-link tu failure/review surfaces, va split-pane debug layout; con lai la polish launch presets va richer issue-driven shortcuts |
| FX-CX-009 | IN PROGRESS | Service tier / verbosity / reasoning controls | Da co node-level va workflow-level fallback; con lai la explain effective value va consistency UX |

### P3 - Dau tu kien truc lon hon

| ID | Status | Item | Why it matters |
| --- | --- | --- | --- |
| FX-CX-010 | NEW | Responses-native runtime design | Neu mo rong OpenAI hosted path, can runtime model rieng, khong clone Codex path |
| FX-CX-011 | NEW | Codex-as-MCP-server integration exploration | Mo ra huong dung `codex mcp-server` nhu session fabric |
| FX-CX-012 | NEW | Mixed workflow step types beyond agent nodes | Hoc tu pipeline/orchestration systems nhu Harness |

## Detailed Backlog

### Track A - Codex runtime ergonomics

#### FX-CX-001 Effective Codex config diagnostics view

Priority: `P1`
Status: `IN PROGRESS`

Outcome:

- User thay duoc effective runtime config thay vi doan.

Scope:

- Hien thi config layers:
  - user config
  - project config
  - active profile
  - workflow node overrides
  - CLI inline overrides do Fluxion sinh ra
- Hien thi effective values:
  - model
  - review model
  - sandbox mode
  - approval policy
  - writable roots
  - network access
  - MCP servers
  - trust level

Acceptance:

- Moi workflow run co the explain vi sao no dang dung config hien tai.
- UI co the chi ra blocker do trust/config thay vi chi bao chung chung "run failed".

Implementation anchors:

- `src/main/services/provider-registry.service.ts`
- `src/main/ipc/workflow.handlers.ts`
- `src/renderer/src/features/topbar/*`
- `src/renderer/src/features/settings/*`

#### FX-CX-002 Rich approval policy mapping

Priority: `P1`
Status: `DONE`

Outcome:

- Fluxion map duoc Codex approval model hien tai thay vi chi coarse guardrail.

Scope:

- Ho tro hien thi va persist:
  - `never`
  - `on-request`
  - granular approval policy
- Surface reviewer mode:
  - `user`
  - `auto_review`
- Distinguish approval categories:
  - sandbox escalation
  - request_permissions
  - MCP elicitation
  - skill approval

Acceptance:

- Node inspector co the cau hinh policy ma khong mat fidelity voi Codex config.
- Guardrail message phan biet policy unsupported va policy merely risky.

Implementation anchors:

- `src/shared/codex-approval-guardrail.ts`
- `src/shared/workflow.types.ts`
- `src/core/schema/codex.schema.ts`
- `src/renderer/src/features/node-inspector/components/CodexPermissionsSection.tsx`

#### FX-CX-003 Split run model va review model

Priority: `P1`
Status: `IN PROGRESS`

Outcome:

- Runtime va review khong bi buoc phai dung cung mot model.

Scope:

- Workflow-level hoac settings-level `review_model`
- UI readiness cho model review rieng
- Explain/review/review gate use-case dung review model khi phu hop
- Hien thi effective fallback cho review model, service tier, verbosity, reasoning summary, va reasoning visibility tren node/runtime surfaces

Acceptance:

- User co the de run dung model nhanh/cheap hon va review dung model ky hon.

Implementation anchors:

- `src/main/services/provider-registry.service.ts`
- `src/shared/workflow.types.ts`
- `src/renderer/src/features/settings/*`
- `src/renderer/src/features/node-inspector/*`

#### FX-CX-004 MCP readiness and topology surface

Priority: `P1`
Status: `IN PROGRESS`

Outcome:

- Fluxion bat dau xem MCP la first-class runtime capability.

Scope:

- Read/import relevant MCP config from `.codex/config.toml`
- Hien thi server list, enabled state, timeouts, tool allow/deny
- Ready/not ready state cho MCP servers
- Workflow-level warning neu node phu thuoc config/tool chua available
- Node-level tool scope warning khi server ready nhung bi constraint boi tool policy, disabled, hoac not-ready

Acceptance:

- User co the biet workspace dang co MCP gi va dang usable hay khong.

Implementation anchors:

- `src/main/services/settings.service.ts`
- `src/main/services/workspace.service.ts`
- `src/shared/agent-config.types.ts`
- `src/renderer/src/features/topbar/components/CodexReadinessPopover.tsx`

#### FX-CX-005 Context budget inspector

Priority: `P1`
Status: `DONE`

Outcome:

- Operator thay duoc compiled context dang "to" den muc nao.

Scope:

- Breakdown:
  - global context
  - short-term memory
  - long-term memory
  - node prompt
  - system instruction
- Heuristic token estimate
- Warning thresholds theo model/context window khi co du metadata

Acceptance:

- Sau moi lan compile context, inspector co the hien size va source breakdown.

Implementation anchors:

- `src/main/services/memory-manager.ts`
- `src/main/services/workflow-engine.ts`
- `src/renderer/src/features/project-context/inspector/FlowContextInspector.tsx`
- `src/renderer/src/stores/execution.store.ts`

### Track B - Policy-aware workflow UX

#### FX-CX-006 Workflow policy view

Priority: `P2`
Status: `IN PROGRESS`

Outcome:

- Workflow duoc nhin nhu mot policy object, khong chi la node graph.

Scope:

- Summary band cho:
  - workspace trust
  - sandbox posture
  - approval posture
  - network posture
  - MCP posture
- Highlight dangerous/full-access combinations

#### FX-CX-007 MCP tool scoping in node UX

Priority: `P2`
Status: `IN PROGRESS`

Outcome:

- Node nao co the dung tool nao se minh bach hon.

Scope:

- Inspector cho biet tool sources:
  - built-in
  - MCP
  - app/connector
- Preview allow/deny state theo server/tool
- Preview dependency state cua node voi MCP server ma no override

#### FX-CX-008 Context compaction policy UX

Priority: `P2`
Status: `IN PROGRESS`

Outcome:

- Context growth duoc control bang policy ro rang.

Scope:

- Chon compact mode cho workflow/profile
- Giu semantic summary + artifact refs + selected evidence
- Warning khi subtree rerun dang carry stale payload risk
- Tao duoc long-term summary truc tiep tu compaction warnings trong inspector va retry/review-adjacent actions

### Track C - Windows-first runtime polish

#### FX-WIN-001 Windows Terminal integration pass

Priority: `P2`
Status: `IN PROGRESS`

Outcome:

- Fluxion co external runtime/debug workflow hop ly tren Windows.

Scope:

- Open selected node/run in external Windows Terminal
- Optional pane layout launch cho debug session
- Deep-link tu runtime issue sang shell session reproducible

Current state:

- Da co IPC `shell:open-terminal` va Windows Terminal launch trong main process
- Runtime log/output surfaces co the mo session ngoai theo workspace
- Session moi hien thong tin workspace/run/node/output va goi y command de reproduce/inspect

Remaining gap:

- pane layout hoac split-session cho cac debug flow phuc tap hon
- deep-link sau fail/review tu issue card/banner thay vi chi tu terminal/output actions

Implementation anchors:

- `src/main/services/shell-path.service.ts`
- `src/main/services/process-manager.ts`
- `src/renderer/src/features/runtime/*`

### Track D - Advanced model/runtime controls

#### FX-CX-009 Service tier / verbosity / reasoning controls

Priority: `P2`
Status: `IN PROGRESS`

Outcome:

- Fluxion khong dung lai o model + reasoning basic picker.

Scope:

- model verbosity
- service tier
- richer reasoning settings
- expose token-related knobs khi an toan

### Track E - Strategic runtime expansion

#### FX-CX-010 Responses-native runtime design

Priority: `P3`
Status: `DISCOVERY`

Guardrail:

- Khong implement bang cach nhai lai Codex local runner.
- Phai co design tach:
  - local coding session
  - remote hosted response job
  - background mode
  - tool classes

#### FX-CX-011 Codex-as-MCP-server integration exploration

Priority: `P3`
Status: `DISCOVERY`

Question:

- Fluxion nen tiep tuc shell quanh `codex exec`, hay co mot mode orchestration khac dua tren `codex mcp-server`?

#### FX-CX-012 Mixed workflow step types

Priority: `P3`
Status: `DISCOVERY`

Outcome:

- Workflow co the co them:
  - shell validation step
  - test gate
  - artifact gate
  - approval/manual decision step

## Documentation and Repo Hygiene

### FX-DOC-001 Repo document cleanup and source-of-truth pass

Priority: `P1`
Status: `IN PROGRESS`

Outcome:

- Repo giam doc drift va historical noise.

Scope:

- Cap nhat cac doc con gia tri nhung dang stale
- Loai bo generated/debug/build residue khong nen commit
- Ghi ro source-of-truth docs:
  - `AGENTS.md`
  - `README.md`
  - `docs/backlog/backlog.md`
  - runtime docs nao con active

Acceptance:

- Khong con doc reference file khong ton tai.
- Khong con build residue/debug dump gia tri thap trong repo.

## Execution Order

### Next sprint recommended

1. `FX-DOC-001`
2. `FX-CX-001`
3. `FX-CX-002`
4. `FX-CX-004`
5. `FX-CX-005`

Ly do:

- Day la nhom co gia tri operator/product cao nhat va sat nhat voi Codex/OpenAI capability hien tai.

### After that

1. `FX-CX-003`
2. `FX-CX-006`
3. `FX-CX-007`
4. `FX-CX-008`
5. `FX-WIN-001`
6. `FX-CX-009`

### Strategic later

1. `FX-CX-010`
2. `FX-CX-011`
3. `FX-CX-012`

## Notes

- Khong can tiep tuc duy tri planning text noi ve backlog files cu khong con ton tai.
- Backlog nay la source planning chinh cho giai doan tiep theo.
