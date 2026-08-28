import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '@/lib/db';

describe('contentPieces repo', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); });
  afterEach(() => { (db as any).close?.(); });

  const now = new Date().toISOString();

  it('insert + all round-trips a content piece', () => {
    db.contentPieces.insert({
      id: 'c1',
      projectId: null,
      kind: 'social_post',
      brief: 'Announce feature X',
      status: 'produced',
      output: 'Check out feature X!',
      requiredCapability: null,
      createdAt: now,
      updatedAt: now,
    });
    const rows = db.contentPieces.all();
    expect(rows).toHaveLength(1);
    expect(rows[0].output).toBe('Check out feature X!');
  });

  it('byProjectId filters, and null-project pieces are excluded', () => {
    db.contentPieces.insert({ id: 'c1', projectId: 'proj-a', kind: 'social_post', brief: 'x', status: 'drafted', output: null, requiredCapability: null, createdAt: now, updatedAt: now });
    db.contentPieces.insert({ id: 'c2', projectId: null, kind: 'social_post', brief: 'y', status: 'drafted', output: null, requiredCapability: null, createdAt: now, updatedAt: now });
    expect(db.contentPieces.byProjectId('proj-a')).toHaveLength(1);
  });

  it('needsCapability lists pieces blocked on a missing tool', () => {
    db.contentPieces.insert({ id: 'c1', projectId: null, kind: 'product_demo_video', brief: 'x', status: 'needs_capability', output: null, requiredCapability: 'video-generation', createdAt: now, updatedAt: now });
    db.contentPieces.insert({ id: 'c2', projectId: null, kind: 'social_post', brief: 'y', status: 'produced', output: 'z', requiredCapability: null, createdAt: now, updatedAt: now });
    expect(db.contentPieces.needsCapability()).toHaveLength(1);
  });

  it('updateStatus mutates status/output/requiredCapability and bumps updatedAt', () => {
    db.contentPieces.insert({ id: 'c1', projectId: null, kind: 'social_post', brief: 'x', status: 'drafted', output: null, requiredCapability: null, createdAt: now, updatedAt: now });
    db.contentPieces.updateStatus('c1', 'produced', 'Here is your post', null);
    const row = db.contentPieces.byId('c1');
    expect(row?.status).toBe('produced');
    expect(row?.output).toBe('Here is your post');
  });

  it('byId returns null for unknown id', () => {
    expect(db.contentPieces.byId('nope')).toBeNull();
  });
});
