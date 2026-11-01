// Builds public/sky-places.js, the town and city list behind Sky Tonight's
// place search, from GeoNames (CC BY 4.0). Run: bun tools/build-places.ts
// It needs `unzip` on PATH. Then run bun tools/stamp-module-versions.ts.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizePlaceName } from '../public/sky-location.js';

const GEONAMES = 'https://download.geonames.org/export/dump';
const OUTPUT = new URL('../public/sky-places.js', import.meta.url);

// Populated places, minus city sections (Brooklyn, Shinjuku) whose sky is the
// city's, and historical, abandoned or destroyed ones.
const SKIPPED_FEATURES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);

type Place = { name: string; ascii: string; country: string; admin1: string; lat: number; lon: number; population: number; zone: string };

// cities15000.txt columns: https://download.geonames.org/export/dump/readme.txt
export function parseCities(text: string): Place[] {
  const places: Place[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const field = line.split('\t');
    if (SKIPPED_FEATURES.has(field[7])) continue;
    places.push({
      name: field[1], ascii: field[2], lat: Number(field[4]), lon: Number(field[5]),
      country: field[8], admin1: `${field[8]}.${field[10]}`, population: Number(field[14]), zone: field[17],
    });
  }
  return places;
}

export function parseAdmin1(text: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const [code, name] = line.split('\t');
    if (code && name) names.set(code, name);
  }
  return names;
}

// Coordinates to 0.1° (about 10 km), as for typed coordinates: the sky does
// not change visibly within a town, and it keeps the file small.
export function buildModule(places: Place[], regions: Map<string, string>, date: string): string {
  const sorted = [...places].sort((a, b) => b.population - a.population || a.name.localeCompare(b.name));
  const sameName = new Map<string, number>();
  for (const place of sorted) {
    const key = `${place.country} ${normalizePlaceName(place.name)}`;
    sameName.set(key, (sameName.get(key) ?? 0) + 1);
  }
  const zones = [...new Set(sorted.map((place) => place.zone))].sort();
  const rows = sorted.map((place) => {
    if ([place.name, place.ascii].some((name) => name.includes('|'))) throw new Error(`"|" in a place name: ${place.name}`);
    const repeated = sameName.get(`${place.country} ${normalizePlaceName(place.name)}`)! > 1;
    const region = repeated ? regions.get(place.admin1) ?? '' : '';
    // Only where the accent-free name differs: Łódź searches as Lodz.
    const ascii = normalizePlaceName(place.ascii) !== normalizePlaceName(place.name) ? place.ascii : '';
    return [place.name, place.country, round(place.lat), round(place.lon), zones.indexOf(place.zone), region, ascii]
      .join('|').replace(/\|+$/, '');
  });
  return `// Generated from GeoNames cities15000 and admin1CodesASCII, ${date}.
// GeoNames (https://www.geonames.org/) is licensed CC BY 4.0
// (https://creativecommons.org/licenses/by/4.0/). Changes: towns and cities of
// 15,000 or more people without city sections, coordinates rounded to 0.1°,
// regions kept only where a country has two places of one name.
// Refresh with: bun tools/build-places.ts

// Rows, most populous first: name|country|lat|lon|ZONES index|region|ASCII name.
export const ZONES = ${JSON.stringify(zones)};

export const PLACES = ${JSON.stringify(rows)};
`;
}

function round(value: number) {
  return Number(value.toFixed(1));
}

async function download(name: string): Promise<Uint8Array> {
  const response = await fetch(`${GEONAMES}/${name}`);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

if (import.meta.main) {
  const dir = mkdtempSync(join(tmpdir(), 'geonames-'));
  writeFileSync(join(dir, 'cities15000.zip'), await download('cities15000.zip'));
  const unzip = Bun.spawnSync(['unzip', '-o', '-q', join(dir, 'cities15000.zip'), '-d', dir]);
  if (unzip.exitCode !== 0) throw new Error(`unzip failed: ${unzip.stderr}`);
  const cities = parseCities(readFileSync(join(dir, 'cities15000.txt'), 'utf8'));
  const regions = parseAdmin1(new TextDecoder().decode(await download('admin1CodesASCII.txt')));
  writeFileSync(OUTPUT, buildModule(cities, regions, new Date().toISOString().slice(0, 10)));
  console.log(`Wrote ${cities.length} places to public/sky-places.js`);
}
