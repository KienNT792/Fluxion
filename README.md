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
│   ├── main/             # Electron backend: workflow engine, memory, workspace, CLI adapters
│   ├── preload/          # Secure bridge: window.api via contextBridge
│   ├── renderer/         # React app: canvas, layout, stores, terminal UI
│   └── shared/           # IPC contracts, workflow types, provider/capability types
├── docs/                 # Roadmap, backlog, implementation notes
├── resources/            # App assets
└── .fluxion/             # Local Fluxion workspace data
```

## Next Architecture Direction

Fluxion sẽ đi theo hướng **AIDLC-style orchestration core**, nhưng giữ trọng tâm **Codex CLI + Windows-first desktop UX**. Mục tiêu là tách phần workflow engine khỏi Electron để core có thể được test, chạy lại và mở rộng độc lập với UI.

### Core-first Design

- **`fluxion-core` thuần TypeScript**: chứa workflow schema, DAG validation, run state, artifact gates và runner contracts; không import Electron hoặc React.
- **Electron là orchestration shell**: Main process chỉ bridge IPC, quản lý process Windows và gọi core.
- **Renderer là control surface**: React Flow hiển thị, chỉnh sửa và điều khiển workflow; không quyết định logic runtime.

### Codex Runner Registry

- **Default runner là `CodexCliRunner`**: chạy `codex exec` trong workspace đã chọn.
- **Runner contract rõ ràng**: mỗi runner nhận prompt/context/env, stream output, trả exit code và hỗ trợ abort.
- **Custom runner sau MVP**: kiến trúc giữ khả năng thêm runner khác, nhưng MVP không phân tán trọng tâm khỏi Codex CLI.

### Workflow Schema & Artifact Gates

Mỗi node nên có contract rõ ràng hơn thay vì chỉ là prompt:

```ts
{
  id: string;
  runner: 'codex';
  model: string;
  prompt: string;
  systemInstruction?: string;
  requires?: string[];
  produces?: string[];
  humanReview?: boolean;
}
```

- **`requires`**: artifact hoặc file context cần tồn tại trước khi node chạy.
- **`produces`**: artifact node phải tạo ra sau khi chạy.
- **Artifact-first memory**: output vẫn lưu trong `.fluxion/memory/`, nhưng frontmatter cần chuẩn hóa theo `runId`, `nodeId`, `runner`, `model`, `status`, `exitCode`, `startedAt`, `completedAt`.

### Run State & Manual Accept

Mỗi lần chạy workflow nên được lưu tại:

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

## MVP Direction

Fluxion MVP được đánh giá hoàn thành khi:

- Có adapter Codex CLI chạy thật trên Windows.
- Chạy được workflow DAG `Node A -> Node B` end-to-end.
- Output node được lưu thành `.md` có Frontmatter trong `.fluxion/memory/`.
- Node sau đọc được output node trước làm context.
- Abort workflow không để lại process CLI chạy ngầm.
- Build Windows chạy được và có smoke test cơ bản.

---

Fluxion ưu tiên một mục tiêu rõ ràng: **biến Codex CLI trên Windows thành một workflow desktop có thể quan sát, điều khiển và lặp lại được.**
