# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- TypeScript 5.7.x - Backend (NestJS), Admin Frontend, Customer Frontend
- JavaScript - Root-level debug scripts (`debug_backend.js`, `inspect_db.js`, `logger.js`)

**Secondary:**
- CSS - Tailwind utility classes compiled via `@tailwindcss/vite`

## Runtime

**Environment:**
- Node.js (no `.nvmrc` detected; targets Node 18/20 based on crypto polyfill in `admin/backend/src/main.ts`)

**Package Manager:**
- npm (lockfile: `package-lock.json` — present in each sub-project)

## Frameworks

**Backend:**
- NestJS ^11.0.1 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) - REST API server
  - Config: `admin/backend/nest-cli.json`, `admin/backend/tsconfig.json`

**Admin Frontend:**
- React ^19.2.0 - Admin SPA
- Vite ^7.2.4 - Build tool and dev server (port 5180)
- React Router DOM ^7.12.0 - Client-side routing
- Config: `admin/frontend/vite.config.ts`

**Customer Frontend:**
- React ^19.2.4 - Customer-facing SPA
- Vite ^8.0.1 - Build tool and dev server (port 5174)
- React Router DOM ^7.13.2 - Client-side routing
- Config: `customer/vite.config.ts`

**Testing:**
- Jest ^30.0.0 - Backend test runner
- ts-jest ^29.2.5 - TypeScript transformer for Jest
- Supertest ^7.0.0 - HTTP integration testing
- Config: inline in `admin/backend/package.json` (`jest` key), E2E config at `admin/backend/test/jest-e2e.json`

**Build/Dev:**
- `@nestjs/cli` ^11.0.0 - NestJS build toolchain (`nest build`, `nest start --watch`)
- `@vitejs/plugin-react` - React fast refresh for both frontends
- `@tailwindcss/vite` ^4.1.x / ^4.2.x - Tailwind CSS v4 Vite plugin (both frontends)

## Key Dependencies

**Critical:**
- `typeorm` ^0.3.28 - ORM for MySQL database access (`admin/backend`)
- `@nestjs/typeorm` ^11.0.0 - NestJS/TypeORM integration
- `mysql2` ^3.16.1 - MySQL driver
- `@nestjs/jwt` ^11.0.2 - JWT token signing/verification
- `@nestjs/passport` ^11.0.5 + `passport-jwt` ^4.0.1 - Auth middleware
- `bcrypt` ^6.0.0 - Password hashing

**Infrastructure:**
- `@nestjs/schedule` ^6.1.1 - Cron job scheduler (hourly Tally sync)
- `@nestjs/serve-static` ^5.0.4 - Serves uploaded item images from `public/` directory
- `@nestjs/config` ^4.0.2 - Environment variable management
- `axios` ^1.13.x - HTTP client (backend for Tally API calls; both frontends for REST API calls)
- `rxjs` ^7.8.1 - Reactive extensions (NestJS core dependency)

**Mobile/PWA:**
- `@capacitor/core` ^8.x + `@capacitor/android` ^8.x - Android native wrapper (both frontends)
- `@capacitor/cli` ^8.x - Capacitor build tooling
- `vite-plugin-pwa` ^1.2.0 - PWA manifest + service worker (admin frontend only)
- `html5-qrcode` ^2.3.8 - QR code scanner (admin frontend)
- `lucide-react` ^0.563.0 / ^1.6.0 - Icon library (both frontends)

## Configuration

**Environment:**
- Backend reads env from `.env` file at `admin/backend/.env` (file confirmed present, contents not read)
- Key env vars consumed by `ConfigService`:
  - `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` - MySQL connection
  - `TALLY_URL` - Tally ERP HTTP endpoint (default: `http://localhost:9000`)
  - `TALLY_COMPANY` - Active Tally company name (default: `6 PPW [25-26]`)
  - `PORT` - Server listen port (default: `3000`)
  - `JWT_SECRET` - JWT signing secret (consumed by `admin/backend/src/auth/constants.ts`)
- Admin frontend: `VITE_API_URL` - Override backend URL for production/Capacitor builds
- `ConfigModule.forRoot({ isGlobal: true })` - Config available across all NestJS modules

**Build:**
- `admin/backend/tsconfig.json`, `admin/backend/tsconfig.build.json` - Backend TS config
- `admin/frontend/tsconfig.json`, `admin/frontend/tsconfig.app.json`, `admin/frontend/tsconfig.node.json` - Frontend TS config
- `customer/tsconfig.json`, `customer/tsconfig.app.json`, `customer/tsconfig.node.json` - Customer app TS config

## Platform Requirements

**Development:**
- Node.js 18 or 20
- MySQL 8.x running locally (default: `127.0.0.1:3306`, database `tally_sync`)
- Tally ERP running locally with HTTP connector on port 9000
- Run backend: `cd admin/backend && npm run start:dev` (port 3000)
- Run admin frontend: `cd admin/frontend && npm run dev` (port 5180, proxies `/api` to port 3000)
- Run customer frontend: `cd customer && npm run dev` (port 5174, proxies `/api` to port 3000)

**Production:**
- Backend: `npm run build` then `npm run start:prod` (serves static files from `public/` for item images)
- Frontend: `npm run build` outputs to `dist/` for static hosting or Android via Capacitor
- Android: `@capacitor/android` wraps both frontends; admin frontend detects Capacitor via `window.Capacitor` and switches API base URL to local network IP

---

*Stack analysis: 2026-04-09*
