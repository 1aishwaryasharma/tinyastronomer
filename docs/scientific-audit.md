# tinyastronomer scientific audit

Audit date: 2026-08-16  
Scope: `public/index.html`, `public/data.js`, `public/seasons.html`, `public/scale-walk.html`, `public/sky-tonight.html`, `public/missions.html`, and `public/solar-system.html` at commit `5cd293b`  
Source policy: primary sources only (NASA, NASA/JPL, NOAA, USNO, and IAU)

## Executive summary

The site's core astronomy is strong, but its labels sometimes promise more fidelity than the models provide. The highest-priority changes are:

1. Correct the ocean-tide lesson. The two-bulge picture is an introductory equilibrium model; not every coast receives two high and two low tides, real highs are often unequal, and coastlines, seafloor shape, basin geometry, and local conditions strongly alter the result.
2. Replace the Grand Tour's August 2026 moon counts: Jupiter **115**, Saturn **293**, Uranus **29**, Neptune **16**. Always attach an “as of” date and a source because these counts change.
3. Stop calling the Sky Tonight calculation a result from each planet's “real orbit.” It uses fixed-radius circular, coplanar mean-orbit approximations and arbitrary visibility thresholds; it is an elongation sketch, not a local observing forecast.
4. Reserve “true scale” for a single consistent scale. The Grand Tour preserves planet-to-planet size ratios and orbit-to-orbit spacing ratios separately, but the planet-size scale is not the orbit-distance scale and the Sun remains enlarged. The Scale Walk uses average distances from the Sun, not current distances or current planet positions.
5. Replace “weight in kg” with Earth-relative gravity language. Kilograms measure mass, and the four giant planets have no solid surface. Their values refer to a conventional atmospheric/cloud-top reference level.
6. Make the generic comet either explicitly **Halley's Comet** or remove its 75-year orbit. Comet periods and rotations vary enormously.
7. Qualify the season dates, eclipse visibility and shadow speed, “exactly half-lit,” “planets don't twinkle,” and all live mission quantities.

The audit found no reason to change the site's child-friendly voice. Most corrections can stay short and concrete.

## Claim/status/source matrix

| Page | Status | Most consequential claim work | Primary source anchors |
|---|---|---|---|
| Light Study (`index.html`) | **Correct after qualification** | Replace the universal coastal-tide rule; narrow scale, eclipse, day/night, and aurora promises. | [NOAA tides](https://oceanservice.noaa.gov/facts/high-tide.html), [NASA Moon phases](https://science.nasa.gov/moon/moon-phases/), [NASA eclipses](https://eclipse.gsfc.nasa.gov/) |
| Shared catalog (`data.js`) | **Corrections required** | Gravity vs mass; giant-planet reference levels; current moon counts; Eris tilt/history; Halley vs generic comet; Sun rotation/plasma; Neptune color. | [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html), [NASA Solar System](https://science.nasa.gov/solar-system/solar-system-facts/), body-specific NASA pages |
| Seasons (`seasons.html`) | **Correct teaching model; limits required** | Circular/uniform orbit, approximate dates, sunlight vs weather, hemisphere wording. | [USNO seasons](https://aa.usno.navy.mil/data/Earth_Seasons), [USNO explanation](https://aa.usno.navy.mil/faq/seasons_orbit.html) |
| Scale Walk (`scale-walk.html`) | **Numbers pass; label is too strong** | Values are mean distances; bodies are not currently aligned; screen markers are enlarged. | [IAU astronomical unit](https://www.iau.org/static/resolutions/IAU2012_English.pdf), [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html) |
| Sky Tonight (`sky-tonight.html`) | **Not valid as a visibility forecast** | Circular mean-orbit elongation only; thresholds are editorial; no observer, horizon, brightness, twilight, or weather. | [JPL approximate positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html), [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), [USNO data services](https://aa.usno.navy.mil/data/) |
| Missions (`missions.html`) | **Mostly correct; volatile claims need dates** | Voyager reference/method; Ingenuity first; Webb L2 language; Huygens credit; Enceladus plume; New Horizons speed; Hubble count. | NASA mission pages and [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) |
| Grand Tour (`solar-system.html`) | **Correct relative periods; fidelity claims overstate** | Circular/coplanar non-current orbits; visual spin; selected moons; separate size/distance scales; Halley-like visitor. | [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html), [JPL satellites](https://ssd.jpl.nasa.gov/sats/), [NASA comet facts](https://science.nasa.gov/solar-system/comets/facts/) |

## Recommended fidelity and sourcing system

Use a visible one-line label close to each model, not only in a footer or repository README.

| Label | Meaning | Use here |
|---|---|---|
| **Measured fact** | A sourced physical measurement or current official count. | Planet radii, periods, gravity ratios, mission dates, moon counts. |
| **Geometry model** | Correct relationships are shown, while sizes, distances, time, or paths are simplified. | Light Study, Seasons, Grand Tour, Sky Tonight. |
| **Scale analogy** | Selected quantities share a declared scale; the scene may not. | Basketball-Sun Scale Walk. |

Every label should answer two questions: **What is preserved? What is changed?** Suggested compact patterns:

- **Geometry model · compressed** — “Tilts and period ratios are preserved; body sizes and distances are not.”
- **Introductory tide model · exaggerated** — “Shows equilibrium tidal forces; coastlines, seafloor shape, basin response, and local tide timing are omitted.”
- **Average-distance scale analogy** — “Object sizes and average distances from the Sun use one scale; the 3D planet markers are enlarged for visibility.”
- **Approximate elongation guide** — “Circular mean orbits; no observer location, horizon, brightness, twilight, weather, or precise ephemeris.”

For sources, add a compact “Sources · reviewed 2026-08-16” disclosure per study. For volatile numbers, put the date in the claim itself: “115 officially recognized moons (NASA/IAU, August 2026).” Link to the owning page, not a search result.

## `public/index.html` — Light Study

### Required corrections and qualifications

| Location | Current claim | Finding | Recommended wording |
|---|---|---|---|
| `index.html:1048` | “Distances are compressed, but the tilts and timing ratios are astronomical.” | Too broad. Earth–Moon size ratio, axial tilt, lunar inclination/eccentricity, and relative period ratios are represented, but the Sun's size, both distance scales, shadow geometry, object textures, and event timelines are independently altered. | “**Geometry model · compressed.** Earth's tilt, the Moon's orbital tilt and shape, and the day/month/year timing ratios are represented. Body sizes, distances, shadow paths, and event durations are changed so the system fits on screen.” |
| `index.html:1049` | The Sun is “enlarged so the whole system remains visible.” | The direction of the distortion depends on which quantities are compared: the Sun is drawn far too small relative to Earth, but too large relative to the heavily compressed Earth–Sun separation. | “The Sun's volume is about 1.3 million Earth volumes. Here it is drawn much smaller relative to Earth, but larger relative to the compressed Earth–Sun gap, so all three bodies remain visible.” |
| `index.html:1057` and initial panel | “exactly half of Earth is lit at any moment” / “only the half” | “Exactly” ignores the finite angular size of the Sun and atmospheric twilight/refraction. The intended hemisphere model is sound. | “At any moment, **roughly one half** of Earth faces the Sun. Twilight softens the boundary between day and night.” |
| `index.html:1058` | Opposite-side children are “fast asleep at midnight.” | Antipodes are about 12 hours apart in local solar time, but civil time zones, daylight-saving rules, longitude, latitude, and polar day/night make the statement unreliable; sleep is not a scientific consequence. | “Places on opposite sides of Earth are usually about 12 hours apart in local solar time: when one faces the Sun, the other faces away.” |
| `index.html:1094` | “every beach gets about two high tides and two low tides a day” | Incorrect. Most coasts have two, often unequal, highs and lows per lunar day; some have one. The site depicts an ideal equilibrium response, not coastal tides. [NOAA explains the three principal daily patterns and geographic controls.](https://oceanservice.noaa.gov/facts/high-tide.html) | “In an ideal ocean covering a smooth Earth, the Moon's tide-raising force produces two broad bulges. Many coasts have two high and two low tides in a lunar day, often of unequal height; some have only one. Real tides are reshaped by continents, water depth, coastline and seafloor geometry, and basin response.” |
| `index.html:1094` | At quarter moon, the Sun and Moon's “pulls fight.” | Misleading. Their tide-producing effects are approximately at right angles and partially offset; neither body's ordinary gravitational pull simply cancels the other. [NOAA's tide tutorial describes spring and neap configurations.](https://oceanservice.noaa.gov/education/tutorial_tides/lessons/ups_downs.html) | “When Sun, Earth, and Moon align, their tide-producing effects reinforce one another, creating spring tides. Near first and third quarter, those effects are at right angles and partly offset, creating neap tides.” |
| `index.html:1095` | “the real open-ocean bulge is only about a metre tall” and tides “run a little late” | The order of magnitude is defensible, but one global height and one small lag hide a dynamic wave response. Local ranges and phase lags vary greatly. Prefer the model-limit statement over a universal height. | “The height here is hugely exaggerated. Real tides travel as long waves through ocean basins, so their height and timing depend strongly on water depth, basin shape, coastlines, and local geography.” |
| `index.html:1115` | Anyone inside “that shadow” sees the Sun blocked. | A solar eclipse has penumbra, umbra, and sometimes antumbra; “blocked” can mean partial, total, or annular. The compressed size/distance model cannot predict path width or duration. | “The Moon's penumbra produces a partial eclipse. Its umbra produces a total eclipse, while an antumbra produces an annular eclipse. This compressed alignment model does not show a real path, width, or duration.” |
| `index.html:1116` | Shadow “races across Earth faster than 2,000 km/h.” | Shadow speed varies by eclipse and position along the path. NASA eclipse calculations show values that can be below or well above 2,000 km/h. [One NASA path calculation reaches 1.7 km/s.](https://eclipse.gsfc.nasa.gov/SEpubs/20010621/text/path-and-visibility.html) | “During a total solar eclipse, the Moon's shadow can sweep across Earth at **thousands of kilometres per hour**, with the speed changing along the path.” |
| `index.html:1131` | A lunar eclipse is “visible to anyone on Earth's night side.” | Too absolute. It is visible where the Moon is above the horizon during the event, subject to weather and obstruction. | “A lunar eclipse can be seen from the broad part of Earth's night side where the Moon is above the horizon.” |
| `index.html:1132` | Copper is “usually subtle.” | Eclipse color/brightness varies substantially with atmospheric dust and cloud along the refracted-light path. NASA's eclipse catalog documents dark gray through bright copper/orange appearances. [NASA lunar-eclipse appearance guide.](https://eclipse.gsfc.nasa.gov/LEcat5/appearance.html) | “Its color and brightness vary from eclipse to eclipse. Earth's atmosphere filters out more blue light and bends some remaining red-orange light into the shadow.” |
| `index.html:1147` | Oxygen and nitrogen make aurora glow “green, red, and violet.” | Process is broadly correct, but colors should be assigned more carefully: oxygen commonly produces green and red; nitrogen produces blue and pink, with mixtures appearing purple. [NASA aurora color guide.](https://science.nasa.gov/sun/auroras/) | “Collisions energize oxygen and nitrogen high in the atmosphere. Oxygen commonly glows green or red; nitrogen can glow blue or pink, and mixed light can look purple.” |
| `index.html:1147–1148` | Flare/CME-to-aurora sequence | Correct as a possible sequence, not a statement that every flare has an Earth-directed CME or every CME creates visible aurora. NOAA reports fast CME transit in as little as 14–17 hours and slower events taking several days. [NOAA SWPC CME guide.](https://www.swpc.noaa.gov/index.php/news/coronal-mass-ejections-cme-space-weather-phenomena) | Keep “can erupt alongside.” Add: “Only an Earth-directed disturbance with a favorable magnetic orientation can drive a strong geomagnetic storm.” |

### Claims checked and acceptable

- A mean solar day is 24 hours and Earth's obliquity is about 23.4°. Call the interval a **mean solar day**, not a “mean solar rotation”; Earth's sidereal rotation is about 23 hours 56 minutes. [USNO's seasons explanation gives 23.4° and the nearly fixed axis.](https://aa.usno.navy.mil/faq/seasons_orbit.html)
- The Moon's 27.3-day sidereal orbit, 29.5-day phase cycle, synchronous rotation, and libration are correct. [NASA Moon phases.](https://science.nasa.gov/moon/moon-phases/)
- New moon is required for a solar eclipse and full moon for a lunar eclipse; orbital inclination explains why neither happens every month. The production model should still be labeled as a geometry demonstration, not an eclipse predictor.
- The CME travel-time range and auroral-oval concept are sound when qualified as above. NASA describes solar-wind energy accumulating in Earth's magnetic environment and producing aurora. [NASA auroras overview.](https://science.nasa.gov/sun/auroras/)
- “1.3 million Earths by volume” is a sound rounded comparison. [NASA Sun facts.](https://science.nasa.gov/sun/facts/)

### Source disclosure to add

“Sources: [NASA Sun](https://science.nasa.gov/sun/facts/) · [NASA Moon phases](https://science.nasa.gov/moon/moon-phases/) · [NOAA tides](https://oceanservice.noaa.gov/education/tutorial_tides/) · [NASA eclipses](https://eclipse.gsfc.nasa.gov/) · [NOAA space weather](https://www.swpc.noaa.gov/) · reviewed 2026-08-16.”

## `public/data.js` — shared body catalog

This file supplies the visible Grand Tour and Scale Walk facts. Its radii, average distances, sidereal rotation periods, orbital periods, and gravity ratios are generally consistent at the displayed precision with [JPL's Planetary Physical Parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html) and NASA body pages.

### Cross-catalog corrections

| Claim family | Finding | Recommended treatment |
|---|---|---|
| “A 30 kg kid would weigh N kg” | Kilograms are units of mass; the child's mass remains 30 kg. The comparison is an Earth-calibrated scale reading. Jupiter, Saturn, Uranus, and Neptune have no solid surface. NASA explicitly notes this for [Jupiter](https://science.nasa.gov/jupiter/jupiter-facts/) and [Neptune](https://science.nasa.gov/neptune/neptune-facts/). | Rename the row **Gravity**. Use “Near the 1-bar cloud level, gravity is about 2.5× Earth's; you would feel as heavy as a 76 kg person feels on Earth.” For solid bodies: “Surface gravity is 0.38× Earth's; you would feel as heavy as an 11 kg person feels on Earth.” Add “This compares force, not mass.” |
| “N Earths could fit inside” | The values are volume ratios, not a claim that rigid spheres pack perfectly without gaps. | Use “Its volume is about N Earth volumes.” |
| “day” / “spin” | The catalog mixes sidereal rotation with ordinary solar-day language. This matters especially on Mercury and Venus. | Label all rotation values **sidereal spin**. Optionally add solar-day values separately: Mercury about 176 Earth days; Venus about 117 Earth days. |
| Moon totals | Volatile and currently stale for three planets. | Show “officially recognized/known moons, as of August 2026,” link the source, and review automatically or on a schedule. |

### Body-by-body findings

| Body | Status and required action | Primary source |
|---|---|---|
| Ceres | Core numbers and salt/water wording pass. “May hide salty water” is appropriately tentative. | [NASA Ceres facts](https://science.nasa.gov/dwarf-planets/ceres/facts/), [NASA Dawn at Ceres](https://science.nasa.gov/mission/dawn/science/ceres/) |
| Earth | “One spin takes 24 hours” should say **one mean solar day**; the stored `23.93` hours is the sidereal rotation. “Only place we know” and surface-ocean language pass. | [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html), [NASA Solar System facts](https://science.nasa.gov/solar-system/solar-system-facts/) |
| Eris | “Discovering it is what led scientists to invent the word dwarf planet” overstates and misstates the history. Eris's discovery reignited the classification debate; the IAU established the dwarf-planet category in 2006. Use: “Its discovery helped prompt astronomers to define the modern category ‘dwarf planet.’” The other public facts (about Pluto's size, 25.9-hour rotation, roughly 557–558-year orbit, Dysnomia) pass. `tiltDeg: 44` is not supported as axial tilt; about 44° is Eris's **orbital inclination**. Do not render it as a known spin-axis tilt unless a source for pole orientation is supplied. | [NASA Eris](https://science.nasa.gov/dwarf-planets/eris/), [JPL inclination definition](https://ssd.jpl.nasa.gov/glossary/inclination.html) |
| Jupiter | Update **101 → 115 officially recognized moons (August 2026)**. The Great Red Spot remains larger than Earth and has persisted for centuries, but it is shrinking; “about 1.3 Earth diameters wide” is more informative. | [NASA Jupiter moons](https://science.nasa.gov/jupiter/jupiter-moons/), [NASA Juno](https://science.nasa.gov/mission/juno/) |
| Mars | Numbers and Olympus Mons comparison pass at the site's precision. “Robots … right now” is volatile; either timestamp it or say “NASA's Curiosity and Perseverance rovers are operating on Mars as of August 2026.” | [NASA Mars facts](https://science.nasa.gov/mars/facts/), [NASA mission index](https://science.nasa.gov/mars/exploration/) |
| Mercury | 59 Earth days is its sidereal spin, not sunrise-to-sunrise. Its solar day is about 176 Earth days. The temperature explanation passes. | [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html), [NASA Mercury facts](https://science.nasa.gov/mercury/facts/) |
| Neptune | Sixteen moons and the >2,000 km/h wind claim pass. Replace “deep blue” everywhere: NASA notes that Voyager images were color-enhanced and reprocessing shows Uranus and Neptune have more similar, paler blue-green appearances. | [NASA Neptune facts](https://science.nasa.gov/neptune/neptune-facts/), [NASA Neptune moons](https://science.nasa.gov/neptune/moons/) |
| Pluto | Size, 6.4-day rotation, 248-year orbit, five moons, and mutual Pluto–Charon tidal locking pass. | [NASA Pluto facts](https://science.nasa.gov/dwarf-planets/pluto/facts/), [NASA Charon](https://science.nasa.gov/dwarf-planets/pluto/moons/charon/) |
| Saturn | Update **274 → 293 confirmed moons (August 2026)**. Density below water is true, but the bathtub line is a density thought experiment, not a possible experiment; Saturn has no surface and cannot be placed intact in water. | [NASA Saturn moons](https://science.nasa.gov/saturn/moons/), [NASA Saturn reference](https://science.nasa.gov/resource/saturn-rings-moons-3/) |
| Uranus | Update **28 → 29 known moons (August 2026)**. The roughly 21-year season statement passes as a quarter of its 84-year orbit; qualify it as a consequence of the planet's extreme tilt and use “each season,” not only summer/winter. | [NASA Uranus moons](https://science.nasa.gov/uranus/moons/), [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html) |
| Venus | 243 Earth days is the retrograde sidereal spin; the solar day is about 117 Earth days. “A year is shorter than its day” is true only when “day” means sidereal rotation, so say so. Hottest-planet and lead-melting claims pass. | [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html), [NASA Venus facts](https://science.nasa.gov/venus/venus-facts/) |
| Sun | Replace “hot gas” with **plasma**. “25 days” is the equatorial rotation only; the poles take about 36 days because the Sun rotates differentially. Volume, galactic year, planet count, and >99% mass statements pass. | [NASA Sun facts](https://science.nasa.gov/sun/facts/), [NASA Solar System facts](https://science.nasa.gov/solar-system/solar-system-facts/) |
| Comet | The card combines a generic comet with Halley's 75-year orbit and the Grand Tour uses Halley-like elements (`a=17.8 AU`, `e=0.966`, period about 75 years). Generic comets have periods from years to millions of years and diverse rotations. A dust tail can curve; the ion tail points most directly away from the Sun. | [NASA comet facts](https://science.nasa.gov/solar-system/comets/facts/) |

High-confidence comet wording if the modeled object stays as written:

> **Halley's Comet** — An icy body a few kilometres across. It circles the Sun about once every 76 years. Near the Sun, warming ice releases gas and dust, creating a coma and two main tails. Solar wind drives the ion tail directly away from the Sun; the broader dust tail also streams generally away but can curve along the orbit. **Geometry model:** the orbit is Halley-like; the nucleus and tail are enlarged enormously.

## `public/seasons.html` — Seasons

### Required corrections and qualifications

- The central explanation is correct: Earth's 23.4° obliquity and nearly fixed axis cause the hemispheres to receive changing sunlight angles and day lengths. Earth–Sun distance is not the cause of the annual seasons; Earth is in fact closest to the Sun in early January. Distance can modestly affect received solar energy but does not create the opposing hemispheric seasons. [USNO seasons and orbit.](https://aa.usno.navy.mil/faq/seasons_orbit.html)
- The model uses a circular orbit and constant angular speed. Earth's actual orbit is slightly elliptical, and the four astronomical seasons are not equal in length. Add: “**Geometry model:** circular orbit and uniform speed; Earth's small orbital eccentricity and unequal season lengths are omitted.”
- `monthAt()` hard-codes “Mar 21,” “Jun 21,” “Sep 23,” and “Dec 21.” Equinox and solstice date/time varies with year and timezone. Use month-only labels, “about March 20,” etc., or calculate for a stated year. USNO publishes exact annual instants and notes year-to-year variation. [USNO season data](https://aa.usno.navy.mil/data/Earth_Seasons), [USNO explanation](https://aa.usno.navy.mil/faq/seasons_orbit.html).
- Replace “northern half” / “southern half” with **Northern Hemisphere** / **Southern Hemisphere**.
- Replace “sunlight strikes it straight-on” with “sunlight strikes the Northern Hemisphere **more directly**.” At the June solstice, only the subsolar latitude near the Tropic of Cancer receives overhead Sun; an entire hemisphere is never illuminated straight-on. [NASA Sun and seasons activity.](https://assets.science.nasa.gov/content/dam/science/esd/eo/eokids/wp-content/uploads/sites/6/2019/04/16_SunSeasons-508.pdf)
- “Days grow longer and warmer” and similar copy is directionally useful, but temperature lags and depends on latitude, land/ocean, weather, and climate. “Receives more/less direct sunlight and longer/shorter daylight” is the modeled result; warmth is a downstream tendency, not an immediate universal output.
- The subsolar-latitude formula is appropriate for this circular conceptual model and correctly ranges between approximately ±23.4°.

Suggested visible label:

> **Geometry model · one idealized year** — Earth's 23.4° tilt and changing sunlight angle are shown. The orbit is circular, speed is uniform, dates are approximate, and weather/climate are not modeled.

Source disclosure: “[USNO seasons](https://aa.usno.navy.mil/data/Earth_Seasons) · [NASA seasons](https://science.nasa.gov/resource/seeing-equinoxes-and-solstices-from-space/) · reviewed 2026-08-16.”

## `public/scale-walk.html` — Scale Walk

### What is accurate

- Planet mean radii, mean orbital distances, AU-to-kilometre conversion, and mean-distance light times agree with JPL/NASA at the displayed precision. [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html), [NASA sizes and distances activity](https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/v/voyagescalemodelss.pdf).
- With a 24 cm Sun, Earth is about 2.2 mm wide and about 25.8 m from the Sun; Neptune is about 8.5 mm wide and about 775 m away. The rounded “26 m” and “nearly 800 m” statements pass.
- Sun diameter around 1.39 million km, about 109 Earth diameters, and >99% of Solar System mass all pass as rounded statements. [NASA Sun facts](https://science.nasa.gov/sun/facts/).

### Claims that need narrower labels

- “True distances,” “real distance,” and the canvas label “true-scale walk” imply current geometry. The code uses each planet's fixed semimajor-axis/mean distance and places all bodies on one straight radial path. Planets' actual Sun distances change along elliptical orbits, and they are not currently lined up.
- The visual planet radii use a square-root enlargement (`dispR`), so the 3D scene does **not** put object size and interplanetary distance on the same scale. Only the numerical basketball analogy does.
- “Distance … from the Sun” should read “**average distance from the Sun**.” “Light time” should read “**light time at average Sun distance**.” “Diameter” should say **mean diameter** where the catalog uses mean radius.
- The everyday object names are illustrative, while the stated millimetre values are the scientific comparison. Preserve the numeric value if a peppercorn/walnut/pea varies in real life.

Suggested visible label:

> **Average-distance scale analogy** — The basketball comparisons put planet diameters and average distances from the Sun on one scale. The 3D markers are enlarged, and the planets are arranged in a straight line rather than at current positions.

Source disclosure: “[JPL planetary parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html) · [NASA scale model](https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/v/voyagescalemodelss.pdf) · reviewed 2026-08-16.”

## `public/sky-tonight.html` — Sky Tonight

### Model audit

This page is the largest mismatch between promise and calculation.

The algorithm advances one mean longitude at a constant rate on a circular, coplanar orbit at fixed AU, then computes geocentric ecliptic elongation. It does not solve Kepler's equation; include eccentricity, inclination, nodes, or perihelia; use light-time corrections; use a precise ephemeris; or compute a topocentric horizon. The wording “worked out from its real orbit” is therefore incorrect.

JPL explicitly distinguishes lower-accuracy Keplerian formulae from high-precision integrated ephemerides. Even JPL's published approximation uses six time-varying orbital elements and solves Kepler's equation; Horizons supplies the high-precision result. [JPL approximate planet positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html), [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/).

A reproducible spot check at 2026-08-16 12:00 UTC illustrates the impact:

| Planet | Site elongation | JPL Horizons geocentric solar elongation | Difference |
|---|---:|---:|---:|
| Mercury | 15.3° | 11.6° | 3.7°; crosses the site's own 12° “hidden” threshold |
| Mars | 59.1° | 50.3° | 8.8° |
| Jupiter | 18.7° | 13.3° | 5.4° |

The Horizons comparison used observer center `500` (geocenter), quantity 23 (Sun–observer–target angle), and the timestamp above. It is a verification sample, not a full accuracy bound.

### Required copy changes

| Current claim | Finding | Recommended wording |
|---|---|---|
| “Which ones can I see?” / metadata “showing which planets are visible” | Without location, local time, horizon, altitude, brightness, twilight, obstructions, or weather, the page cannot determine visibility. | Rename the promise “Which planets are near or far from the Sun?” or “Approximate planet geometry.” |
| “worked out from its real orbit” | False for the implemented circular mean-orbit model. | “estimated from a simplified circular mean-orbit model.” |
| `<12° = hidden` | Editorial rule, not a universal visibility boundary. Mercury/bright Venus can behave differently; latitude, season, and twilight matter. | “Very near the Sun in this model; likely lost in twilight. This is not a local visibility test.” |
| `>150° = all night` | Only exact/near opposition supports all-night visibility, and rise/set still depends on date/location. 150° can mean “much of the night,” not all night. | “Far from the Sun in our sky; may be visible for much of the night.” |
| East of Sun = “west after sunset”; west = “east before dawn” | Broadly correct as a geometry teaching rule, but not a guarantee of altitude or visibility. | Add “when it is high and bright enough from your location.” |
| Uranus `naked:false` → “Needs a telescope” | Too absolute. NASA says Uranus is barely visible to excellent unaided eyesight under dark skies when its location is known; binoculars/telescope are recommended. Neptune requires a telescope. | Uranus: “Optical aid recommended.” Neptune: “Telescope required.” [NASA skywatching tips.](https://science.nasa.gov/skywatching/) |
| “it doesn't twinkle the way stars do” | Planets usually twinkle **less** because their disks average atmospheric fluctuations; near the horizon they can twinkle. | “Planets usually glow more steadily than stars, though they can twinkle when low in turbulent air.” [NASA explanation.](https://science.nasa.gov/solar-system/skywatching/whats-up-june-2024-skywatching-tips-from-nasa/) |

NASA notes that useful visibility depends on height above the horizon and twilight, while brightness changes as Earth and the planets move. [NASA planetary alignments guide](https://science.nasa.gov/solar-system/skywatching/planetary-alignments-and-planet-parades/). USNO and JPL services accept an observer location for rise/set or topocentric ephemerides. [USNO data services](https://aa.usno.navy.mil/data/), [JPL Horizons tutorial](https://ssd.jpl.nasa.gov/horizons/tutorial.html).

Suggested visible label if the present algorithm remains:

> **Approximate elongation guide** — Circular mean orbits show whether a planet lies east or west of the Sun. This is not a local sky forecast: precise orbit, observer location, horizon, brightness, twilight, weather, and obstructions are omitted.

Source disclosure: “[JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) · [NASA skywatching](https://science.nasa.gov/skywatching/) · reviewed 2026-08-16.”

## `public/missions.html` — Missions

### Mission cards

| Mission | Finding | Recommended change/source |
|---|---|---|
| Voyager 1 & 2 | Interstellar-space and Golden Record claims pass. “About 24 hours” is a rounded, date-sensitive **one-way Earth–spacecraft light time**; NASA says Voyager 1 reaches one light-day from Earth on 2026-11-18. The page's counter is instead a linear estimate of **Sun distance** from a hard-coded epoch and speed. Its `25.4 billion km` start is about **79.8 million km too high** against JPL Horizons' 2026-01-01 heliocentric distance of 25,320,225,956 km, before accounting for rounding. | “As of August 2026, a one-way radio signal takes almost 24 hours. NASA expects Voyager 1 to reach one light-day from Earth on Nov. 18, 2026.” For the counter, use the JPL epoch value and radial rate (~16.8825 km/s), label it “linear estimate of distance from the Sun,” and expose the epoch/method, or link to NASA's tracker. [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), [NASA Voyager current position](https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/) |
| Perseverance / Ingenuity | Jezero ancient-lake, sample, and size claims pass. The aviation first should be “first **powered, controlled** flight on another planet.” Ingenuity's mission ended in January 2024, so keep past tense. | [NASA Perseverance highlights](https://science.nasa.gov/mission/mars-2020-perseverance/science-highlights/), [NASA Ingenuity](https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/) |
| Webb | “Parked” is misleading: Webb orbits the Sun and also follows a halo orbit around Sun–Earth L2 about 1.5 million km from Earth. “Sees heat (infrared) light” should be “observes primarily infrared light; some infrared is emitted as heat.” >13-billion-year-old light passes. | [NASA Webb orbit](https://science.nasa.gov/mission/webb/orbit/), [NASA Webb FAQ](https://science.nasa.gov/mission/webb/faqs-full/) |
| Cassini-Huygens | Thirteen years at Saturn, Enceladus plumes, Titan descent, and final plunge pass. Credit Huygens as ESA's probe and describe the plumes as water vapor and icy particles rather than liquid-water “fountains.” | [NASA Cassini mission](https://science.nasa.gov/mission/cassini/about-the-mission/), [NASA Huygens](https://science.nasa.gov/mission/cassini-huygens/) |
| New Horizons | Piano size, nine-year journey, 2015 first close-up, and heart-shaped region pass. Use roughly 49,600–50,000 km/h at Pluto and name the heart's major plain as nitrogen-ice Sputnik Planitia. | [NASA New Horizons](https://science.nasa.gov/mission/new-horizons/), [NASA Pluto facts](https://science.nasa.gov/dwarf-planets/pluto/facts/) |
| Parker Solar Probe | “Touch the Sun” is NASA's defined shorthand for crossing into the corona; record-close and heat-shield claims pass. | [NASA Parker Solar Probe](https://science.nasa.gov/mission/parker-solar-probe/) |
| Apollo 11 | First Moon walkers, two on surface/one in orbit, and 1969 pass. Footprints “could last millions of years” is acceptable only as a probabilistic claim; impacts and micrometeorite gardening eventually alter them. | [NASA Apollo 11 history](https://science.nasa.gov/solar-system/moon/history-of-lunar-exploration/), [NASA/NSSDC Apollo 11](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo11.html) |
| Hubble | School-bus scale, low-Earth orbit, 1990 launch, and >1.7 million observations pass as of the audit. The age phrase should automatically age or use “since 1990.” | [NASA Hubble by the numbers](https://science.nasa.gov/mission/hubble/overview/hubble-by-the-numbers/), [NASA Hubble operations](https://science.nasa.gov/mission/hubble/observatory/science-operations/) |

### Live-data policy

Mission ages, observation totals, activity status, distances, speeds, and signal times need one of:

1. a source API/ephemeris with displayed retrieval time;
2. a clearly labeled estimate with epoch, reference body, method, and uncertainty; or
3. static copy with an explicit “as of YYYY-MM-DD.”

The current Voyager display combines a Sun-distance extrapolation, an Earth-distance signal-time sentence, and “Right now,” which implies a precision the counter does not have.

Source disclosure: link each card to its official NASA mission page rather than a single undifferentiated source footer.

## `public/solar-system.html` — Grand Tour

This page inherits all factual corrections in `data.js` and adds important model-fidelity issues.

### Required model-label changes

- The metadata promises “real orbits,” but planet paths are circular and coplanar, average orbital radii are used, and initial phases are arbitrary (`phase0 = i * 0.9`). Relative orbital periods are represented; current positions, eccentricity, inclination, nodes, apsides, and perturbations are not.
- The visible spin animations are illustrative. Their rates are clamped and do not complete one rotation per stored `rotationHours`; they should not be described as physical time alongside the orbit animation.
- Only a curated sample of major moons is drawn. Moon sizes, planet distances, and orbital planes are display-scaled. Make clear that the numeric moon count and the visible moon markers are different things.
- “True Scale” is not a single true scale. At full toggle, planet radii are proportional to each other and orbit radii are proportional to AU, but those two scales differ enormously; the Sun stays far too large relative to both. The existing parenthetical admits enlargement while the headline still says true scale.
- The Sun is called “the centre of everything” in the tour. Use “the center of our Solar System” or “the star at the center of our planetary system.” The Solar System itself orbits the Milky Way and the Sun moves around the Solar System barycenter.
- Replace “deep-blue Neptune” in the tour and quiz with “blue-green Neptune” or “the farthest, windiest planet.” [NASA explains the revised color interpretation.](https://science.nasa.gov/neptune/neptune-facts/)
- The comet is numerically and geometrically Halley-like. Name it Halley's Comet or generalize both the orbit and 75-year card as described under `data.js`.
- The comet tail is visible at every orbital distance in the rendering, but real comae/tails develop when solar heating becomes strong enough; far from the Sun the nucleus is inactive and extremely faint. [NASA comet facts.](https://science.nasa.gov/solar-system/comets/facts/)

Suggested mode names:

- **Teaching view** — “Planet sizes and orbit spacing are compressed independently; positions are illustrative.”
- **Relative-size + relative-distance view** — “Planet-to-planet size ratios and orbit-to-orbit spacing ratios are shown separately. Planets, moons, and the Sun remain enlarged relative to orbital distance.”

Suggested persistent label:

> **Geometry model · animated** — Average orbit sizes and relative orbital periods are represented. Orbits are circular and coplanar, starting positions are illustrative, rotations are visual, and only selected moons are drawn.

Source disclosure: “[JPL planetary parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html) · [JPL satellites](https://ssd.jpl.nasa.gov/sats/) · [NASA Solar System](https://science.nasa.gov/solar-system/solar-system-facts/) · body-specific NASA pages · reviewed 2026-08-16.”

## Source maintenance checklist

- Review official moon totals monthly or remove exact totals from evergreen copy.
- Review active-mission status, Hubble observations, rover status, Voyager time/distance, and “right now” language at least quarterly.
- Put the review date in the rendered UI, not only source comments.
- Prefer JPL Solar System Dynamics/Horizons for physical parameters and ephemerides; use NASA Science body pages for child-readable context; NOAA for tides and operational space weather; USNO for season instants and rise/set definitions; IAU/MPC for new satellite confirmations and nomenclature.
- When two first-party pages disagree, cite the dated value being shown and record the retrieval date. NASA's August 2026 moon-page headings and some older tables on the same pages are currently internally inconsistent, which reinforces the need for timestamps and a single declared source-of-truth field.

## Priority implementation order

1. Tides copy and fidelity label.
2. Sky Tonight promise, caveat, thresholds, and model label.
3. Moon totals plus “as of August 2026.”
4. Weight/gravity terminology and giant-planet reference level.
5. Grand Tour and Scale Walk scale/orbit labels.
6. Generic-comet/Halley correction; Eris axial-tilt removal.
7. Seasons date/direct-sun qualifications.
8. Mission timestamps and Voyager labeling.
9. Remaining wording polish: Neptune color, solar differential rotation/plasma, twinkling, eclipse visibility/speed, and aurora colors.
