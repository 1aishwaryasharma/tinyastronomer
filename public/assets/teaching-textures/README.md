# Illustrative planet textures

These WebP images were rendered once from the deterministic planetTexture
functions in tour-textures.js at commit 9182686, using the matching data.js
body definitions, at 2048 × 1024 and WebP quality 0.9. They replace thousands
of canvas gradient operations during page startup. Original code and these
illustrative textures are MIT licensed. They are teaching illustrations,
not scientific surface maps. Eris, Haumea and Makemake have no image here:
`surfaceMap: false` in data.js draws each as a plain globe in its `dot` color.
Grand Tour continues to load NASA models when a planet is selected.
