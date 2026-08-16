// Sound, synthesized.
//
// Not one byte of audio is shipped. Every footstep, chime and bird is built
// from oscillators and filtered noise at runtime, which keeps the "no binary
// assets" rule intact and costs about two hundred lines.
//
// Two reasons this earns its place rather than being decoration:
//
//   * A silent simulator feels like a form. The thunk of a monument going into
//     the ground and the chime when an observation lands are the difference
//     between operating a spreadsheet and doing a job.
//   * Sound carries information the screen cannot. Footsteps change with the
//     soil you are standing on, so you hear that you have walked onto marsh
//     before you look down and find the tripod refuses to stand.
//
// Nothing starts until a real user gesture (the intro modal's button), so no
// autoplay policy is ever violated and the tab never makes noise unbidden.

const AMBIENT_KEY = 'sv.audio';

/** A pentatonic scale, in semitones from the root. Nothing can sound wrong. */
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];
const ROOT_HZ = 220; // A3

/** Soil id -> how a boot sounds on it. */
const FOOTSTEP = {
  PASTO: { cut: 2400, q: 0.9, gain: 0.055, decay: 0.075 },
  CAMPO_SUJO: { cut: 3000, q: 0.8, gain: 0.06, decay: 0.09 },
  SOLO_EXPOSTO: { cut: 1100, q: 1.4, gain: 0.07, decay: 0.055 },
  LAVOURA: { cut: 900, q: 1.6, gain: 0.075, decay: 0.07 },
  AREIA: { cut: 5200, q: 0.6, gain: 0.05, decay: 0.11 },
  ROCHA: { cut: 1800, q: 3.2, gain: 0.08, decay: 0.045 },
  BREJO: { cut: 700, q: 2.4, gain: 0.09, decay: 0.14 },
  AGUA: { cut: 800, q: 2.0, gain: 0.09, decay: 0.16 },
};

export function makeAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuffer = null;
  let started = false;
  let ambientTimer = null;
  let birdTimer = null;

  let settings = load();

  function load() {
    try {
      const raw = localStorage.getItem(AMBIENT_KEY);
      if (raw) return { muted: false, music: true, ...JSON.parse(raw) };
    } catch {
      // Private mode, or a corrupt value. Defaults are fine.
    }
    return { muted: false, music: true };
  }

  function save() {
    try {
      localStorage.setItem(AMBIENT_KEY, JSON.stringify(settings));
    } catch {
      // Not being able to remember the setting is not worth breaking over.
    }
  }

  /**
   * Build the graph. Must be called from a user gesture.
   * @returns {boolean} whether audio is available at all
   */
  function start() {
    if (started) return true;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;

    try {
      ctx = new AC();
    } catch {
      return false;
    }

    master = ctx.createGain();
    master.gain.value = settings.muted ? 0 : 0.9;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = settings.music ? 0.14 : 0;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.85;
    sfxGain.connect(master);

    // One second of white noise, reused for every percussive sound.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    started = true;
    scheduleAmbient();
    scheduleBirds();
    return true;
  }

  const now = () => ctx.currentTime;
  const ok = () => started && ctx && ctx.state !== 'closed' && !settings.muted;

  /** A filtered noise burst: footsteps, thunks, anything percussive. */
  function noise({ cut = 1500, q = 1, gain = 0.06, decay = 0.08, type = 'bandpass', dest = null }) {
    if (!ok()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = cut;
    filt.Q.value = q;

    const g = ctx.createGain();
    const t = now();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    src.connect(filt).connect(g).connect(dest || sfxGain);
    src.start(t);
    src.stop(t + decay + 0.02);
  }

  /** A pitched blip. `curve` bends the pitch over its life. */
  function tone({ freq = 440, type = 'sine', gain = 0.12, attack = 0.005, decay = 0.25, bend = 0, delay = 0, dest = null }) {
    if (!ok()) return;
    const t = now() + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + decay);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    osc.connect(g).connect(dest || sfxGain);
    osc.start(t);
    osc.stop(t + decay + 0.03);
  }

  const semi = (n) => ROOT_HZ * Math.pow(2, n / 12);

  // ---- ambience -----------------------------------------------------------

  /**
   * A slow pad that re-voices every few seconds. Two notes from the pentatonic
   * set, so consecutive voicings can never clash however they overlap.
   */
  function scheduleAmbient() {
    clearTimeout(ambientTimer);
    if (!started) return;

    const play = () => {
      if (ok() && settings.music) {
        const base = PENTATONIC[Math.floor(Math.random() * 4)];
        for (const step of [base, base + PENTATONIC[2 + Math.floor(Math.random() * 3)]]) {
          tone({
            freq: semi(step) / 2,
            type: 'triangle',
            gain: 0.09,
            attack: 1.6,
            decay: 5.5,
            dest: musicGain,
          });
        }
      }
      ambientTimer = setTimeout(play, 6500 + Math.random() * 4000);
    };
    ambientTimer = setTimeout(play, 800);
  }

  /** Birdsong: two or three quick descending chirps, at random intervals. */
  function scheduleBirds() {
    clearTimeout(birdTimer);
    if (!started) return;

    const sing = () => {
      if (ok() && settings.music) {
        const n = 2 + Math.floor(Math.random() * 3);
        const top = 1800 + Math.random() * 1400;
        for (let i = 0; i < n; i++) {
          tone({
            freq: top * (1 - i * 0.06),
            type: 'sine',
            gain: 0.045,
            attack: 0.008,
            decay: 0.1,
            bend: 0.72,
            delay: i * 0.13,
            dest: musicGain,
          });
        }
      }
      birdTimer = setTimeout(sing, 4000 + Math.random() * 9000);
    };
    birdTimer = setTimeout(sing, 2500);
  }

  // ---- the vocabulary -----------------------------------------------------

  let stepPhase = 0;

  return {
    start,

    get available() {
      return started;
    },
    get muted() {
      return settings.muted;
    },
    get musicOn() {
      return settings.music;
    },

    setMuted(v) {
      settings.muted = Boolean(v);
      save();
      if (master) master.gain.value = settings.muted ? 0 : 0.9;
    },

    setMusic(v) {
      settings.music = Boolean(v);
      save();
      if (musicGain) musicGain.gain.value = settings.music ? 0.14 : 0;
    },

    /**
     * A footstep on the given soil. Alternating slightly in pitch, because two
     * identical footsteps in a row is the most obvious tell in game audio.
     */
    step(soilId = 'PASTO') {
      const s = FOOTSTEP[soilId] || FOOTSTEP.PASTO;
      stepPhase ^= 1;
      noise({ ...s, cut: s.cut * (stepPhase ? 1 : 0.82) });
    },

    /** A monument driven into the ground. */
    thunk() {
      noise({ cut: 260, q: 1.1, gain: 0.22, decay: 0.16, type: 'lowpass' });
      tone({ freq: 150, type: 'sine', gain: 0.14, decay: 0.2, bend: 0.6 });
    },

    /** An observation recorded. Bright, short, unmistakably a success. */
    chime() {
      tone({ freq: semi(12), type: 'sine', gain: 0.13, decay: 0.22 });
      tone({ freq: semi(16), type: 'sine', gain: 0.1, decay: 0.3, delay: 0.05 });
    },

    /** The instrument being levelled and set up. */
    setup() {
      noise({ cut: 3200, q: 4, gain: 0.05, decay: 0.12 });
      tone({ freq: semi(7), type: 'triangle', gain: 0.1, decay: 0.28, delay: 0.08 });
      tone({ freq: semi(12), type: 'triangle', gain: 0.08, decay: 0.34, delay: 0.16 });
    },

    /** A refused action. Low and flat — a "no", not a punishment. */
    reject() {
      tone({ freq: 190, type: 'square', gain: 0.055, decay: 0.11, bend: 0.75 });
    },

    /** A sight line blocked by something. */
    blocked() {
      noise({ cut: 500, q: 2.5, gain: 0.09, decay: 0.13 });
      tone({ freq: 140, type: 'sawtooth', gain: 0.045, decay: 0.16, bend: 0.7 });
    },

    /** Payment. The oldest trick in the genre, and it still works. */
    kaching() {
      tone({ freq: semi(19), type: 'sine', gain: 0.14, decay: 0.14 });
      tone({ freq: semi(24), type: 'sine', gain: 0.12, decay: 0.4, delay: 0.09 });
      noise({ cut: 6000, q: 1.2, gain: 0.05, decay: 0.25 });
    },

    /** A traverse that closed inside tolerance. Worth a small fanfare. */
    fanfare() {
      [0, 4, 7, 12].forEach((step, i) => {
        tone({ freq: semi(step + 12), type: 'triangle', gain: 0.12, decay: 0.45, delay: i * 0.1 });
      });
    },

    /** A job delivered. */
    complete() {
      [0, 7, 12, 16, 19].forEach((step, i) => {
        tone({ freq: semi(step + 12), type: 'sine', gain: 0.11, decay: 0.6, delay: i * 0.13 });
      });
    },

    /** Interface click. */
    click() {
      noise({ cut: 2600, q: 3, gain: 0.03, decay: 0.035 });
    },

    /** Suspend on tab-hide; the browser will otherwise keep the graph running. */
    setActive(active) {
      if (!started || !ctx) return;
      if (active && ctx.state === 'suspended') ctx.resume();
      else if (!active && ctx.state === 'running') ctx.suspend();
    },
  };
}
