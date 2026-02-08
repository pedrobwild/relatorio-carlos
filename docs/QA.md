# Quality Assurance - Portal BWild

This document describes the QA infrastructure for the Portal BWild Beta.

## Quick Start

```bash
# Run smoke tests (build + lint + typecheck + critical E2E)
npm run smoke

# Run all E2E tests
npm run test:e2e

# Run E2E with visual UI
npm run test:e2e:ui

# Seed test data (requires service role key)
npm run seed
```

## Test Structure

```
tests/
├── e2e/
│   ├── fixtures/
│   │   └── auth.ts          # Auth fixtures and helpers
│   ├── auth.spec.ts         # Authentication tests
│   ├── obras.spec.ts        # Project listing tests
│   ├── documents.spec.ts    # Document management tests
│   ├── weekly-reports.spec.ts
│   ├── cronograma.spec.ts
│   ├── pdf-export.spec.ts
│   └── smoke.spec.ts        # Quick sanity checks
scripts/
├── seed.ts                  # Test data seeding
docs/
├── SMOKE_TESTS.md          # Manual verification checklist
├── RELEASE_CHECKLIST.md    # Deploy quality gate
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

### Playwright Config

See `playwright.config.ts` for full configuration. Key settings:

- **Retries**: 2 in CI, 0 locally
- **Parallel**: Enabled locally, single-threaded in CI
- **Artifacts**: Screenshots, videos, traces on failure only

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

### Error Context

All errors include:
- Feature (auth, documents, weekly-reports, cronograma, formalizacoes, export-pdf)
- Route
- User ID (if available)
- Role (if available)
- Timestamp
- User agent
- Custom context

### Production Monitoring

The system is ready for external monitoring integration (Sentry, DataDog, etc.).
See `sendReport()` in `errorMonitoring.ts`.

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
    
    // Wait for content
    await expect(
      staffPage.locator('[data-testid="feature-element"]')
    ).toBeVisible({ timeout: 10000 });
    
    // Interact
    await staffPage.click('[data-testid="action-button"]');
    
    // Assert
    await expect(staffPage.locator('.success')).toBeVisible();
  });
});
```

### Adding Test IDs

When adding new features, include test IDs:

```tsx
<Button data-testid="my-new-feature-button">
  Click me
</Button>
```

## CI Integration

Add to your CI pipeline:

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run Smoke Tests
  run: npm run smoke

- name: Run E2E Tests
  run: npm run test:e2e
  env:
    PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}
    TEST_CUSTOMER_EMAIL: ${{ secrets.TEST_CUSTOMER_EMAIL }}
    TEST_CUSTOMER_PASSWORD: ${{ secrets.TEST_CUSTOMER_PASSWORD }}
    TEST_STAFF_EMAIL: ${{ secrets.TEST_STAFF_EMAIL }}
    TEST_STAFF_PASSWORD: ${{ secrets.TEST_STAFF_PASSWORD }}
    TEST_PROJECT_ID: ${{ secrets.TEST_PROJECT_ID }}
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
