# Dynamic Codex Capability Integration

`codex-debug.json` cho thấy Codex CLI đang có một nguồn dữ liệu machine-readable qua `codex debug models`. Nguồn này không chỉ là danh sách model, mà còn là capability registry chứa `slug`, `display_name`, `description`, `visibility`, `supported_reasoning_levels`, `context_window`, `input_modalities` và các cờ hỗ trợ khác.

Hiện tại Fluxion vẫn hardcode provider `codex` với các model cũ như `o4-mini` và `codex-mini`, trong khi CLI thực tế đang trả về các model như `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2`. Vì vậy thay đổi này không chỉ là cải tiến UI, mà là sửa lệch contract giữa Fluxion và Codex CLI hiện tại.

## Corrections To The Previous Draft

1. `codex debug models` không nên được xử lý bằng Regex trên stdout.
   Kết quả thực tế là JSON hợp lệ. Nếu có warning môi trường, chúng nên được coi là `stderr` hoặc diagnostic riêng, không phải lý do để parse chuỗi bằng Regex.

2. Bài toán không dừng ở dropdown model.
   Renderer, shared types, validation schema, node display, palette, runtime wiring và graceful degradation đều đang phụ thuộc vào hardcode.

3. `codex-debug.json` nên được xem là capability registry.
   UI chỉ nên hiển thị control nào có mapping runtime thật. Không nên thêm field cấu hình nhìn có vẻ đúng nhưng không có tác dụng khi chạy CLI.

4. Cần giữ backward compatibility cho workflow cũ.
   Các slug legacy như `o4-mini` hoặc `codex-mini` không nên làm panel, schema hay save/load bị vỡ.

## Goals

1. Loại bỏ hardcode model của provider `codex` khỏi renderer và shared types.
2. Đồng bộ danh sách model từ Codex CLI theo cách an toàn cho Windows và IPC hiện tại.
3. Chuyển UI sang capability-driven rendering thay vì slug-driven rendering.
4. Chỉ expose các cấu hình đã có mapping runtime thật.
5. Giữ workflow cũ và custom model string vẫn load/save được.
6. Tuân thủ nguyên tắc Auto-Detect & Graceful Degradation của Fluxion.

## Proposed Changes

### 1. Backend Capability Registry

#### [NEW] `src/main/services/codex-model-registry.service.ts`

- Dùng `child_process.execFile()` hoặc `spawn()` để chạy `codex debug models`.
- Tách `stdout` và `stderr` riêng. Parse JSON trực tiếp từ `stdout`.
- Không dùng Regex để trích object JSON.
- Gọi thêm `CodexAdapter.checkRequirements()` để lấy trạng thái availability của CLI.
- Chuẩn hóa dữ liệu về một format dùng chung cho Fluxion.
- Lọc `visibility !== 'list'` khỏi picker mặc định.
  Điều này ngăn model internal như `codex-auto-review` xuất hiện trong UI chọn model thông thường.
- Cache kết quả trong memory nếu cần, nhưng cho phép refresh theo yêu cầu khi app khởi động hoặc khi user mở panel.

Ví dụ shape chuẩn hóa:

```ts
export interface ProviderModel {
  id: string;
  displayName: string;
  description?: string;
  visibility: 'list' | 'hide' | string;
  supportedInApi?: boolean;
  supportedReasoningLevels: string[];
  defaultReasoningLevel?: string;
  supportVerbosity?: boolean;
  defaultVerbosity?: string;
  contextWindow?: number;
  maxContextWindow?: number;
  inputModalities?: string[];
  supportsImages?: boolean;
}

export interface CodexCapabilitiesPayload {
  available: boolean;
  version?: string;
  error?: string;
  models: ProviderModel[];
}
```

### 2. IPC Contract

#### [MODIFY] `src/shared/ipc.channels.ts`

- Thêm channel `codex:get-capabilities`.
- Không dùng tên `codex:get-models`, vì renderer còn cần biết CLI có sẵn hay không.

#### [MODIFY] `src/shared/ipc.payloads.ts`

- Thêm payload type cho `CodexCapabilitiesPayload`.

#### [MODIFY] `src/main/ipc/workflow.handlers.ts` hoặc file handler riêng cho Codex

- Lắng nghe `codex:get-capabilities`.
- Gọi `CodexModelRegistryService`.
- Trả về cả `available/error` lẫn danh sách model đã normalize.

#### [MODIFY] `src/preload/index.ts`

- Expose `window.api.getCodexCapabilities()` qua `ipcRenderer.invoke(...)`.

### 3. Shared Types And Compatibility

#### [MODIFY] `src/shared/workflow.types.ts`

- Đổi `ModelId` từ union hardcode sang `string`.
- Mở rộng `ReasoningLevel` để hỗ trợ `xhigh`, hoặc đổi tên field thành `reasoningEffort` nếu muốn tách rõ khỏi các provider khác.
- Thêm `ProviderModel` và `CodexCapabilitiesPayload`.
- Giữ `temperature` và `maxTokens` là optional field chung, nhưng không ngụ ý rằng Codex runtime đã hỗ trợ chúng.

#### Compatibility Rules

- Workflow chứa model không còn nằm trong registry vẫn phải load được.
- Nếu node hiện tại chứa slug legacy như `o4-mini` hoặc `codex-mini`, panel phải giữ nguyên giá trị đó thay vì crash vì schema.
- Không tự động remap legacy slug sang model mới một cách silent.
  Nếu cần gợi ý migration, làm ở UI dưới dạng hint, không sửa dữ liệu âm thầm.

### 4. Renderer State Refactor

#### [MODIFY] `src/renderer/src/stores/workflow.store.ts`

- Thêm state để lưu `codexCapabilities`.
- Thêm action `fetchCodexCapabilities()`.
- Gọi action này lúc app hoặc workspace khởi động, hoặc lazy-load khi panel đầu tiên cần tới.

Gợi ý state:

```ts
codexCapabilities: {
  available: boolean;
  error?: string;
  models: ProviderModel[];
}
```

### 5. Properties Panel Becomes Capability-Driven

#### [MODIFY] `src/renderer/src/components/layout/PropertiesPanel.tsx`

- Bỏ `z.enum([...hardcoded models...])` cho `model`.
- Bỏ `MODELS` hardcode cho provider `codex`.
- Bỏ `isReasoningModel()` dựa trên danh sách slug hardcode.
- Render model list của provider `codex` từ registry.
- Hiển thị `displayName`, `description`, `contextWindow` hoặc badge capability nếu hữu ích cho user.
- Nếu node đang dùng một model không nằm trong registry, render thêm một option kiểu `Legacy / Custom` để form không vỡ.
- Chỉ hiển thị `Reasoning Effort` khi model hiện tại thực sự có `supportedReasoningLevels`.
- Nếu hiển thị `Reasoning Effort`, phải hỗ trợ cả `xhigh`.
- Ẩn hoặc disable `Temperature` cho provider `codex` cho tới khi có mapping CLI đã được xác minh.
- Không hiển thị control nào chỉ mang tính trang trí mà chưa đi được xuống runtime.
- Nếu `codex` không available, panel phải hiện trạng thái unavailable rõ ràng thay vì rơi về hardcoded fallback cũ.

### 6. Agent Palette And Node Display

#### [MODIFY] `src/renderer/src/components/canvas/AgentPalette.tsx`

- Không hardcode preset `codex` về `o4-mini` hoặc `codex-mini`.
- Nếu có capabilities, dùng model Codex đầu tiên có `visibility: list` làm default.
- Nếu chưa load xong capabilities, có thể hiển thị generic card `Codex Agent`.

#### [MODIFY] `src/renderer/src/components/canvas/AgentNode.tsx`

- Bổ sung accent/logo/fallback label đúng cho provider `codex`.
- Label nên ưu tiên:
  `custom label` -> `registry displayName` -> `raw slug`
- Không phụ thuộc hoàn toàn vào `MODEL_LABELS` hardcode.

### 7. Runtime Wiring

#### [MODIFY] `src/main/adapters/codex.adapter.ts`

- Tiếp tục pass `--model <slug>` như hiện tại.
- Không thêm các cờ CLI suy đoán như `--reasoning` hoặc `--verbosity` nếu chưa xác minh được syntax thật từ Codex CLI.
- Phase đầu của thay đổi này chỉ cần đảm bảo dynamic slug chạy đúng qua `--model`.

#### [MODIFY] `src/main/services/workflow-engine.ts`

- Sửa phần compile prompt để `systemInstruction` thật sự được đưa vào prompt cuối.
- Hiện tại field này được lưu từ UI nhưng chưa được dùng trong runtime.

Gợi ý format:

```text
[GLOBAL CONTEXT]
...

[SYSTEM INSTRUCTION]
...

[USER INSTRUCTION]
...
```

Điểm này quan trọng vì nếu không sửa, panel sẽ vẫn có field cấu hình không có tác dụng thực tế.

### 8. Graceful Degradation

#### Expected Behavior When Codex Is Missing Or Discovery Fails

- `codex:get-capabilities` trả về `available: false`, `error`, `models: []`.
- Renderer không crash và không quay về danh sách hardcode cũ.
- Provider `codex` vẫn có thể hiện diện trên UI, nhưng phải được đánh dấu unavailable hoặc degraded.
- User phải nhìn thấy rõ nguyên nhân như `Codex CLI is not installed or not found in PATH`.

Điều này khớp với operational rule của Fluxion: thiếu CLI hoặc auth phải degrade ngay trên node/provider liên quan, không biến thành lỗi hệ thống mơ hồ.

## Scope Guard

Nằm trong thay đổi này:

- Dynamic discovery cho provider `codex`
- Refactor shared type/schema để chấp nhận model string động
- Capability-driven rendering cho Properties Panel
- Backward compatibility cho legacy/custom model slug
- Runtime pass-through đúng `--model`
- Fix `systemInstruction` để có hiệu lực thật

Chưa nằm trong thay đổi này:

- Dynamic registry cho `google`, `openai`, `anthropic`
- Auto-migrate legacy slug sang model mới
- Expose `verbosity`, `image`, `temperature`, `maxTokens` cho Codex nếu chưa có CLI mapping đã xác minh
- Manual Accept / Auto Accept
- Explain with AI

## Verification Plan

1. Backend discovery
   Chạy `codex debug models` qua service mới và xác nhận parse được JSON trực tiếp từ `stdout`, không dùng Regex.

2. Filtering
   Xác nhận model `codex-auto-review` không xuất hiện trong picker vì `visibility: "hide"`.

3. Shared-type compatibility
   Mở workflow chứa model legacy như `o4-mini` hoặc `codex-mini` và xác nhận panel không crash vì validation schema.

4. Properties Panel
   Mở dropdown Model của provider `codex` và xác nhận thấy các model thật như `GPT-5.5`, `GPT-5.4`, `GPT-5.4-Mini`.

5. Capability-driven controls
   Xác nhận panel chỉ hiện `Reasoning Effort` cho model có `supported_reasoning_levels`, và control này có đủ `low`, `medium`, `high`, `xhigh`.

6. Runtime execution
   Chọn `gpt-5.4-mini`, chạy node, và xác nhận lệnh spawn nhận đúng `--model gpt-5.4-mini`.

7. Prompt assembly
   Xác nhận `systemInstruction` thực sự đi vào compiled prompt thay vì chỉ tồn tại trong UI/store.

8. Graceful degradation
   Giả lập trường hợp `codex` không có trong PATH và xác nhận UI hiện trạng thái unavailable rõ ràng, không quay lại hardcode cũ, không crash panel.

## Recommended Delivery Order

1. Backend capability service + IPC
2. Shared type/schema refactor
3. Workflow store capability state
4. Properties Panel capability-driven rendering
5. Agent Palette + AgentNode cleanup
6. Runtime prompt fix for `systemInstruction`
7. Verification across legacy workflow and real Codex execution

## Final Note

Điểm quan trọng nhất của thay đổi này là: Fluxion không nên chỉ "đọc được model mới", mà phải chuyển hẳn từ cách nghĩ hardcode slug sang capability-driven integration cho provider `codex`. Nếu không, app sẽ có danh sách model mới nhưng vẫn duy trì các control, schema và runtime behavior cũ, dẫn đến trải nghiệm sai lệch và khó debug.
