const TZDB = 'https://data.iana.org/time-zones/tzdb';
const CLDR = 'https://raw.githubusercontent.com/unicode-org/cldr/main/common/bcp47/timezone.xml';
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

// Clock names from Unix System V and POSIX, not places. backward defines
// the four US ones as Zones rather than Links, so they carry their city here.
const CLOCK_NAMES = new Set(['CET', 'EET', 'EST', 'HST', 'MET', 'MST', 'WET']);
const POSIX_CLOCKS: Record<string, string> = {
  EST5EDT: 'America/New_York',
  CST6CDT: 'America/Chicago',
  MST7MDT: 'America/Denver',
  PST8PDT: 'America/Los_Angeles',
};

// backward's sections say whether a link is the same place or only the same
// clock. "Alternate names for the same location" and the old renames are the
// same city, so Asia/Calcutta is Kolkata. "Pre-2013 practice" merged whole
// countries (Accra into Abidjan) and "Non-zone.tab locations" are other towns
// on a shared clock (Timbuktu on Abidjan time): those only get a rough guess.
const SECTIONS: [RegExp, 'same' | 'shared'][] = [
  [/^Pre-1993 naming conventions/, 'same'],
  [/^Two-part names that were renamed/, 'same'],
  [/^Pre-2013 practice/, 'shared'],
  [/^Non-zone\.tab locations/, 'shared'],
  [/^Alternate names for the same location/, 'same'],
];

function parseLinks(backward: string, coords: Map<string, unknown>) {
  const exact = new Map<string, string>();
  const shared = new Map<string, string>();
  const links: { target: string; name: string; successor?: string; kind: 'same' | 'shared' }[] = [];
  const lines = backward.split(/\r?\n/);
  let kind: 'same' | 'shared' | null = null;
  let heading = '';
  lines.forEach((line, index) => {
    // A section heading is the comment after a blank line; the "# Link TARGET"
    // column header that follows it confirms it opens a list of links.
    const header = /^#\s*Link\s+TARGET/.test(line);
    if (!header && line.startsWith('# ') && !lines[index - 1]) {
      heading = line.slice(2);
      // Until its column header confirms the section, its links are unclassified.
      kind = null;
    }
    if (header) {
      const known = SECTIONS.find(([pattern]) => pattern.test(heading));
      // An unknown section could be either kind; guessing would silently
      // mislabel a place. Make whoever refreshes the data decide.
      if (!known) throw new Error(`Unknown backward section: "${heading}". Classify it in SECTIONS.`);
      kind = known[1];
    }
    const zone = line.match(/^Zone\s+(\S+)/);
    if (zone && !coords.has(zone[1])) {
      if (!POSIX_CLOCKS[zone[1]]) throw new Error(`Unknown Zone in backward: ${zone[1]}. Map it in POSIX_CLOCKS.`);
      shared.set(zone[1], POSIX_CLOCKS[zone[1]]);
    }
    // "#= TARGET1" names the link's real successor where tzdb could not
    // link to a link, e.g. Iceland #= Atlantic/Reykjavik.
    const match = line.match(/^Link\s+(\S+)\s+(\S+)(?:\s+#=\s*(\S+))?/);
    if (!match) return;
    if (!kind) throw new Error(`Link before any section in backward: ${line}`);
    links.push({ target: match[1], name: match[2], successor: match[3], kind });
  });
  for (const link of links) {
    if (link.kind === 'shared' || CLOCK_NAMES.has(link.name) || POSIX_CLOCKS[link.name]) {
      shared.set(link.name, POSIX_CLOCKS[link.name] ?? link.target);
    }
  }
  for (const { target, name, successor } of links) {
    if (coords.has(name) || shared.has(name)) continue;
    // With a "#=" note the target is by definition another place, so it can
    // only be exact through the successor.
    if (successor) {
      if (coords.has(successor)) exact.set(name, successor);
      else shared.set(name, shared.get(successor) ?? target);
    } else exact.set(name, target);
  }
  return { exact, shared };
}

// Browsers report CLDR's canonical IDs, which keep some names tzdb retired:
// Chrome says America/Coral_Harbour in Atikokan, which tzdb files as another
// town on Panama time. CLDR's `iana` attribute names the place it means.
function parseCldr(timezoneXml: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const [, alias, iana] of timezoneXml.matchAll(/<type\b[^>]*\balias="([^"]+)"[^>]*\biana="([^"]+)"/g)) {
    const reported = alias.split(/\s+/)[0];
    if (reported !== iana) names.set(reported, iana);
  }
  return names;
}

// zone1970.tab has one row per distinct clock, so it is what manual
// coordinates search for the nearest clock. zone.tab adds every country's
// own reference city, a better position for a device in, say, Amsterdam,
// but some are towns on another zone's clock (Creston keeps Phoenix time),
// which would pull nearby places onto the wrong clock.
export function buildModule(zone1970Tab: string, zoneTab = '', backward = '', cldrTimezones = ''): string {
  const clocks = parseTab(zone1970Tab);
  const cities = new Map([...parseTab(zoneTab)].filter(([zone]) => !clocks.has(zone)));
  const coords = new Map([...clocks, ...cities]);
  const { exact, shared } = parseLinks(backward, coords);
  for (const [name, zone] of parseCldr(cldrTimezones)) {
    if (coords.has(name) || !coords.has(zone)) continue;
    exact.set(name, zone);
    shared.delete(name);
  }
  const located = (map: Map<string, string>) => [...map]
    .filter(([name, target]) => !coords.has(name) && coords.has(target))
    .sort(([a], [b]) => a.localeCompare(b));
  const coordRows = (map: Map<string, [number, number]>) => [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zone, [lat, lon]]) => `  ${JSON.stringify(zone)}: [${lat}, ${lon}],`);
  const mapRows = (entries: [string, string][]) => entries.map(([name, target]) => `  ${JSON.stringify(name)}: ${JSON.stringify(target)},`);
  return [
    '// Generated from the IANA Time Zone Database zone1970.tab, zone.tab and',
    '// backward (public domain), and CLDR bcp47/timezone.xml (Unicode License).',
    `// Sources: ${TZDB}/ and ${CLDR}`,
    '// Refresh with: bun tools/build-tz-coords.ts',
    '',
    '// One reference city per distinct clock.',
    'export const TZ_COORDS = {',
    ...coordRows(clocks),
    '};',
    '',
    '// Countries\' own reference cities whose clock is listed above.',
    'export const TZ_CITY_COORDS = {',
    ...coordRows(cities),
    '};',
    '',
    '// Old names for the same place, mapped to the zone that replaced them.',
    'export const TZ_ALIASES = {',
    ...mapRows(located(exact)),
    '};',
    '',
    '// Other places, or bare clock names, that only share a zone\'s clock.',
    '// Their coordinates are a rough guess, not a location.',
    'export const TZ_SHARED_CLOCKS = {',
    ...mapRows(located(shared)),
    '};',
    '',
  ].join('\n');
}

async function download(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`);
  return response.text();
}

if (import.meta.main) {
  const [zone1970, zone, backward, cldr] = await Promise.all([
    `${TZDB}/zone1970.tab`, `${TZDB}/zone.tab`, `${TZDB}/backward`, CLDR,
  ].map(download));
  await Bun.write(OUTPUT, buildModule(zone1970, zone, backward, cldr));
  console.log(`Wrote ${OUTPUT.pathname}`);
}
