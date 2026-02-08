# Release Checklist - Portal BWild

Quality gate for production releases. Complete ALL items before deploying.

---

## Pre-Release (Before Merge)

### 1. Code Quality
- [ ] All TypeScript errors resolved (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console.log/debugger statements in production code

### 2. Testing
- [ ] Smoke tests pass (`npm run smoke`)
- [ ] E2E critical paths pass (`npx playwright test`)
- [ ] Manual verification of changed features

### 3. Database/Backend
- [ ] All migrations applied to staging
- [ ] No pending migrations for production
- [ ] RLS policies verified for new tables
- [ ] Edge functions deployed and tested

### 4. Environment
- [ ] All required env vars documented
- [ ] Secrets configured in production
- [ ] API keys rotated if needed

---

## Release (Deploy)

### 5. RBAC Verification
- [ ] Customer login → sees /minhas-obras
- [ ] Staff login → sees /gestao
- [ ] Customer cannot access staff routes
- [ ] Logout clears session properly

### 6. Core Flows Verification
- [ ] Document upload works
- [ ] Weekly report save/load works
- [ ] Cronograma date updates work
- [ ] PDF export completes

### 7. Deploy Steps
- [ ] Notify team of deploy window
- [ ] Deploy to staging first
- [ ] Run smoke tests on staging
- [ ] Deploy to production
- [ ] Verify production is live

---

## Post-Release (After Deploy)

### 8. Monitoring
- [ ] Check error tracking dashboard (15 min)
- [ ] Verify no new errors spiking
- [ ] Check performance metrics
- [ ] Monitor user feedback channels

### 9. Validation
- [ ] Open production URL in incognito
- [ ] Complete one full user flow (login → project → action → logout)
- [ ] Verify mobile responsiveness

### 10. Communication
- [ ] Update changelog/release notes
- [ ] Notify stakeholders of new features
- [ ] Close related tickets/issues

---

## Rollback Plan

If critical issues found post-deploy:

1. **Immediate**: Revert to previous deployment
2. **Database**: If migration was destructive, restore from backup
3. **Edge Functions**: Redeploy previous version
4. **Communication**: Notify users of temporary issues

### Rollback Command
```bash
# Via Lovable: use Version History to restore
# Or redeploy previous commit
```

---

## Contacts

- **On-call Engineer**: [TBD]
- **Product Owner**: [TBD]
- **Customer Support**: [TBD]

---

## Version History

| Date | Version | Changes | Deployed By |
|------|---------|---------|-------------|
| 2024-XX-XX | 1.0.0 | Initial release | [Name] |
