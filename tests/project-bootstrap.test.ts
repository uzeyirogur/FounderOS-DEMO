import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectProjectStack } from '@/lib/project-bootstrap';

/**
 * Project Bootstrap: reads a REAL local project's manifest files (never
 * guesses) and recommends a stack summary + starter checklist. Purely
 * read-only filesystem inspection — no writes, no package installs (those
 * remain a human/approved-agent action per the project's permissionLevel).
 */
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('detectProjectStack', () => {
  it('detects a Node/TypeScript project from package.json', () => {
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'x', dependencies: { next: '14.0.0', react: '18.0.0' }, devDependencies: { typescript: '5.0.0', vitest: '2.0.0' } }),
    );
    const stack = detectProjectStack(dir);
    expect(stack.languages).toContain('TypeScript/JavaScript');
    expect(stack.frameworks).toContain('Next.js');
    expect(stack.testRunners).toContain('Vitest');
  });

  it('detects a .NET project from a .csproj file', () => {
    fs.writeFileSync(path.join(dir, 'Anka.Api.csproj'), '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>');
    const stack = detectProjectStack(dir);
    expect(stack.languages).toContain('.NET / C#');
  });

  it('detects Python from requirements.txt or pyproject.toml', () => {
    fs.writeFileSync(path.join(dir, 'requirements.txt'), 'flask==3.0.0\n');
    const stack = detectProjectStack(dir);
    expect(stack.languages).toContain('Python');
  });

  it('returns an honest empty stack for a path with no recognizable manifest', () => {
    const stack = detectProjectStack(dir);
    expect(stack.languages).toEqual([]);
    expect(stack.frameworks).toEqual([]);
    expect(stack.note).toMatch(/no recognizable/i);
  });

  it('returns an honest error stack for a path that does not exist', () => {
    const stack = detectProjectStack(path.join(dir, 'does-not-exist'));
    expect(stack.note).toMatch(/not accessible|does not exist/i);
  });

  it('recommends a checklist item for a detected but untested stack', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', dependencies: { express: '4.0.0' } }));
    const stack = detectProjectStack(dir);
    expect(stack.checklist.some((c) => /test/i.test(c))).toBe(true);
  });
});
