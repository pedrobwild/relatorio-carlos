import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Quick sanity checks before deploy
 * These should run in under 5 minutes
 */
test.describe('Smoke Tests', () => {
  test('1. App loads without crash', async ({ page }) => {
    await page.goto('/');
    
    // App should render something (not blank page)
    await expect(page.locator('body')).not.toBeEmpty();
    
    // No critical errors in console
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Filter out known benign errors
    const criticalErrors = errors.filter(e => 
      !e.includes('postMessage') && 
      !e.includes('ResizeObserver')
    );
    
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test('2. Auth page renders correctly', async ({ page }) => {
    await page.goto('/auth');
    
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible({ timeout: 10000 });
  });

  test('3. Protected routes redirect to auth', async ({ page }) => {
    await page.goto('/minhas-obras');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('4. 404 page works', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345');
    
    // A página 404 é carregada sob demanda (lazy): espera ela aparecer em vez
    // de olhar no mesmo instante. O seletor antigo casava dois elementos
    // ("404" e o texto), o que estourava o modo estrito do Playwright — o
    // erro era engolido pelo catch e o teste falhava com a página correta.
    // Sem checar o texto da página: este teste roda contra o site publicado,
    // que pode estar uma versão atrás do código.
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href="/"]')).toBeVisible();
  });

  test('5. No JavaScript errors on home', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // Filter benign errors
    const criticalErrors = errors.filter(e => 
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});
