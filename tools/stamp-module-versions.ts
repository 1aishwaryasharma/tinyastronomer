// Sets each Sky Tonight module import's ?v= to that module's content hash,
// then refreshes the inline-script hashes in _headers, since stamping edits
// the page's inline module. Run after editing any of the modules or any
// inline script: bun tools/stamp-module-versions.ts
// Importers contain their imports' hashes, so it repeats until nothing moves.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Modules only Sky Tonight imports. chrome.js, frame-loop.js and data.js are
// shared with every page and the common bundle, and keep the site's
// hand-bumped dates.
export const VERSIONED_MODULES = ['sky-forecast.js', 'sky-stars.js', 'sky-location.js', 'sky-labels.js', 'tz-coords.js'];

// Hash the text as git stores it: a CRLF checkout must stamp what CI and the
// deploy will serve.
export function moduleHash(source: string | Buffer): string {
  return createHash('sha256').update(source.toString().replaceAll('\r\n', '\n')).digest('hex').slice(0, 10);
}

// The CSP source for one inline script, hashed as git serves it (LF).
export function inlineScriptHash(text: string): string {
  return `'sha256-${createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('base64')}'`;
}

function inlineScriptHashes(dir: string): string[] {
  const hashes: string[] = [];
  const pages = (readdirSync(dir, { recursive: true }) as string[])
    .filter((name) => name.endsWith('.html') && !name.startsWith('vendor'))
    .sort();
  for (const page of pages) {
    for (const match of readFileSync(join(dir, page), 'utf8').matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc=["']/i.test(match[1] || '')) continue;
      hashes.push(inlineScriptHash(match[2]));
    }
  }
  return hashes;
}

// Keeps the existing order for unchanged scripts and appends new ones.
function refreshCsp(dir: string) {
  const path = join(dir, '_headers');
  const headers = readFileSync(path, 'utf8');
  const live = inlineScriptHashes(dir);
  const directive = /script-src 'self'((?: 'sha256-[^']+')*)/;
  const found = headers.match(directive);
  if (!found) throw new Error(`No "script-src 'self'" directive in ${path}`);
  const current = found[1].trim().split(' ').filter(Boolean);
  const next = [...current.filter((hash) => live.includes(hash)), ...live.filter((hash) => !current.includes(hash))];
  writeFileSync(path, headers.replace(directive, ['script-src', "'self'", ...next].join(' ')));
}

export function stampVersions(dir: string) {
  const files = readdirSync(dir).filter((name) => /\.(?:html|js)$/.test(name));
  const pattern = new RegExp(`(from\\s+['"]\\./)(${VERSIONED_MODULES.join('|').replaceAll('.', '\\.')})(?:\\?v=[^'"]*)?(['"])`, 'g');
  for (let pass = 0; pass < 10; pass += 1) {
    let changed = false;
    for (const file of files) {
      const path = join(dir, file), source = readFileSync(path, 'utf8');
      const next = source.replace(pattern, (_, from, module, quote) => `${from}${module}?v=${moduleHash(readFileSync(join(dir, module)))}${quote}`);
      if (next !== source) { writeFileSync(path, next); changed = true; }
    }
    if (!changed) { refreshCsp(dir); return; }
  }
  throw new Error('Module versions did not settle; is there an import cycle?');
}

if (import.meta.main) {
  stampVersions(fileURLToPath(new URL('../public/', import.meta.url)));
  console.log('Module versions and inline-script CSP hashes are current.');
}
