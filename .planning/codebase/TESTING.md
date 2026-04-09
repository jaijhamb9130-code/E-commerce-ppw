# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Framework

**Runner (Backend):**
- Jest 30 configured in `admin/backend/package.json`
- Config: inline in `package.json` under `"jest"` key
- Transform: `ts-jest` for TypeScript compilation
- Test environment: `node`

**Runner (Frontend - Admin & Customer):**
- No test framework configured
- `admin/frontend/package.json` has no test script or test dependencies
- `customer/package.json` has no test script or test dependencies

**Assertion Library:**
- Jest built-in (`expect`) — backend only

**Run Commands:**
```bash
# Backend only (from admin/backend/)
npm test               # Run all unit tests
npm run test:watch     # Watch mode
npm run test:cov       # Coverage report
npm run test:e2e       # E2E tests (jest-e2e.json config)
npm run test:debug     # Debug mode with Node inspector
```

## Test File Organization

**Location:**
- Backend unit tests: co-located in `src/` — `testRegex: ".*\\.spec\\.ts$"`
- Backend E2E tests: separate `test/` directory at `admin/backend/test/`
- Frontend: no test files exist anywhere in the project

**Naming:**
- Unit tests: `[name].spec.ts` (e.g., `app.controller.spec.ts`, `app.service.spec.ts`)
- E2E tests: `[name].e2e-spec.ts` (based on NestJS scaffolding convention)

**Coverage collection:**
- `collectCoverageFrom: ["**/*.(t|j)s"]` — collects from all files in `src/`
- Output directory: `../coverage` relative to `src/`

## Test Structure

**NestJS Default Scaffolding (only spec files present are NestJS-generated stubs):**

No actual test implementations were found in the codebase. The backend has Jest fully configured but spec files are empty NestJS scaffold stubs. The frontend apps have zero testing infrastructure.

**Expected NestJS spec pattern (scaffold):**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });
});
```

## Mocking

**Framework:** Jest built-in mocks (`jest.fn()`, `jest.spyOn()`)

**NestJS Testing utilities:**
- `@nestjs/testing` package installed (`"@nestjs/testing": "^11.0.1"`) — available but unused
- TypeORM repositories can be mocked via `getRepositoryToken(Entity)`

**Patterns (prescribed, not yet implemented):**
```typescript
// Mock TypeORM repository
const mockRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

// In TestingModule
providers: [
  AuthService,
  { provide: getRepositoryToken(User), useValue: mockRepository },
  { provide: JwtService, useValue: { sign: jest.fn(), verifyAsync: jest.fn() } },
]
```

**What to Mock:**
- TypeORM repositories (never hit real DB in unit tests)
- `JwtService` — mock `sign` and `verifyAsync`
- `bcrypt` — mock for deterministic tests
- External HTTP calls (`axios`, `TallyService`) — mock entirely

**What NOT to Mock:**
- NestJS framework internals (guards, decorators)
- Business logic under test

## Fixtures and Factories

**Test Data:**
- No fixture files or factory helpers exist in the project
- No `factories/`, `fixtures/`, or `__mocks__/` directories found

**Recommended pattern for this codebase:**
```typescript
// Example factory for Customer entity
const makeCustomer = (overrides = {}): Partial<Customer> => ({
  id: 1,
  name: 'Test Customer',
  phone_number: '9999999999',
  shop_no: 'SHOP001',
  email: 'test@example.com',
  ...overrides,
});
```

## Coverage

**Requirements:** No coverage thresholds configured — none enforced

**View Coverage:**
```bash
# From admin/backend/
npm run test:cov
# Output written to admin/backend/coverage/
```

## Test Types

**Unit Tests:**
- Scope: individual services, guards, controllers in isolation
- Location: co-located `.spec.ts` files in `admin/backend/src/`
- Status: Jest configured, no actual tests written

**Integration Tests:**
- Not configured

**E2E Tests:**
- Framework: Jest with `jest-e2e.json` config (NestJS scaffold)
- Location: `admin/backend/test/`
- Status: Config file present, no actual tests written
- Uses `supertest` (installed: `"supertest": "^7.0.0"`)

## Current Testing State

**Summary:** The project has zero actual tests written.

- Backend (`admin/backend/`): Jest fully configured, `@nestjs/testing` + `supertest` installed, only NestJS scaffold stubs present — no meaningful tests
- Admin Frontend (`admin/frontend/`): No testing framework, no test files, no test scripts
- Customer App (`customer/`): No testing framework, no test files, no test scripts

**Priority areas to test first (based on codebase complexity):**
1. `admin/backend/src/auth/auth.service.ts` — `validateUser` has legacy plain-text password fallback logic that needs coverage
2. `admin/backend/src/customers.controller.ts` — `syncCustomer` upsert logic
3. `admin/backend/src/auth/auth.guard.ts` — JWT extraction and validation

## Common Patterns (Prescribed)

**Async Testing:**
```typescript
it('should validate user with bcrypt', async () => {
  mockRepository.findOne.mockResolvedValue(mockUser);
  const result = await authService.validateUser('admin', 'password');
  expect(result).not.toBeNull();
  expect(result.password).toBeUndefined();
});
```

**Error Testing:**
```typescript
it('should throw if user already exists', async () => {
  mockRepository.findOne.mockResolvedValue(existingUser);
  await expect(authService.register({ username: 'admin', password: '123' }))
    .rejects.toThrow('User already exists');
});
```

**Guard Testing:**
```typescript
it('should throw UnauthorizedException when no token', async () => {
  const mockContext = createMockExecutionContext({ headers: {} });
  await expect(authGuard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
});
```

---

*Testing analysis: 2026-04-09*
