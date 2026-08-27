import { describe, expect, test } from 'vitest';
import { ProjectSchema } from '@/lib/schemas';

/**
 * Project Registry schema: the dynamic list of projects agents are allowed to
 * touch. Nothing about a project is hardcoded into agent logic — this table
 * is the single source of truth for what exists, why, and who may act on it.
 */
describe('ProjectSchema', () => {
  const valid = {
    id: 'anka-plus',
    name: 'ANKA+ / TIVARO',
    kind: 'local' as const,
    pathOrUrl: 'C:/Users/HP/source/repos/ANKA+',
    purpose: 'Athlete development platform backend + admin + mobile.',
    status: 'active' as const,
    permissionLevel: 'read_only' as const,
    authorizedAgentIds: ['anka-operations'],
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
    origin: 'os' as const,
  };

  test('accepts a valid project', () => {
    expect(ProjectSchema.parse(valid)).toEqual(valid);
  });

  test('defaults status to active, permissionLevel to read_only, authorizedAgentIds to empty', () => {
    const { status: _s, permissionLevel: _p, authorizedAgentIds: _a, ...rest } = valid;
    const parsed = ProjectSchema.parse(rest);
    expect(parsed.status).toBe('active');
    expect(parsed.permissionLevel).toBe('read_only');
    expect(parsed.authorizedAgentIds).toEqual([]);
  });

  test('defaults origin to seed', () => {
    const { origin: _o, ...rest } = valid;
    expect(ProjectSchema.parse(rest).origin).toBe('seed');
  });

  test('accepts kind: git with a remote URL', () => {
    const gitProject = { ...valid, id: 'is-ilan-radar', kind: 'git' as const, pathOrUrl: 'https://github.com/example/is-ilan-radar.git' };
    expect(ProjectSchema.parse(gitProject).kind).toBe('git');
  });

  test('rejects an unknown kind', () => {
    expect(() => ProjectSchema.parse({ ...valid, kind: 'ftp' })).toThrow();
  });

  test('rejects an unknown permissionLevel', () => {
    expect(() => ProjectSchema.parse({ ...valid, permissionLevel: 'god-mode' })).toThrow();
  });

  test('rejects an unknown status', () => {
    expect(() => ProjectSchema.parse({ ...valid, status: 'deleted' })).toThrow();
  });

  test('rejects a missing pathOrUrl', () => {
    const { pathOrUrl: _omitted, ...rest } = valid;
    expect(() => ProjectSchema.parse(rest)).toThrow();
  });

  test('rejects an empty name', () => {
    expect(() => ProjectSchema.parse({ ...valid, name: '' })).toThrow();
  });
});
