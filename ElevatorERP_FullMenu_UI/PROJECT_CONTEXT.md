# PROJECT_CONTEXT

> Source of truth for AI coding. Last source review: **2026-07-21**. Read this file before changing code.

## 1. Project overview

ElevatorERP is an internal ERP for **Công ty Thang máy Miền Trung**, expected to serve about 100 users across management, sales, operations, engineering, KCS, accounting, HR, installation, maintenance and repair teams.

The system manages the full customer and elevator lifecycle:

`Khách hàng → Hồ sơ tư vấn → Cấu hình thang tư vấn → Báo giá → Hợp đồng → Thang máy tài sản → Triển khai → KCS → Kiểm định → Nghiệm thu → Bàn giao → Bảo hành → Bảo trì → Sự cố sửa chữa`

Core domain decisions:

- Do **not** use the term or entity **“Cơ hội bán hàng”**.
- The long-lived identity master is **Khách hàng**; normalized phone number is the duplicate-prevention key.
- A customer can have many **Hồ sơ tư vấn** at different times.
- A consultation profile can have zero or many preliminary elevator configurations. Creating a configuration is optional when saving the profile.
- A preliminary configuration belongs to exactly one consultation profile. Other profiles' configurations are read-only references, but may be copied into the current profile.
- A preliminary configuration is not a physical elevator asset.
- An accepted quotation/signed contract creates a **Thang máy tài sản** snapshot used by implementation, warranty and maintenance.
- A project may be created only from a signed contract or an explicitly approved exceptional deployment.
- One project can contain many elevators.
- Project is the cross-department coordination center.
- Elevator dossier is the lifecycle record of one physical elevator.
- UI navigation is grouped by business capability, not hard-coded by department.

## 2. Current source truth

The current package is a **functional foundation plus a full-menu UI prototype**, not a completed V0–V9 ERP.

### Real backend/API features

- Cookie login/logout/current user.
- Users, roles, additive permissions and simple data scopes.
- Dashboard statistics for customers and care activities.
- Customer master: list/search/filter/create/edit/delete safeguards, inline status update and normalized-phone duplicate prevention.
- Consultation profiles: list/create/edit/status/detail/history, KPI metadata and preliminary elevator configurations.
- Customer 360 aggregate APIs for overview, profiles, preliminary configurations, physical elevator assets, care and history.
- Configuration copy API for reusing an existing elevator configuration in another consultation profile.
- Quotation confirmation API that creates an idempotent physical `CustomerElevator` asset snapshot.
- Customer care: list/calendar/create/complete.
- Shared catalog administration for customer status, lost reason, source, customer group and elevator type.
- Customer list filtering by normalized search, status/status group, customer group, source, owner, address and created date range.
- Customer CSV export is implemented in the frontend from the current loaded rows.
- Free geocoding helper endpoints for per-elevator installation pinning:
  - `/api/geo/search` uses OpenStreetMap/Nominatim with Vietnam/area bias.
  - `/api/geo/resolve-link` parses pasted Google Maps links or manual coordinates into latitude/longitude.
- User-role assignment.
- File upload with basic allow-listing and stored metadata.
- Basic audit records.
- PostgreSQL demo seeding.

### UI-only development workspaces

Most V3–V9 routes use `ModuleWorkspace.tsx` and persist sample rows to browser `localStorage`.
They are useful for layout and interaction testing only. They are **not evidence that the related business module, API, permission, workflow, audit or database schema is complete**.

Current UI-only routes such as `/quotations`, `/contracts`, `/projects/list` and most accounting/technical/HR pages show a thin dismissible **Dữ liệu mô phỏng** banner in development. That banner means the page is not backed by PostgreSQL for its business records. The banner is hidden in production builds.

There is intentionally no Live/Demo/Planned label in the menu. All menu items are open for the sole developer, but implementation status must still be determined from source and tests.

## 3. Technology

### Current implementation

- Frontend: Next.js 15 App Router, React 19, TypeScript 5.
- UI: Ant Design 5, `@ant-design/icons`, Ant Design ProComponents.
- Backend: ASP.NET Core 8 Minimal API.
- ORM: Entity Framework Core 8 with Npgsql.
- Database: PostgreSQL 16.
- Reverse proxy: Nginx.
- Runtime: Docker Compose.
- Authentication: ASP.NET Core cookie authentication with persisted Data Protection keys.
- Local file storage: bind-mounted VPS/local disk path; metadata in PostgreSQL.

### Current approved UI shell direction

- The ERP/admin shell is a persistent shared layout, not a wrapper mounted inside each page.
- `AppFrame` wraps authenticated routes with `AppShell`; `/login` is intentionally outside the shell.
- `AppShell` owns the sidebar, account toolbar, notification action, user menu, account-menu theme toggle and `/auth/me` loading.
- Route changes from the sidebar should update only the right content area. The sidebar/header must not remount on normal menu navigation.
- Desktop sidebar should behave like an ERP accordion: only one top-level module group is open at a time, and the active route's group is opened automatically.
- Mobile sidebar may keep default compact behavior to save space.
- Desktop and mobile support light/dark themes through `AppProviders` and `localStorage` key `elevator-erp:theme-mode`.
- The top-right account toolbar is intentionally compact: notification plus user menu. Theme switching remains available inside the account menu.
- Primary page business actions belong in the page header on the right, not in the global shell header and not inside the filter bar.
- Filter bars should contain search/filter/reset/apply/export actions. They should not contain create-new buttons.
- List search should update results automatically after a short debounce where practical; heavy/secondary filters belong in an advanced filter drawer.
- Advanced filter drawers should group conditions by business meaning, use a fixed footer, and keep the primary apply action visually dominant.
- Data table cards use a compact toolbar: title on the left, table tools on the right, table header close below the toolbar.
- Table action columns should be centered/right-aligned consistently through shared table action classes; do not hand-position row icons per page.
- The dashboard and mobile shell have been polished as an ERP/admin interface; avoid reverting it to a marketing/landing-page layout.
- Customer status in the customer list is an editable colored badge. Keep the color for scanability and keep the dropdown indicator inside the badge.
- Customer address is contact information only. Do not store installation area or installation coordinates on the customer master.
- Installation address, pin coordinates and derived area belong to each preliminary elevator configuration and later to its physical asset snapshot.
- Installation area is read-only and derived from the pin at ward/commune plus province level.
- Installation pinning must remain usable without paid Google APIs. The approved free flow is OSM search plus optional pasted Google Maps link/coordinate parsing.

### Customer 360 and sales domain decisions

- The business menu is: **Khách hàng**, **Hồ sơ tư vấn**, **Lịch chăm sóc khách hàng**, **Báo giá**, **Hợp đồng**.
- Customer 360 is the cross-process read model for one customer. Its tabs are: **Tổng quan**, **Hồ sơ tư vấn**, **Thang máy**, **Báo giá**, **Hợp đồng**, **Công nợ**, **Tiến độ**, **Bảo trì**, **Chăm sóc**, **Lịch sử**.
- Customer name and customer code open Customer 360. Consultation profile code opens/focuses that profile's detail context.
- Customer 360 uses URL tab state (`?tab=`), so links must open the intended business tab without losing customer context.
- The **Thang máy** tab is for physical assets only. Preliminary configurations remain under their source consultation profile and must not inflate the asset count.
- Receivables, progress and maintenance in Customer 360 are aggregate/read-oriented views. Mutations remain in the owning contract, asset, accounting or maintenance module.
- Survey documents/images are optional and belong to an individual elevator configuration, not globally to the customer or consultation profile.
- If a preliminary configuration is created, its technical fields, floor rows, installation address and installation pin are required; technical notes and attachments remain optional.
- KPI is counted from eligible consultation profiles, not unique customer masters. Sending a quotation is a consultation milestone; sales commission is derived from a successful contract.
- Authorization target: an account receives one or more Rules. Each Rule contains action permissions and per-module data scope (`OWN`, `TEAM`, `DEPARTMENT`, `BRANCH`, `COMPANY`, `CUSTOM`). Actions are additive; scope is evaluated per module.

### Chosen target architecture, not fully implemented

- Modular Monolith.
- Redis cache.
- Hangfire or ASP.NET Core Worker for background jobs.
- SignalR for realtime notifications and invalidation.
- Ubuntu Linux production with Nginx and HTTPS.
- At least one backup copy outside the VPS.

Important current gaps:

- Backend is still one API project; modules are not physically separated.
- Redis exists only as a container and has no backend client usage.
- No SignalR hub/client.
- No worker/Hangfire service.
- No EF Core migrations; startup uses `EnsureCreatedAsync()`.

## 4. Main runtime flow

1. Browser requests `http(s)://host`.
2. Nginx sends page requests to Next.js and `/api/*` to ASP.NET Core.
3. Login posts credentials to `/api/auth/login`.
4. Backend verifies PBKDF2 password hash and issues `elevator_erp_auth` HttpOnly cookie.
5. Frontend calls `/api/auth/me` with `credentials: include`.
6. `AppFrame` keeps `AppShell` mounted for authenticated routes.
7. `AppShell` filters menu entries that declare a permission.
8. Every real protected endpoint must independently call `RequirePermission(...)`; frontend hiding is never security.
9. EF Core reads/writes PostgreSQL.
10. Mutating real APIs save audit entries where implemented.
11. UI refreshes by re-fetching the affected API after a successful mutation.

Customer master and consultation flow:

1. Customer page loads `/api/customers`; backend defaults to numeric customer code descending.
2. Main search runs with debounce and normalized Vietnamese text so partial/diacritic-light input can match names, phones, emails and codes.
3. Customer advanced filters use customer identity/contact fields. Elevator type is filtered on consultation profiles through their owned configurations, not on the customer master.
4. Customer create uses `POST /api/customers`; edit uses `PUT /api/customers/{id}`; inline status uses `PUT /api/customers/{id}/status`.
5. The form stores customer group (`PERSONAL`/`BUSINESS`) but the UI-facing label is **Nhóm khách hàng** to avoid disrespectful wording.
6. Consultation creation either selects an existing customer or creates a new customer after normalized-phone duplicate validation.
7. A consultation profile may be saved without a technical configuration. When configurations are added, each owns its type, installation address, pin, derived area, floor rows and optional survey attachments.
8. Customer code/name opens Customer 360; consultation code opens the matching profile context.

Development-only workspace flow:

1. Catch-all route `/[...workspace]` renders `ModuleWorkspace`.
2. Route configuration chooses title, status set and generic fields.
3. Sample rows are generated in the browser.
4. Create/update/delete writes only to `localStorage` key `elevator-erp:workspace:{pathname}`.
5. This path must be replaced by a real module service/API before production.
6. Workspace pages show a development-only dismissible demo-data banner unless the session has hidden it.

## 5. Coding rules

### General

- Inspect existing code and tests before changing behavior.
- Make small, reviewable changes; do not rewrite unrelated areas.
- Do not mark a feature complete because a menu route or generic workspace exists.
- Preserve backward compatibility unless an explicit migration is included.
- Add or update tests for every business rule, permission rule and state transition.
- Use UTC in persistence and API timestamps; format to Vietnamese local time only in UI.
- Validate input in the backend even when frontend validation exists.
- Return structured error payloads; do not expose stack traces or secrets.
- Use soft delete for business records that require traceability.
- All sensitive mutations must be auditable.

### Backend

- Use async EF/API calls; never use `.Result`, `.Wait()` or shared mutable static state.
- `DbContext` remains scoped per request/job and must never be shared across threads.
- Add `CancellationToken` to database, file and long-running operations.
- Business invariants belong in the domain/application layer, not only in endpoint/UI code.
- Authorization must be checked before loading or returning sensitive data.
- Save the business transaction first; publish realtime notifications only after commit succeeds.
- Prefer explicit request/response DTOs; do not expose EF entities directly.
- When Modular Monolith extraction starts, modules may depend on SharedKernel contracts, not on another module’s EF internals.

### Frontend

- Keep server data as server data; `localStorage` is permitted only for temporary development workspaces.
- Do not store auth tokens, contracts, prices, payroll or real customer data in `localStorage`.
- Use the shared API layer and consistent error parsing.
- After mutation, either safely update cache/state or re-fetch; avoid duplicate requests and double-submit.
- Keep desktop table/mobile card parity.
- List pages should follow the shared ERP structure: two-line page header, primary action on the header right, KPI row, filter bar, data table card with title, pagination/export where applicable.
- Customer list default ordering is numeric customer code descending (`KH-000024` before `KH-000023`). Backend default and visible table sort indicator must stay consistent.
- Table header typography is 600; primary entity name is 600; phone is 500; ordinary metadata is 400; money is 600 and right-aligned.
- Table hover is subtle and selected rows use a left indicator. Business status must be shown by tags, not by coloring the whole row.
- Sort icons should be shown only on columns where sorting is meaningful; do not enable hidden sort behavior without a visible sorter.
- CSV export is acceptable for "Xuất Excel" workflows during the current stage because Excel opens CSV reliably, but future permission/audit requirements still apply.
- Long forms use `StepsForm` or structured sections; mobile actions remain reachable.
- Do not manipulate DOM directly when React/Ant Design can own the state.
- Browser-only APIs must run in client components/effects, never during server rendering.
- Keep the admin shell in shared layout. Do not reintroduce per-page `<AppShell>` wrappers.
- Preserve sidebar/header state across route navigation unless the user logs out or enters `/login`.
- On desktop, keep only one top-level sidebar module group open at a time. Do not remount the shell while doing this.
- On mobile, keep controls compact and reachable; full-width actions are acceptable on narrow screens.

## 6. Naming rules

### C#

- Types, records, public members: `PascalCase`.
- Locals and parameters: `camelCase`.
- Async methods: suffix `Async`.
- Interfaces: prefix `I` (`IFileStorage`).
- Entity names singular; `DbSet` names plural.
- IDs: `Guid`; timestamps: `DateTimeOffset`.
- Permission codes: lowercase dotted form, e.g. `customer.view`, `quotation.approve`.
- Workflow/status constants: uppercase stable codes, e.g. `PENDING_APPROVAL`, while Vietnamese labels stay in UI/catalog data.

### TypeScript/Next.js

- React components and types: `PascalCase`.
- Hooks/functions/variables: `camelCase`.
- Route folders: lowercase kebab-case.
- API types use explicit names such as `CustomerListItem`, `CreateCustomerRequest`.
- Do not use `any` for domain/API data.

### Database and business codes

- Current physical database naming is EF default and not yet standardized. Do not mass-rename tables/columns without an approved migration plan.
- Human-readable codes (`KH-`, `BG-`, `HD-`, `DA-`, `TM-`) must be generated concurrency-safely; never rely on `COUNT + 1` in production.

## 7. Permission and approval rules

- One account can have multiple roles.
- Effective permission is the union of allowed permissions from all roles.
- V1 does not use explicit `DENY`.
- Authorization dimensions eventually include function, data scope, project, sensitive fields, workflow state and approval limit.
- Backend returns `403` when permission or data scope is insufficient.
- Creator/requester must not approve their own sensitive transaction.
- Installer must not perform final KCS approval.
- Payment creator must not approve the same payment.
- Quotation creator must not approve the same quotation.
- Signed contract core data is immutable; changes use appendices/change requests.

## 8. Pending and workflow flow

### Business pending states

- Quotation: `DRAFT → PENDING_APPROVAL → APPROVED → SENT → REVISION_REQUESTED → new version`, or `REJECTED`.
- Contract: `DRAFT → TECH_REVIEW → ACCOUNTING_REVIEW → PENDING_APPROVAL → APPROVED → SIGNED → IN_PROGRESS → COMPLETED → LIQUIDATED`.
- Project creation is blocked until contract is `SIGNED` or exceptional deployment approval exists.
- Care: `UPCOMING → DONE`; overdue must be derived/updated when due time passes.
- Long-running system work should use `QUEUED → RUNNING → COMPLETED/FAILED`, with retry metadata and an idempotency key.

### UI pending rules

- Show loading state for fetches and disable the submitted action while a mutation is pending.
- Do not show success before the server confirms commit.
- Prevent double-submit.
- On failure, preserve user input and show a Vietnamese actionable message.
- On success, refresh the authoritative server state.

## 9. Websocket / SignalR flow

### Current state

No SignalR hub, websocket client, event contract or Nginx websocket proxy configuration exists. Do not assume realtime behavior is available.

### Target rule

Use SignalR mainly for notification/invalidation, not as the source of truth:

`Command API → validate permission/workflow → DB transaction commit → publish event → SignalR group → client receives event → invalidate/re-fetch affected API`

Suggested event envelope:

- `eventId`
- `eventType`
- `occurredAtUtc`
- `entityType`
- `entityId`
- `projectId` when applicable
- `version`
- minimal non-sensitive `payload`

Rules:

- Join groups by user, role/department when justified, and project assignment.
- Never broadcast confidential financial/payroll/contract fields to broad groups.
- Clients must tolerate duplicate/out-of-order events and re-fetch authoritative data.
- Nginx must add websocket `Upgrade` and `Connection` proxy headers when SignalR is introduced.

## 10. Threading and UI update rules

- Request handlers and jobs are async end-to-end.
- A scoped EF `DbContext` is used by only one request/job execution context.
- Background jobs persist state; they do not directly manipulate UI state.
- React state updates occur through hooks/components; SignalR callbacks enqueue state invalidation/refetch rather than mutating unrelated component state.
- Abort or ignore stale fetch results when route/filter changes can race.
- Optimistic UI is allowed only for reversible, low-risk actions; approvals, payments, KCS and handover require confirmed server results.

## 11. OCR / canvas

No OCR or canvas implementation exists in the current source.

Mobile construction photos should initially use standard camera/file input, client-side compression/thumbnail generation and retryable upload. Any future OCR/canvas pipeline must be isolated behind a service and must not block the UI thread.

## 12. Things that must never be broken

- Never introduce “Cơ hội bán hàng”.
- Never merge **Khách hàng**, **Hồ sơ tư vấn**, preliminary elevator configuration and **Thang máy tài sản** into one record.
- Never count a physical elevator asset before quotation/contract conversion has succeeded.
- Never allow one consultation profile to edit or delete configurations owned by another profile; copying is the supported reuse operation.
- Never move installation address, installation pin or installation area back to the customer master.
- Never allow project creation before signed contract or exceptional approval.
- Never model one project as exactly one elevator.
- Never use frontend menu visibility as the only authorization control.
- Never let a sensitive record creator self-approve.
- Never overwrite old quotation versions.
- Never directly edit signed contract core content.
- Never expose uploaded files through an unprotected public URL.
- Never store real secrets or production passwords in Git.
- Never expose PostgreSQL or Redis publicly.
- Never enable demo seeding in production.
- Never run `docker compose down -v` or delete `.data` when data must be preserved.
- Never claim a V3–V9 module is complete until its API, schema/migration, permissions, audit, workflow and tests are implemented.
- Never move primary page create actions back into the filter bar or global shell header.
- Never remove the demo-data distinction for localStorage-backed modules.
- Never require a paid Google Maps/Places API key for the approved free installation-location workflow unless the business explicitly accepts the cost and changes the architecture.
- Never expose location radius/accuracy in normal configuration UI unless there is a real dispatch/geofence requirement.
