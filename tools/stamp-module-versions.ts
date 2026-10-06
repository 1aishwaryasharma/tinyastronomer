// Sets each Sky Tonight module import's ?v= to that module's content hash.
// Run after editing any of them: bun tools/stamp-module-versions.ts
// Importers contain their imports' hashes, so it repeats until nothing moves.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

export const VERSIONED_MODULES = ['sky-forecast.js', 'sky-stars.js', 'sky-location.js', 'tz-coords.js'];
const DIR = new URL('../public/', import.meta.url);

export function moduleHash(source: string | Buffer): string {
  return createHash('sha256').update(source).digest('hex').slice(0, 10);
}

if (import.meta.main) {
  const files = readdirSync(DIR).filter((name) => /\.(?:html|js)$/.test(name));
  const pattern = new RegExp(`(from\\s+['"]\\./)(${VERSIONED_MODULES.join('|').replaceAll('.', '\\.')})(?:\\?v=[^'"]*)?(['"])`, 'g');
  for (let pass = 0; pass < 10; pass += 1) {
    let changed = false;
    for (const file of files) {
      const url = new URL(file, DIR), source = readFileSync(url, 'utf8');
      const next = source.replace(pattern, (_, from, module, quote) => `${from}${module}?v=${moduleHash(readFileSync(new URL(module, DIR)))}${quote}`);
      if (next !== source) { writeFileSync(url, next); changed = true; }
    }
    if (!changed) { console.log('Module versions are current.'); process.exit(0); }
  }
  throw new Error('Module versions did not settle; is there an import cycle?');
}
