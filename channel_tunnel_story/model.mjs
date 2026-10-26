/** Pedagogical bearing-error model; NOT a reconstruction of the historical Eurotunnel survey. */
export const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
export function lateralErrorMeters(lengthKm, bearingErrorArcsec) {
  if (!Number.isFinite(lengthKm) || !Number.isFinite(bearingErrorArcsec) || lengthKm < 0 || Math.abs(bearingErrorArcsec) >= 324000)
    throw new RangeError("Expected non-negative finite distance and finite bearing error below 90 degrees");
  return lengthKm * 1000 * Math.tan(bearingErrorArcsec * ARCSEC_TO_RAD);
}
/** Approximate geographic portal locations, not survey-grade control points. */
export const PORTALS = Object.freeze({ uk:[1.1558,51.0971], fr:[1.7804,50.9228] });
/** Illustrative chord in plan view, NOT the surveyed three-bore alignment. */
export function illustrativeRoute(progress=1) {
  const p=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
  return [PORTALS.uk,[PORTALS.uk[0]+(PORTALS.fr[0]-PORTALS.uk[0])*p,PORTALS.uk[1]+(PORTALS.fr[1]-PORTALS.uk[1])*p]];
}
