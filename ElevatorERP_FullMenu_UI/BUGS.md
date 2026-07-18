# BUGS

> Known defects, risks and historical fixes identified from the current source and project conversation. Last review: **2026-07-18**.

## 1. Current open issues

### Critical / high

- **Most menu modules are not real backend modules.**
  - Area: `frontend/src/components/ModuleWorkspace.tsx`.
  - Cause: V3–V9 routes use generic browser-only rows stored in `localStorage`.
  - Risk: UI can look complete while no schema, API, permission, audit or workflow exists.
  - Required fix: replace one route group at a time with real module implementation and tests.

- **No EF Core migrations.**
  - Area: `DemoSeeder.SeedAsync()` calls `EnsureCreatedAsync()`.
  - Risk: no controlled schema evolution or safe production deployment.
  - Workaround: acceptable only for disposable local demo databases.

- **Department data scope leaks company-wide data.**
  - Area: customer/care queries in `Program.cs`.
  - Cause: roles with `DataScope == "DEPARTMENT"` are treated like `ALL` and bypass owner filtering.
  - Required fix: filter through the current user’s department and explicit ownership/assignment rules.

- **Authorization coverage is incomplete.**
  - Area: `AppShell` route definitions and generic workspace routes.
  - Cause: only dashboard, customer, care and user routes declare menu permissions; most routes are visible to every authenticated user.
  - Risk: when real data is connected, UI and API access may diverge.
  - Required fix: define permission for every route and enforce the same capability in backend endpoints.

- **Cookie-authenticated mutation APIs have no explicit antiforgery design.**
  - Area: all POST/PUT endpoints; upload explicitly calls `DisableAntiforgery()`.
  - Risk: production CSRF protection is not demonstrated.
  - Required fix: implement and test an antiforgery strategy compatible with same-origin Next.js/Nginx requests.

- **Swagger is always enabled, including Production environment.**
  - Area: `Program.cs` and Docker Compose (`ASPNETCORE_ENVIRONMENT=Production`).
  - Risk: production API surface is publicly documented unless protected externally.
  - Required fix: restrict by environment, authentication or network policy.

### Medium

- **Customer code generation is race-prone.**
  - Area: `POST /api/customers` uses total count + 1.
  - Risk: concurrent creates can produce the same unique code and fail.
  - Also inconsistent: seed codes use four digits, API codes use six digits.
  - Required fix: database sequence/counter or retryable unique code generator.

- **Care overdue state is static.**
  - Area: seed logic and care API.
  - Cause: `OVERDUE` is assigned only when demo data is seeded; no scheduled recalculation.
  - Required fix: derive from due date or update through worker job.

- **Care completion UI does not create next care.**
  - Area: `care/page.tsx` sends `nextCareAt: null`.
  - Gap: approved workflow asks whether to create the next care schedule.

- **Customer status cannot be progressed through real APIs.**
  - Area: backend only supports list/create.
  - Gap: no edit, transition validation, soft-delete endpoint or failure reason enforcement.

- **Role assignment can remove the current admin’s final role.**
  - Area: `PUT /api/admin/users/{id}/roles`.
  - Risk: accidental self-lockout.
  - Required fix: protect last privileged account/role and require confirmation/re-auth for sensitive changes.

- **Audit log is incomplete.**
  - Missing or weak coverage: logout, read/download of sensitive files, before/after values, reason, user agent/device, status transitions and many future modules.
  - Role assignment stores only role IDs in a string.

- **File validation trusts declared `Content-Type`.**
  - Area: upload endpoint.
  - Missing: magic-byte/content sniffing, checksum, malware strategy, image dimensions, version/security classification.

- **File write and metadata save are not atomic.**
  - Area: upload endpoint writes disk first, then database.
  - Risk: DB failure can leave orphaned files.
  - Missing: authorized download, thumbnail and delete lifecycle.

- **Shared API helper forces JSON content type.**
  - Area: `frontend/src/lib/api.ts`.
  - Impact: it cannot be reused safely for `FormData` uploads without a separate helper/change.

- **API errors are displayed as raw response text.**
  - Area: `frontend/src/lib/api.ts`.
  - Risk: JSON error bodies may appear to users as raw strings instead of a clean message.

- **No request cancellation or stale-response protection.**
  - Area: page `useEffect`/load methods.
  - Risk: fast navigation/filter changes may render an older response last.

- **Generic localStorage data has no schema validation/version.**
  - Area: `ModuleWorkspace.tsx` casts parsed JSON directly.
  - Risk: stale or manually edited data can break UI assumptions.
  - Workaround: use “Khôi phục dữ liệu” or clear the route-specific localStorage key.

- **Client-side CSV export is not yet a permissioned/audited export system.**
  - Area: `frontend/src/lib/exportCsv.ts`, customers, care and generic workspace pages.
  - Cause: export uses currently loaded frontend rows.
  - Risk: future large datasets, hidden columns, permissions and audit requirements are not enforced server-side.
  - Required fix: implement backend export endpoints with permission checks, audit entries and streaming for large datasets.

- **Demo-data banner hidden state is session-scoped and shared across workspace routes.**
  - Area: `ModuleWorkspace.tsx`.
  - Cause: one `sessionStorage` key hides the thin demo banner for all generic workspace pages.
  - Risk: developer may forget a later generic route is still localStorage-backed during the same browser session.
  - Workaround: open a new session or clear `elevator-erp:hide-demo-banner`.

- **Global search is placeholder behavior.**
  - Area: `AppShell.tsx`.
  - Current behavior: Enter always navigates to `/customers` and does not use the query.

- **Forgot-password control is disabled.**
  - Area: login page.
  - Gap: no reset workflow exists.

- **Redis is an unused hard dependency.**
  - Area: Docker Compose waits for Redis healthy although backend has no Redis client.
  - Impact: Redis failure blocks backend startup without providing application value.

- **Health check covers only PostgreSQL.**
  - Missing: Redis, upload storage writability, worker and dependency health.

- **No SignalR/background worker.**
  - Consequences: no realtime notifications, automatic overdue processing, reminders or maintenance schedule generation.
  - Nginx also lacks websocket upgrade headers.

### Low / maintainability

- `Program.cs` is a large composition root plus all endpoints and DTOs.
- All entities are in one file.
- Status labels/codes are duplicated between backend seed and frontend pages.
- Several UI patterns are now standardized by convention/CSS but not yet extracted into shared components (`PageHeaderSection`, `PageFilterBar`, `DataTableCard`, `DemoDataBanner`, `StatusTag`).
- Soft-delete query filters exist only for Customer and CareActivity although base `Entity` contains `IsDeleted`.
- Generic workspace fields are too broad to represent domain-specific rules.
- Frontend full-menu route has a large first-load bundle and should be split as real modules are implemented.

## 2. Historical bugs already fixed

- Added `ElevatorERP.sln` so Rider can open/build the backend solution.
- Added and locked `frontend/package-lock.json`.
- Removed the accidental internal package registry reference that caused Docker `npm ci` failure.
- Changed frontend Docker build to deterministic `npm ci`.
- Fixed mobile sidebar/content offset and added mobile card layouts.
- Replaced low-contrast disabled menu items with readable collapsible full-menu navigation.
- Added persistent ASP.NET Data Protection key storage so auth cookies survive backend container restart.
- Replaced permissive wildcard CORS-with-credentials behavior with configured origins.
- Sanitized upload module path and added path traversal boundary check.
- Made demo seeding respect `ENABLE_DEMO_SEED=false`.
- Added assignee/manager scope check when completing care activity.
- Added basic audit entries for customer/care creation, care completion, role assignment and upload.
- Updated PowerShell start script to fail when Docker commands fail instead of printing false success URLs.
- Verified Full Menu frontend with `npm ci`, ESLint, strict TypeScript and production build.
- Moved `AppShell` out of individual pages into a shared `AppFrame`, so sidebar/header no longer remount when clicking sidebar menu items.
- Added `/login` exception so the login page renders outside the ERP shell.
- Added persistent light/dark theme switching through `AppProviders`.
- Reworked top-right account toolbar so account/notification controls no longer collide with page actions; theme switching now lives in the account menu.
- Removed global header business buttons; current create actions belong in page headers and apply/export actions belong in filter/tool areas.
- Improved desktop/mobile ERP/admin shell visual design, including dashboard hero, KPI cards, dark mode contrast, mobile cards and filter layout.
- Made desktop sidebar groups support multiple open sections while keeping mobile compact behavior.
- Slimmed and darkened sidebar scrollbar to avoid the oversized default browser scrollbar.
- Documented and worked around Nginx `502 Bad Gateway` after rebuilding frontend by restarting `nginx` when upstream IP caching occurs.
- Reworked the sidebar behavior to a one-open-group desktop accordion and kept the shell mounted during navigation.
- Replaced the hand-drawn placeholder sidebar logo with a repo-native SVG brand mark aligned to the public website logo direction.
- Standardized the green brand palette: neutral light background, dark green sidebar, green primary actions, red/orange still reserved for error/warning.
- Lightened dark mode background and strengthened dark status tags for readability.
- Split customer table contact information into separate code/name/phone/email columns for future filtering and CSV export.
- Added customer table action menu and fixed sticky action/date column overlap by standardizing fixed-column shadows.
- Fixed customer KPI active state where "Tổng khách hàng" looked selected when no KPI filter was active.
- Fixed ProTable toolbar icon alignment and normalized its 32px click target.
- Added visible sorters only to meaningful table columns and removed unnecessary sorters from email/phone/type/active columns where appropriate.
- Added frontend CSV export buttons to customers, care and generic workspace list pages.
- Added catalog administration for customer statuses/sources/types/lost reasons and fixed active toggle UI refresh without reloading the left category list.
- Vietnamese labels are used for catalog-facing UI options such as badge colors.
- Removed invalid `processing` badge color from the customer status color selector and standardized customer status colors in frontend fallback and backend seed.
- Added seed update behavior for existing system catalog options so label/color/sort order changes apply to old local databases.
- Moved primary create actions to page headers for customers, care and generic workspace pages; filter bars no longer contain create-new buttons.
- Replaced large generic workspace demo alerts with thin dismissible development-only demo-data banners.
- Added list card titles for generic workspace tables such as báo giá and hợp đồng.
- Added calendar previous/today/next navigation and month/year mode switch; calendar cells now show at most three schedules plus a "+n lịch khác" indicator.

## 3. Temporary workarounds

- Generic route data issue: click **Khôi phục dữ liệu** or remove `elevator-erp:workspace:{pathname}` from browser localStorage.
- Need real business verification: test only login, dashboard, customers, care and user-role assignment against PostgreSQL; treat other routes as UI scaffolding.
- Schema changes during local prototype: recreate only a disposable local database after backup. Never delete production `.data`.
- Docker dependency installation issue: keep the committed npmjs-based lock file; do not run unreviewed dependency upgrades.
- Care overdue demo mismatch: re-seed disposable demo data or inspect dates manually until worker/derived status exists.
- After rebuilding/recreating the frontend container, if `localhost` shows Nginx `502 Bad Gateway` while containers are healthy, run `docker compose restart nginx` so Nginx resolves the current frontend container IP.

## 4. High-risk code areas

- `backend/Program.cs`
  - Authentication, CORS, Swagger, all endpoints, authorization, audit and upload are coupled.
- `backend/Infrastructure/DemoSeeder.cs`
  - Database creation and seed idempotency; not a migration system.
- `backend/Security/SecurityServices.cs`
  - Permission union is correct at a basic level, but full scope/field/workflow authorization is absent.
- `frontend/src/components/AppShell.tsx`
  - Menu permission consistency and global navigation.
- `frontend/src/components/ModuleWorkspace.tsx`
  - Large generic component, localStorage persistence and fake domain behavior.
- `frontend/src/lib/api.ts`
  - Cross-cutting auth redirect, content type and error parsing.
- `docker-compose.yml` and `.env`
  - Secrets, production demo flag, persistent data paths and service startup coupling.
- `deploy/nginx/default.conf`
  - Production TLS/security headers and future SignalR websocket support.

## 5. Regression checks after changes

- Login cookie still works through Nginx.
- Backend restart does not log users out unexpectedly.
- Every protected API returns `401/403` correctly.
- A sales user cannot see another scope’s records.
- Mobile sidebar, tables/cards and drawers remain usable.
- Customer/care mutations create audit records.
- Upload cannot escape the configured root or execute uploaded content.
- Docker restart preserves PostgreSQL, uploads and Data Protection keys.
- Production configuration does not seed demo accounts or expose demo password.
