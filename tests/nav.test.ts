import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { NAV_OPERATE, NAV_AGENTS, NAV_INTELLIGENCE, NAV_SYSTEM, NAV_LIBRARY, NAV_ORDER, DIGIT_VIEWS } from '@/lib/nav';

describe('shared nav config', () => {
  test('NAV_ORDER is the visible order: Operate → Agents → Intelligence → System → Variants', () => {
    expect(NAV_ORDER).toEqual(
      [...NAV_OPERATE, ...NAV_AGENTS, ...NAV_INTELLIGENCE, ...NAV_SYSTEM, ...NAV_LIBRARY].map((n) => n.href),
    );
  });

  test('Operate is the trimmed daily flow: Home, Projects, Tasks, Agents, Notifications, Monitoring, Content, Connections', () => {
    // 2026-08-31 dashboard audit: the primary sidebar group holds only the
    // "what do I check daily" routes; the roster/org-chart/knowledge detail
    // pages moved to their own groups (still reachable, not duplicated here).
    expect(NAV_OPERATE.map((n) => n.href)).toEqual([
      '/',
      '/projects',
      '/tasks',
      '/agents',
      '/notifications',
      '/monitoring',
      '/content',
      '/integrations',
    ]);
  });

  test('Agents group holds skills and the org chart (roster itself moved to Operate)', () => {
    expect(NAV_AGENTS.map((n) => n.href)).toEqual(['/skills', '/org']);
  });

  test('Intelligence group holds G-Brain, its Doctor, Capabilities, and Analytics', () => {
    expect(NAV_INTELLIGENCE.map((n) => n.href)).toEqual(['/brain', '/doctor', '/capabilities', '/analytics']);
  });

  test('every non-primary route from the old flat list is still reachable somewhere in nav', () => {
    const all = new Set(NAV_ORDER);
    for (const href of ['/finances', '/social', '/content', '/comms', '/funnel', '/workflows', '/roadmap', '/reference']) {
      expect(all.has(href), `${href} should still be reachable from the sidebar`).toBe(true);
    }
  });

  test('digit shortcuts (1–9) map to the first 9 views in visible order', () => {
    expect(DIGIT_VIEWS).toEqual(NAV_ORDER.slice(0, 9));
    expect(DIGIT_VIEWS).toHaveLength(9);
  });

  test('every digit target is a real page route', () => {
    for (const href of DIGIT_VIEWS) {
      const rel = href === '/' ? 'app/page.tsx' : `app/${href.replace(/^\//, '')}/page.tsx`;
      expect(existsSync(path.join(process.cwd(), rel)), `${href} should have a page.tsx`).toBe(true);
    }
  });

  test('regression: Content and Connections stay digit-reachable (the daily operator flow)', () => {
    for (const href of ['/content', '/integrations']) {
      expect(DIGIT_VIEWS, `${href} must be reachable by digit`).toContain(href);
    }
  });

  test('CommandPalette consumes the shared DIGIT_VIEWS (no private stale copy)', () => {
    const src = readFileSync(path.join(process.cwd(), 'components', 'CommandPalette.tsx'), 'utf8');
    expect(src).toMatch(/from '@\/lib\/nav'/);
    expect(src).not.toMatch(/const DIGIT_VIEWS\s*=/); // must import, not redefine
  });
});
