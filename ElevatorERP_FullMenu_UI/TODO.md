# TODO

> Prioritized handoff list for Codex. Do not mark an item complete without source, migration and test evidence.

## 1. Current focus

- Stabilize the Full Menu UI package as the development baseline.
- Move from generic `localStorage` workspaces to real business modules one roadmap stage at a time.
- Preserve the approved business rules while restructuring the backend into a real Modular Monolith.
- Keep Docker Compose and Rider workflows working after every meaningful change.
- Preserve the approved ERP/admin shell behavior: persistent shared shell, desktop one-open-group sidebar accordion, compact mobile drawer, primary page actions in page headers, and light/dark theme support.
- Stabilize the Customer → consultation → quotation/contract → physical elevator asset lifecycle and remove legacy ownership ambiguity.
- Keep Customer 360 as an aggregate/read surface while write operations remain in their owning modules.

## 1.1 Recently completed customer/consultation foundation

- [x] Split the business navigation into **Khách hàng** and **Hồ sơ tư vấn**.
- [x] Add normalized-phone duplicate prevention and actionable existing-customer selection.
- [x] Support multiple consultation profiles for one customer.
- [x] Store multiple preliminary elevator configurations per consultation profile and support configuration copying.
- [x] Move installation address, pin, derived area and survey attachments into each elevator configuration.
- [x] Add Customer 360 aggregate APIs and URL-backed Customer 360 tabs.
- [x] Add contract-confirmation conversion from an accepted quotation to a physical `CustomerElevator` asset snapshot.
- [x] Add Customer 360 tabs for profiles, assets, quotations, contracts, receivables, progress, maintenance, care and history.
- [x] Make customer code/name navigate to Customer 360 and profile code navigate to the profile context.

## 1.2 Current Customer 360 and lifecycle work

- [ ] Correct Customer 360 labels and counters so preliminary configurations and physical assets are never represented as the same quantity.
- [ ] Show consultation configurations under their source profile, including read-only configurations from other profiles and explicit copy-to-current-profile action.
- [ ] Replace the receivables placeholder with a real accounting read model grouped by contract.
- [ ] Replace derived progress/maintenance placeholders with real asset workflow read models and links to their owning modules.
- [ ] Add responsive and dark-theme verification for every Customer 360 tab.
- [ ] Add backend integration tests for profile creation, configuration copy, contract conversion, repeat conversion and customer history.

## 1.3 Recently completed UI shell baseline

- [x] Move `AppShell` to shared authenticated frame so sidebar/header do not remount on normal menu navigation.
- [x] Keep `/login` outside the ERP shell.
- [x] Add light/dark theme switching with persisted user preference.
- [x] Move account controls to the top-right toolbar.
- [x] Remove page business actions from the global header.
- [x] Move primary create actions to the right side of each page header for customers, care and generic workspace pages.
- [x] Polish desktop dashboard, tables, cards and sidebar scrollbar for ERP/admin shell use.
- [x] Polish mobile dashboard/module layouts, KPI cards, filter actions, account toolbar and sidebar sizing.
- [x] Configure desktop sidebar accordion so only one top-level menu group is open at a time; keep mobile behavior compact.
- [x] Standardize customer list table columns for code, name, phone, email, area, source, owner, status, created date and action.
- [x] Add CSV export to list pages that currently have loaded client-side rows.
- [x] Add shared catalog administration UI and API for customer statuses, lost reasons, sources and customer types.
- [x] Make catalog active toggles update the right content without reloading the left category list.
- [x] Standardize sortable columns and visible sorter icons across the main list tables.
- [x] Add thin dismissible development-only demo-data banner for localStorage-backed workspace pages.
- [x] Add table card titles for generic workspace list pages.
- [x] Add month/year calendar toolbar with previous/today/next navigation.
- Verification evidence: `npm run lint` and `npm run build` passed after the shell changes.

## 1.4 Legacy customer-intake UX/API baseline (partly superseded)

- [x] Add edit action to the legacy customer-intake list and persist customer master edits through `PUT /api/customers/{id}`.
- [x] Add inline editable customer status badge using catalog-backed colors and `PUT /api/customers/{id}/status`.
- [x] Standardize table action alignment and compact table card toolbar spacing across list pages.
- [x] Move secondary customer filters into an advanced filter drawer; keep main search as live/debounced search.
- [x] Add created date range, customer group, elevator type, source, owner and area/address filters to the customer advanced filter.
- [x] Add normalized Vietnamese-friendly search so partial input without full diacritics can still match customer data.
- [x] Keep catalog-backed **Loại thang máy** but move its business ownership to each consultation configuration.
- [x] Reuse the free OpenStreetMap/coordinate flow for per-configuration installation pinning.
- [x] Keep the installation-location workflow free by avoiding Google Places/Maps API key dependency.
- [x] Hide visible location radius/accuracy from normal business forms.
- [x] Keep customer contact address separate from installation address/coordinates.
- [x] Use **Nhóm khách hàng** as the customer-facing label and remove elevator type/installation area from customer-master list semantics.
- [x] Fix dashboard welcome panel contrast/fog so text is readable on a professional ERP/admin shell background.
- Verification evidence: `npm run lint` and `npm run build` passed after the customer/location changes.

## 2. P0 — must complete before expanding features

- [ ] Run and record a clean baseline on the developer machine:
  - `dotnet restore/build`
  - `npm ci`, lint, type-check, production build
  - `docker compose config/build/up`
  - health, login and database persistence smoke tests
- [ ] Add EF Core migrations and replace `EnsureCreatedAsync()` with a controlled migration strategy.
- [ ] Define development/test/production configuration; remove demo credentials from production UI/docs.
- [ ] Restrict Swagger to development or protected administration access.
- [ ] Add automated backend and frontend test projects.
- [ ] Define structured API error format and update `frontend/src/lib/api.ts` to parse it.
- [ ] Add antiforgery/CSRF strategy appropriate for cookie-authenticated mutation APIs.
- [ ] Add login throttling/lockout and production password policy.
- [ ] Implement concurrency-safe business code generation.
- [ ] Confirm backup and restore for PostgreSQL, uploads and deployment configuration.
- [ ] Add a database uniqueness constraint for quotation/contract-to-asset conversion and execute conversion plus audit in one transaction.
- [ ] Define relational entities/migrations for elevator configurations, floors and configuration attachments; migrate away from JSON-only ownership.
- [ ] Normalize and uniquely index customer phone numbers at database level.

## 3. P0 — authorization foundation

- [ ] Replace string-only `DataScope` behavior with explicit scope evaluation.
- [ ] Correct `DEPARTMENT` scope so it filters by the user’s department instead of exposing all company data.
- [ ] Implement scopes: own, assigned, team, department, branch, company.
- [ ] Add project assignments.
- [ ] Add sensitive-field permissions.
- [ ] Add workflow-state permissions and approval limits.
- [ ] Add permission metadata to every menu route and backend endpoint.
- [ ] Prevent a user from accidentally removing their own last administration role.
- [ ] Add separation-of-duties policies for quotation, payment, KCS and change approval.
- [ ] Expand audit logging with before/after values, reason, device/user agent and protected document access.
- [ ] Implement approved Rule assignment: one account can receive multiple Rules containing action permissions plus per-module data scope.
- [ ] Support explicit scopes `OWN`, `TEAM`, `DEPARTMENT`, `BRANCH`, `COMPANY` and `CUSTOM`; do not infer access from job title alone.

## 4. Backend refactor

- [ ] Split `Program.cs` into host setup and module endpoint registration.
- [ ] Split `Entities.cs` by module/aggregate.
- [ ] Introduce application commands/queries and explicit DTOs.
- [ ] Define SharedKernel primitives for entity, result, audit, permissions and domain events.
- [ ] Create module projects or folders with enforced dependency direction.
- [ ] Add validation layer and consistent pagination/filter contracts.
- [ ] Add transaction boundaries for business mutation plus audit.
- [ ] Add integration/domain event mechanism after database commit.
- [ ] Add Redis only where measured/useful; do not cache permissions or sensitive data without invalidation rules.
- [ ] Add worker/Hangfire project and Docker service.
- [ ] Add SignalR hub, event contracts, reconnect handling and Nginx websocket proxy headers.

## 5. V1–V2 completion

### Identity and organization

- [ ] Create/update/disable users.
- [ ] Manage departments and work teams.
- [ ] Manage roles, permissions and scopes through real APIs.
- [ ] First-login password change.
- [ ] Password reset flow.
- [ ] Optional 2FA for privileged accounts.
- [ ] Audit viewer backed by PostgreSQL, not generic workspace data.

### Customer master and consultation profiles

- [x] Add Customer 360 detail page and deep links from customer code/name.
- [ ] Add soft-delete/restore semantics and audit behavior; deletion must remain blocked when dependent profiles/contracts/assets exist.
- [ ] Add customer contacts and tax code without moving construction/installation addresses to the customer master.
- [ ] Enforce full status transitions, failure reason and lost reason rules; current inline status update writes the selected catalog status directly.
- [ ] Add tax-code duplicate policy; normalized phone duplicate prevention already exists and also applies when creating a customer through a consultation profile.
- [ ] Add server pagination and formal server sorting contracts to customer and consultation lists.
- [ ] Replace prototype schema workarounds and legacy customer/profile location/elevator-type columns with controlled EF Core migrations.
- [ ] Add backend tests for customer edit/delete guards, duplicate phone, profile ownership, KPI eligibility and installation metadata.
- [ ] Replace client-side CSV export with server-side export when data volume, permissions and audit requirements are implemented.
- [ ] Add KPI statistics by time window, owner, department, source, eligible consultation count, quotation milestone, contract outcome and conversion rate.
- [ ] Add read-only visibility of configurations from a customer's other profiles and explicit copy-to-current-profile behavior.

### Care schedule

- [ ] Add date/status/assignee filters to UI and API.
- [ ] Add week view, upcoming, overdue and employee views.
- [ ] Allow participants and attachments.
- [ ] Allow next-care creation from completion flow.
- [ ] Automatically derive/update overdue status.
- [ ] Add reminders through worker and notifications.
- [ ] Make "+n lịch khác" in calendar cells open a popover/drawer with the hidden schedules.

## 6. V3 — quotations and contracts

- [ ] Replace `/quotations` generic workspace with real module/API/schema.
- [ ] Implement immutable quotation versions.
- [ ] Implement line items, technical specs, VAT, discount, payment terms and exclusions.
- [ ] Implement discount-limit approval and creator/approver separation.
- [ ] Replace `/contracts` generic workspace with real module/API/schema.
- [ ] Implement technical review, accounting review, approval and signing workflow.
- [ ] Implement appendices/change requests; prevent direct edit after signing.
- [ ] Implement payment installments and protected contract documents.

## 7. V4 — projects and elevator dossiers

- [ ] Create project only from signed contract or exceptional approval.
- [ ] Copy approved source data into project snapshot/read model.
- [ ] Implement project members and data access by assignment.
- [ ] Implement one-project-to-many-elevators model.
- [ ] Implement elevator identity, specifications, QR code and lifecycle timeline.
- [ ] Implement weighted project stages; total progress must be calculated, not manually typed.
- [ ] Replace all V4 generic workspaces with real pages and APIs.

## 8. V5–V7 — field work, KCS and service

- [ ] Tasks, schedules, checklists and resource conflict detection.
- [ ] Mobile-first site journal with photo compression, thumbnail and retry.
- [ ] KCS checklist, defects, correction and independent re-check.
- [ ] Inspection, acceptance and handover records/signatures.
- [ ] Handover action creates warranty dates, operating record and maintenance schedule.
- [ ] Maintenance plans, generated schedules, maintenance forms and customer signature.
- [ ] Incident SLA, assignment, cause, repair, parts and recovery confirmation.

## 9. V8–V9 — accounting, reporting and production

- [ ] Receivables, payment confirmation, overdue alerts and basic project cost.
- [ ] Revenue/costing/subcontractor reports with sensitive-field permissions.
- [ ] Excel export with permission and audit.
- [ ] Role-specific dashboards using authoritative data.
- [ ] Database indexes and query performance review.
- [ ] Upload/storage quota, checksum, malware strategy and cleanup.
- [ ] HTTPS/Let’s Encrypt, security headers and production Nginx configuration.
- [ ] Monitoring, logs, health checks for DB/Redis/storage/worker.
- [ ] Backup automation, off-VPS copy and restore drill.
- [ ] Production deployment and rollback runbook.

## 10. Refactor candidates

- [ ] Replace generic `ModuleWorkspace` with module-specific components as each API is implemented.
- [ ] Extract shared UI building blocks: `PageHeaderSection`, `PageFilterBar`, `DataTableCard`, `DemoDataBanner`, `StatusTag`, `PriorityTag` and `CalendarToolbar`.
- [ ] Extract `AppHeaderActions` / `UserDropdown` from `AppShell` if the shell grows further.
- [ ] Consider moving route/menu definitions into a typed registry shared by permissions, breadcrumbs and page guards.
- [ ] Centralize status codes/labels instead of duplicating them in pages and backend seed logic.
- [ ] Centralize responsive table/card patterns.
- [ ] Extract shared list-table action alignment and compact table toolbar styles into reusable components/classes rather than page-specific fixes.
- [ ] Extract the elevator installation-location picker into a reusable, tested component for consultation configurations, projects and physical elevator assets.
- [ ] Introduce a real upload API helper that supports `FormData` without forcing JSON headers.
- [ ] Add request cancellation/stale-response protection.
- [ ] Reduce frontend first-load bundle size; generic workspace currently loads a large ProComponents bundle.
- [ ] Cache permissions per request or user version after correctness/invalidation is designed.
- [ ] Add typed route/permission registry shared by menu and page guards.

## 11. Tests to add or rerun

### Security

- [ ] Unauthenticated API returns `401`.
- [ ] Missing permission returns `403`.
- [ ] Multiple roles union permissions.
- [ ] Data scopes do not leak cross-owner/department/project data.
- [ ] Creator cannot self-approve sensitive records.
- [ ] Cookie survives backend restart because Data Protection keys persist.
- [ ] CSRF, login throttling, upload validation and path traversal tests.

### Functional

- [ ] Customer create/edit/search/status/location/elevator-type/soft-delete/concurrent code generation.
- [ ] Geo helper tests for OSM query fallback, pasted decimal coordinates, DMS coordinates, Google Maps `@lat,lng` URLs and shortened-link failure messages.
- [ ] Care create/complete/next-care/overdue calculation.
- [ ] User role assignment and self-lockout protection.
- [ ] Project creation gate and one-to-many elevator relation.
- [ ] Quotation version immutability and contract immutability.
- [ ] Audit entries for all sensitive operations.

### Deployment/UI

- [ ] Fresh Docker start with empty `.data`.
- [ ] Restart containers without data/session loss.
- [ ] Production startup with `ENABLE_DEMO_SEED=false`.
- [ ] Desktop/mobile layouts for all real pages, including regression checks for persistent shell navigation.
- [ ] Verify sidebar desktop one-open-group accordion behavior and mobile compact behavior after menu changes.
- [ ] Visual regression for page header action placement, filter bars, demo banners, table toolbar icons and calendar toolbar on 1920, 1366, tablet and mobile widths.
- [ ] Camera upload and unreliable-network retry.
- [ ] Nginx API routing, upload size and future websocket upgrade.
- [ ] Backup restore into a clean environment.

## 14. Production operations and deployment follow-up

### Before real customer data

- [ ] Attach production domain and configure HTTPS/TLS in Nginx; change CORS to the final HTTPS origin.
- [ ] Restrict or disable public Swagger outside explicitly authorized administration access.
- [ ] Create scheduled backups for PostgreSQL, uploads and Data Protection keys; copy backups to storage outside the VPS and test restoration.
- [ ] Add service health monitoring, disk-space alerting and error-log retention for Docker/Nginx/backend.
- [ ] Harden SSH access: use key-only login, disable password/root login where the server-access process permits, and restrict administration IPs when possible.

### Current test deployment workflow

- [ ] Use `docs/DEPLOYMENT_CHECKLIST.md` as the only copy-paste deployment runbook; retain placeholders such as `<IP_SERVER>` rather than committing real host details or secrets.
- [ ] For code-only updates: local commit/push, VPS `git pull --ff-only`, then `docker compose up -d --build` and verify `docker compose ps` plus the web/API health endpoints.
- [ ] For deliberate local-to-VPS test-data sync: export PostgreSQL with `pg_dump`, transfer SQL plus uploads and Data Protection keys, back up VPS data, restore with application containers stopped, then restart the stack.
- [ ] Stop using local-to-VPS database overwrites once real production data begins; switch to migrations and production backup/restore procedures only.
