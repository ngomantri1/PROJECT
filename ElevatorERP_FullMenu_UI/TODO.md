# TODO

> Prioritized handoff list for Codex. Do not mark an item complete without source, migration and test evidence.

## 1. Current focus

- Stabilize the Full Menu UI package as the development baseline.
- Move from generic `localStorage` workspaces to real business modules one roadmap stage at a time.
- Preserve the approved business rules while restructuring the backend into a real Modular Monolith.
- Keep Docker Compose and Rider workflows working after every meaningful change.

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

### Customer registration

- [ ] Add customer detail page.
- [ ] Add edit and soft-delete APIs.
- [ ] Add contacts, tax code and multiple construction addresses.
- [ ] Add elevator need/specification fields from the approved summary.
- [ ] Add attachments through a real document service.
- [ ] Enforce full status transitions and failure reason.
- [ ] Add duplicate phone/tax-code detection policy.
- [ ] Add server pagination and sorting.

### Care schedule

- [ ] Add date/status/assignee filters to UI and API.
- [ ] Add week view, today, upcoming, overdue and employee views.
- [ ] Allow participants and attachments.
- [ ] Allow next-care creation from completion flow.
- [ ] Automatically derive/update overdue status.
- [ ] Add reminders through worker and notifications.

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
- [ ] Centralize status codes/labels instead of duplicating them in pages and backend seed logic.
- [ ] Centralize responsive table/card patterns.
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

- [ ] Customer create/search/status/soft-delete/concurrent code generation.
- [ ] Care create/complete/next-care/overdue calculation.
- [ ] User role assignment and self-lockout protection.
- [ ] Project creation gate and one-to-many elevator relation.
- [ ] Quotation version immutability and contract immutability.
- [ ] Audit entries for all sensitive operations.

### Deployment/UI

- [ ] Fresh Docker start with empty `.data`.
- [ ] Restart containers without data/session loss.
- [ ] Production startup with `ENABLE_DEMO_SEED=false`.
- [ ] Desktop/mobile layouts for all real pages.
- [ ] Camera upload and unreliable-network retry.
- [ ] Nginx API routing, upload size and future websocket upgrade.
- [ ] Backup restore into a clean environment.
