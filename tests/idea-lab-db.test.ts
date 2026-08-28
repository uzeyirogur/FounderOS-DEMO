import { afterEach, describe, expect, test } from 'vitest';
import { openDb, type FounderDb } from '@/lib/db';

let db: FounderDb;
afterEach(() => db?.close());

const made = (over: Partial<Parameters<FounderDb['ideas']['insert']>[0]> = {}) => ({
  id: 'idea-1',
  title: 'Automated grade digest for parents',
  description: 'Weekly summary email.',
  marketSize: 4,
  effort: 2,
  strategicFit: 5,
  status: 'new' as const,
  projectId: null,
  createdAt: '2026-08-27T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z',
  ...over,
});

describe('db.ideas', () => {
  test('round-trips an idea', () => {
    db = openDb(':memory:');
    db.ideas.insert(made());
    const row = db.ideas.byId('idea-1');
    expect(row?.title).toBe('Automated grade digest for parents');
    expect(row?.marketSize).toBe(4);
  });

  test('all() returns newest updatedAt first', () => {
    db = openDb(':memory:');
    db.ideas.insert(made({ id: 'i1', updatedAt: '2026-08-01T00:00:00.000Z' }));
    db.ideas.insert(made({ id: 'i2', updatedAt: '2026-08-20T00:00:00.000Z' }));
    expect(db.ideas.all().map((i) => i.id)[0]).toBe('i2');
  });

  test('byId returns null for an unknown id', () => {
    db = openDb(':memory:');
    expect(db.ideas.byId('nope')).toBeNull();
  });

  test('remove deletes a row and reports whether it existed', () => {
    db = openDb(':memory:');
    db.ideas.insert(made());
    expect(db.ideas.remove('idea-1')).toBe(true);
    expect(db.ideas.remove('idea-1')).toBe(false);
  });
});
