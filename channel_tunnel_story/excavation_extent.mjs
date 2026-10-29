/**
 * Dimensionless excavation storyboard for the conceptual Channel Tunnel scene.
 * x in [-10,10] describes an illustrative model axis, not historical chainage.
 * The service tunnel is bored first; the two running tunnels start slightly later.
 */
const clamp=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;

export function driveExtentAt(progress,bore=1) {
  const p=clamp(progress);
  const effective=bore===1?p:clamp((p-.16)/.84);
  return .5*effective;
}

export function remainingRockAt(progress,bore=1) {
  const extent=driveExtentAt(progress,bore);
  const left=-10+20*extent;
  const right=10-20*extent;
  const width=Math.max(0,right-left);
  return {left,right,width,center:(left+right)/2,closed:width<1e-8,extent};
}
