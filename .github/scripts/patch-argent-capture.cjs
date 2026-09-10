const fs = require('node:fs');
const path = require('node:path');

// Electron 33 can retain the quarter-scale compositor surface after Argent's
// readiness capture, leaving subsequent snapshots blank or partially scaled.
// Keep readiness captures at native scale; retain all pixel-idle checks.
const root = process.argv[2];
if (!root) throw new Error('Pass the installed @swmansion/argent directory');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (version !== '0.21.0') throw new Error(`Re-evaluate capture workaround for Argent ${version}`);
const file = path.join(root, 'dist/tool-server.cjs');
const source = fs.readFileSync(file, 'utf8');
const before = 'clip: { x, y, width, height, scale: CAPTURE_SCALE }';
const after = 'clip: { x, y, width, height, scale: 1 /* tinyastronomer: native capture */ }';
if (source.includes(after) && !source.includes(before)) process.exit(0);
if (source.split(before).length !== 2) throw new Error('Unexpected Argent capture implementation');
fs.writeFileSync(file, source.replace(before, after));
console.log('Applied Argent 0.21.0 native-scale readiness capture workaround');
