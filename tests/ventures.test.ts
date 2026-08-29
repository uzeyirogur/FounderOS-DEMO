import { describe, expect, test } from 'vitest';
import { LIFE_AREAS } from '@/lib/life-map';
import {
  VENTURES,
  ventureAgentSet,
  venturesForAgent,
  getVenture,
} from '@/lib/ventures';

import { realAgents } from '@/lib/agents/real';

const KNOWN_AGENTS = new Set(realAgents.map((a) => a.id));

describe('VENTURES', () => {
  test('two active income sources, each with a distinct color and brain tag', () => {
    expect(VENTURES.map((v) => v.id)).toEqual(['vantage', 'launchpad-cohort']);
    expect(new Set(VENTURES.map((v) => v.color)).size).toBe(2);
    expect(new Set(VENTURES.map((v) => v.brainTag)).size).toBe(2);
    for (const v of VENTURES) {
      expect(v.focus.length).toBeGreaterThan(0); // executive task list
      expect(v.detail.length).toBeGreaterThan(0);
    }
  });

  test('labels are neutral business-type descriptors, not a prior operator\'s brand names', () => {
    // The named brands (Vantage / Launchpad Cohort) were a prior operator's
    // demo data (see lib/agents/real.ts sales-agent, removed 2026-08-28) —
    // ids stay stable (schema/DB/seed depend on them) but the user-visible
    // label must never surface someone else's brand.
    for (const v of VENTURES) {
      expect(v.label.toLowerCase()).not.toContain('vantage');
      expect(v.label.toLowerCase()).not.toContain('launchpad');
      expect(v.label.toLowerCase()).not.toContain('cohort');
    }
  });

  test('venture colors are neutral theme accents, not a prior operator\'s brand colors', () => {
    const byId = new Map(VENTURES.map((v) => [v.id, v]));
    // Prior operator's brand colors (Vantage spring green / Launchpad
    // crimson) must not appear — replaced with neutral OS-palette accents.
    expect(byId.get('vantage')?.color).not.toBe('#00ffaa');
    expect(byId.get('launchpad-cohort')?.color).not.toBe('#d9263f');
  });

  test('Personal Brand (brand-deals) is retired from the venture lens', () => {
    expect(getVenture('brand-deals')).toBeNull();
    expect(VENTURES.some((v) => v.label === 'Personal Brand')).toBe(false);
  });

  test('venture colors do not collide with life-area colors', () => {
    const areaColors = new Set(LIFE_AREAS.map((a) => a.color));
    for (const v of VENTURES) expect(areaColors.has(v.color)).toBe(false);
  });

  test('every areaAgents key is a real life area; every agent id is real', () => {
    const areaIds = new Set(LIFE_AREAS.map((a) => a.id));
    for (const v of VENTURES) {
      for (const [areaId, agents] of Object.entries(v.areaAgents)) {
        expect(areaIds.has(areaId), `unknown area ${areaId} in ${v.id}`).toBe(true);
        for (const id of agents) {
          expect(KNOWN_AGENTS.has(id), `unknown agent ${id} in ${v.id}/${areaId}`).toBe(true);
        }
      }
    }
  });

  test('every venture staffs marketing, communication, and finances at minimum', () => {
    for (const v of VENTURES) {
      for (const required of ['marketing', 'communication', 'finances']) {
        expect(
          (v.areaAgents[required] ?? []).length,
          `${v.id} has no agents on ${required}`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe('lookups', () => {
  test('getVenture resolves by id and returns null for unknowns', () => {
    expect(getVenture('vantage')?.id).toBe('vantage');
    expect(getVenture('nope')).toBeNull();
  });

  test('ventureAgentSet unions all areas for a venture', () => {
    const set = ventureAgentSet('vantage');
    const vantage = getVenture('vantage')!;
    for (const agents of Object.values(vantage.areaAgents)) {
      for (const id of agents) expect(set.has(id)).toBe(true);
    }
  });

  test('venturesForAgent reverse lookup: shared infra agents serve both ventures', () => {
    expect(venturesForAgent('conductor').map((v) => v.id)).toEqual([
      'vantage', 'launchpad-cohort',
    ]);
  });

  test('whatsapp-worker serves launchpad-cohort (students live on WhatsApp)', () => {
    expect(venturesForAgent('whatsapp-worker').some((v) => v.id === 'launchpad-cohort')).toBe(true);
  });
});
