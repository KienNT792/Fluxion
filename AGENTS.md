🌊 FLUXION - SYSTEM INSTRUCTIONS

Bạn đang hoạt động trong bối cảnh phát triển dự án Fluxion, một Desktop Tool điều phối Agent Workflow (Orchestrator). Nhiệm vụ của bạn là hỗ trợ kỹ thuật, thiết kế logic, viết code và đảm bảo tính nhất quán của hệ thống theo các quy tắc dưới đây.

---

### 1. DANH TÍNH DỰ ÁN (PROJECT IDENTITY)

*   **Tên dự án:** Fluxion.
*   **Nền tảng:** Desktop Application (Electron + Vite + React + TypeScript + NodeJS).
*   **Hệ điều hành mục tiêu:** Windows (Ưu tiên hàng đầu).
*   **Mục tiêu cốt lõi:** Chuyển đổi các câu lệnh CLI thô thành một sơ đồ dòng chảy (Diagram-based Workflow) trực quan bằng React Flow, cho phép nhiều Agent (Gemini, Codex, Claude) hợp tác theo chuỗi.

### 2. KIẾN TRÚC KỸ THUẬT (TECH STACK & LIBRARIES)

*   **Frontend (Renderer):**
    *   **Core:** ReactJS 19 + TypeScript.
    *   **Bundler:** Vite (thông qua `electron-vite`).
    *   **Styling:** TailwindCSS v4 (sử dụng `@tailwindcss/vite`, không dùng `tailwind.config.js`).
    *   **State Management:** Zustand.
    *   **UI/Diagram:** React Flow (`@xyflow/react`), `lucide-react` (Icons), `react-markdown` (hiển thị dữ liệu).
*   **Backend (Main Process & Preload):**
    *   NodeJS xử lý File System (`fs`), File Watching (`chokidar`), và chạy tiến trình ngầm (`child_process`).
    *   Giao tiếp IPC (Inter-Process Communication) chuẩn xác giữa Main và Renderer.
*   **Dữ liệu Flow:** Lưu trữ cấu trúc sơ đồ dưới dạng file `workflow.json`.
*   **Dữ liệu truyền tải (Data Piping):** Sử dụng Markdown kết hợp Frontmatter (phân tích bằng `gray-matter`).
*   **Quy tắc Metadata:** Bất kỳ file data `.md` nào được truyền giữa các Node/Agent đều PHẢI có Frontmatter ở đầu file để lưu Metadata (Ví dụ: `Node ID`, `Status`, `Agent Name`).

### 3. QUY TRÌNH VẬN HÀNH (OPERATIONAL WORKFLOW)

Khi hỗ trợ người dùng xây dựng tính năng, bạn cần hình dung app Fluxion hoạt động qua 5 bước Onboarding & Execution:

1.  **Zero State (Welcome Screen):** Giao diện khởi động tối giản (ẩn Canvas). Người dùng bắt đầu bằng cách `Open Folder`, chọn `Recent Workspaces` hoặc thiết lập `Global Settings` (API Keys).
2.  **Context Initialization (Scout Agent):** Khi mở dự án mới, "Scout Agent" (dùng mô hình nhỏ/local) tự động quét mã nguồn để điền trước (auto-fill) 80% câu trả lời cho 5 câu hỏi chiến lược. Người dùng duyệt và xác nhận. App tạo thư mục `.fluxion/` và dùng `chokidar` theo dõi file.
3.  **Workflow Initialization:** Khởi tạo workflow bằng cách chọn các Template có sẵn (Code Auditing, Refactoring) hoặc bắt đầu từ Blank Canvas với Agent Palette (nút `+`) gợi ý tương tác.
4.  **Auto-Detect & Graceful Degradation:** Tiến trình ngầm tự động kiểm tra các CLI đã cài đặt và trạng thái Auth. Bất kỳ sự thiếu hụt nào (thiếu API Key, chưa cài CLI) đều được xử lý tinh tế ngay trên Node liên quan thay vì báo lỗi hệ thống.
5.  **Flow Execution:** Hệ thống tự động tạo các file `.md` chứa chỉ dẫn cùng Frontmatter chuẩn hóa. Điều phối chạy tuần tự/song song các Terminal ngầm. Giao diện React Flow cập nhật realtime trạng thái từng Node theo 2 chế độ: *Auto Accept* (tự động chạy) và *Manual Accept* (người dùng duyệt từng bước).

### 4. QUY TẮC XỬ LÝ LỖI (ERROR HANDLING RULES)

Khi một Node/Agent trong workflow thất bại (bắt lỗi từ `stderr` của child_process):
*   **Trạng thái (UI):** Hiển thị lỗi rõ ràng trên UI thông qua Tooltip/Icon cảnh báo trên Node của React Flow.
*   **Hành động (Action):** Cung cấp 2 lựa chọn cho người dùng: **Retry** (Thử lại ngay) hoặc **Explain with AI** (Phân tích nguyên nhân).
*   **Diagnostic Agent (Mặc định):** Sử dụng LLM cấu hình thấp hoặc miễn phí (như Gemini 1.5 Flash hoặc Ollama chạy local) để chẩn đoán lỗi, nhằm tiết kiệm chi phí API cho người dùng.

### 5. CHỈ DẪN CHO AGENT KHI VIẾT CODE CHO FLUXION

Mỗi khi AI (bạn) viết code cho dự án này, PHẢI tuân thủ các nguyên tắc sau:

*   **Typing & Typescript:** Code phải type-safe. Định nghĩa rõ ràng các `interface` cho trạng thái Zustand và payload của IPC.
*   **Ưu tiên Windows:** Luôn kiểm tra tính tương thích của đường dẫn. Bắt buộc dùng `path.join()`, xử lý dấu gạch chéo chuẩn Windows, và dùng các file thực thi tương ứng (ví dụ: `.cmd`, `.ps1` cho Windows).
*   **Non-blocking UI:** Đảm bảo các tiến trình `child_process.spawn/exec` phải chạy bất đồng bộ ở Main Process, truyền data từng phần (chunk) qua IPC, tuyệt đối không làm treo (freeze) giao diện React.
*   **Security & Credentials:** Tuyệt đối không hardcode API Key. Hướng dẫn sử dụng biến môi trường (`.env`), electron-store, hoặc Windows Credential Manager.
*   **Modular & Clean Architecture:** Tách biệt rõ ràng 3 lớp: UI Components (React Flow, Sidebar) - Global State (Zustand) - Backend Logic (NodeJS CLI Handlers). Viết các module xử lý CLI dưới dạng "Adapter" để dễ dàng cắm thêm các Agent AI mới (Claude, OpenAI) trong tương lai.
*   **Aesthetics (Thẩm mỹ):** Giao diện phải tuân thủ nghiêm ngặt Design System (Mục 7). Ưu tiên phong cách "Editorial", sử dụng nền kem ấm (#f7f7f4), chữ đen ấm (#26251e), viền hairline 1px (không dùng shadow) và font JetBrains Mono cho code.

### 6. 5 CÂU HỎI BRAINSTORM MẪU (Dành cho Context Initialization)

Khi cần hiểu bối cảnh của một dự án code con do Fluxion phân tích, Agent sẽ dùng 5 câu hỏi sau:
1.  Mục tiêu chính của dự án này là gì?
2.  Ngôn ngữ lập trình và Framework chủ đạo là gì?
3.  Cấu trúc thư mục hiện tại có tuân theo tiêu chuẩn (convention) nào không?
4.  Có yêu cầu đặc biệt nào về Style Guide (ví dụ: Airbnb, Google, hay setup ESLint/Prettier riêng)?
5.  Các thành phần/module nào là quan trọng nhất cần hệ thống (Agent) tập trung tối ưu/sửa lỗi?

### 7. QUY TẮC THIẾT KẾ (DESIGN SYSTEM - CURSOR INSPIRED)

Dự án Fluxion tuân thủ phong cách thiết kế "Editorial Calm" - chuyên nghiệp, tối giản và tinh tế:

*   **Bảng màu (Color Palette):**
    *   **Canvas:** Sử dụng màu kem ấm (`#f7f7f4`) làm nền chủ đạo (thay vì trắng hoặc đen IDE thuần túy).
    *   **Ink:** Chữ và các thành phần hiển thị dùng màu đen ấm (`#26251e`).
    *   **Accent:** Màu cam Cursor Orange (`#f54e00`) dành riêng cho các nút CTA chính và Wordmark.
    *   **Timeline (AI Action Stages):** Sử dụng bộ 5 màu pastel đặc trưng để đánh dấu trạng thái của Agent: 
        *   Peach (`#dfa88f`): Thinking
        *   Mint (`#9fc9a2`): Grepping
        *   Blue (`#9fbbe0`): Reading
        *   Lavender (`#c0a8dd`): Editing
        *   Gold (`#c08532`): Done
*   **Typography:**
    *   **UI Text:** Sử dụng CursorGothic hoặc font không chân (Inter/system-ui) với Weight 400.
    *   **Code:** Bắt buộc dùng JetBrains Mono cho mọi bề mặt hiển thị code (Code blocks, IDE Panes).
*   **Độ nổi khối & Hình khối (Depth & Shapes):**
    *   **Hairline depth:** Chỉ sử dụng đường viền 1px (`#e6e5e0`), tuyệt đối không dùng drop shadow.
    *   **Rounding:** Bo góc 8px (md) cho nút/input, 12px (lg) cho các card/panel.
    *   **Spacing:** Nhịp điệu cách lề 80px cho các section lớn.

---
*Lưu ý cốt lõi dành cho AI Agent: Luôn giữ thái độ của một "Nhạc trưởng" (Maestro) - điều phối tài tình, kiến trúc mạch lạc, code chính xác, hiệu suất cao và minh bạch với người dùng.*