const SOURCE = 'https://data.iana.org/time-zones/tzdb/zone1970.tab';
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

export function buildModule(tab: string): string {
  const entries = tab
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [, coordinate, zone] = line.split('\t');
      const [latitude, longitude] = parseIso6709(coordinate);
      return [zone, [Number(latitude.toFixed(2)), Number(longitude.toFixed(2))]] as const;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  const rows = entries.map(([zone, coordinate]) =>
    `  ${JSON.stringify(zone)}: [${coordinate[0]}, ${coordinate[1]}],`
  );
  return [
    '// Generated from the IANA Time Zone Database zone1970.tab (public domain).',
    `// Source: ${SOURCE}`,
    '// Refresh with: bun tools/build-tz-coords.ts',
    'export const TZ_COORDS = {',
    ...rows,
    '};',
    '',
  ].join('\n');
}

if (import.meta.main) {
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`Could not download zone1970.tab: ${response.status}`);
  await Bun.write(OUTPUT, buildModule(await response.text()));
  console.log(`Wrote ${OUTPUT.pathname}`);
}
