# ARCHITECTURE

> Current architecture map plus the approved target direction. Last source review: **2026-07-21**.

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
│       ├── components/LocationPickerMap.tsx
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

### Customer, consultation and elevator model

```text
Customer (long-lived identity master)
  └── ConsultationProfile 1..n (a sales/consultation need at a point in time)
        ├── Technical configuration 0..n (currently serialized in TechnicalSpecsJson)
        ├── Quotation 0..n
        └── CustomerElevator 0..n (created only by successful contract conversion)
```

- `Customer` owns stable identity/contact data. Normalized phone is the duplicate-prevention key.
- `ConsultationProfile` owns source, status, assignee, KPI eligibility and preliminary technical configurations.
- A technical configuration is scoped to its source consultation. Cross-profile reuse is performed by copy, never by shared mutable ownership.
- `CustomerElevator` is the physical asset snapshot for deployment, handover, warranty and maintenance.
- Installation address, coordinates and derived area are configuration/asset data, not customer master data.
- `TechnicalSpecsJson` and `AttachmentLinksJson` are current compatibility storage. They are not the preferred final relational model.

Implemented lifecycle endpoints include:

- `GET /api/customers/{id}/overview`
- `GET /api/customers/{id}/customer-360`
- `GET /api/customers/{id}/elevators`
- `GET /api/customers/{id}/history`
- consultation profile list/create/update/status/detail/history endpoints
- `POST /api/consultation-profiles/{id}/copy-technical-configuration`
- `POST /api/quotations/{id}/confirm-contract`
- customer elevator detail/status/history endpoints

Contract confirmation requires an accepted/approved quotation and a source technical configuration, rejects repeated conversion, and creates a `CustomerElevator` snapshot. This flow still needs database-level uniqueness and transaction/integration-test hardening.

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
- `CatalogCategory`
- `CatalogOption`
- `AuditLog`
- `StoredFile`

`Entity` provides `Guid Id`, UTC timestamps, `IsDeleted`, and `IsDemo`.

`Customer` currently includes basic registration data plus `CustomerType`, `ElevatorType`, optional latitude/longitude, optional location accuracy metadata and optional cleaned location label.

### `backend/Infrastructure/AppDbContext.cs`

- Declares all current `DbSet`s.
- Configures composite keys for role joins.
- Creates unique indexes for username, role code, permission code and customer code.
- Applies soft-delete query filters only to `Customer` and `CareActivity`.

### `backend/Infrastructure/DemoSeeder.cs`

- Calls `Database.EnsureCreatedAsync()`.
- Exits unless `EnableDemoSeed=true`.
- Seeds departments, permissions, roles, users, 20 customers and 45 care activities.
- Seeds shared catalog categories/options for customer statuses, lost reasons, sources, customer types and elevator types.
- Updates existing system catalog options on startup when their label/color/sort order changes.
- Uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for legacy prototype columns because EF Core migrations are not in place yet. These compatibility columns do not define the approved ownership model.
- Uses deterministic sample random seed.

### `backend/Security/SecurityServices.cs`

- PBKDF2-SHA256 password hashing/verification.
- `CurrentUser` reads user ID/name from cookie claims.
- `PermissionService` unions permissions from all assigned roles.
- `RequirePermission(...)` endpoint filter returns `403` when missing.

## 4. Current frontend architecture

### Customer 360

- Route: `frontend/src/app/business/customers/[id]/page.tsx`.
- Tab state is URL-backed through `?tab=`.
- Tabs: overview, profiles, elevators, quotations, contracts, receivables, progress, maintenance, care and history.
- The page consumes the Customer 360 read model and keeps mutations in the owning business surface.
- Consultation configurations and physical elevator assets are separate collections. UI labels, counters and empty states must preserve that distinction.
- Desktop shows the complete tab row. Mobile uses a horizontally scrollable tab control without wrapping or overlapping actions.

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
- Handles account toolbar, notification action, user dropdown, account-menu theme toggle and logout.
- Owns responsive sidebar collapse state.
- Desktop sidebar uses controlled `openKeys` so only one top-level module group is open at a time and the active route's group is opened automatically.
- Mobile sidebar keeps compact behavior to save screen space.

Only routes with an explicit `permission` property are currently filtered. Most generic V3–V9 routes are visible to any authenticated user.

### Real API pages

- `app/login/page.tsx`: cookie login.
- `app/page.tsx`: dashboard from `/dashboard`.
- `app/customers/page.tsx`: consultation-profile list and business intake workflow retained as a compatibility route.
- `app/business/customers/page.tsx`: customer master list/create/edit/actions and Customer 360 navigation.
- `app/business/customers/[id]/page.tsx`: Customer 360 aggregate surface.
- `components/LocationPickerMap.tsx`: Leaflet/OpenStreetMap wrapper used for per-configuration installation pinning.
- `app/care/page.tsx`: care list/calendar/create/complete, CSV export and month/year calendar navigation.
- `app/admin/users/page.tsx`: user/role list and role assignment.
- `app/admin/catalogs/page.tsx`: shared catalog category/option administration, including active toggle and sort order management.

### Generic development workspace

- `app/[...workspace]/page.tsx` delegates to `ModuleWorkspace`.
- `ModuleWorkspace.tsx` maps 38 business paths to generic configuration.
- Sample data and mutations persist in browser `localStorage`.
- It provides KPI cards, filters, responsive table/card, create, details, status update, delete and reset.
- Its current UI follows the shared ERP list pattern: two-line page header, create action on the header right, KPI row, filter bar, table card title, CSV export and a thin dismissible demo-data banner in development.
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
PUT  /api/customers/{id}
PUT  /api/customers/{id}/status
GET  /api/care-activities
POST /api/care-activities
PUT  /api/care-activities/{id}/complete
GET  /api/catalogs/categories
GET  /api/catalogs/categories/{code}/options
POST /api/catalogs/categories/{code}/options
PUT  /api/catalogs/options/{id}
PUT  /api/catalogs/options/{id}/active
GET  /api/admin/roles
GET  /api/admin/users
PUT  /api/admin/users/{id}/roles
POST /api/files/upload
GET  /api/geo/search
POST /api/geo/resolve-link
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

### Customer consultation to physical asset

```text
Create/select Customer
  → create ConsultationProfile
  → optionally add one or more preliminary configurations
  → create/revise Quotation
  → approve/accept and confirm Contract
  → create immutable-origin CustomerElevator snapshot
  → deployment / handover / warranty / maintenance
```

Customer 360 aggregates this lifecycle but does not become the write owner for receivables, progress or maintenance. Those writes stay in accounting, contract, asset and maintenance modules and return to Customer 360 as read models.

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

### Customer edit and inline status

```text
Customer list row
→ edit icon opens the same drawer with existing values
→ PUT /api/customers/{id}
→ backend validates required fields and owner/data-scope update permission
→ update Customer + AuditLog
→ SaveChanges
→ frontend re-fetches customer list
```

```text
Customer status badge
→ dropdown selects catalog status
→ PUT /api/customers/{id}/status
→ backend checks update permission/ownership
→ update status + AuditLog
→ SaveChanges
→ frontend re-fetches customer list
```

The current status endpoint writes the selected status directly. Full transition rules and failure reasons are not implemented yet.

### Elevator installation pinning

```text
Technical configuration drawer
→ Ghim vị trí opens Modal
→ AutoComplete calls GET /api/geo/search?q=...&area=...
→ backend calls OpenStreetMap/Nominatim with Vietnam and optional area bias
→ user selects suggestion, clicks the map, uses browser geolocation, pastes Google Maps link/coordinates, or manually edits coordinates
→ pasted links/coordinates call POST /api/geo/resolve-link
→ frontend stores latitude/longitude/locationLabel on the selected configuration
→ configuration save persists installation address, coordinates and derived ward/commune plus province
→ later contract conversion snapshots these fields into CustomerElevator
→ asset/deployment views can open Google Maps by coordinates
```

The UI intentionally hides radius/accuracy from users. Any legacy customer-level location columns remain compatibility data only and must not receive new installation writes.

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
→ development-only demo banner explains that the records are not saved to PostgreSQL
```

### Catalog option update

```text
Catalog administration page
→ GET category list/options
→ create/edit/toggle option
→ API writes CatalogOption to PostgreSQL
→ frontend updates local category/options state without refreshing the left category list
→ customer form/status tags read catalog options from API
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
- Global business action buttons were removed from the shell header.
- Page-level create actions live in the right side of the page header.
- Filter bars contain search/filter/reset/apply/export only.
- Table styling is centralized in `globals.css` for sorter visibility, sticky/fixed-column shadows, hover/selected colors, toolbar icon sizing and typography.
- The customer table uses separate columns for customer code, name, phone and email to support future export/filter workflows.
- Customer search auto-loads after debounce and uses normalized text matching in the backend response set.
- Customer advanced filters are in a right drawer and include status, customer group, source, owner, contact address and created date range.
- Consultation-profile advanced filters may query elevator type through owned technical configurations using “matches any configuration” semantics.
- Customer list default ordering is numeric customer code descending from the backend; the code column shows default descending sort in the table.
- Customer tables do not expose installation area or elevator type as customer-master columns.
- The installation-location modal belongs to the selected elevator configuration. It uses a compact top search/link area, a one-line coordinate strip and a Leaflet map; latitude/longitude are read-only by default and switch to manual input only through **Sửa tọa độ**.

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

### 12.1 Current Ubuntu deployment topology

```text
Internet (80/443)
  -> Nginx container
     -> Next.js frontend container
     -> .NET backend container (internal API)
        -> PostgreSQL 16 container
        -> Redis 7 container
```

- Nginx is the only application service exposed publicly on port 80 today; HTTPS on 443 is reserved in the firewall for the upcoming TLS/domain configuration.
- PostgreSQL is published only on `127.0.0.1:5432` for host administration and must not be opened in the firewall. Redis is not publicly published.
- Backend uploads and ASP.NET Data Protection keys are mounted from `/opt/elevator-erp/data/uploads` and `/opt/elevator-erp/data/data-protection-keys`; these paths must survive image rebuilds.
- The PostgreSQL and Redis bind mounts are `/opt/elevator-erp/data/postgres` and `/opt/elevator-erp/data/redis`.
- Production configuration lives in `/opt/elevator-erp/.env`, is mode `600`, is not committed to Git, and sets `ENABLE_DEMO_SEED=false`.

### 12.2 Deployment and data transfer policy

- Initial source delivery may be an archive uploaded with SCP. Routine source delivery is Git-based and deploys the committed `main` branch with `git pull --ff-only` followed by `docker compose up -d --build`.
- Database data crosses environments only as a logical SQL dump generated by `pg_dump` and restored through `psql`; copying PostgreSQL data files between Windows and Linux is unsupported and risks corruption.
- Files uploaded by users and Data Protection keys are archived and transferred separately. Keys are required to preserve encrypted cookies/tokens after a restore.
- Before restoring test data, stop backend/frontend/Nginx, preserve a VPS backup, restore PostgreSQL, restore files/keys, then rebuild/start the application stack.
- The runnable commands and acceptance checks are maintained in `docs/DEPLOYMENT_CHECKLIST.md`.
