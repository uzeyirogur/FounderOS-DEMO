import { defineConfig, devices } from '@playwright/test';

/**
 * V1 completion sprint: real browser smoke coverage over the operator's
 * priority screens (Command Center, Projects, Project Lifecycle, Agents,
 * Org Chart, Capabilities, Content Studio, Growth, Notifications/Approvals,
 * Work, Personal, ANKA Operations).
 *
 * Deliberately does NOT start its own server (webServer option) — this repo
 * runs a long-lived dev server on :4100 that other concurrent Claude/Codex
 * sessions and the user's own Startup-folder keepalive script depend on
 * (see AGENTS.md: "Don't kill the dev server on 4100 or 4101"). Tests
 * assume :4100 is already up and skip with a clear message if it is not,
 * rather than racing another process for the port.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // one shared dev server backing all tests — avoid stampeding it
  forbidOnly: !!process.env.CI,
  retries: 0, // no flake-masking — a real failure must be a real failure
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
