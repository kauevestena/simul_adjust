// Module worker: runs the whole pipeline off the main thread and transfers typed arrays back.
import { simulate } from './model.mjs';

self.onmessage = ({ data }) => {
  const { job, params, geoidPatch, maxPoints } = data;
  try {
    const out = simulate(params, { geoidPatch, maxPoints });
    const buffers = [out.enu.buffer, out.disp.buffer, out.ppm.buffer, out.cls.buffer, ...(out.dg ? [out.dg.buffer] : []), ...Object.values(out.grid.fields).map(f => f.buffer)];
    self.postMessage({ job, out }, buffers);
  } catch (error) {
    self.postMessage({ job, error: String(error?.message || error) });
  }
};
