import { test, expect, type Page } from '@playwright/test';

/**
 * Production go-live sprint: real browser + real HTTP smoke coverage
 * against the REAL DEPLOYED public URL (Railway), not local dev. Proves
 * phone/desktop access to the deployed instance actually works end to
 * end: HTTPS, the access-gate token flow, and every priority screen
 * rendering with no console errors / no overflow / no crash.
 *
 * Requires FOUNDEROS_PROD_URL and FOUNDEROS_PROD_TOKEN env vars (never
 * hardcoded, never logged) — this suite is not run by default; it's
 * invoked explicitly against a live deployment.
 */
const BASE = process.env.FOUNDEROS_PROD_URL;
const TOKEN = process.env.FOUNDEROS_PROD_TOKEN;

test.skip(!BASE || !TOKEN, 'FOUNDEROS_PROD_URL / FOUNDEROS_PROD_TOKEN not set — skipping production smoke');

const SCREENS: { path: string; name: string }[] = [
  { path: '/', name: 'Command Center' },
  { path: '/projects', name: 'Projects' },
  { path: '/agents', name: 'Agents' },
  { path: '/org', name: 'Org Chart' },
  { path: '/capabilities', name: 'Capabilities' },
  { path: '/content', name: 'Content Studio' },
  { path: '/notifications', name: 'Notifications / Approvals' },
  { path: '/work', name: 'Work / Personal' },
  { path: '/monitoring', name: 'Monitoring' },
];

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

function isKnownNoise(text: string): boolean {
  return (
    /Download the React DevTools/i.test(text) ||
    /\[Fast Refresh\]/i.test(text) ||
    /A tree hydrated but some attributes/i.test(text)
  );
}

test.beforeEach(async ({ page }) => {
  // Authenticate against the real access gate once per test (sets the
  // real httpOnly cookie the gate reads) — never prints the token.
  const response = await page.goto(`${BASE}/?token=${TOKEN}`, { waitUntil: 'networkidle' });
  expect(response?.ok(), 'access-gate token exchange should succeed').toBe(true);
});

for (const screen of SCREENS) {
  test(`[PROD] ${screen.name} (${screen.path}) — real deploy, no console errors, no overflow`, async ({ page }) => {
    const errors = await collectConsoleErrors(page);
    const response = await page.goto(`${BASE}${screen.path}`, { waitUntil: 'networkidle' });
    expect(response?.ok(), `${screen.path} should respond 2xx on the real deployment`).toBe(true);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText.length, `${screen.path} should render real content`).toBeGreaterThan(0);
    expect(bodyText).not.toMatch(/Application error: a client-side exception/i);
    expect(bodyText).not.toMatch(/Internal Server Error/i);
    expect(bodyText).not.toMatch(/502 Bad Gateway/i);

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow, `${screen.path} has ${overflow}px of horizontal overflow`).toBeLessThanOrEqual(2);

    const realErrors = errors.filter((e) => !isKnownNoise(e));
    expect(realErrors, `${screen.path} console errors:\n${realErrors.join('\n')}`).toEqual([]);
  });
}

test('[PROD] health endpoint is reachable WITHOUT the access token (host probe must never be gated)', async ({ request }) => {
  const res = await request.get(`${BASE}/api/health`);
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.db).toBe('connected');
});

test('[PROD] a page request WITHOUT the token is rejected (access gate is actually enforced)', async ({ browser }) => {
  // A fresh, cookie-less context — never touches the authenticated page
  // fixture above, so this genuinely proves the gate rejects an
  // unauthenticated caller rather than riding the beforeEach's cookie.
  const freshContext = await browser.newContext();
  const res = await freshContext.request.get(`${BASE}/agents`);
  expect(res.status()).toBe(401);
  await freshContext.close();
});
