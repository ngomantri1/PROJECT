# ARCHITECTURE

> Current architecture map plus the approved target direction. Last source review: **2026-07-17**.

## 1. Current repository structure

```text
ElevatorERP_FullMenu_UI/
├── ElevatorERP.sln
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── ElevatorERP.Api.csproj
│   ├── Program.cs
│   ├── Domain/Entities.cs
│   ├── Infrastructure/AppDbContext.cs
│   ├── Infrastructure/DemoSeeder.cs
│   ├── Security/SecurityServices.cs
│   └── Dockerfile
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── next.config.mjs
│   ├── Dockerfile
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── globals.css
│       │   ├── page.tsx
│       │   ├── login/page.tsx
│       │   ├── customers/page.tsx
│       │   ├── care/page.tsx
│       │   ├── admin/users/page.tsx
│       │   └── [...workspace]/page.tsx
│       ├── components/AppShell.tsx
│       ├── components/AppFrame.tsx
│       ├── components/AppProviders.tsx
│       ├── components/ModuleWorkspace.tsx
│       └── lib/api.ts
├── deploy/nginx/default.conf
├── scripts/
├── docs/
└── reports/
```

## 2. Runtime topology

```text
Browser
  │
  ▼
Nginx :80/:443
  ├── /              → Next.js frontend :3000
  └── /api/*         → ASP.NET Core API :8080
                           ├── EF Core → PostgreSQL :5432
                           ├── local disk → /app/uploads
                           └── Data Protection keys → /app/data-protection-keys

Redis :6379 exists in Docker but is not used by application code yet.
```

Current Docker Compose services:

- `postgres`
- `redis`
- `backend`
- `frontend`
- `nginx`

Target but absent service:

- `background-worker` using Hangfire or ASP.NET Core Worker.

## 3. Current backend architecture

The source is **not yet a true Modular Monolith**. It is one ASP.NET Core Minimal API project.

### `backend/Program.cs`

Responsibilities currently concentrated in one file:

- Service registration.
- PostgreSQL `DbContext` registration.
- Cookie authentication and authorization.
- Data Protection key persistence.
- Forwarded headers and CORS.
- Swagger.
- Startup seed.
- All API endpoint mappings.
- Request record declarations.

This is the main refactor hotspot.

### `backend/Domain/Entities.cs`

Contains all current entities:

- `Entity`
- `Department`
- `AppUser`
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`
- `Customer`
- `CareActivity`
- `AuditLog`
- `StoredFile`

`Entity` provides `Guid Id`, UTC timestamps, `IsDeleted`, and `IsDemo`.

### `backend/Infrastructure/AppDbContext.cs`

- Declares all current `DbSet`s.
- Configures composite keys for role joins.
- Creates unique indexes for username, role code, permission code and customer code.
- Applies soft-delete query filters only to `Customer` and `CareActivity`.

### `backend/Infrastructure/DemoSeeder.cs`

- Calls `Database.EnsureCreatedAsync()`.
- Exits unless `EnableDemoSeed=true`.
- Seeds departments, permissions, roles, users, 20 customers and 45 care activities.
- Uses deterministic sample random seed.

### `backend/Security/SecurityServices.cs`

- PBKDF2-SHA256 password hashing/verification.
- `CurrentUser` reads user ID/name from cookie claims.
- `PermissionService` unions permissions from all assigned roles.
- `RequirePermission(...)` endpoint filter returns `403` when missing.

## 4. Current frontend architecture

### `src/app/layout.tsx`

- Root metadata.
- Ant Design SSR registry.
- Wraps the app with `AppProviders`.
- Wraps authenticated routes with `AppFrame`.

### `src/components/AppProviders.tsx`

- Client-side Ant Design `ConfigProvider` and `App`.
- Owns light/dark theme state.
- Persists theme in `localStorage` key `elevator-erp:theme-mode`.
- Sets `document.documentElement.dataset.theme` so global CSS can style light/dark variants.

### `src/components/AppFrame.tsx`

- Client-side route frame.
- Renders `/login` without the ERP shell.
- Renders all other routes inside `AppShell`.
- This keeps the shell mounted while App Router swaps only the page content.

### `src/components/AppShell.tsx`

- Main `ProLayout` shell.
- Full business menu definitions.
- Calls `/auth/me`.
- Filters routes that declare a permission.
- Handles account toolbar, theme toggle, notifications, help, user dropdown and logout.
- Owns responsive sidebar collapse state.
- Desktop sidebar menu uses `autoClose: false` so multiple module groups can remain open.
- Mobile sidebar keeps the default compact behavior to save screen space.

Only routes with an explicit `permission` property are currently filtered. Most generic V3–V9 routes are visible to any authenticated user.

### Real API pages

- `app/login/page.tsx`: cookie login.
- `app/page.tsx`: dashboard from `/dashboard`.
- `app/customers/page.tsx`: customer list/filter/create.
- `app/care/page.tsx`: care list/calendar/create/complete.
- `app/admin/users/page.tsx`: user/role list and role assignment.

### Generic development workspace

- `app/[...workspace]/page.tsx` delegates to `ModuleWorkspace`.
- `ModuleWorkspace.tsx` maps 38 business paths to generic configuration.
- Sample data and mutations persist in browser `localStorage`.
- It provides KPI cards, filters, responsive table/card, create, details, status update, delete and reset.
- It has no backend domain model, permission enforcement, audit or server persistence.

### `src/lib/api.ts`

- Prefixes calls with `NEXT_PUBLIC_API_BASE_URL`.
- Sends cookies using `credentials: include`.
- Redirects to `/login` on `401`.
- Throws on non-2xx responses.

## 5. Current API surface

```text
GET  /api/health
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/dashboard
GET  /api/customers
POST /api/customers
GET  /api/care-activities
POST /api/care-activities
PUT  /api/care-activities/{id}/complete
GET  /api/admin/roles
GET  /api/admin/users
PUT  /api/admin/users/{id}/roles
POST /api/files/upload
```

## 6. Dependency direction

### Current

```text
Frontend pages/components
  └── frontend/lib/api.ts
        └── ASP.NET Core endpoints in Program.cs
              ├── Security services
              ├── AppDbContext
              └── Domain entities
                    └── PostgreSQL
```

The backend currently has direct endpoint-to-EF dependencies and no application layer.

### Target Modular Monolith

```text
Api/Host
  └── Module Application contracts/handlers
        ├── Module Domain
        └── Module Infrastructure
              ├── EF mappings/repositories
              ├── file/cache/job adapters
              └── integration event publishing

Modules may depend on SharedKernel abstractions.
Modules must not query another module’s tables through its internal DbContext/repository.
Cross-module communication uses public contracts, domain/integration events or read models.
```

Recommended module boundaries:

- Identity
- Organization
- Customers
- Care
- Quotations
- Contracts
- Projects
- Elevators
- Technical/Tasks/SiteJournal
- QualityControl
- Inspection/Acceptance/Handover
- Maintenance/Incidents
- Accounting
- HumanResources
- Documents
- Notifications
- Reporting

## 7. Data flow

### Authentication

```text
Login form
→ POST /api/auth/login
→ load active user
→ verify PBKDF2 hash
→ issue HttpOnly cookie
→ save login audit
→ frontend redirects to dashboard
→ AppShell calls /api/auth/me
```

### Authorized query

```text
Frontend request with cookie
→ authentication middleware
→ RequirePermission filter
→ PermissionService unions role permissions from DB
→ endpoint applies data-scope filter
→ EF query PostgreSQL
→ DTO JSON response
→ React state render
```

### Customer creation

```text
Drawer form
→ POST /api/customers
→ validate required fields
→ derive customer code
→ assign current user as owner
→ add Customer + AuditLog
→ SaveChanges
→ frontend re-fetches customer list
```

### Care completion

```text
Completion UI
→ PUT /api/care-activities/{id}/complete
→ permission check
→ ownership/manager scope check
→ update status/result/next date
→ add AuditLog
→ SaveChanges
→ frontend re-fetches care list
```

### File upload

```text
Multipart upload
→ permission + size + declared MIME allow-list
→ sanitize module folder
→ create UUID file name
→ write file to bind-mounted disk
→ save StoredFile + AuditLog metadata
```

There is currently no download flow, checksum verification, file versioning or cleanup transaction for failed metadata writes.

### Generic workspace

```text
Route pathname
→ workspace config
→ localStorage load or sample generation
→ React state
→ local create/update/delete
→ localStorage persistence
```

## 8. UI update flow

### Current

- Real pages use `useEffect`/`useCallback` to fetch.
- Mutations await the API, show Ant Design messages, then re-fetch.
- Dashboard fetches once on mount.
- `AppFrame` keeps the shell outside individual pages; menu navigation changes only the right content area.
- Menu/user shell fetches `/auth/me` once when the authenticated shell mounts, not once per page component.
- Generic workspaces update local React state and `localStorage` synchronously.
- Desktop uses `ProTable`; under the CSS breakpoint the table is replaced by mobile cards.
- Current UI shell supports polished desktop/mobile light and dark modes.
- Global business action buttons were removed from the shell header; page-level create/apply actions live near filters/toolbars.

### Target

- Centralize query/mutation behavior before module count grows.
- Use server state cache or a consistent refetch strategy.
- SignalR should invalidate/refetch affected views rather than sending complete sensitive records.
- Avoid global page reloads.
- Preserve form input on failure.
- Prevent stale response races and double-submit.

## 9. Websocket / SignalR packet flow

### Current

Not implemented. There is no hub, connection factory, event schema, group membership, reconnect policy or Nginx websocket configuration.

### Target

```text
Client command
→ API permission + workflow validation
→ PostgreSQL commit
→ event published after commit
→ SignalR Hub sends to user/project group
→ client receives event envelope
→ client invalidates/refetches relevant API data
→ UI renders authoritative state
```

Recommended event envelope:

```text
eventId, eventType, occurredAtUtc,
entityType, entityId, projectId?, version, payload
```

The client must handle reconnect, duplicate events and out-of-order delivery. Event payloads should contain identifiers and safe summary data only.

## 10. Background job flow

Not implemented. Intended for reminders, maintenance schedule generation, overdue recalculation, exports, notifications, image processing and backups.

```text
API creates job record/transaction
→ enqueue after commit
→ worker loads its own scoped DbContext
→ idempotency check
→ execute/retry
→ persist completed/failed state
→ notify through SignalR
```

A job must not reuse the request `DbContext` or depend on browser connection lifetime.

## 11. OCR / canvas / image flow

No OCR or canvas code exists.

Current backend supports basic file upload only. The intended construction-photo flow is:

```text
Mobile camera/file input
→ client validate/compress/create thumbnail
→ retryable multipart upload
→ backend validate content and permission
→ private disk storage
→ metadata in PostgreSQL
→ authorized download/thumbnail endpoint
```

Any future OCR/canvas processing should run off the UI thread and preferably in a background worker.

## 12. Persistence and deployment

Local bind mounts:

- `./.data/postgres`
- `./.data/redis`
- `./.data/uploads`
- `./.data/data-protection-keys`

Production target paths:

- `/opt/elevator-erp/data/postgres`
- `/opt/elevator-erp/data/redis`
- `/opt/elevator-erp/data/uploads`
- `/opt/elevator-erp/data/data-protection-keys`

Production requires HTTPS, restricted Swagger, firewall rules, PostgreSQL/Redis not publicly exposed, scheduled database/file/config backups and at least one external backup copy.
