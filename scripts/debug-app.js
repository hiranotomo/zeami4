/**
 * Playwright script to debug Zeami4 Tauri app
 * This allows Claude to inspect the app's state, console logs, and UI
 */

const { chromium } = require('playwright');

async function debugApp() {
  console.log('🔍 Starting Playwright debugging...');

  const browser = await chromium.launch({
    headless: false, // Show browser window
    slowMo: 500, // Slow down actions for visibility
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.error('[BROWSER ERROR]', error.message);
  });

  // Navigate to Vite dev server (Tauri's frontend)
  console.log('📱 Connecting to http://localhost:5173...');
  await page.goto('http://localhost:5173');

  // Wait for page to load
  await page.waitForLoadState('networkidle');
  console.log('✅ Page loaded');

  // Take screenshot
  await page.screenshot({ path: '/tmp/zeami4-screenshot.png', fullPage: true });
  console.log('📸 Screenshot saved to /tmp/zeami4-screenshot.png');

  // Check if Terminal component is present
  const terminalExists = await page.locator('div[class*="terminal"]').count() > 0;
  console.log(`🖥️  Terminal component exists: ${terminalExists}`);

  // Get connection status
  const statusText = await page.locator('text=/Connected|Disconnected/').textContent().catch(() => 'Not found');
  console.log(`📡 Connection status: ${statusText}`);

  // Check for any visible text
  const bodyText = await page.locator('body').textContent();
  console.log(`📝 Visible text length: ${bodyText.length} chars`);
  if (bodyText.length < 200) {
    console.log(`📝 Full body text: "${bodyText}"`);
  }

  // Get all console messages
  console.log('\n📊 Waiting 3 seconds to collect console logs...');
  await page.waitForTimeout(3000);

  // Check network requests
  console.log('\n🌐 Checking network activity...');

  // Try to interact with the terminal
  console.log('\n⌨️  Attempting to focus terminal...');
  const terminalDiv = page.locator('div').first();
  await terminalDiv.click().catch(e => console.log('Could not click:', e.message));

  console.log('\n✅ Debug session complete. Browser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);

  await browser.close();
  console.log('👋 Browser closed');
}

debugApp().catch(error => {
  console.error('❌ Error during debugging:', error);
  process.exit(1);
});
