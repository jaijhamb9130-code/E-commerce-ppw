# Architecture

**Analysis Date:** 2026-04-09

## Pattern Overview

**Overall:** Monorepo with three separate applications sharing one backend API

**Key Characteristics:**
- One NestJS REST API backend serves both frontend applications
- Admin frontend is a PWA (Capacitor-enabled) React SPA for shop staff
- Customer frontend is a PWA (Capacitor-enabled) React SPA for end customers
- Backend integrates with Tally ERP (on-premises) via HTTP polling for inventory/ledger sync
- All three apps can run independently; frontends proxy `/api` to the backend in dev

## Layers

**Backend - Entry Point:**
- Purpose: Bootstrap NestJS application, register global prefix, CORS, body size limits
- Location: `admin/backend/src/main.ts`
- Contains: NestFactory bootstrap, port binding to `0.0.0.0:3000`
- Depends on: `AppModule`
- Used by: Node.js runtime

**Backend - App Module:**
- Purpose: Root module wiring all controllers, services, entities, and sub-modules
- Location: `admin/backend/src/app.module.ts`
- Contains: TypeORM MySQL config, static file serving (`/public`), module imports
- Depends on: `AuthModule`, `ItemDetailsModule`, all entity classes
- Used by: NestJS DI container

**Backend - Auth Layer:**
- Purpose: JWT authentication + role/permission-based access control
- Location: `admin/backend/src/auth/`
- Contains:
  - `auth.module.ts` — wires Passport, JwtModule (7-day tokens)
  - `auth.service.ts` — bcrypt login/register with plain-text migration fallback
  - `jwt.strategy.ts` — validates JWT, fetches fresh permissions from DB on every request
  - `auth.guard.ts` — standard Passport JWT guard
  - `permissions.guard.ts` — checks `user.permissions[]` or bypasses for `role === 'admin'`
  - `permissions.decorator.ts` — `@RequirePermission('inventory')` metadata decorator
- Depends on: `User` entity, `JwtService`
- Used by: All protected controllers via `@UseGuards(AuthGuard('jwt'), PermissionsGuard)`

**Backend - Controllers:**
- Purpose: Handle HTTP requests, delegate to services/repositories
- Location: `admin/backend/src/`
- Contains:
  - `app.controller.ts` — dashboard stats, sync triggers, order CRUD, ledger/stock reports (large file)
  - `user.controller.ts` — user management (CRUD for admin users)
  - `customers.controller.ts` — customer profile sync and address management
  - `item-details/item-details.controller.ts` — product description and image upload (multipart)
- Depends on: TypeORM repositories, `TallyService`, `AuthService`
- Used by: HTTP clients (admin frontend, customer frontend)

**Backend - Services:**
- Purpose: Business logic and external integrations
- Location: `admin/backend/src/`
- Contains:
  - `app.service.ts` — module init (seed default admin), hourly cleanup cron stub
  - `tally.service.ts` — Tally ERP integration: fetch ledgers/stock via HTTP POST, upsert to MySQL, push orders back
  - `item-details/item-details.service.ts` — item metadata and image file management
- Depends on: TypeORM repositories, `ConfigService`, `axios`
- Used by: Controllers, NestJS scheduler

**Backend - Entities (Data Model):**
- Purpose: TypeORM entity definitions mapping to MySQL tables
- Location: `admin/backend/src/entities/`
- Contains: `User`, `Order`, `OrderDetail`, `Customer`, `Address`, `Ledger`, `StockItem`, `ItemDetail`, `ItemImage`, `Meta`
- Depends on: TypeORM decorators
- Used by: All repositories, services, controllers

**Admin Frontend - App Shell:**
- Purpose: Route definitions, auth guard, permission-gated navigation, nap-time auto-logout
- Location: `admin/frontend/src/App.tsx`
- Contains: `AuthGuard` component, `Layout` with bottom nav, `NavLink`, time-based force-logout logic
- Depends on: `localStorage` for token/user, `react-router-dom`
- Used by: `main.tsx`

**Admin Frontend - Pages:**
- Purpose: Full-screen views for each feature
- Location: `admin/frontend/src/pages/`
- Contains: `Dashboard`, `OrderReport`, `OrderDetail`, `OnlineOrder`, `Customers`, `AdminProfile`, `Login`
- Depends on: `api.ts`, context providers
- Used by: React Router routes in `App.tsx`

**Admin Frontend - API Layer:**
- Purpose: Centralised axios instance with JWT injection and 401 auto-redirect
- Location: `admin/frontend/src/api.ts`
- Contains: All API call functions, `getUser()` helper reading from `localStorage`
- Depends on: `axios`, `VITE_API_URL` env var (falls back to `/api` or Capacitor IP)
- Used by: All pages/components

**Customer Frontend - App Shell:**
- Purpose: Route definitions, auth providers, protected/guest route wrappers
- Location: `customer/src/App.tsx`
- Contains: `ProtectedRoute`, `GuestRoute`, `MainLayout` with Navbar + Footer
- Depends on: `AuthContext`, `CartContext`, `OrderContext`
- Used by: `main.tsx`

**Customer Frontend - Context Layer:**
- Purpose: Global state management via React Context
- Location: `customer/src/context/`
- Contains:
  - `AuthContext.tsx` — customer auth state (localStorage keys: `customer_token`, `customer_user`)
  - `CartContext.tsx` — cart item state
  - `OrderContext.tsx` — order state
- Depends on: `localStorage`, React Context API
- Used by: All pages and components

**Customer Frontend - API Layer:**
- Purpose: Axios instance + typed interfaces + `transformStockItemToProduct` mapper
- Location: `customer/src/api.ts`
- Contains: Product fetching, brand/category helpers, customer profile, order fetching
- Depends on: `axios`, `/api` proxy
- Used by: All customer pages

## Data Flow

**Admin Login Flow:**
1. Admin frontend POSTs credentials to `POST /api/auth/login`
2. `AppController` delegates to `AuthService.validateUser()` (bcrypt compare, auto-migrates plain-text passwords)
3. `AuthService.login()` signs JWT with `{username, sub, id, role, permissions}`
4. Frontend stores `token` and `user` in `localStorage`
5. Subsequent requests inject `Bearer <token>` header via axios interceptor
6. `JwtStrategy.validate()` fetches fresh permissions from DB on every request

**Customer Login Flow:**
1. Customer frontend POSTs phone/OTP to `POST /api/customers/sync` (profile upsert) and auth endpoint
2. Token stored under `customer_token` / `customer_user` keys in `localStorage`
3. `AuthContext` exposes `isLoggedIn`, `user`, `login`, `logout`, `updateUser`

**Order Lifecycle:**
1. Customer places order via customer frontend → `POST /api/orders` (status: `inedit`)
2. Admin sees order in `OnlineOrder` page → approves/rejects line items → `PATCH /api/orders/items/bulk-status`
3. Admin finalizes order → `PATCH /api/orders/:id/finalize` (status: `pending`)
4. Admin syncs to Tally → `POST /api/orders/:id/sync` → `TallyService.pushOrder()` (currently mocked, returns fake bill number)
5. Order gains `bill_number`, `tally_master_id`, `synced_at` → status becomes `fetched`
6. Orders synced >24h ago are excluded from active view, appear in reports

**Tally Sync Flow (Scheduled - hourly):**
1. `TallyService.handleScheduledSync()` cron fires at `0 * * * *`
2. POSTs to Tally HTTP server (`TALLY_URL`, default `http://localhost:9000`) with collection request headers
3. Parses JSON response (with sanitisation for Tally's malformed JSON output)
4. Upserts `Ledger` and `StockItem` records to MySQL
5. Acknowledges stock items back to Tally in batches of 500
6. Updates `Meta` table with `last_sync_ledgers` / `last_sync_stock` timestamps

**State Management:**
- Admin frontend: No context providers; state is local to pages; `localStorage` for auth
- Customer frontend: React Context for auth, cart, and order state; no Redux/Zustand

## Key Abstractions

**Permissions System:**
- Purpose: Fine-grained access control for non-admin users
- Examples: `admin/backend/src/auth/permissions.guard.ts`, `admin/backend/src/auth/permissions.decorator.ts`
- Pattern: `@RequirePermission('inventory')` decorator + `PermissionsGuard` reads `user.permissions[]` JSON column; `admin` role bypasses all checks

**TallyService:**
- Purpose: Bridge between the app and on-premises Tally ERP
- Examples: `admin/backend/src/tally.service.ts`
- Pattern: HTTP POST to Tally with custom headers (`tallyrequest`, `type`, `id`); response sanitisation pipeline for malformed JSON; `findCustomField()` for recursive field search in dynamic Tally response structures

**API Modules (Submodules):**
- Purpose: Encapsulate feature-specific controllers/services/entities
- Examples: `admin/backend/src/auth/auth.module.ts`, `admin/backend/src/item-details/item-details.module.ts`
- Pattern: NestJS feature modules imported into `AppModule`

**transformStockItemToProduct:**
- Purpose: Maps raw Tally StockItem DB records to customer-facing Product shape
- Examples: `customer/src/api.ts` line 58
- Pattern: Pure function that parses MRP string (`"50.00/Pcs"` → `50`), cleans Tally numeric prefixes from names, computes `inStock` from `closing_balance`

## Entry Points

**Backend:**
- Location: `admin/backend/src/main.ts`
- Triggers: `node dist/main` or `nest start`
- Responsibilities: Create NestJS app, set global prefix `api`, enable CORS (all origins), set 50mb body limit, listen on `0.0.0.0:PORT`

**Admin Frontend:**
- Location: `admin/frontend/src/main.tsx`
- Triggers: Vite dev server or built `dist/index.html`
- Responsibilities: Mount React app, render `<App />`

**Customer Frontend:**
- Location: `customer/src/main.tsx`
- Triggers: Vite dev server or built `dist/index.html`
- Responsibilities: Mount React app, render `<App />` with all context providers

## Error Handling

**Strategy:** Inconsistent — backend throws NestJS HTTP exceptions in some places, raw `Error` in others; frontends rely on axios interceptor for 401s and try/catch in individual functions

**Patterns:**
- Backend: `throw new Error('User already exists')` in `AuthService` (not using `ConflictException`)
- Backend: `try/catch` in `TallyService` with `Logger.error()` and silent returns of `0` on failure
- Admin frontend: axios interceptor redirects to `/login` on 401; no global error boundary
- Customer frontend: `fetchCustomerProfile` returns `null` on error; `fetchCustomerOrders` returns `[]` on error

## Cross-Cutting Concerns

**Logging:** NestJS `Logger` used in `TallyService`; `console.log/error` used in `AppService` and `main.ts`
**Validation:** No DTO validation pipes detected; controllers accept raw `@Body() body: any`
**Authentication:** JWT Bearer tokens; admin uses `token`/`user` localStorage keys; customer uses `customer_token`/`customer_user` localStorage keys
**File Uploads:** Multer via `AnyFilesInterceptor`; files stored to `admin/backend/public/uploads/items/`; served statically at `/public/`
**Scheduled Tasks:** NestJS `@nestjs/schedule` — hourly Tally sync in `TallyService`, hourly cleanup stub in `AppService`

---

*Architecture analysis: 2026-04-09*
