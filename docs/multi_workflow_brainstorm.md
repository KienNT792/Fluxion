# Brainstorm: Multi-Workflow Manager - Chuan hoa File, Sidebar, Sharing

Day la ban brainstorm tong the cho tinh nang quan ly da workflow trong Fluxion. Tai lieu nay gom 2 lop:

1. de xuat product/design,
2. phan bien ky thuat dua tren codebase hien tai.

Muc tieu la giu huong di tham vong, nhung khong de implementation bi mo ho hoac vuot qua kha nang cua kien truc hien tai.

---

## 1. Cau truc thu muc `.fluxion/`

```text
{project-root}/
`-- .fluxion/
    |-- context.json
    |-- memory/
    |   `-- short-term/
    |-- workflows/
    |   |-- code-audit.fluxion.json
    |   |-- refactor-auth.fluxion.json
    |   `-- my-custom-flow.fluxion.json
    `-- workflow.json
```

Y nghia:

- `context.json`: thong tin project sau buoc Context Initialization.
- `memory/`: memory runtime cua agent.
- `workflows/`: noi chua workflow files theo chuan moi.
- `workflow.json`: legacy file, chi ton tai de tuong thich nguoc trong giai doan chuyen tiep.

Quy tac detect:

- Fluxion quet `.fluxion/workflows/`.
- Chi nhan dien file co duoi `.fluxion.json`.
- Suffix nay la marker de phan biet workflow file cua Fluxion voi JSON thong thuong.

---

## 2. Naming convention

### 2.1. Quy tac ten file

- Format: `{slug-kebab-case}.fluxion.json`
- Slug chi chua:
  - chu thuong `a-z`
  - so `0-9`
  - dau gach ngang `-`
- Khong dung:
  - space
  - underscore
  - ky tu dac biet

Vi du hop le:

- `code-audit.fluxion.json`
- `migrate-jsp-to-react.fluxion.json`
- `api-doc-generator.fluxion.json`
- `phase-1-refactor.fluxion.json`

### 2.2. Ten hien thi trong UI

- UI lay ten tu field `name` ben trong file JSON.
- Ten file chi dung de luu tru.
- App co the cho user dat ten tuy y, sau do tu slugify de tao filename.

### 2.3. Schema workflow file

```json
{
  "fluxionVersion": "1.0",
  "id": "01JV4Q3Q1Y4V9C0M2M5Q6MZ8WD",
  "name": "Code Audit - Phase 1",
  "description": "Workflow kiem tra module Auth truoc khi refactor.",
  "tags": ["audit", "auth", "phase-1"],
  "createdAt": "2026-05-03T04:00:00Z",
  "updatedAt": "2026-05-03T10:30:00Z",
  "nodes": [],
  "edges": []
}
```

Field moi quan trong:

| Field | Y nghia |
| --- | --- |
| `fluxionVersion` | version cua schema de migrate sau nay |
| `id` | dinh danh bat bien cua workflow |
| `description` | mo ta ngan cho tooltip / detail panel |
| `tags` | phan loai, loc, search |
| `createdAt` | thoi diem tao |
| `updatedAt` | thoi diem cap nhat file |

---

## 3. Sidebar va workflow switching

Sidebar moi du kien co:

- header `Fluxion`
- section `Workflows`
- item workflow active / inactive
- action:
  - `New`
  - `Import`
  - `Export`
  - click de switch workflow

Y tuong UI:

- workflow active co accent ro hon
- item co the hien:
  - `name`
  - `description`
  - `legacy` badge
  - `shared` badge

Tuong tac chinh:

- click item -> load workflow len canvas
- export -> xuat file `.fluxion.json`
- import -> copy file vao `.fluxion/workflows/`
- new -> tao workflow moi tu template hoac blank

---

## 4. Sharing model

### 4.1. Export

- User nhan `Export` tren workflow item.
- App xuat 1 file `.fluxion.json` doc lap.
- File tu mang day du metadata + graph.

### 4.2. Import

- User import file `.fluxion.json` vao workspace hien tai.
- App copy file vao `.fluxion/workflows/`.
- Neu conflict, app phai hoi user cach xu ly.

### 4.3. Portability

- Toan bo `.fluxion/workflows/` co the commit vao Git.
- Team mo cung repository co the thay workflow list tu dong.
- Huong di uu tien: offline-first, Git-native, khong phu thuoc server.

---

## 5. Proposed decisions for V1

### 5.1. Migration strategy

Khong nen goi day la "finalized" qua som. De xuat V1:

- Legacy `.fluxion/workflow.json` duoc doc trong giai doan chuyen tiep.
- Workflow tao moi luu vao `.fluxion/workflows/*.fluxion.json`.
- Trong UI, legacy workflow co badge `[legacy]`.
- Rule precedence giua legacy va new format phai duoc khoa ro trong implementation plan, khong chi neu chung trong brainstorm.

### 5.2. ID strategy - ULID

ULID la lua chon hop ly cho workflow id.

Vi du:

```text
01ARZ3NDEKTSV4RRFFQ69G5FAV
```

Ly do:

- unique toan cuc
- co timestamp
- sort duoc theo lexical order
- ngan hon UUID v4 theo nghia su dung UI/URL
- khong phu thuoc auth/user id

Mo rong metadata sau nay:

```json
{
  "id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "createdBy": "user_abc123",
  "createdAt": "2026-05-03T04:00:00Z"
}
```

Conflict khi import:

- cung `id` -> overwrite / fork / cancel
- cung `slug` khac `id` -> rename imported file
- schema khong hop le -> block import

---

## 6. Templates

Template goi y khi tao workspace moi:

### Template 1: `code-audit.fluxion.json`

Display name: `Code Audit - Quick Scan`

```text
[Read Codebase] -> [Analyze & Report] -> [Generate Summary]
     Gemini           Claude Sonnet         Gemini Flash
```

### Template 2: `refactor-plan.fluxion.json`

Display name: `Refactoring Planner`

```text
[Scout Context] -> [Identify Issues] -> [Write Refactor Plan]
   Gemini Flash      Claude Sonnet          Codex
```

Template duoc bundle san trong app, khong doc tu disk luc runtime.

---

## 7. Phan bien tren codebase hien tai

Phan nay khong phu dinh y tuong Multi-Workflow. Muc tieu la chi ra nhung diem hien chua khop voi implementation thuc te cua Fluxion, de team khong xem mot brainstorming product la san sang code ngay.

### 7.1. Kien truc hien tai van la single-workflow

Code hien tai dang duoc xay quanh 1 workflow active duy nhat:

- `src/main/services/workspace.service.ts` hardcode file `.fluxion/workflow.json`
- `src/renderer/src/stores/workflow.store.ts` chi luu:
  - `workflowId`
  - `workflowName`
  - `nodes`
  - `edges`
- `src/renderer/src/lib/workflow-session.ts` build document tu state hien tai, khong co `activeWorkflowFilePath` hoac `workflows[]`
- `src/renderer/src/hooks/useWorkflowPersistence.ts` autosave tren 1 workflow

He qua:

- Multi-workflow khong phai chi la them Sidebar list.
- Day la refactor xuyen main process, preload, IPC, renderer store, autosave, watcher, reload flow.

### 7.2. "Load song song legacy + new" dang mo ho

Neu app vua doc:

1. `.fluxion/workflow.json`
2. `.fluxion/workflows/*.fluxion.json`

thi doc phai tra loi ro:

- file nao la source-of-truth
- file nao duoc autosave
- reload tren Topbar reload file nao
- workflow active mac dinh duoc chon theo quy tac nao

Neu khong khoa ro, user se gap bug kieu:

- canvas dang hien workflow A
- autosave lai ghi vao workflow B
- external change alert noi ve file khac voi file dang mo

### 7.3. Runtime payload chua namespace theo workflow

Code runtime hien tai:

- `src/main/services/workflow-engine.ts` chi cho phep 1 workflow dang chay toan cuc
- `src/shared/ipc.payloads.ts` gui runtime state theo `nodeId`
- `src/renderer/src/stores/execution.store.ts` cung luu state theo `nodeId`

He qua:

- Neu sau nay co queue, background run, hoac concurrent workflow execution thi payload model hien tai se vo ngay.
- Ngay ca khi V1 chua ho tro concurrent run, doc van phai ghi ro:
  - `multi-workflow management`
  - khac voi
  - `multi-workflow execution`

### 7.4. Watcher va external-change detection dang hardcode cho 1 file

Hien tai:

- `workflow.store.ts` chi bat `hasExternalWorkflowChange` khi file doi la `.fluxion/workflow.json`
- `workspace.service.ts` chi track `lastInternalWorkflowWritePath` cho 1 file vua ghi

He qua:

- Neu active workflow nam trong `workflows/*.fluxion.json`, app co the bo sot external change.
- App cung khong du thong tin de biet:
  - internal write cua workflow A
  - co phai nham voi external write cua workflow B hay khong

### 7.5. Import/export conflict policy chua du chat

Doc hien moi nhac conflict theo `id`, nhu vay chua du.

Can quy dinh ro:

- cung `id`, khac `updatedAt`
- cung `slug`, khac `id`
- schema cu hon / moi hon
- import nhu overwrite hay nhu fork

De xuat toi thieu:

- them `fluxionVersion`
- dung `updatedAt`
- co conflict matrix ro truoc khi code UI import

### 7.6. Memory va output chua namespace theo workflow

Hien tai:

- `src/main/services/memory-manager.ts` ghi short-term output vao `.fluxion/memory/short-term/{nodeId}.md`
- `src/main/services/workflow-engine.ts` phat `outputFilePath` theo convention nay

He qua:

- clone/fork workflow de gay de output neu node id trung nhau
- context cua workflow nay co the ro ri sang workflow kia

Huong an toan hon:

- `.fluxion/memory/short-term/{workflowId}/{nodeId}.md`

hoac

- `.fluxion/workflows/{workflowId}/memory/{nodeId}.md`

### 7.7. Naming convention chua du cho Windows-first

Rule `kebab-case` la dung huong, nhung chua du cho Windows:

- reserved names: `CON`, `PRN`, `AUX`, `NUL`, ...
- case-insensitive collision
- ky tu cam trong filename
- do dai path

Can co quy tac normalize slug va fallback strategy, khong chi dung o muc "format dep".

### 7.8. Sidebar spec dang di nhanh hon API spec

Doc mo ta:

- `New`
- `Import`
- `Export`
- switch workflow
- section `Shared`

Nhung code hien tai trong:

- `src/preload/index.ts`
- `src/main/ipc/workflow.handlers.ts`

chua co IPC surface cho:

- list workflows
- load workflow by id / path
- create workflow
- rename workflow
- export workflow
- import workflow

Ket luan:

- Truoc khi ve chi tiet UI, can chot data model va IPC contract.

---

## 8. V1 implementable scope de de code va de test

De tranh refactor qua rong trong 1 buoc, scope V1 nen duoc khoa nhu sau:

1. Multi-workflow management, nhung chi 1 workflow active tren canvas
2. Chi 1 workflow duoc run tai 1 thoi diem
3. `workflows/` la source-of-truth moi
4. Legacy `workflow.json` chi doc trong giai doan chuyen tiep
5. Workspace payload can mo rong thanh:
   - `workflows: WorkflowListItem[]`
   - `activeWorkflowId`
   - `activeWorkflowFilePath`
   - `legacyWorkflowDetected`
6. Runtime payload can namespace theo `workflowId`
7. File change event can biet:
   - file nao thuoc workflow nao
   - workflow do co phai active hay khong

Neu khong khoa scope theo huong nay, feature rat de truot thanh mot tap hop thay doi UI dep nhung state model va persistence chua du on dinh.

---

## 9. Ket luan

Y tuong multi-workflow la dung huong, dac biet o 3 diem:

- suffix `.fluxion.json`
- metadata mo rong
- sharing offline-first / Git-native

Nhung brainstorming hien tai can duoc doc nhu mot design proposal, khong phai implementation-ready spec. Muon code an toan, can bo sung rang buoc ve:

- source-of-truth
- active workflow model
- IPC contract
- runtime namespacing
- watcher behavior
- import conflict rules

Khi nhung diem do duoc khoa ro, luc do moi nen tach task UI, persistence, import/export va migration thanh backlog implementation cu the.
