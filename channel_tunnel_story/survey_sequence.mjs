/**
 * Synthetic teaching storyboard, NOT Eurotunnel as-built chainage or surveyed stations.
 * The transfer begins at an outside GNSS receiver (satellite coverage ends at portal).
 * Subsequent observations are terrestrial wall-mounted total-station/prism setups.
 */
export const WALL_STATION_COUNT=7;
export function surveySequenceAt(progress) {
  const p=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
  const transfer=p<0.12;
  if(transfer) return {phase:'gnss-transfer',step:-1,instrument:-1,prism:-1,backsight:-1,
    reached:0,showOutsideGNSS:true,showPortalTransfer:true};
  const step=Math.min(WALL_STATION_COUNT-2,Math.floor((p-0.12)/((1-0.12)/(WALL_STATION_COUNT-1))));
  return {
    phase:'wall-traverse',step,instrument:step,prism:step+1,backsight:step?step-1:-1,
    reached:step+2,showOutsideGNSS:step===0,showPortalTransfer:step===0
  };
}
