const math = require('/home/kaue/tests/simul_adjust/node_modules/mathjs'); // if available, or just test Array.map
const Qxx = [[1, 2], [3, 4]];
const sigma02 = 1.5;
const Qxx_arr = typeof Qxx.toArray === 'function' ? Qxx.toArray() : Qxx;
const SigmaXa = Qxx_arr.map(row => row.map(v => v * sigma02));
console.log("Length:", SigmaXa.length);
console.log(SigmaXa);
