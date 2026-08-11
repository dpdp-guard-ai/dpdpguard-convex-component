import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The published package is ESM (`"type": "module"`) and `tsc` copies relative
 * import specifiers through verbatim. An extensionless `./webhooks` therefore
 * survives into `dist/`, where Convex's own bundler resolves it happily but
 * Node's ESM loader does not — so a host app that merely *imports*
 * `@dpdpguard/convex/http` (a Vitest suite, an SSR build, anything not going
 * through the Convex bundler) fails with ERR_MODULE_NOT_FOUND before any of
 * our code runs.
 *
 * That is how 0.3.0 shipped, and it is invisible in this repo's own tests
 * because Vitest resolves TypeScript sources rather than the built output.
 * Hence a source-level assertion.
 */

const SRC = fileURLToPath(new URL('.', import.meta.url));

function typescriptFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...typescriptFiles(path));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      // Test files are excluded from the published tarball, so their
      // specifiers never reach a consumer's module loader.
      out.push(path);
    }
  }
  return out;
}

/** `from './x'` / `import './x'`, capturing the specifier. */
const RELATIVE_SPECIFIER = /(?:from|import)\s+['"](\.{1,2}\/[^'"]*)['"]/g;

/** Any import whose specifier ends in `.json`, relative or bare. */
const JSON_IMPORT = /(?:from|import)\s+['"]([^'"]*\.json)['"]/g;

describe('package output resolvability', () => {
  it('gives every relative import an explicit .js extension', () => {
    const offenders: string[] = [];

    for (const file of typescriptFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(RELATIVE_SPECIFIER)) {
        const specifier = match[1];
        if (specifier.endsWith('.js') || specifier.endsWith('.json')) continue;
        offenders.push(`${file.slice(SRC.length)}: ${specifier}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("gives every JSON import a `with { type: 'json' }` attribute", () => {
    const offenders: string[] = [];

    for (const file of typescriptFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(JSON_IMPORT)) {
        // The attribute, if present, follows the closing quote on the same
        // statement — Node rejects the import outright without it.
        const rest = source.slice(match.index + match[0].length, match.index + match[0].length + 60);
        if (/^\s*with\s*\{\s*type\s*:\s*['"]json['"]\s*\}/.test(rest)) continue;
        offenders.push(`${file.slice(SRC.length)}: ${match[1]}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
