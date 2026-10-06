const TZDB = 'https://data.iana.org/time-zones/tzdb';
const OUTPUT = new URL('../public/tz-coords.js', import.meta.url);

function parseCoordinate(value: string, degreeDigits: number): number {
  const sign = value[0] === '-' ? -1 : 1;
  const digits = value.slice(1);
  const degrees = Number(digits.slice(0, degreeDigits));
  const minutes = Number(digits.slice(degreeDigits, degreeDigits + 2));
  const seconds = digits.length > degreeDigits + 2
    ? Number(digits.slice(degreeDigits + 2, degreeDigits + 4))
    : 0;
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

export function parseIso6709(value: string): [number, number] {
  const longitudeSign = value.search(/[+-]/g) === 0
    ? value.slice(1).search(/[+-]/) + 1
    : -1;
  if (longitudeSign <= 0) throw new Error(`Invalid ISO 6709 coordinate: ${value}`);
  return [
    parseCoordinate(value.slice(0, longitudeSign), 2),
    parseCoordinate(value.slice(longitudeSign), 3),
  ];
}

function parseTab(tab: string): Map<string, [number, number]> {
  const zones = new Map<string, [number, number]>();
  for (const line of tab.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const [, coordinate, zone] = line.split('\t');
    const [latitude, longitude] = parseIso6709(coordinate);
    zones.set(zone, [Number(latitude.toFixed(2)), Number(longitude.toFixed(2))]);
  }
  return zones;
}

// Browsers still report legacy names: Chrome says Asia/Calcutta for all of
// India. `backward` maps each one to the zone that replaced it.
function parseLinks(backward: string): Map<string, string> {
  const links = new Map<string, string>();
  for (const line of backward.split(/\r?\n/)) {
    const [kind, target, name] = line.replace(/#.*/, '').trim().split(/\s+/);
    if (kind === 'Link' && target && name) links.set(name, target);
  }
  return links;
}

// zone1970.tab merges countries that have shared clocks since 1970, so
// Amsterdam only appears as Brussels. zone.tab keeps every country's own
// reference city, which is the better guess for someone standing there.
export function buildModule(zone1970Tab: string, zoneTab = '', backward = ''): string {
  const coords = new Map([...parseTab(zone1970Tab), ...parseTab(zoneTab)]);
  const aliases = [...parseLinks(backward)]
    .filter(([name, target]) => !coords.has(name) && coords.has(target))
    .sort(([a], [b]) => a.localeCompare(b));
  const rows = [...coords]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zone, [lat, lon]]) => `  ${JSON.stringify(zone)}: [${lat}, ${lon}],`);
  return [
    '// Generated from the IANA Time Zone Database zone.tab, zone1970.tab and',
    '// backward (public domain).',
    `// Source: ${TZDB}/`,
    '// Refresh with: bun tools/build-tz-coords.ts',
    'export const TZ_COORDS = {',
    ...rows,
    '};',
    '',
    '// Legacy and merged zone names, mapped to the zone whose coordinates they use.',
    'export const TZ_ALIASES = {',
    ...aliases.map(([name, target]) => `  ${JSON.stringify(name)}: ${JSON.stringify(target)},`),
    '};',
    '',
  ].join('\n');
}

async function download(name: string): Promise<string> {
  const response = await fetch(`${TZDB}/${name}`);
  if (!response.ok) throw new Error(`Could not download ${name}: ${response.status}`);
  return response.text();
}

if (import.meta.main) {
  const [zone1970, zone, backward] = await Promise.all(['zone1970.tab', 'zone.tab', 'backward'].map(download));
  await Bun.write(OUTPUT, buildModule(zone1970, zone, backward));
  console.log(`Wrote ${OUTPUT.pathname}`);
}
