# Fluxion Project Assessment

Date: 2026-05-06
Workspace: `D:\codex-workflow\Fluxion`
Assessment status: updated after `FX-027`, `FX-018`, local `FX-025` smoke baseline, Codex runtime readiness onboarding, and the UI onboarding clarity pass landed in code.

## Executive Summary

Fluxion da vuot qua moc "runtime foundation" va hien tai dang o muc desktop alpha co the verify duoc tren Windows local.

Batch thay doi hien tai da dong 5 khoang trong quan trong:

- Codex model/catalog khong con hardcode trong UI. Fluxion doc capability that tu `codex debug models`.
- Workflow-level `Auto` / `Manual` execution mode da ton tai xuyen suot tu workflow file -> topbar -> engine -> run-state.
- Local Windows smoke baseline da co, bao gom `typecheck`, `test`, build, va unpacked packaging verification.
- Codex runtime readiness da co preflight ro rang: `codex login status`, live catalog, bundled catalog fallback, va force refresh tu UI.
- Onboarding UI da tach ro Codex CLI readiness voi OpenAI API key optional, them Welcome readiness, empty-state actions, save/node-count signal, va accessibility pass co focus trap.

Du an van chua dat MVP hoan chinh vi van con 4 nhom gap lon:

1. Chua co `Explain with AI` de giai thich loi cho operator.
2. Chua co adapter that thu hai tren main execution path.
3. Chua co CI baseline cho smoke/lint/typecheck/test.
4. Chua khoa chat validation cho provider config va downstream metadata.

Danh gia hien tai:

**"Codex-first desktop alpha da co smoke baseline, readiness onboarding, va human-in-the-loop workflow mode, nhung chua dat beta candidate."**

## Validation Snapshot

- `npm run typecheck`: pass
- `npm test`: pass (`14` files, `73` tests)
- `npm run smoke:win`: pass

## Completed In This Batch

### FX-027 Dynamic Codex capability discovery [DONE]

- Parse JSON that tu `codex debug models`
- Reuse `PROVIDERS_GET_CAPABILITIES`
- Model picker, node label, va properties panel chuyen sang capability-driven
- CLI missing / auth missing / success deu co state ro rang
- Legacy/custom model slug van load/save duoc

### FX-018 Workflow-level Auto / Manual Accept [DONE]

- `executionMode` duoc persist trong workflow document
- Topbar co mode switch `Auto` / `Manual`
- `Manual` pause moi node completed truoc khi unlock downstream
- `reviewSource` phan biet pause do node gate hay do workflow mode
- Approve node cuoi cung ket thuc run binh thuong

### FX-025 Local Windows smoke baseline [PARTIAL]

- Co `npm run smoke:win`
- Verify `dist/win-unpacked/fluxion.exe`
- Co checklist desktop manual smoke
- Chua co CI baseline cho pipeline nay

### Codex runtime readiness onboarding [DONE]

- `PROVIDERS_GET_CAPABILITIES` ho tro force refresh.
- Main process chay `codex login status` truoc khi discovery catalog.
- Hard-block `Run` chi khi thieu Codex CLI hoac CLI chua login.
- `auth_unknown`, `catalog_failed`, bundled catalog, va legacy/custom model chi canh bao, khong chan run.
- UI co readiness badge/card trong Topbar, Welcome, AgentPalette, PropertiesPanel, va Global Settings.

### UI onboarding clarity and accessibility pass [DONE]

- Welcome screen co Codex readiness card, gear settings, va mot CTA chinh `Open Project Folder`.
- Global Settings copy da lam ro `OpenAI API Key` la optional cho Codex CLI workflows.
- Topbar hien node count va save state ro hon, giam nhieu tin hieu trung lap khi workspace steady.
- Empty canvas co `Add Agent` va `Try Simple Chain` de tao nhanh DAG `A -> B`.
- Modal focus trap va `aria-label` cho icon-only controls quan trong da duoc them.

## Current Project State

### Strengths

- Runtime/IPC/store contract cho Codex hien nay nhat quan hon truoc.
- Workflow human review flow da dung voi model van hanh "auto" va "manual".
- Repo da co local Windows packaging smoke thay vi chi dung `build` don le.
- Backward compatibility cho workflow cu da duoc giu khi chuyen surface sang Codex-first.
- Readiness onboarding giam nham lan giua `codex login` va `OPENAI_API_KEY`.
- Empty-state template giup smoke workflow that nhanh hon ma khong can tutorial rieng.

### Highest-Impact Gaps

- `FX-020`: can hoan tat `Explain with AI`
- `FX-023`: can chan metadata/frontmatter loi truoc downstream context
- `FX-024`: can mo rong validate auth/config cho cac runtime/provider ngoai Codex CLI readiness da co
- `FX-025`: can dua smoke baseline vao CI
- `FX-026`: can lam sach lint baseline va metadata san pham
- `FX-016`: can them adapter that thu hai

## Recommended Next Priorities

1. `FX-020` hoan tat error surface bang `Explain with AI`
2. `FX-023` khoa schema metadata de giam loi day chuyen trong memory/context
3. `FX-025` dua `smoke:win` vao CI baseline
4. `FX-024` mo rong provider auth/config validation ngoai Codex CLI readiness
5. `FX-026` don dep lint baseline va package metadata
6. `FX-016` bat dau adapter that thu hai

## Final Verdict

Neu so voi assessment ngay `2026-05-03`, Fluxion da tien them mot buoc ro rang:

- tu runtime Codex co hardcode UI
- sang capability-driven Codex integration
- tu node-level review gate
- sang workflow-level `Auto` / `Manual`
- tu test/build cuc bo
- sang local Windows smoke baseline co executable artifact check
- tu settings/onboarding gay nham lan OpenAI auth
- sang Codex-first readiness copy va run preflight ro rang

Ket luan hien tai:

**Fluxion da dat moc "desktop alpha co the smoke-test nghiem tuc tren Windows local voi onboarding Codex-first ro rang", nhung van can them CI, error intelligence, va adapter thu hai de tien sang beta.**
