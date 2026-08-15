export const INNER_FRAME_PADDING = 1.75;
export const RELAXED_SYSTEM_RADII = 6.0;

export function advanceTrackedCoordinate(current, desired, previousDesired, blend, focusChanged) {
  const motionCompensated = focusChanged
    ? current
    : current + desired - previousDesired;
  return motionCompensated + (desired - motionCompensated) * blend;
}

export function updatedAutomaticDistance(
  currentDistance,
  previousAutomaticDistance,
  desiredAutomaticDistance,
  tolerance = 0.01
) {
  if (previousAutomaticDistance == null) return null;
  return Math.abs(currentDistance - previousAutomaticDistance) <= tolerance
    ? desiredAutomaticDistance
    : null;
}

export function limitingHalfFov(verticalFovDegrees, aspect) {
  const verticalHalfFov = verticalFovDegrees * Math.PI / 360;
  return Math.atan(Math.tan(verticalHalfFov) * Math.min(aspect, 1));
}

export function fitSphereDistance(radius, verticalFovDegrees, aspect, padding) {
  return radius * padding / Math.sin(limitingHalfFov(verticalFovDegrees, aspect));
}

export function sunAndPlanetFrame({
  aspect,
  planetRadius,
  separation,
  sunRadius,
  verticalFovDegrees
}) {
  const centerFromSun = (separation + planetRadius - sunRadius) * 0.5;
  return {
    distance: fitSphereDistance(
      (separation + planetRadius + sunRadius) * 0.5,
      verticalFovDegrees,
      aspect,
      INNER_FRAME_PADDING
    ),
    targetFraction: Math.max(0, Math.min(centerFromSun / separation, 1))
  };
}

export function relaxedPlanetDistance({
  aspect,
  hasRings,
  moonExtent,
  planetRadius,
  verticalFovDegrees
}) {
  const systemExtent = planetRadius * Math.max(
    RELAXED_SYSTEM_RADII,
    hasRings ? 2.4 : 0,
    moonExtent
  );
  const fitted = fitSphereDistance(systemExtent, verticalFovDegrees, aspect, 1.08);
  return Math.max(7, Math.min(fitted, 80));
}
