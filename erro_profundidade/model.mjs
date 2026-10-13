export const controls = {
  distance: [1, 100, .5, 10, 'm'], base: [.1, 20, .1, 2, 'm'],
  focal: [8, 200, 1, 24, 'mm'], sensor: [6, 54, .1, 36, 'mm'],
  width: [1000, 12000, 100, 6000, 'px'], sigma: [.1, 10, .1, 5, 'px']
};
export const defaults = Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,v[3]]));
// First-order propagation for a symmetric target, independent image measurements,
// exact camera poses and intrinsics. All returned lengths are metres.
export function evaluate(p) {
  for (const k of Object.keys(controls)) if (!Number.isFinite(p[k]) || p[k] <= 0) throw new RangeError(k);
  const {distance:z,base:b,focal:f,sensor:w,width:n,sigma:s}=p;
  const fpx=f*n/w, theta=Math.atan(b/(2*z)), range=Math.hypot(z,b/2);
  const parallel=Math.SQRT2*s*z*z/(fpx*b);
  return {fpx,theta,range,angle:2*theta*180/Math.PI,parallel,
    convergent:parallel*(1+b*b/(4*z*z)),pixelMicrons:w/n*1000,
    visibleParallel:f*b/(2*z)<=w/2, fov:2*Math.atan(w/(2*f))*180/Math.PI};
}
export function series(p) {
  return Array.from({length:40},(_,i)=>{const base=(i+1)*.5;return {base,...evaluate({...p,base})};});
}
