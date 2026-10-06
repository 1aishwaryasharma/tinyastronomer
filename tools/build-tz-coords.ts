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

// Clock names from Unix System V and POSIX, not places.
const CLOCK_NAMES = new Set(['CET', 'EET', 'EST', 'HST', 'MET', 'MST', 'WET']);

// `backward` maps old names to current zones, but a link only promises the
// same clock, not the same place. Its sections say which is which:
// "Alternate names for the same location" (and the older renames) are the
// same city, so Asia/Calcutta is Kolkata; "Non-zone.tab locations ... that
// duplicate those of an existing location" are other places that merely
// share a clock, so Africa/Timbuktu links to Abidjan, in another country.
// Those, and clock names like EST, only get a rough position.
function parseLinks(backward: string, coords: Map<string, unknown>) {
  const exact = new Map<string, string>();
  const shared = new Map<string, string>();
  const links: { target: string; name: string; successor?: string; merged: boolean }[] = [];
  let merged = false;
  for (const line of backward.split(/\r?\n/)) {
    if (line.startsWith('# ')) {
      if (/^# (Pre-1993|Two-part|Pre-2013|Alternate names)/.test(line)) merged = false;
      else if (/^# Non-zone\.tab locations/.test(line)) merged = true;
      continue;
    }
    // "#= TARGET1" names the link's real successor where tzdb could not
    // link to a link, e.g. Iceland #= Atlantic/Reykjavik.
    const match = line.match(/^Link\s+(\S+)\s+(\S+)(?:\s+#=\s*(\S+))?/);
    if (match) links.push({ target: match[1], name: match[2], successor: match[3], merged });
  }
  for (const link of links.filter((link) => link.merged || CLOCK_NAMES.has(link.name))) shared.set(link.name, link.target);
  for (const { target, name, successor } of links) {
    if (coords.has(name) || shared.has(name)) continue;
    if (successor && coords.has(successor)) exact.set(name, successor);
    else if (successor && shared.has(successor)) shared.set(name, shared.get(successor)!);
    else exact.set(name, target);
  }
  const located = (map: Map<string, string>) => [...map]
    .filter(([name, target]) => !coords.has(name) && coords.has(target))
    .sort(([a], [b]) => a.localeCompare(b));
  return { exact: located(exact), shared: located(shared) };
}

// zone1970.tab merges countries that have shared clocks since 1970, so
// Amsterdam only appears as Brussels. zone.tab keeps every country's own
// reference city, which is the better guess for someone standing there.
export function buildModule(zone1970Tab: string, zoneTab = '', backward = ''): string {
  const coords = new Map([...parseTab(zone1970Tab), ...parseTab(zoneTab)]);
  const { exact, shared } = parseLinks(backward, coords);
  const rows = [...coords]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zone, [lat, lon]]) => `  ${JSON.stringify(zone)}: [${lat}, ${lon}],`);
  const mapRows = (entries: [string, string][]) => entries.map(([name, target]) => `  ${JSON.stringify(name)}: ${JSON.stringify(target)},`);
  return [
    '// Generated from the IANA Time Zone Database zone.tab, zone1970.tab and',
    '// backward (public domain).',
    `// Source: ${TZDB}/`,
    '// Refresh with: bun tools/build-tz-coords.ts',
    'export const TZ_COORDS = {',
    ...rows,
    '};',
    '',
    '// Old names for the same place, mapped to the zone that replaced them.',
    'export const TZ_ALIASES = {',
    ...mapRows(exact),
    '};',
    '',
    '// Other places, or bare clock names, that only share a zone\'s clock.',
    '// Their coordinates are a rough guess, not a location.',
    'export const TZ_SHARED_CLOCKS = {',
    ...mapRows(shared),
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
