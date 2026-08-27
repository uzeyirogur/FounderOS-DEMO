import fs from 'node:fs';
import path from 'node:path';

/**
 * Project Bootstrap: real, read-only filesystem inspection of a registered
 * local project. Never guesses a stack from a project's name or purpose text
 * — only from manifest files actually present on disk. Recommends a starter
 * checklist; never runs installs itself (that stays a human, or an
 * auto_safe_write/full_with_approval-authorized agent action gated by the
 * Project Registry's permissionLevel).
 */
export type ProjectStackReport = {
  languages: string[];
  frameworks: string[];
  testRunners: string[];
  checklist: string[];
  note: string;
};

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function detectProjectStack(projectPath: string): ProjectStackReport {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const testRunners = new Set<string>();
  const checklist: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(projectPath, { withFileTypes: true });
  } catch {
    return { languages: [], frameworks: [], testRunners: [], checklist: [], note: 'Project path is not accessible or does not exist.' };
  }

  const names = new Set(entries.map((e) => e.name));

  if (names.has('package.json')) {
    languages.add('TypeScript/JavaScript');
    const pkg = readJsonSafe(path.join(projectPath, 'package.json')) ?? {};
    const deps = {
      ...((pkg.dependencies as Record<string, string>) ?? {}),
      ...((pkg.devDependencies as Record<string, string>) ?? {}),
    };
    if (deps.next) frameworks.add('Next.js');
    if (deps.react && !deps.next) frameworks.add('React');
    if (deps.express) frameworks.add('Express');
    if (deps.vitest) testRunners.add('Vitest');
    if (deps.jest) testRunners.add('Jest');
    if (deps.playwright || deps['@playwright/test']) testRunners.add('Playwright');
    if (deps.typescript) checklist.push('Run the existing TypeScript typecheck before changing anything.');
    if (testRunners.size === 0) checklist.push('No test runner detected — consider adding one before writing agent-authored changes.');
  }

  const csproj = entries.some((e) => e.name.endsWith('.csproj'));
  if (csproj || names.has('*.sln')) {
    languages.add('.NET / C#');
    checklist.push('Run `dotnet build` and the existing test suite before changing anything.');
  }

  if (names.has('requirements.txt') || names.has('pyproject.toml')) {
    languages.add('Python');
    checklist.push('Create/activate a virtualenv before installing anything.');
  }

  if (names.has('go.mod')) languages.add('Go');
  if (names.has('Cargo.toml')) languages.add('Rust');

  const note =
    languages.size === 0
      ? 'No recognizable manifest file (package.json, .csproj, requirements.txt, ...) found at this path.'
      : `Detected from manifest files on disk: ${[...languages].join(', ')}.`;

  return { languages: [...languages], frameworks: [...frameworks], testRunners: [...testRunners], checklist, note };
}
