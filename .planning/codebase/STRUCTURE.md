# Codebase Structure

**Analysis Date:** 2026-04-09

## Directory Layout

```
admin-customer/                     # Monorepo root
├── admin/                          # Admin-side applications
│   ├── backend/                    # NestJS REST API (shared by both frontends)
│   │   ├── src/                    # TypeScript source
│   │   │   ├── auth/               # Auth module (JWT, guards, strategy)
│   │   │   ├── entities/           # TypeORM entity definitions
│   │   │   ├── item-details/       # Item description & image upload module
│   │   │   ├── app.module.ts       # Root NestJS module
│   │   │   ├── app.controller.ts   # Main controller (orders, reports, sync, dashboard)
│   │   │   ├── app.service.ts      # App service (seed admin, cleanup cron)
│   │   │   ├── user.controller.ts  # User CRUD endpoints
│   │   │   ├── customers.controller.ts # Customer profile & address endpoints
│   │   │   ├── tally.service.ts    # Tally ERP integration service
│   │   │   └── main.ts             # Application bootstrap entry point
│   │   ├── dist/                   # Compiled JS output (generated, committed)
│   │   ├── public/                 # Static file serving root
│   │   │   └── uploads/items/      # Uploaded product images
│   │   └── package.json
│   └── frontend/                   # Admin PWA (React + Vite)
│       ├── src/
│       │   ├── components/         # Shared UI components
│       │   ├── context/            # React context providers
│       │   ├── pages/              # Page-level components
│       │   ├── App.tsx             # Root component, router, layout, auth guard
│       │   ├── api.ts              # Axios instance + all API call functions
│       │   └── main.tsx            # React app entry point
│       ├── dist/                   # Vite build output (generated)
│       └── package.json
├── customer/                       # Customer-facing PWA (React + Vite)
│   ├── src/
│   │   ├── components/             # Shared UI components (Navbar, Footer, ProductCard, etc.)
│   │   ├── context/                # Auth, Cart, Order context providers
│   │   ├── pages/                  # Page-level components
│   │   ├── App.tsx                 # Root component, router, protected routes
│   │   ├── api.ts                  # Axios instance + API functions + type interfaces
│   │   └── main.tsx                # React app entry point
│   ├── dist/                       # Vite build output (generated)
│   └── package.json
├── .planning/                      # Planning and analysis documents
│   └── codebase/                   # Codebase mapping documents
├── backend_debug.log               # Backend debug log (root level)
├── debug_backend.js                # Debug helper script
├── inspect_db.js                   # Database inspection script
└── logger.js                       # Root-level logger utility
```

## Directory Purposes

**`admin/backend/src/`:**
- Purpose: All backend TypeScript source code
- Contains: Controllers, services, entities, modules
- Key files: `main.ts` (entry), `app.module.ts` (root module), `tally.service.ts` (ERP integration)

**`admin/backend/src/auth/`:**
- Purpose: Authentication and authorization subsystem
- Contains: `auth.module.ts`, `auth.service.ts`, `auth.guard.ts`, `jwt.strategy.ts`, `permissions.guard.ts`, `permissions.decorator.ts`, `constants.ts`
- Key files: `permissions.guard.ts` (role/permission check), `jwt.strategy.ts` (DB-fresh permissions on each request)

**`admin/backend/src/entities/`:**
- Purpose: All TypeORM entity/table definitions
- Contains: `user.entity.ts`, `order.entity.ts`, `order-detail.entity.ts`, `customer.entity.ts`, `address.entity.ts`, `ledger.entity.ts`, `stock-item.entity.ts`, `item-detail.entity.ts`, `item-image.entity.ts`, `meta.entity.ts`
- Key files: `order.entity.ts` (complex — status enum, multiple FK relations, Tally fields)

**`admin/backend/src/item-details/`:**
- Purpose: NestJS feature module for product enrichment (descriptions, images)
- Contains: `item-details.module.ts`, `item-details.controller.ts`, `item-details.service.ts`

**`admin/backend/public/uploads/items/`:**
- Purpose: Runtime storage for uploaded product images
- Generated: Yes (at runtime by Multer)
- Committed: Partially (directory structure committed, image files are runtime artifacts)

**`admin/frontend/src/pages/`:**
- Purpose: Full-page React components, one per route
- Contains: `Dashboard.tsx`, `OrderReport.tsx`, `OrderDetail.tsx`, `OnlineOrder.tsx`, `Customers.tsx`, `AdminProfile.tsx`, `Login.tsx`

**`admin/frontend/src/components/`:**
- Purpose: Reusable UI components used across pages
- Contains: `ConfirmModal.tsx`, `InstallPWA.tsx`

**`admin/frontend/src/context/`:**
- Purpose: React context providers for cross-page state
- Contains: `ToastContext.tsx`

**`customer/src/pages/`:**
- Purpose: Full-page React components for customer journeys
- Contains: `Home.tsx`, `Products.tsx`, `ProductDetail.tsx`, `Cart.tsx`, `Checkout.tsx`, `Orders.tsx`, `Login.tsx`, `Profile.tsx`, `ProfileEdit.tsx`, `Addresses.tsx`

**`customer/src/components/`:**
- Purpose: Reusable UI components for customer app
- Contains: `Navbar.tsx`, `Footer.tsx`, `ProductCard.tsx`, `PostLoginSheet.tsx`, `ScrollToTop.tsx`

**`customer/src/context/`:**
- Purpose: Global state via React Context
- Contains: `AuthContext.tsx` (customer auth), `CartContext.tsx` (cart), `OrderContext.tsx` (order)

## Key File Locations

**Entry Points:**
- `admin/backend/src/main.ts`: Backend server bootstrap
- `admin/frontend/src/main.tsx`: Admin React app mount
- `customer/src/main.tsx`: Customer React app mount

**Configuration:**
- `admin/backend/src/app.module.ts`: TypeORM MySQL config, module wiring
- `admin/backend/src/auth/constants.ts`: JWT secret constant
- `admin/frontend/vite.config.*`: Vite build config (contains `/api` proxy for dev)
- `customer/vite.config.*`: Vite build config (contains `/api` proxy for dev)

**Core Logic:**
- `admin/backend/src/app.controller.ts`: Primary REST API — orders, reports, dashboard, sync
- `admin/backend/src/tally.service.ts`: Tally ERP HTTP integration + scheduled sync
- `admin/backend/src/auth/auth.service.ts`: Login, register, password migration
- `admin/backend/src/customers.controller.ts`: Customer profile upsert, address management
- `admin/frontend/src/api.ts`: All admin frontend → backend API calls
- `customer/src/api.ts`: All customer frontend → backend API calls + StockItem→Product transform

**Auth/Routing:**
- `admin/frontend/src/App.tsx`: Admin route definitions, `AuthGuard`, permission-gated nav, nap-time logout
- `customer/src/App.tsx`: Customer route definitions, `ProtectedRoute`, `GuestRoute`

## Naming Conventions

**Backend Files:**
- Entities: `kebab-case.entity.ts` (e.g., `stock-item.entity.ts`, `order-detail.entity.ts`)
- Controllers: `kebab-case.controller.ts` (e.g., `user.controller.ts`, `customers.controller.ts`)
- Services: `kebab-case.service.ts` (e.g., `tally.service.ts`, `auth.service.ts`)
- Modules: `kebab-case.module.ts` (e.g., `auth.module.ts`, `item-details.module.ts`)
- Guards/decorators: `kebab-case.guard.ts`, `kebab-case.decorator.ts`

**Frontend Files:**
- Pages: `PascalCase.tsx` (e.g., `Dashboard.tsx`, `OrderDetail.tsx`)
- Components: `PascalCase.tsx` (e.g., `ConfirmModal.tsx`, `ProductCard.tsx`)
- Context: `PascalCaseContext.tsx` (e.g., `AuthContext.tsx`, `CartContext.tsx`)
- API module: `api.ts` (flat file, not a directory)

**TypeScript Classes/Interfaces:**
- Entity classes: `PascalCase` matching file name (e.g., `class StockItem`, `class OrderDetail`)
- React components: `PascalCase` function (default export)
- Context types: `PascalCaseContextType` interface

## Where to Add New Code

**New Backend Feature (controller + service):**
- If standalone: add `feature.controller.ts` and `feature.service.ts` to `admin/backend/src/`
- Register controller in `AppModule` controllers array: `admin/backend/src/app.module.ts`
- If feature is large: create `admin/backend/src/feature/` directory with its own module, import into `AppModule`

**New Entity/Table:**
- Create `admin/backend/src/entities/entity-name.entity.ts`
- Add to both `entities` array and `TypeOrmModule.forFeature([])` in `admin/backend/src/app.module.ts`
- Import in any controller/service that needs it via `@InjectRepository(EntityName)`

**New Admin Frontend Page:**
- Create `admin/frontend/src/pages/PageName.tsx`
- Add `<Route>` in `admin/frontend/src/App.tsx` inside `<Routes>` wrapped with `<AuthGuard permission="...">`
- Add nav link in `Layout` component nav section in `admin/frontend/src/App.tsx` if needed
- Add API calls to `admin/frontend/src/api.ts`

**New Customer Frontend Page:**
- Create `customer/src/pages/PageName.tsx`
- Add `<Route>` inside `<Route element={<ProtectedRoute />}>` in `customer/src/App.tsx`
- Add API calls to `customer/src/api.ts`

**New Reusable Component:**
- Admin app: `admin/frontend/src/components/ComponentName.tsx`
- Customer app: `customer/src/components/ComponentName.tsx`

**New Permission Type:**
- Add string literal to `user.permissions` JSON column usage
- Use `@RequirePermission('new-permission')` decorator on backend endpoint
- Check `hasPerm('new-permission')` in admin frontend `App.tsx` for nav visibility
- Update `getDefaultRoute()` in `admin/frontend/src/App.tsx` if this permission has a home page

**New Global State (Customer):**
- Create `customer/src/context/FeatureContext.tsx`
- Wrap `<FeatureProvider>` in `customer/src/App.tsx` around `<Routes>`

## Special Directories

**`admin/backend/dist/`:**
- Purpose: TypeScript compiled output
- Generated: Yes (by `nest build` / `tsc`)
- Committed: Yes (present in repo)

**`admin/frontend/dist/` and `customer/dist/`:**
- Purpose: Vite production build output
- Generated: Yes (by `vite build`)
- Committed: Yes (present in repo — likely for direct deployment without CI)

**`.planning/codebase/`:**
- Purpose: GSD codebase mapping documents
- Generated: Yes (by GSD tooling)
- Committed: Yes

**`admin/backend/public/uploads/`:**
- Purpose: Runtime-uploaded product images served statically at `/public/`
- Generated: Yes (at runtime)
- Committed: Directory structure only

---

*Structure analysis: 2026-04-09*
