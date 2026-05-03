# Hướng dẫn Toàn tập về Codex CLI (`@openai/codex`)

Codex CLI là một công cụ dòng lệnh mạnh mẽ từ OpenAI, cho phép bạn tương tác với mã nguồn của mình bằng ngôn ngữ tự nhiên. Nó hoạt động như một cộng sự lập trình (AI pair programmer) ngay trong terminal của bạn.

---

## 1. Cài đặt

Yêu cầu Node.js đã được cài đặt trên hệ thống.

```bash
npm install -g @openai/codex
```

Kiểm tra cài đặt:
```bash
codex --version
```

---

## 2. Các lệnh cơ bản

| Lệnh | Mô tả |
| :--- | :--- |
| `codex` | Khởi chạy giao diện người dùng terminal (TUI) tương tác. |
| `codex "<prompt>"` | Bắt đầu một phiên làm việc với một chỉ dẫn cụ thể. |
| `codex exec "<prompt>"` | Chạy Codex ở chế độ không tương tác (thực thi và thoát). Lý tưởng cho tự động hóa. |
| `codex review` | Thực hiện đánh giá mã nguồn cho các thay đổi hiện tại hoặc một commit cụ thể. |
| `codex resume` | Tiếp tục phiên làm việc trước đó. Sử dụng `--last` để vào phiên gần nhất. |
| `codex fork` | Tạo một phiên mới dựa trên lịch sử của một phiên cũ. |

---

## 3. Các lệnh Slash (Sử dụng trong chế độ tương tác)

Khi đang trong một phiên làm việc của Codex, bạn có thể sử dụng các lệnh bắt đầu bằng dấu gạch chéo `/` để điều khiển:

- `/model`: Thay đổi model AI đang sử dụng (ví dụ: `gpt-4o`, `gpt-4-turbo`).
- `/permissions`: Điều chỉnh quyền hạn của Codex (Read Only, Auto, v.v.).
- `/status`: Xem cấu hình phiên, lượng token đã dùng và giới hạn định mức.
- `/plan`: Chuyển sang "Chế độ lập kế hoạch" để Codex soạn thảo chiến lược trước khi viết code.
- `/clear`: Xóa màn hình terminal và đặt lại ngữ cảnh hội thoại.
- `/compact`: Tóm tắt hội thoại để tiết kiệm token và không gian ngữ cảnh.
- `/copy`: Sao chép phản hồi cuối cùng hoặc khối mã vào clipboard.
- `/init`: Tạo file mẫu `AGENTS.md` trong thư mục hiện tại.

---

## 4. Chế độ Sandbox và Chính sách phê duyệt

Codex sử dụng hai lớp bảo mật để kiểm soát những gì AI có thể thực hiện trên máy tính của bạn.

### Chế độ Sandbox (`--sandbox`)
Xác định giới hạn kỹ thuật mà agent được phép thực hiện:

- `read-only`: Chỉ có thể đọc file, không thể sửa đổi hoặc chạy lệnh shell.
- `workspace-write` (Mặc định): Có thể đọc và sửa đổi file trong workspace hiện tại.
- `danger-full-access`: Cho phép truy cập toàn bộ hệ thống và mạng (Dùng thận trọng!).

### Chính sách phê duyệt (`--ask-for-approval` hoặc `-a`)
Xác định khi nào Codex cần hỏi ý kiến bạn trước khi hành động:

- `untrusted`: Luôn hỏi trước khi thực hiện bất kỳ lệnh nào không nằm trong danh sách tin cậy.
- `on-request` (Mặc định): Hoạt động tự chủ trong sandbox nhưng hỏi khi cần vượt qua ranh giới (ví dụ: truy cập internet).
- `never`: Không bao giờ hỏi. Thường dùng trong môi trường CI/CD hoặc thực thi tự động.

---

## 5. Các Flag phổ biến

- `-m, --model <name>`: Chỉ định model cho phiên làm việc.
- `-a, --ask-for-approval <mode>`: Thiết lập chính sách phê duyệt.
- `-i, --image <path>`: Đính kèm hình ảnh (ảnh chụp màn hình, wireframe) vào prompt.
- `-c, --config <key=value>`: Ghi đè các thiết lập trong file cấu hình.
- `--cd <path>`: Thay đổi thư mục làm việc cho phiên.
- `--json`: Xuất kết quả dưới dạng JSONL (hữu ích để tích hợp với các công cụ khác).
- `--yolo`: Bỏ qua mọi phê duyệt và sandbox (Chạy với quyền hạn cao nhất).

---

## 6. Tích hợp Shell và Ngữ cảnh File

### Tích hợp Shell
Bạn có thể chạy các lệnh shell trực tiếp trong phiên Codex bằng cách thêm dấu chấm than `!` phía trước:
- `!ls`: Liệt kê file.
- `!npm test`: Chạy bộ test và để Codex xem kết quả để sửa lỗi.

### Ngữ cảnh File (`@`)
Sử dụng ký hiệu `@` trong prompt để chỉ định rõ file nào Codex cần đọc:
- `"Giải thích logic trong file @src/main.ts"`

---

## 7. Cấu hình và Hướng dẫn Dự án

### Cấu hình toàn cục (`~/.codex/config.toml`)
Nơi lưu trữ các thiết lập mặc định về theme, model, và bảo mật cho tất cả các dự án.

### Hướng dẫn dự án (`AGENTS.md`)
Đặt file này ở gốc dự án của bạn để cung cấp các quy tắc cố định cho Codex (ví dụ: "Luôn dùng TypeScript", "Tuân thủ style guide của Google"). Codex sẽ tự động đọc file này mỗi khi bắt đầu phiên trong dự án đó.

---

## 8. Tích hợp trong Hệ sinh thái Fluxion

Trong dự án Fluxion, Codex CLI được sử dụng thông qua `CodexAdapter`. Fluxion tận dụng sức mạnh của Codex để thực thi các tác vụ tự động hóa mã nguồn một cách an toàn.

- **Chế độ thực thi:** Fluxion sử dụng `codex exec` kết hợp với flag `--json` để nhận phản hồi dưới dạng dòng dữ liệu (stream) thời gian thực.
- **Bảo mật:** Mặc định, Fluxion cấu hình Codex với `--ask-for-approval never` và `--sandbox workspace-write` để đảm bảo agent có thể làm việc hiệu quả trong phạm vi project mà không cần can thiệp thủ công quá nhiều, nhưng vẫn đảm bảo an toàn cho hệ thống.
- **Định hướng (Identity):** Fluxion sử dụng file `AGENTS.md` (nằm ở gốc dự án) để định hướng hành vi cho không chỉ Codex mà tất cả các Agent khác trong hệ thống, đảm bảo tính nhất quán về phong cách code và kiến trúc dự án.
