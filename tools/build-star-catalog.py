"""Generate the locally served HYG bright-star subset. Run with Python 3."""
import csv
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen

COMMIT = 'c7f7f883fe678cc7680169a50ccd7dcc49b060ce'
URL = f'https://raw.githubusercontent.com/astronexus/HYG-Database/{COMMIT}/hyg/CURRENT/hygdata_v41.csv'
source = urlopen(URL).read()
rows = csv.DictReader(io.StringIO(source.decode()))
stars = []
for row in rows:
    if row['id'] == '0' or not row['mag'] or float(row['mag']) > 4.5:
        continue
    stars.append([int(row['id']), row['proper'], float(row['ra']), float(row['dec']),
                  float(row['mag']), float(row['pmra'] or 0), float(row['pmdec'] or 0)])
stars.sort(key=lambda star: (star[4], star[0]))
root = Path(__file__).resolve().parent.parent
header = '// HYG v4.1 subset, David Nash / Astronexus, CC BY-SA 4.0. See assets/stars/README.md.\n'
header += '// Fields: HYG id, proper name, J2000 RA (hours), Dec (degrees), V magnitude, pmRA*cosDec, pmDec (mas/year).\n'
(root / 'public/assets/stars/catalog.js').write_text(header + 'export const STAR_CATALOG = ' + json.dumps(stars, separators=(',', ':')) + ';\n')
print(f'{len(stars)} stars; source SHA256 {hashlib.sha256(source).hexdigest()}')
