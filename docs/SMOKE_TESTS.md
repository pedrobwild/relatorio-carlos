# Smoke Tests - Portal BWild

Manual verification checklist for pre-deploy sanity checks (10-15 min).

## Automated Smoke

Run the full quality pipeline before every deploy:

```bash
# Step 1: Lint
npm run lint

# Step 2: Type check
npx tsc -b

# Step 3: Unit tests
npx vitest run

# Step 4: Build
npm run build

# Step 5: E2E smoke (requires Playwright + running app)
npx playwright test smoke.spec.ts
```

> **Nota**: Quando o script `smoke` for adicionado ao `package.json`,
> basta rodar `npm run smoke` para executar todos os passos acima.

## Manual Smoke Checklist

When automation isn't available or after incidents, run these 10 steps manually:

### Auth (2 min)
- [ ] **1. Open /auth** - Login form renders correctly
- [ ] **2. Submit empty** - Validation prevents submission
- [ ] **3. Access /minhas-obras without login** - Redirects to /auth

### Customer Flow (3 min)
- [ ] **4. Login as customer** - Redirects to /minhas-obras
- [ ] **5. Click on a project** - Opens /obra/:id with tabs
- [ ] **6. Navigate tabs** - Each tab loads content without crash

### Staff Flow (3 min)
- [ ] **7. Login as staff** - Redirects to /gestao
- [ ] **8. Click on a project** - Opens project dashboard
- [ ] **9. Access documents** - List loads, upload button visible

### Critical Features (2 min)
- [ ] **10. Export PDF** - Click export, verify loading state appears (no crash)

## Environment Variables Required

For automated tests:

```env
PLAYWRIGHT_BASE_URL=http://localhost:8080
TEST_CUSTOMER_EMAIL=customer.test@bwild.com.br
TEST_CUSTOMER_PASSWORD=test123456
TEST_STAFF_EMAIL=staff.test@bwild.com.br
TEST_STAFF_PASSWORD=test123456
TEST_PROJECT_ID=<uuid-of-test-project>
```

## Running E2E Tests

```bash
# All tests
npx playwright test

# Smoke only (fastest)
npx playwright test smoke.spec.ts

# With UI
npx playwright test --ui

# Specific file
npx playwright test auth.spec.ts
```

## Interpreting Results

- ✅ **All pass** - Safe to deploy
- ⚠️ **Flaky (pass on retry)** - Investigate, but can deploy
- ❌ **Consistent failure** - Do NOT deploy, investigate first

## Post-Deploy Verification

After deploying to production:

1. Open production URL
2. Check browser console for errors
3. Run manual steps 1, 4, 7, 10 above
4. Monitor error tracking for 15 minutes
