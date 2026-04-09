# Codebase Concerns

**Analysis Date:** 2026-04-09

---

## Security Considerations

**Hardcoded JWT Secret:**
- Risk: JWT signing secret is a hardcoded string literal, not an environment variable. Anyone who reads the source code can forge tokens.
- Files: `admin/backend/src/auth/constants.ts`
- Current mitigation: The string includes a comment warning against production use, but it IS in production code.
- Recommendation: Move to `process.env.JWT_SECRET` with a strong random value. Throw on startup if missing.

**Wildcard CORS Policy:**
- Risk: `origin: true` allows any domain to make credentialed cross-origin requests to the backend.
- Files: `admin/backend/src/main.ts` (line 19)
- Current mitigation: None. Comment explicitly says "Allow all origins for production simplicity."
- Recommendation: Set `origin` to an explicit allowlist of known frontend domains.

**No Auth on Customer-Facing Endpoints:**
- Risk: `CustomersController` (`/customers/sync`, `/customers/:phone/profile`) and the entire customer order placement endpoint (`/orders/online`) have zero authentication guards. Any internet client can create/update customer records or place orders on behalf of any phone number.
- Files: `admin/backend/src/customers.controller.ts`
- Current mitigation: None.
- Recommendation: Add phone-ownership verification (OTP challenge) before `/customers/sync` or use a signed short-lived token issued after OTP verification.

**Fake OTP Authentication in Customer App:**
- Risk: Customer login generates a random OTP entirely in the browser (`const [mockOtp] = useState(...)`), never contacts an SMS provider, and displays the OTP in the UI success message. Any user can log in as any phone number by reading the screen.
- Files: `customer/src/pages/Login.tsx` (lines 34, 62, 74, 83)
- Current mitigation: None. The comment says "Demo OTP."
- Recommendation: Integrate a real SMS OTP provider (e.g. Twilio, MSG91). Backend should issue and verify the OTP; the frontend should never hold the expected value.

**Customer Token Is Not a Real JWT:**
- Risk: After OTP "verification," the customer app stores `'demo_' + Date.now()` as the auth token. This is never validated by the backend — no auth interceptor exists in `customer/src/api.ts`. The backend accepts orders without verifying customer identity.
- Files: `customer/src/context/AuthContext.tsx` (line 93), `customer/src/api.ts`
- Current mitigation: None.
- Recommendation: Issue a real JWT from the backend after OTP verification. Add a request interceptor in `customer/src/api.ts` to attach it.

**Plain-Text Password Legacy Fallback:**
- Risk: `AuthService.validateUser` includes a fallback that accepts the raw plain-text password if bcrypt compare fails. While it auto-migrates on success, users who never log in remain vulnerable to credential exposure if the database leaks.
- Files: `admin/backend/src/auth/auth.service.ts` (lines 30–43)
- Current mitigation: Auto-migration on next login.
- Recommendation: Run a one-time migration script to hash all remaining plain-text passwords, then remove the fallback branch.

**Default Admin Password "password":**
- Risk: `AppService.onModuleInit` creates an admin user with password `password` if none exists. The `app.service.ts` migration only hashes it if `admin.password === 'password'` (string equality), which only catches the case where it was never hashed — not if someone set it back.
- Files: `admin/backend/src/app.service.ts` (lines 24–43)
- Current mitigation: Console log announces the default credentials.
- Recommendation: Require admin password to be set via an environment variable at first boot, or force a password change on first login.

**50 MB Request Body Limit:**
- Risk: No rate limiting or authentication check before body parsing. An unauthenticated attacker can send repeated 50 MB requests to exhaust server memory or bandwidth.
- Files: `admin/backend/src/main.ts` (lines 15–16)
- Current mitigation: None.
- Recommendation: Reduce the global limit and apply the large limit only to the specific image upload endpoint. Add rate limiting middleware (e.g. `@nestjs/throttler`).

---

## Tech Debt

**`TypeORM synchronize: true` in Production:**
- Issue: `synchronize: true` auto-alters the database schema on every startup. This is safe in development but dangerous in production — it can silently drop columns or cause irreversible migrations.
- Files: `admin/backend/src/app.module.ts` (line 48)
- Impact: A schema change in an entity could destroy production data with no warning.
- Fix approach: Set `synchronize: false` and manage schema changes with TypeORM migrations (`typeorm migration:generate` / `migration:run`).

**`pushOrder` Is a Mock / Stub:**
- Issue: `TallyService.pushOrder` generates fake bill numbers and Tally master IDs using `Math.random()` and `Date.now()`. The actual Tally voucher XML logic is commented out as a placeholder.
- Files: `admin/backend/src/tally.service.ts` (lines 484–507)
- Impact: The admin UI shows "synced to Tally" but no data is actually pushed. Orders are permanently marked with fake identifiers.
- Fix approach: Implement the real Tally XML voucher generation and POST it to `this.tallyUrl`.

**Empty Hourly Cron Job:**
- Issue: `AppService.handleSyncedCleanup` runs every hour but contains no logic — just a `console.log`. It was created as a placeholder for archiving logic that was never written.
- Files: `admin/backend/src/app.service.ts` (lines 53–58)
- Impact: Unnecessary CPU wakeup every hour; misleading log output.
- Fix approach: Either implement the archive logic or remove the cron entirely.

**Address Field Mapping Confusion:**
- Issue: In `CustomersController.addAddress`, `address.name` is assigned `type` (the address type label, e.g. "Home"), not the person's name. The comment acknowledges the confusion: `// mapping type to name or vice versa`. This means the `name` column stores "Home"/"Work" not the recipient's name.
- Files: `admin/backend/src/customers.controller.ts` (line 64)
- Impact: Any frontend that reads `address.name` expecting a person name will show "Home" instead.
- Fix approach: Add a dedicated `type` column to the `Address` entity and store the recipient's name in `name`.

**Checkout Loads Addresses from `localStorage` Only:**
- Issue: `Checkout.tsx` reads saved addresses exclusively from `localStorage` key `ppw_addresses`, while the actual address API (`/customers/:id/addresses`) exists in the backend. The two data sources are never synchronized.
- Files: `customer/src/pages/Checkout.tsx` (lines 47–62)
- Impact: Addresses saved via the `Addresses` page (if it uses the API) will not appear at checkout, and vice versa. Data is siloed per device.
- Fix approach: Fetch addresses from `/customers/:phone/profile` (which includes `relations: ['addresses']`) at checkout, falling back to localStorage only when offline.

**Fragile Tally JSON Parsing:**
- Issue: `TallyService.extractCollection` applies a regex to rename duplicate unnamed keys (`fix_1`, `fix_2`, …) before parsing JSON. This is a workaround for non-standard Tally output. It will silently return `[]` on parse failure, masking sync errors.
- Files: `admin/backend/src/tally.service.ts` (lines 65–117)
- Impact: A Tally format change could cause all syncs to silently ingest zero records with no alert.
- Fix approach: Surface parse errors via the `Logger` at `error` level and emit a sync-failure metric or notification.

**`any` Types Pervasive in Backend:**
- Issue: Controller method parameters and return types use `any` throughout (`@Body() body: any`, `async login(user: any)`, `async register(userDto: any)`). TypeScript provides no type safety for request shapes.
- Files: `admin/backend/src/auth/auth.service.ts`, `admin/backend/src/customers.controller.ts`, `admin/backend/src/user.controller.ts`
- Impact: Silent runtime errors if callers send unexpected shapes; no IDE autocompletion or validation.
- Fix approach: Define DTOs (Data Transfer Objects) with `class-validator` decorators and enable the `ValidationPipe` globally.

---

## Known Bugs

**`updateAddress` Does Not Update Address Fields:**
- Symptoms: `PATCH /customers/addresses/:id` only sets `is_default` if `body.isDefault` is truthy. All other fields in `body` are silently ignored. The endpoint always returns `{ success: true }` even when nothing changed.
- Files: `admin/backend/src/customers.controller.ts` (lines 73–84)
- Trigger: Any attempt to update address text (street, city, etc.) via this endpoint.
- Workaround: None — data cannot be updated via the API.

**`getProfile` Returns `null` With HTTP 200:**
- Symptoms: `GET /customers/:phone/profile` returns `null` with a `200 OK` status for unknown phones. Callers cannot distinguish "not found" from an empty profile.
- Files: `admin/backend/src/customers.controller.ts` (lines 39–49)
- Trigger: Any request for a phone number not yet in the database.
- Workaround: Callers check for null response, but HTTP semantics say this should be a `404`.

**`addItem` in CartContext Has Stale-Closure Bug:**
- Symptoms: `addItem` uses `setItems` with a callback (correct) but the `else` branch constructs `updated` using `prev` (from the closure), then calls `localStorage.setItem` inside `setItems`. If two items are added in rapid succession, the second `localStorage.setItem` may overwrite the first because both callbacks started with the same `prev`.
- Files: `customer/src/context/CartContext.tsx` (lines 40–53)
- Trigger: Adding two different products to cart in very quick succession (e.g. tap-spamming).
- Workaround: Add a slight debounce or consolidate the `localStorage` write into a `useEffect` that watches `items`.

---

## Performance Bottlenecks

**N+1 Queries in Tally Ledger Sync:**
- Problem: `fetchAndSaveLedgers` loops through every ledger item and issues a `findOne` + `save` per record inside a `for` loop — potentially thousands of individual DB round-trips per sync.
- Files: `admin/backend/src/tally.service.ts` (lines 206–257)
- Cause: No bulk upsert; each ledger is fetched and saved individually.
- Improvement path: Fetch all existing ledgers in one query before the loop, build a name→id map, then use a bulk `INSERT ... ON DUPLICATE KEY UPDATE` via QueryBuilder or TypeORM's `upsert`.

**N+1 Queries in Stock Item Sync:**
- Problem: Same pattern as ledger sync — `findOne` + `save` per stock item inside a loop.
- Files: `admin/backend/src/tally.service.ts` (lines 375–413)
- Improvement path: Same as ledger sync — bulk upsert strategy.

**Image Files Written Synchronously:**
- Problem: `ItemDetailsService.saveDetails` uses `fs.writeFileSync` and `fs.unlinkSync` on the main Node.js thread, blocking the event loop during image uploads.
- Files: `admin/backend/src/item-details/item-details.service.ts` (lines 97, 89)
- Cause: Synchronous file I/O in an async context.
- Improvement path: Replace with `fs.promises.writeFile` / `fs.promises.unlink`.

---

## Fragile Areas

**Tally URL Hardcoded Fallback:**
- Files: `admin/backend/src/tally.service.ts` (lines 31–38)
- Why fragile: Falls back to `http://localhost:9000` if `TALLY_URL` env var is absent. In a containerized or cloud deployment this will silently point to localhost (the container itself) and all syncs will fail with no obvious error.
- Safe modification: Make `TALLY_URL` required — throw a startup error if missing.
- Test coverage: No tests for sync logic.

**`synchronize: true` on Schema:**
- Files: `admin/backend/src/app.module.ts` (line 48)
- Why fragile: Adding a `@Column()` with no `nullable: true` to any entity will cause TypeORM to attempt `ALTER TABLE ... ADD COLUMN NOT NULL` which fails if rows exist.
- Safe modification: Always add new columns as `nullable: true` first, migrate data, then add the constraint.

**Customer Cart Stored Only in `localStorage`:**
- Files: `customer/src/context/CartContext.tsx`
- Why fragile: Cart state is not persisted to the backend. Clearing browser storage, logging out, or switching devices loses the cart entirely.
- Test coverage: None.

---

## Test Coverage Gaps

**No Tests Exist Anywhere:**
- What's not tested: The entire codebase — backend services, controllers, guards, and all frontend components — has zero test files (`.spec.ts`, `.test.ts`, `.test.tsx`).
- Files: All source under `admin/backend/src/`, `admin/frontend/src/`, `customer/src/`
- Risk: Any refactor or new feature can silently break existing behavior with no automated detection. The Tally sync, auth flow, order placement, and permission system are all untested.
- Priority: High

---

## Scaling Limits

**MySQL on Single Host with No Connection Pooling Config:**
- Current capacity: Default TypeORM pool (10 connections).
- Limit: Under concurrent sync + order traffic the pool will exhaust and requests will queue or timeout.
- Scaling path: Configure `extra: { connectionLimit: N }` in TypeORM options; consider a read replica for report queries.

**Hourly Full Ledger Sync Scans All Records:**
- Current behavior: Every hour, all ledgers and all stock items are fetched from Tally and upserted regardless of whether they changed.
- Limit: As the Tally dataset grows, sync time will increase linearly.
- Scaling path: Implement incremental sync using Tally's `LastAlterDate` or a server-side modification timestamp filter.

---

*Concerns audit: 2026-04-09*
