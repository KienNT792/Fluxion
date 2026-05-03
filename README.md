# 🌊 Fluxion

**The Maestro of AI Agents — Enterprise-grade Desktop Orchestrator**

Fluxion is a high-performance desktop application designed to orchestrate multiple AI Agents (such as Gemini, Codex, Claude) through a visual, diagram-based workflow. Built on top of Electron, Vite, and React, it transforms raw CLI execution into an intuitive node-based graph, enabling seamless, transparent collaboration between different AI models.

## ✨ Key Features & Architectural Highlights

### 🎨 Spatial Workspace (React Flow)
- **Glassmorphism Agent Nodes**: Beautifully designed custom nodes using TailwindCSS v4 with real-time visual feedback (pulsing shadows, status indicators).
- **Animated Data Streams**: Custom bezier edges that animate (dashed flowing effect) to visually represent the flow of data between running AI agents.
- **Drag & Drop Orchestration**: Effortlessly drag agents from the Sidebar library directly into the Flow Canvas.

### ⚡ "The Performance Savior" State Management
- **Decoupled Stores (Zustand)**: Separation of static graph data (`WorkflowStore`) and dynamic execution data (`ExecutionStore`).
- **60FPS Rendering**: React Flow canvas is protected from re-rendering during heavy terminal log streams. Nodes only subscribe to their specific status via selectors.
- **Log Slicing**: Automated truncation of terminal logs (`MAX_LOG_LINES = 1000`) to prevent browser RAM overflow during long-running tasks.

### 🧠 Directed Acyclic Graph (DAG) Execution Engine
- **Topological Sorting**: Calculates dependency trees to execute agents in the precise mathematical order.
- **Memory Context Compiler**: Gathers historical outputs (`.fluxion/memory/`), injects `systemInstruction`, and dynamically compiles the exact context needed for each agent before execution.
- **Graceful Termination**: robust `AbortController` integration combined with Windows-specific `taskkill /T /F` to ensure zero zombie processes remain upon cancellation or app closure.

### 🌉 Type-Safe IPC Bridge
- **Strict Contracts**: All Inter-Process Communication payloads are strictly typed via a shared Domain Layer (`@shared`), bridged securely through Electron's `contextBridge`.
- **Throttled Streaming**: Buffered log streaming (100ms chunks) from Child Process `stdout` to the UI to maintain silky smooth interactions.

## 🛠 Tech Stack

### Frontend (Renderer)
- **Core**: React 19 + TypeScript
- **Bundler**: Vite (via `electron-vite`)
- **Styling**: TailwindCSS v4 (Zero-config, native CSS integration)
- **State Management**: Zustand
- **Diagram Engine**: React Flow (`@xyflow/react`)
- **Icons**: Lucide React

### Backend (Main Process)
- **Framework**: Electron + Node.js
- **Services**: Chokidar (File Watching), Child Process (CLI Execution)
- **Data Serialization**: `gray-matter` (Markdown + Frontmatter)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- Windows OS (Primary target platform for optimal process management)

### Installation

Clone the repository and install dependencies:

```bash
$ npm install
```

### Development

Start the development server with HMR:

```bash
$ npm run dev
```

### Build

Build the application for your target platform:

```bash
# For Windows (Targeted)
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## 🏗 Project Structure (Clean Architecture)

```
Fluxion/
├── src/
│   ├── main/             # Backend: DAG Engine, Memory Manager, IPC Handlers, CLI Adapters
│   ├── preload/          # Secure Bridge: Type-safe Context API (`window.api`)
│   ├── renderer/         # Frontend: React App, Zustand Stores, Flow Canvas, Components
│   └── shared/           # Contract Layer: Types, Interfaces, Enums (`@shared`)
```

---
*Architected for performance, stability, and aesthetics. Powered by [electron-vite](https://electron-vite.org).*
