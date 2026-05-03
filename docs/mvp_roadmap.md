# 🎯 Fluxion MVP Roadmap & Brainstorm Summary

Tài liệu này tổng hợp toàn bộ các quyết định kiến trúc, các lưu ý quan trọng (Gotchas) và kịch bản lõi được thống nhất trong phiên Brainstorming. File này đóng vai trò là "Kim chỉ nam" cho quá trình triển khai mã nguồn các Phase tiếp theo.

---

## 1. Mục Tiêu Cốt Lõi Của MVP (The "Golden Path")
MVP cần đảm bảo luồng (User Journey) sau chạy mượt mà từ đầu đến cuối:
1. Chọn Workspace (Khởi tạo `.fluxion/memory`).
2. Kéo thả 2 Node ra màn hình: `Node A` -> Nối dây -> `Node B`.
3. Nhập Prompt vào Node A. Bấm RUN.
4. Node A chạy, stream log mượt mà lên terminal mini bên trong UI Node A. UI không bị giật/freeze.
5. Node A xong, tự động sinh file `.md` output. Node B tiếp nối, tự đọc file `.md` đó làm context và chạy tiếp.
6. Kết thúc luồng an toàn.

---

## 2. Các Quyết Định Kiến Trúc Tầng Backend (Main Process)

### A. Workflow Engine
- **Thuật toán:** Duyệt đồ thị có hướng không chu trình (DAG - Directed Acyclic Graph) tuyến tính. Khoan làm Vòng lặp (Loop) ở MVP để tránh cháy Token API.
- **Trạng thái:** Quản lý bằng Cờ nội bộ (`isHalted`, `isRunning`) thay vì phụ thuộc UI.
- **Memory Leak Prevention:** BẮT BUỘC gọi `removeAllListeners()` sau khi Node chạy xong hoặc bị ngắt, không để Event Emitter chồng chéo.

### B. Agent Adapter & Dữ liệu
- **1 Agent duy nhất cho MVP:** Có thể là Gemini CLI hoặc một Node.js script giả lập luồng stream (Mock CLI) bắn chunk mỗi 100ms.
- **Stateless Persistence:** Truyền data giữa các node bằng file `.md`. Mô hình này cho phép tắt app, mở lại và chạy tiếp Node kế mà không mất bối cảnh.
- **Windows OS Escape:** Cực kỳ chú ý khi nạp file `.md` vào Prompt. Phải escape dấu ngoặc kép, dấu cách hoặc dùng thư viện an toàn để bọc đường dẫn Windows.

### C. Cơ chế Graceful Abort (Khi nhấn STOP)
Quy trình "Cắt cầu dao" 5 bước:
1. UI đổi trạng thái -> Gửi IPC `action: 'abort'`.
2. Workflow Engine bật cờ `isHalted = true`, ngắt mạch DAG.
3. Agent Adapter (đang dùng AsyncGenerator) đánh dấu `isAborted = true`, ngắt vòng lặp stream.
4. ProcessManager gọi `taskkill /pid <PID> /T` (dọn dẹp Process Tree). Thòng thêm 3 giây timeout, nếu lì lợm thì gọi `taskkill /pid <PID> /T /F`.
5. Không lưu file `.md` nửa vời để tránh làm hỏng context của Node sau.

---

## 3. Các Quyết Định Kiến Trúc Tầng Frontend (Renderer Process)

### A. Tách Biệt State (Chống Lag)
Không gom tất cả trạng thái vào một Store. Đây là nguyên tắc sống còn khi làm việc với React Flow:
- **`useWorkflowStore`:** Dành riêng cho Toạ độ (Position), Mảng Nodes, Edges. Đây là các dữ liệu "tĩnh", thỉnh thoảng mới cập nhật khi kéo thả.
- **`useExecutionStore`:** Dành cho Trạng thái chạy (`running`, `completed`) và Terminal Logs (chứa hàng nghìn ký tự thay đổi mỗi 100ms).

### B. Tối Ưu Terminal Viewer (Xterm.js)
Xterm.js là con dao hai lưỡi nếu dùng sai cách.
- **Lazy Mount:** KHÔNG khởi tạo DOM Xterm.js cho tất cả 20 Nodes trên Canvas ngay từ đầu. Chỉ Node nào đang chạy, hoặc khi user chủ động bấm "Mở Terminal", mới Mount instance Xterm.js. Khi đóng, huỷ (unmount) instance đó đi.
- **WebGL Addon:** Bắt buộc dùng `xterm-addon-webgl` hoặc Canvas addon để nhường phần vẽ text siêu tốc cho GPU xử lý thay vì CPU trình duyệt.
- **Dữ liệu mồ côi:** Khi unmount Xterm, log được lưu giữ tĩnh (text thô) trong Zustand để không mất dữ liệu lịch sử.

---
*Tài liệu này được sinh ra từ phiên tư vấn kiến trúc. Sẵn sàng sử dụng làm Specification cho các Agent lập trình.*
