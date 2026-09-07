# Earth textures

The surface and city-light maps are credited in the project README.

clouds-1k.png is an unchanged copy of earth_clouds_1024.png from the MIT-licensed three.js r185 examples:
https://raw.githubusercontent.com/mrdoob/three.js/r185/examples/textures/planets/earth_clouds_1024.png
Downloaded 2026-09-04. RGBA color texture; alpha supplies cloud coverage.
Cloud motion and altitude are visual aids, not a current weather observation.

lights-2k.webp is a lossless WebP encoding of the previously bundled lights-2k.png.
Decoded RGBA pixels were verified identical; the file is 306,308 bytes instead
of 410,160 bytes. The original imagery credit remains in the project README.

home-preview.webp is a capture of the site's Earth renderer at 922 × 912,
encoded as WebP quality 0.9. The home deck displays it before a study opens.
The same NASA/three.js imagery credits apply.

day-2k.webp is a 2048 × 1024 downsample of day-4k.jpg using Lanczos resampling
and WebP quality 90. The small globes in Seasons, Scale Walk, and Grand Tour
use it; the close-up Light Study retains the 4K day map.
