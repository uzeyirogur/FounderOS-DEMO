import { afterEach, describe, expect, test } from 'vitest';
import { openDb, type FounderDb } from '@/lib/db';

/**
 * Project Registry repo layer. Same origin contract as lead magnets: a row
 * created from the OS (origin: 'os') must never be deleted by a re-seed;
 * only rows the seed itself planted (origin: 'seed') may be pruned when they
 * leave the seed file.
 */
let db: FounderDb;

afterEach(() => {
  db?.close();
});

const made = (over: Partial<Parameters<FounderDb['projects']['insert']>[0]> = {}) => ({
  id: 'anka-plus',
  name: 'ANKA+ / TIVARO',
  kind: 'local' as const,
  pathOrUrl: 'C:/Users/HP/source/repos/ANKA+',
  purpose: 'Athlete development platform.',
  status: 'active' as const,
  permissionLevel: 'read_only' as const,
  authorizedAgentIds: ['anka-operations'],
  createdAt: '2026-08-27T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z',
  origin: 'os' as const,
  ...over,
});

describe('db.projects', () => {
  test('round-trips a project row', () => {
    db = openDb(':memory:');
    db.projects.insert(made());
    const row = db.projects.byId('anka-plus');
    expect(row?.name).toBe('ANKA+ / TIVARO');
    expect(row?.authorizedAgentIds).toEqual(['anka-operations']);
    expect(row?.permissionLevel).toBe('read_only');
  });

  test('all() returns every project, newest updatedAt first', () => {
    db = openDb(':memory:');
    db.projects.insert(made({ id: 'p1', updatedAt: '2026-08-01T00:00:00.000Z' }));
    db.projects.insert(made({ id: 'p2', updatedAt: '2026-08-20T00:00:00.000Z' }));
    const ids = db.projects.all().map((p) => p.id);
    expect(ids[0]).toBe('p2');
    expect(ids).toContain('p1');
  });

  test('byId returns null for an unknown id', () => {
    db = openDb(':memory:');
    expect(db.projects.byId('nope')).toBeNull();
  });

  test('remove deletes a row and reports whether it existed', () => {
    db = openDb(':memory:');
    db.projects.insert(made());
    expect(db.projects.remove('anka-plus')).toBe(true);
    expect(db.projects.byId('anka-plus')).toBeNull();
    expect(db.projects.remove('anka-plus')).toBe(false);
  });

  test('deleteWhereIdNotIn prunes only origin=seed rows outside the given ids', () => {
    db = openDb(':memory:');
    db.projects.insert(made({ id: 'seed-row', origin: 'seed' }));
    db.projects.insert(made({ id: 'os-row', origin: 'os' }));
    db.projects.deleteWhereIdNotIn([]);
    const ids = db.projects.all().map((p) => p.id);
    expect(ids).not.toContain('seed-row');
    expect(ids, 'an OS-created project must survive a re-seed').toContain('os-row');
  });

  test('rejects a row with an invalid pathOrUrl-less shape via schema validation', () => {
    // @ts-expect-error deliberately malformed for the runtime check
    expect(() => db.projects.insert({ ...made(), pathOrUrl: undefined })).toThrow();
  });
});