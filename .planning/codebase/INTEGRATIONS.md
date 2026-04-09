# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**Tally ERP (Core Integration):**
- Tally accounting software running locally with HTTP connector
  - SDK/Client: `axios` (direct HTTP POST in `admin/backend/src/tally.service.ts`)
  - Auth: None (localhost trust; no auth headers)
  - URL env var: `TALLY_URL` (default: `http://localhost:9000`)
  - Company env var: `TALLY_COMPANY` (default: `6 PPW [25-26]`)
  - Protocol: Custom Tally JSON export/import format with request headers (`tallyrequest`, `type`, `id`)
  - Collections used:
    - `ABSDebLedColl` - Ledger/customer data export
    - `ABSitemColl` - Stock item export
    - `PPWGdBatchColl` - Godown (warehouse) batch stock query
    - `All Masters` - Stock item acknowledgement import
  - Sync schedule: Hourly cron (`0 * * * *`) via `@nestjs/schedule`
  - Bidirectional: Reads ledgers/stock from Tally; writes acknowledgements and (stubbed) orders back

**ngrok (Development Tunnel):**
- Used to expose admin frontend to external devices during development
  - Allowed host configured in `admin/frontend/vite.config.ts`: `transnational-cherly-hallucinational.ngrok-free.dev`
  - Not a production integration

## Data Storage

**Databases:**
- MySQL 8.x
  - Connection env vars: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
  - Default database name: `tally_sync`
  - Default connection: `127.0.0.1:3306`
  - Client/ORM: TypeORM ^0.3.28 (`admin/backend/src/app.module.ts`)
  - `synchronize: true` enabled (auto-creates/alters tables — development convenience, production risk)
  - Entities:
    - `admin/backend/src/entities/ledger.entity.ts` - Tally ledgers (customers/suppliers)
    - `admin/backend/src/entities/stock-item.entity.ts` - Tally inventory items
    - `admin/backend/src/entities/order.entity.ts` - Orders
    - `admin/backend/src/entities/order-detail.entity.ts` - Order line items
    - `admin/backend/src/entities/user.entity.ts` - Admin/staff users
    - `admin/backend/src/entities/meta.entity.ts` - Key-value metadata (sync timestamps)
    - `admin/backend/src/entities/item-detail.entity.ts` - Item descriptions
    - `admin/backend/src/entities/item-image.entity.ts` - Item image metadata
    - `admin/backend/src/entities/customer.entity.ts` - Online customers
    - `admin/backend/src/entities/address.entity.ts` - Customer addresses

**File Storage:**
- Local filesystem only
  - Item images stored under `admin/backend/public/` directory
  - Served statically via `@nestjs/serve-static` at `/public` route
  - Uploaded via multipart/form-data to `/api/item-details/:masterid` (max 50MB body limit)
  - No cloud storage (S3, GCS, etc.) detected

**Caching:**
- None detected (no Redis, Memcached, or in-memory cache layer)

## Authentication & Identity

**Auth Provider:**
- Custom (self-hosted, no third-party auth service)
  - Implementation: JWT-based auth in `admin/backend/src/auth/`
  - Password hashing: bcrypt ^6.0.0 with auto-migration from plaintext legacy passwords
  - Token: JWT signed via `@nestjs/jwt`; secret from env (consumed in `admin/backend/src/auth/constants.ts`)
  - Strategy: `passport-jwt` Bearer token strategy (`admin/backend/src/auth/jwt.strategy.ts`)
  - Guards: `AuthGuard` (`admin/backend/src/auth/auth.guard.ts`) + `PermissionsGuard` (`admin/backend/src/auth/permissions.guard.ts`)
  - Permissions: Decorator-based fine-grained permissions on top of role (`admin/backend/src/auth/permissions.decorator.ts`)
  - Frontend storage: JWT stored in `localStorage` under key `token`; user object under key `user`
  - Auto-logout: 401 response interceptor in `admin/frontend/src/api.ts` clears storage and redirects to `/login`

**Customer Auth:**
- Customer app (`customer/`) uses phone number as identifier
  - No JWT detected in `customer/src/api.ts` — API calls use `/api` proxy without auth headers
  - Customer profile fetched by phone: `GET /customers/:phone/profile`
  - Customer orders fetched by phone: `GET /orders/customer/:phone`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc. detected)

**Logs:**
- NestJS built-in `Logger` class used throughout backend (`admin/backend/src/tally.service.ts`)
- `console.error` used in frontend API interceptors
- Root-level `logger.js` and `backend_debug.log` present at project root (ad-hoc debug artifacts)

## CI/CD & Deployment

**Hosting:**
- Not detected (no Dockerfile, `render.yaml`, `vercel.json`, `fly.toml`, etc.)
- Likely self-hosted / on-premises given local Tally ERP dependency

**CI Pipeline:**
- None detected (no `.github/workflows/`, no CI config files)

## Webhooks & Callbacks

**Incoming:**
- None detected (no webhook receiver endpoints)

**Outgoing:**
- Tally ERP HTTP connector receives POST requests from backend on sync events
  - Ledger sync: POST to `TALLY_URL` with collection id `ABSDebLedColl`
  - Stock sync: POST to `TALLY_URL` with collection id `ABSitemColl`
  - Acknowledgement: POST to `TALLY_URL` with collection id `All Masters` (batches of 500)
  - Godown query: POST to `TALLY_URL` with collection id `PPWGdBatchColl`

## Environment Configuration

**Required env vars (backend):**
- `DB_HOST` - MySQL host (default: `127.0.0.1`)
- `DB_PORT` - MySQL port (default: `3306`)
- `DB_USERNAME` - MySQL username (default: `root`)
- `DB_PASSWORD` - MySQL password (default: empty string)
- `DB_NAME` - MySQL database name (default: `tally_sync`)
- `TALLY_URL` - Tally ERP HTTP endpoint (default: `http://localhost:9000`)
- `TALLY_COMPANY` - Tally company name (default: `6 PPW [25-26]`)
- `PORT` - HTTP listen port (default: `3000`)
- `JWT_SECRET` - JWT signing secret (no default; must be set)

**Optional env vars (admin frontend):**
- `VITE_API_URL` - Override API base URL for production or Capacitor builds; falls back to `/api` proxy in dev, `http://192.168.1.19:3000` when Capacitor is detected

**Secrets location:**
- `admin/backend/.env` - Contains backend secrets (confirmed present, not read)

---

*Integration audit: 2026-04-09*
