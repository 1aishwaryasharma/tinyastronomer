# Bright-star catalog

Derived from [HYG Database v4.1](https://github.com/astronexus/HYG-Database/tree/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg), by David Nash / Astronexus.
The catalog and this derived subset are licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); see LICENSE. The site's MIT license does not replace this data license.

Changes: omit the Sun (id 0); keep visual magnitude <= 4.5; retain only HYG ID, proper name, J2000 right ascension (hours), declination (degrees), visual magnitude and tangential proper motion (mas/year); sort by magnitude then ID; encode as a JavaScript array. There are 925 stars. Names and magnitudes are catalog values, not live measurements.

Regenerate from the pinned source with `python3 tools/build-star-catalog.py` from the repository root. The generator prints the source SHA256. No catalog download happens in a visitor's browser beyond this small local asset.

The renderer advances tangential proper motion from J2000, rotates into the observer's horizon of date (precession/nutation included), and applies standard refraction. Annual parallax, aberration, radial-velocity perspective effects, and variable-star brightness are omitted. This is a direction-finding chart, not precision astrometry. Symbol size and twilight fading are illustrative. The 360° panorama distorts sky shapes, especially near the zenith; it is not a camera view.
