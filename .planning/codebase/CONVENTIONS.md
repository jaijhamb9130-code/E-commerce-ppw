# Coding Conventions

**Analysis Date:** 2026-04-09

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` — `ConfirmModal.tsx`, `InstallPWA.tsx`, `ToastContext.tsx`
- Pages: PascalCase `.tsx` in `pages/` — `Dashboard.tsx`, `OnlineOrder.tsx`, `OrderDetail.tsx`
- Backend controllers: kebab-case `.controller.ts` — `customers.controller.ts`, `user.controller.ts`
- Backend services: kebab-case `.service.ts` — `auth.service.ts`, `tally.service.ts`
- Backend entities: kebab-case `.entity.ts` — `customer.entity.ts`, `order-detail.entity.ts`
- Backend modules: kebab-case `.module.ts` — `auth.module.ts`, `item-details.module.ts`
- API layer files: lowercase `.ts` — `api.ts`

**Functions:**
- camelCase for all functions and methods: `syncCustomer`, `validateUser`, `getOrderById`, `showToast`
- Async API functions named with verb+noun: `getOrders`, `createUser`, `deleteOrder`, `syncLedgers`
- React hooks: `use` prefix — `useToast`, `useAuth`, `useCart`
- Private class methods: camelCase — `extractTokenFromHeader`

**Variables:**
- camelCase: `isCapacitor`, `hashedPassword`, `totalItems`
- Boolean variables prefixed with `is`/`has`: `isActive`, `isDefault`, `isLoggedIn`, `isInCart`
- Constants used as theme values: camelCase at module top — `const copper = '#b8804a'`, `const cream = '#f7f0e8'`

**Types/Interfaces:**
- PascalCase interfaces: `CartItem`, `AuthContextType`, `ToastContextType`, `ToastType`
- Type aliases: PascalCase union strings — `type ToastType = 'success' | 'error' | 'warning' | 'info'`
- Generic `any` used heavily in backend DTOs (not strongly typed) — `login(user: any)`, `registerUserDto: any`

**Database Columns:**
- snake_case column names in entities: `phone_number`, `created_at`, `shop_no`, `is_default`, `customer_id`
- Entity class properties mirror column names directly

**React Components:**
- PascalCase function declarations exported as named or default: `export function AuthProvider`, `export default function App`
- Context files export both Provider and hook: `export const useAuth`, `export const ToastProvider`

## Code Style

**Formatting:**
- Prettier configured in backend (`"format": "prettier --write \"src/**/*.ts\""`)
- No `.prettierrc` found at root — likely uses Prettier defaults (single quotes inferred from code, trailing commas)
- Indentation: 2 spaces (all files observed)
- Semicolons: present throughout

**Linting:**
- Backend: ESLint 9 + `typescript-eslint` + `eslint-plugin-prettier`
- Frontend (admin): ESLint 9 + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`
- Customer app: same frontend ESLint config as admin frontend
- Config files: `customer/eslint.config.js`, no separate admin frontend eslint config found (uses same pattern)

## Import Organization

**Order (observed pattern):**
1. Framework imports — `import React from 'react'`, `import { Injectable } from '@nestjs/common'`
2. Third-party libraries — `import axios from 'axios'`, `import { JwtService } from '@nestjs/jwt'`
3. Internal relative imports — `import { Customer } from './entities/customer.entity'`
4. No path aliases used — all imports use relative paths (`./`, `../`)

**Pattern:**
- Named imports preferred: `import { useState, useEffect } from 'react'`
- Star imports only for `bcrypt`: `import * as bcrypt from 'bcrypt'`
- No barrel `index.ts` files observed — direct file imports only

## Error Handling

**Backend:**
- Throw raw `Error` in service layer: `throw new Error('User already exists')`
- Use NestJS HTTP exceptions in guards: `throw new UnauthorizedException()`
- No global exception filter observed — relies on NestJS defaults
- Controllers return `null` for not-found rather than throwing `NotFoundException`: `return null` in `getProfile`

**Frontend:**
- API layer propagates errors via `Promise.reject(error)` in axios interceptors
- 401 responses auto-redirect to `/login` and clear localStorage
- `getUser()` wraps `JSON.parse` in try/catch returning `{}` on failure
- No `ErrorBoundary` components observed
- User feedback via toast system (`showToast('message', 'error')`) — not inline error states

## Logging

**Framework:** `console` (no structured logging library observed)

**Patterns:**
- Inline code comments used for intent documentation (not console logs)
- No explicit logging calls observed in source files reviewed

## Comments

**When to Comment:**
- Step-by-step logic blocks: `// 1. Try bcrypt compare`, `// 2. Legacy Fallback`
- Intent clarification: `// mapping type to name or vice versa`, `// Auto-migrate to hash for next time`
- NestJS boilerplate comments preserved: `// 💡 We're assigning the payload...`
- Vite config comments explain priority/fallback logic

**JSDoc/TSDoc:**
- Not used — no `/** */` documentation blocks observed anywhere

## Function Design

**Size:** Functions kept small and focused; most under 20 lines

**Parameters:**
- Backend methods use destructured `@Body() body: any` — loose typing on request bodies
- Frontend API functions use default parameter values: `getOrders(page = 1, limit = 50, search = '')`
- Long parameter lists on some API functions (e.g., `getOrders` has 9 params) — not yet refactored to options objects

**Return Values:**
- Backend controllers return entity objects or plain objects directly (no response wrapper DTO)
- Frontend API functions return `response.data` directly — no transformation layer
- Auth service `login` returns `{ access_token, user }` shape

## Module Design

**Backend (NestJS):**
- Feature modules used for auth (`AuthModule`) and item details (`ItemDetailsModule`)
- Root-level controllers (`CustomersController`, `UserController`) registered directly in `AppModule` rather than sub-modules — inconsistent pattern
- Repositories injected via `@InjectRepository` decorator at both module and controller level
- `TypeOrmModule.forFeature` registered in root `AppModule` — not encapsulated in feature modules

**Frontend:**
- Context API for shared state: `AuthContext`, `CartContext`, `OrderContext`, `ToastContext`
- All contexts in `src/context/` directory
- Custom hooks (`useAuth`, `useCart`, `useToast`) exported from context files
- Single `api.ts` file holds all API calls — no per-resource API modules
- Pages in `src/pages/`, reusable UI in `src/components/`

**Exports:**
- Named exports for providers and hooks: `export function CartProvider`, `export const useCart`
- Default exports for pages and App: `export default function App`, `export default Dashboard`
- No barrel `index.ts` files

---

*Convention analysis: 2026-04-09*
