import { test, expect } from '@playwright/test';

test.describe('Zeami4 Browser Version', () => {
  test('should load application', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/zeami4/i);

    // Check header is visible
    await expect(page.locator('h1')).toContainText('zeami4');
  });

  test('should show Disconnected status in browser', async ({ page }) => {
    await page.goto('/');

    // Browser version should show "Disconnected" (expected behavior)
    const statusBadge = page.locator('text=/Connected|Disconnected/');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText('Disconnected');
  });

  test('should display diagnostic panel', async ({ page }) => {
    await page.goto('/');

    // Click "Show Diagnostics" button
    const diagnosticsButton = page.locator('button', { hasText: 'Show Diagnostics' });
    await expect(diagnosticsButton).toBeVisible();
    await diagnosticsButton.click();

    // Check diagnostic panel is displayed
    await expect(page.locator('text=/Diagnostic Panel/i')).toBeVisible();

    // In browser, should show isTauri = false
    await expect(page.locator('text=/Is Tauri Environment/i')).toBeVisible();
  });

  test('should capture console logs', async ({ page }) => {
    const consoleLogs: string[] = [];

    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto('/');

    // Wait for initialization
    await page.waitForTimeout(2000);

    // Should have initialization logs
    expect(consoleLogs.length).toBeGreaterThan(0);

    // Should contain terminal initialization message
    const hasTerminalInit = consoleLogs.some(log =>
      log.includes('Terminal initialization') ||
      log.includes('Not running in Tauri environment')
    );
    expect(hasTerminalInit).toBe(true);
  });

  test('should take screenshot', async ({ page }) => {
    await page.goto('/');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/browser-screenshot.png',
      fullPage: true
    });

    // Verify page is stable
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should detect console output', async ({ page }) => {
    const consoleMessages: string[] = [];

    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should have console output from the application
    expect(consoleMessages.length).toBeGreaterThan(0);

    // Log the console messages for debugging
    console.log('Console messages captured:', consoleMessages.length);
  });
});
