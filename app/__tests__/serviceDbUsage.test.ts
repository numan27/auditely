// app/__tests__/serviceDbUsage.test.ts

// The service client bypasses Row Level Security, so only the code doing work no
// signed-in user owns may import `serviceDb`: the owner lookup in server.ts, the
// shared PageSpeed cache, the usage ledger (a user may read their own uses but never
// write one), the devartventures.com webhook and signed report links.
// Anywhere else it could hand one user another's data. The `Db` type carries no
// access, so `import type { Db }` is fine anywhere.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';

const ROOT = process.cwd();
const CLIENT = 'app/_shared/lib/supabase/client';

const ALLOWED = [
  'app/_shared/lib/audit/pageSpeedStore.ts',
  'app/_shared/lib/supabase/server.ts',
  'app/_shared/lib/usage/usage.ts',
  'app/api/inbound/audit-request/route.ts',
  'app/report/[token]/route.ts',
];

// `import`/`export … from` with named bindings, a namespace import, or a dynamic import()
const NAMED = /\b(?:import|export)\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
const NAMESPACE = /\b(?:import|export)\s+(type\s+)?\*(?:\s+as\s+\w+)?\s+from\s*['"]([^'"]+)['"]/g;
const DYNAMIC = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/** The repo-relative path a module specifier names, without its extension */
function resolveSpecifier(file: string, specifier: string): string {
  if (specifier.startsWith('@/')) return specifier.slice(2).replace(/\.tsx?$/, '');
  if (!specifier.startsWith('.')) return specifier;
  return posix.join(posix.dirname(file), specifier).replace(/\.tsx?$/, '');
}

/** True when the source brings in the value `serviceDb` from the service client module */
function importsServiceDb(file: string, source: string): boolean {
  const fromClient = (specifier: string) => resolveSpecifier(file, specifier) === CLIENT;
  for (const [, typeOnly, names, specifier] of source.matchAll(NAMED)) {
    if (typeOnly || !fromClient(specifier)) continue;
    const values = names.split(',').map((name) => name.trim()).filter((name) => name && !name.startsWith('type '));
    if (values.some((name) => name.split(/\s+as\s+/)[0] === 'serviceDb')) return true;
  }
  for (const [, typeOnly, specifier] of source.matchAll(NAMESPACE)) {
    if (!typeOnly && fromClient(specifier)) return true;
  }
  for (const [, specifier] of source.matchAll(DYNAMIC)) {
    if (fromClient(specifier)) return true;
  }
  return false;
}

function sourceFiles(): string[] {
  return (readdirSync(join(ROOT, 'app'), { recursive: true }) as string[])
    .map((path) => posix.join('app', path.split(sep).join('/')))
    .filter((path) => /\.tsx?$/.test(path) && !path.split('/').includes('__tests__'));
}

describe('the service client', () => {
  it('tells a value import of serviceDb from a type import', () => {
    const file = 'app/api/example/route.ts';
    expect(importsServiceDb(file, "import { serviceDb } from '@/app/_shared/lib/supabase/client';")).toBe(true);
    expect(importsServiceDb(file, "import { serviceDb, type Db } from '@/app/_shared/lib/supabase/client';")).toBe(true);
    expect(importsServiceDb(file, "import { type Db, serviceDb as db } from '@/app/_shared/lib/supabase/client';")).toBe(true);
    expect(importsServiceDb(file, "import * as client from '@/app/_shared/lib/supabase/client';")).toBe(true);
    expect(importsServiceDb(file, "await import('@/app/_shared/lib/supabase/client')")).toBe(true);
    expect(importsServiceDb('app/_shared/lib/supabase/other.ts', "import { serviceDb } from './client';")).toBe(true);
    expect(importsServiceDb(file, "import type { Db } from '@/app/_shared/lib/supabase/client';")).toBe(false);
    expect(importsServiceDb(file, "import { type Db } from '@/app/_shared/lib/supabase/client';")).toBe(false);
    expect(importsServiceDb(file, "import { getSession } from '@/app/_shared/lib/supabase/server';")).toBe(false);
  });

  it('is imported only where no signed-in user owns the work', () => {
    const importers = sourceFiles().filter((path) => importsServiceDb(path, readFileSync(join(ROOT, path), 'utf8')));
    expect(importers.sort()).toEqual(ALLOWED);
  });
});
