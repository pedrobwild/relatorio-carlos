# Quality Assurance - Portal BWild

This document describes the QA infrastructure for the Portal BWild Beta.

## Quick Start

```bash
# Type check
npx tsc -b

# Run linter
npm run lint

# Run unit tests
npx vitest run

# Run all E2E tests
npx playwright test

# Run E2E smoke only (fastest)
npx playwright test smoke.spec.ts

# Run E2E with visual UI
npx playwright test --ui

# Build
npm run build
```

> **Nota**: Os comandos acima usam `npx` diretamente porque os scripts correspondentes
> ainda não foram adicionados ao `package.json`. Quando disponíveis, use:
> `npm run typecheck`, `npm run test`, `npm run test:e2e`, etc.

## Test Structure

```
src/
├── components/__tests__/    # Component tests (Vitest)
├── hooks/__tests__/         # Hook tests (Vitest)
├── lib/__tests__/           # Utility tests (Vitest)
├── config/__tests__/        # Config tests (Vitest)
├── infra/repositories/__tests__/  # Repository tests (Vitest)
└── test/
    ├── setup.ts             # Vitest setup
    ├── smoke.test.ts        # Smoke test
    └── mocks/
        └── supabase.ts      # Supabase mock

tests/
├── e2e/
│   ├── fixtures/
│   │   └── auth.ts          # Auth fixtures and helpers
│   ├── auth.spec.ts         # Authentication tests
│   ├── obras.spec.ts        # Project listing tests
│   ├── documents.spec.ts    # Document management tests
│   ├── weekly-reports.spec.ts
│   ├── cronograma.spec.ts
│   ├── formalizacoes-pendencias.spec.ts
│   ├── jornada.spec.ts
│   ├── pdf-export.spec.ts
│   ├── projeto3d-revision-request.spec.ts
│   └── smoke.spec.ts        # Quick sanity checks

scripts/
├── seed.ts                  # Test data seeding

docs/
├── SMOKE_TESTS.md          # Manual verification checklist
├── RELEASE_CHECKLIST.md    # Deploy quality gate
├── AUDIT_REPORT.md         # Audit findings
├── AUDIT_CHANGELOG.md      # Audit changes log
└── QA.md                   # This file
```

## Configuration

### Environment Variables

Create a `.env.test` file for E2E tests:

```env
PLAYWRIGHT_BASE_URL=http://localhost:8080
TEST_CUSTOMER_EMAIL=customer.test@bwild.com.br
TEST_CUSTOMER_PASSWORD=test123456
TEST_STAFF_EMAIL=staff.test@bwild.com.br
TEST_STAFF_PASSWORD=test123456
TEST_PROJECT_ID=<uuid>
```

### GitHub Actions Secrets

For CI, configure these secrets in your repository settings:

| Secret | Description |
|--------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |
| `PLAYWRIGHT_BASE_URL` | Deployed staging URL for E2E |
| `TEST_CUSTOMER_EMAIL` | Test customer account email |
| `TEST_CUSTOMER_PASSWORD` | Test customer account password |
| `TEST_STAFF_EMAIL` | Test staff account email |
| `TEST_STAFF_PASSWORD` | Test staff account password |
| `TEST_PROJECT_ID` | UUID of seeded test project |

### Playwright Config

See `playwright.config.ts` for full configuration. Key settings:

- **Retries**: 2 in CI, 0 locally
- **Parallel**: Enabled locally, single-threaded in CI
- **Artifacts**: Screenshots, videos, traces on failure only

## CI Pipeline

The CI workflow (`.github/workflows/ci.yml`) runs:

1. **Build job** (on all pushes/PRs to main):
   - `npm run lint`
   - `npx tsc -b` (typecheck)
   - `npx vitest run` (unit tests)
   - `npm run build`

2. **E2E job** (on push to main only):
   - `npx playwright test smoke.spec.ts`

## Test IDs

Critical components have `data-testid` attributes for stable selectors:

| Component | Test ID |
|-----------|---------|
| Login form | `login-form` |
| Login identifier input | `login-identifier` |
| Login password input | `login-password` |
| Login submit | `login-submit` |
| Signup form | `signup-form` |
| Signup email | `signup-email` |
| Signup password | `signup-password` |
| Signup submit | `signup-submit` |
| Obras list (customer) | `obras-list` |
| Gestão obras list | `gestao-obras-list` |
| Project tabs | `project-tabs` |
| Tab triggers | `tab-{name}` |
| Documents page | `documents-page` |
| Document upload button | `document-upload-button` |
| Document upload modal | `document-upload-modal` |
| Schedule table | `schedule-table` |
| Gantt chart | `gantt-chart` |
| Export PDF button | `export-pdf-button` |

## Error Monitoring

Errors are captured via `src/lib/errorMonitoring.ts`:

```typescript
import { captureError, documentErrors } from '@/lib/errorMonitoring';

// Generic capture
captureError(error, { feature: 'documents', action: 'upload' });

// Feature-specific
documentErrors.capture(error, { action: 'upload', projectId });
```

## Adding New Tests

### E2E Test Template

```typescript
import { test, expect } from './fixtures/auth';

test.describe('Feature Name', () => {
  test('should do something', async ({ staffPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.goto(`/obra/${testProjectId}/feature`);
    
    await expect(
      staffPage.locator('[data-testid="feature-element"]')
    ).toBeVisible({ timeout: 10000 });
    
    await staffPage.click('[data-testid="action-button"]');
    
    await expect(staffPage.locator('.success')).toBeVisible();
  });
});
```

## Troubleshooting

### Tests are flaky
- Add more specific waits: `await expect(locator).toBeVisible({ timeout: 10000 })`
- Use `data-testid` instead of text selectors
- Check for network-dependent assertions

### Tests fail in CI but pass locally
- CI runs single-threaded; race conditions may appear
- Check environment variable differences
- Verify test data exists in CI environment

### Auth tests fail
- Verify test user credentials in environment
- Check if email confirmation is enabled (disable for test users)
- Ensure test users have correct roles assigned
