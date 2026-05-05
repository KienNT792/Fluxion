# 🌊 Fluxion

**Windows-first Desktop Orchestrator for Codex CLI**

Fluxion là ứng dụng desktop dùng Electron, Vite, React và TypeScript để thiết kế, chạy và quan sát các workflow tự động hóa bằng **Codex CLI** trên Windows. Thay vì viết chuỗi lệnh terminal rời rạc, Fluxion biến từng tác vụ `codex exec` thành node trực quan trên canvas, nối chúng thành DAG, truyền context giữa các bước, và stream log chạy thật về giao diện.

## Trọng Tâm Sản Phẩm

- **Codex CLI là runtime chính**: MVP tập trung vào việc điều phối `codex exec`, model selection, prompt, system instruction, sandbox và approval mode của Codex.
- **Windows là nền tảng ưu tiên**: mọi luồng chạy, build, path handling và process cleanup được tối ưu cho Windows.
- **Workflow trực quan thay cho shell script**: người dùng kéo thả node, nối dependency, chạy toàn bộ pipeline và theo dõi trạng thái từng bước.
- **Workspace-first**: Fluxion mở trực tiếp một project folder, tạo `.fluxion/`, lưu workflow và memory ngay trong workspace đó.
- **Có thể mở rộng adapter sau MVP**: kiến trúc vẫn giữ lớp adapter cho provider khác, nhưng hướng build hiện tại ưu tiên Codex CLI + Windows trước.

## Năng Lực Cốt Lõi

### Visual Codex Workflow

- **React Flow Canvas**: dựng workflow dạng node/edge cho các tác vụ Codex.
- **Agent Nodes**: mỗi node đại diện cho một lần chạy Codex với prompt, model và cấu hình riêng.
- **Dependency Graph**: node sau tự nhận output của node trước làm context.

### Codex CLI Execution

- **CLI-first Runtime**: hướng tới chạy Codex qua `codex exec` trong workspace đã chọn.
- **Workspace Sandbox**: mặc định thiết kế quanh chế độ làm việc an toàn trong phạm vi project.
- **Realtime Terminal Stream**: stdout/stderr được stream về UI theo batch để tránh làm treo renderer.

### Windows Runtime Reliability

- **Windows Path Safety**: dùng đường dẫn tuyệt đối và xử lý path bằng Node APIs phù hợp Windows.
- **Process Cleanup**: ưu tiên dọn process tree bằng cơ chế Windows như `taskkill /T /F` khi abort hoặc đóng app.
- **No Zombie Processes**: workflow cancellation phải kết thúc sạch các tiến trình CLI đang chạy.

### Memory & Context Pipeline

- **`.fluxion/memory/`**: lưu output node dưới dạng Markdown + Frontmatter.
- **Global Context**: đọc `global-context.md` để inject rule chung cho các lần chạy.
- **Short-term Context**: node sau đọc kết quả `.md` của node trước.
- **Long-term Context**: dành chỗ cho lịch sử/tóm tắt dài hạn khi workflow phát triển.

### Type-safe Desktop Bridge

- **Main Process**: workflow engine, workspace service, memory manager, provider/CLI adapter.
- **Preload Bridge**: expose API an toàn qua `contextBridge`.
- **Shared Contracts**: IPC channels, payloads và workflow types được định nghĩa trong `src/shared`.

## Tech Stack

### Frontend (Renderer)

- React 19 + TypeScript
- Vite qua `electron-vite`
- TailwindCSS v4
- Zustand
- React Flow (`@xyflow/react`)
- Lucide React
- Xterm.js cho terminal surface

### Backend (Main Process)

- Electron + Node.js
- `child_process` cho CLI execution
- `chokidar` cho file watching
- `gray-matter` cho Markdown + Frontmatter
- Type-safe IPC qua shared contracts

## Getting Started

### Prerequisites

- Windows 10/11
- Node.js 18+
- Codex CLI đã cài và đăng nhập

```bash
npm install -g @openai/codex
codex --version
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Windows Build

```bash
npm run build:win
```

Build cho macOS/Linux có thể vẫn tồn tại trong script dự án, nhưng không phải mục tiêu ưu tiên của Fluxion MVP.

## Project Structure

```text
Fluxion/
├── src/
│   ├── core/             # Pure TypeScript contracts: schema, DAG, runs, artifacts, runners
│   ├── main/             # Electron backend: workflow engine, memory, workspace, CLI adapters
│   ├── preload/          # Secure bridge: window.api via contextBridge
│   ├── renderer/         # React app: canvas, layout, stores, terminal UI
│   └── shared/           # IPC contracts, workflow types, provider/capability types
├── docs/                 # Roadmap, backlog, implementation notes
├── resources/            # App assets
└── .fluxion/             # Local Fluxion workspace data
```

## Next Architecture Direction

Fluxion đi theo hướng **AIDLC-style orchestration core**, nhưng giữ trọng tâm **Codex CLI + Windows-first desktop UX**. P0/P0.1 đã đặt nền contract thuần TypeScript để workflow validation, DAG validation, run state, artifact contracts và runner contracts có thể được test độc lập với Electron/UI. P1 đã nối runtime thật qua Codex CLI để workflow node mặc định chạy bằng `codex exec`.

### Core-first Design

- **`src/core` thuần TypeScript đã có**: chứa workflow schema, Codex execution options, artifact schema, run state schema, DAG validation, topological batching và runner contracts; không import Electron hoặc React.
- **Electron là orchestration shell**: Main process gọi core để validate workflow và dùng adapter bridge để chạy Codex CLI; phần run persistence/artifact gates vẫn để phase sau.
- **Renderer là control surface**: React Flow hiển thị, chỉnh sửa và điều khiển workflow; logic runtime sẽ tiếp tục được kéo dần về core ở các phase sau.

### Codex Runner Registry

- **Runner registry contract đã có**: `codex` là runner chính, `custom` là extension point có kiểm soát.
- **`CodexCliRunner` đã được triển khai ở P1**: runner thật chạy `codex exec` bằng `spawn`, không nối command string cho lệnh chính.
- **Codex JSON mode đã hoạt động ở runner layer**: runner parse NDJSON từ `codex exec --json` thành `json-event`, đồng thời giữ fallback stdout/stderr raw.
- **Final output ổn định cho memory**: P1 dùng `--output-last-message` để lấy assistant final message sạch thay vì lưu raw NDJSON.

### Workflow Schema & Artifact Gates

Mỗi node có contract rõ ràng hơn thay vì chỉ là prompt:

```ts
{
  id: string;
  data: {
    runner: 'codex' | 'custom';
    model?: string;
    prompt: string;
    systemInstruction?: string;
    codex?: {
      json: boolean;
      sandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access';
      approvalPolicy: 'untrusted' | 'on-request' | 'never';
      windowsSandbox?: 'unelevated' | 'elevated';
      profile?: string;
      config?: Record<string, string | number | boolean>;
    };
    requires?: Array<{ path: string; required?: boolean }>;
    produces?: Array<{ path: string; required?: boolean }>;
    humanReview?: boolean;
  };
}
```

- **`requires`**: artifact hoặc file context cần tồn tại trước khi node chạy.
- **`produces`**: artifact node phải tạo ra sau khi chạy.
- **Backward-compatible defaults**: workflow cũ không có `runner`, `codex`, `requires`, `produces` hoặc `humanReview` vẫn validate được.
- **Artifact-first memory**: output vẫn lưu trong `.fluxion/memory/`, nhưng frontmatter cần chuẩn hóa theo `runId`, `nodeId`, `runner`, `model`, `status`, `exitCode`, `startedAt`, `completedAt`.

### Run State & Manual Accept

Run state contract đã được định nghĩa trong core. Ở P2, mỗi lần chạy workflow sẽ được lưu tại:

```text
.fluxion/runs/<runId>.json
```

Run state cần hỗ trợ các trạng thái:

- `pending`
- `running`
- `awaiting_review`
- `completed`
- `failed`
- `aborted`
- `rejected`

Điều này mở đường cho resume, retry, audit trail và Manual Accept. Nếu node có `humanReview: true`, Fluxion dừng ở `awaiting_review`; user có thể approve, reject hoặc rerun trước khi downstream nodes tiếp tục.

## Trạng Thái Hiện Tại

- **Core contract đã sẵn sàng**: `src/core` có schema, DAG validation, runner contracts, run state schema và artifact contracts.
- **Codex runtime đã có**: main process có `CodexCliRunner`, Windows CLI resolver và `CodexCliAdapter` làm runtime mặc định cho workflow node.
- **Streaming đã có nền tảng**: stdout/stderr vẫn đi qua terminal UI hiện tại; NDJSON được parse ở runner contract để phục vụ telemetry/runtime sau này.
- **Memory vẫn theo cơ chế hiện tại**: output node tiếp tục lưu trong `.fluxion/memory/short-term/<workflowId>/<nodeId>.md`.
- **Chưa có P2/P3**: chưa persist `.fluxion/runs/<runId>.json`, chưa enforce `requires`/`produces`, chưa có Manual Accept UI.

## Ưu Tiên Triển Khai

### P0 - Core Contract: Hoàn tất

- Đã tạo `src/core` thuần TypeScript, tách khỏi Electron/React.
- Đã có Zod schemas cho workflow, node, edge, artifact, run state và Codex execution options.
- Đã có DAG validation, cycle detection, topological batching và reachable-node helpers.
- IPC workflow validation đã dùng core validator thay cho logic local trong handler.
- Đã có Vitest coverage cho schema, artifact path, run state và DAG validation.

### P0.1 - Codex-compatible Contracts: Hoàn tất

- Đã chuẩn bị `data.codex` với default `json: true`, `sandboxMode: 'workspace-write'`, `approvalPolicy: 'never'`.
- Runner event contract hỗ trợ `stdout`, `stderr`, `status` và `json-event`.
- Run state có chỗ lưu `runner`, `model` và `runnerSessionId` để phục vụ `codex exec resume` ở phase sau.
- IPC validation dùng `safeParse` để báo lỗi payload rõ hơn.

### P1 - Real Codex Runner: Hoàn tất

- Đã thêm `CodexCliRunner` chạy `codex exec` bằng `spawn`.
- Prompt được truyền qua stdin với `PROMPT = -`, tránh lỗi quoting Windows.
- Đã map model, workspace `--cd`, sandbox mode, approval policy, Windows sandbox, profile và config override.
- Mặc định dùng `--json`, parse NDJSON thành `json-event`, vẫn giữ fallback stdout/stderr raw.
- Đã dùng `--output-last-message` để lấy final assistant output sạch cho memory.
- Abort dùng process-tree cleanup trên Windows qua `taskkill` argument array.
- Test dùng fake child process, không phụ thuộc Codex CLI thật.

### P2 - Run State & Artifact Gates: Ưu tiên hiện tại

- Persist `.fluxion/runs/<runId>.json`.
- Chỉ cho node chạy khi `requires` hợp lệ.
- Validate `produces` sau execution.
- Chuẩn hóa Markdown memory frontmatter trong `.fluxion/memory/short-term/<workflowId>/<nodeId>.md`.

### P3 - Human Review / Manual Accept

- Nếu `humanReview: true`, workflow chuyển sang `awaiting_review`.
- UI cho phép Approve, Reject và Rerun.
- Downstream nodes chỉ chạy sau khi được approve.

### P4 - Thin UI Shell

- Renderer tập trung vào visual editing và control surface.
- Main process giữ vai trò IPC/process bridge.
- Core quyết định workflow hợp lệ, node nào có thể chạy tiếp và run state hiện tại.

## MVP Direction

Fluxion MVP được đánh giá hoàn thành khi:

- [x] Có adapter Codex CLI chạy thật trên Windows.
- [ ] Chạy được workflow DAG `Node A -> Node B` end-to-end qua smoke test thủ công.
- [x] Output node được lưu thành `.md` có Frontmatter trong `.fluxion/memory/`.
- [x] Node sau đọc được output node trước làm context bằng memory pipeline hiện tại.
- [x] Abort workflow có process-tree cleanup cho Codex CLI trên Windows.
- [ ] Build Windows chạy được và có smoke test cơ bản.

---

Fluxion ưu tiên một mục tiêu rõ ràng: **biến Codex CLI trên Windows thành một workflow desktop có thể quan sát, điều khiển và lặp lại được.**
