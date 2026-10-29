/**
 * Illustrative storyboard: outside GNSS -> portal transfer -> moving optical traverse.
 * Everything here is synthetic and dimensionless, NOT historical chainage.
 * A fractional state makes *every* slider move have a visible effect.
 */
export const WALL_STATION_COUNT=7;
const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
export function surveySequenceAt(progress) {
  const p=clamp(progress);
  if(p<.12) {
    const surfaceProgress=clamp(p/.055);
    const transferProgress=clamp((p-.055)/.065);
    return {
      phase:'gnss-transfer',
      subphase:p<.055?'surface':'portal',
      progress:p,step:-1,stepProgress:0,
      surfaceProgress,transferProgress,
      instrument:-1,prism:-1,backsight:-1,reached:0,
      showOutsideGNSS:true,showPortalTransfer:p>=.055
    };
  }
  const segment=(1-.12)/(WALL_STATION_COUNT-1);
  const index=(p-.12)/segment;
  const step=Math.min(WALL_STATION_COUNT-2,Math.floor(index));
  const stepProgress=step===WALL_STATION_COUNT-2?clamp(index-step):index-step;
  return {
    phase:'wall-traverse',subphase:'underground',progress:p,step,stepProgress,
    surfaceProgress:1,transferProgress:1,
    instrument:step,prism:step+1,backsight:step?step-1:-1,
    reached:step+2,showOutsideGNSS:step===0,showPortalTransfer:step===0
  };
}
