// Place full names near their markers without covering another name or marker.
export function layoutSkyLabels(points, bounds, measureText) {
  const gap = 4, labelHeight = 16;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const overlaps = (a, b) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
  const occupied = points.map(point => ({ x: point.x - 8, y: point.y - 8, width: 16, height: 16 }));
  return points.map(point => {
    const width = measureText(point.name), preferredY = point.y - 19;
    const xs = [...new Set([point.x + 12, point.x - width - 12, bounds.left, bounds.right - width]
      .map(x => clamp(x, bounds.left, bounds.right - width)))];
    const ys = [];
    for (let y = bounds.top; y <= bounds.bottom - labelHeight; y += labelHeight + gap) ys.push(y);
    ys.push(clamp(preferredY, bounds.top, bounds.bottom - labelHeight));
    ys.sort((a, b) => Math.abs(a - preferredY) - Math.abs(b - preferredY));
    let chosen = null, bestScore = Infinity;
    for (const y of ys) {
      for (const x of xs) {
        const box = { x, y, width, height: labelHeight };
        const collisions = occupied.filter(other => overlaps(box, other)).length;
        const score = collisions * 10000 + Math.hypot(x - (point.x + 12), y - preferredY);
        if (score < bestScore) { chosen = box; bestScore = score; }
      }
    }
    occupied.push(chosen);
    return { ...point, labelX: chosen.x, labelY: chosen.y + 12, width, height: labelHeight };
  });
}
