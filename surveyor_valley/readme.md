# Surveyor Valley

A gamified simulator of **planimetric surveying with a total station**, built for a
first-year Topografia course: no GNSS, no levelling, no altimetry. You walk a valley,
plant monuments, set the instrument up, sight boundary corners, close a traverse, and
deliver a **planta** and a **memorial descritivo** for six rural properties.

## Running it

```bash
cd surveyor_valley
python3 -m http.server 8080
# then open http://localhost:8080/
```

**Opening `index.html` directly from the file system will not work.** The game is
built from ES modules, which browsers refuse to load over `file://`. Any static
server will do (`npx serve .` works too). On GitHub Pages it just works — every path
in the project is relative.

**The first load needs a network.** The renderer is PixiJS, pulled from a CDN at an
exact pinned version with an SRI hash. A service worker then caches it along with every
app file, so every visit after the first works completely offline — which is the case
that matters in a classroom. If the first load fails you get a translated explanation
rather than a black canvas. For a genuinely air-gapped lab, drop the Pixi bundle at
`vendor/pixi.min.mjs` and `src/render/pixi.js` will prefer it without any other change.

A world is completely described by its seed, so a link can carry one:

```
index.html?seed=sv-3a9197&difficulty=facil&lang=en&start=1
```

Handy for giving a whole class the same valley to survey.

## Tests

```bash
node --test tests/
```

No `package.json`, no install, nothing to download: Node 20 runs ESM and has a test
runner built in. This works only because everything under `src/core/`, `src/survey/`,
`src/world/` and `src/game/` is free of the DOM — which is also why `tests/pipeline.test.mjs`
can drive an entire survey, from planting the first monument to reading the finished
memorial descritivo, without a browser.

- `tests/math.test.mjs` — azimuth convention, DMS round-trips and carrying, area by
  the shoelace formula, quadrant bearings, traverse closure and compensation, resection.
- `tests/world.test.mjs` — determinism, and the parcel topology that everything
  downstream depends on.
- `tests/pipeline.test.mjs` — a whole service, end to end, plus the documents it produces.
- `tests/persistence.test.mjs` — saving and resuming a campaign, and refusing a
  corrupt or future-version save rather than trusting it.
- `tests/offline.test.mjs` — the service worker's precache list matches the files on disk,
  and the PixiJS pin, its SRI hash and the cached URL all agree.
- `tests/render.test.mjs` — the art pipeline. Sprite painters are deterministic and
  outlined, the shading ramp shifts hue in the right direction for every base colour,
  ground chunks bake identically in slices as in one pass, and the camera never leaves
  the pixel grid. All DOM-free, because a sprite is a plain `{w, h, data}`.

## How it is put together

```
index.html          the only page
styles/             base, game, report (the print rules double as the offline PDF path)
src/
  core/     seeded RNG, value noise, planar geometry, the fixed-step loop, state, storage
  world/    terrain field, parcel topology, entities, spatial index, line of sight
  render/   camera, the pixel painter, sprite painters, atlas, ground baking, scene,
            plan view, effects
  audio/    synthesized ambience and sound effects — no audio files anywhere
  game/     player movement, input, tool gating, tutorial, the service orchestrator,
            the day clock and time limit, the economy
  survey/   units and DMS, azimuths and areas, instrument model, station, resection, traverse
  report/   the DrawList/DocBlocks document model, planta, memorial, preview, PDF
  ui/       i18n, modal, intro, HUD, toolbar, field book, computations
tests/
```

### Conventions worth knowing before changing anything

- **Coordinates are `(E, N)` in metres** on a local plane, and **azimuth is clockwise
  from North** — so it is `atan2(ΔE, ΔN)`, East first. This is the reverse of the usual
  `atan2(y, x)` and it is the single most common bug in survey code. It has its own test.
- **Truth and measurement are kept apart.** A monument has `trueE/trueN` — where it
  physically is — and `E/N`, what the player has surveyed. Only the surveyed values are
  ever shown; the gap between them is the player's score, revealed at the debrief.
- **Everything random flows through a named seeded stream**, so tuning the vegetation
  cannot move a parcel boundary, and the same seed replays the same measurements exactly.
- **Stroke width is `lw` on every drawing primitive, never `w`** — on a rectangle, `w`
  is the rectangle's width, and confusing the two strokes the sheet border with a 277 mm
  pen and floods the plan solid black.
- The generated documents always carry **"SIMULAÇÃO DIDÁTICA — SEM VALOR LEGAL"**.
  They deliberately imitate a legal instrument and must never be mistakable for one.
- **The art is 16 pixels per metre and is never scaled by a fraction.** Field zoom is
  restricted to integer multiples of that (16/32/48/64 screen px per metre) and the
  camera snaps to whole art pixels; both rules are enforced by tests. Scaling pixel art
  by 1.37 is what turns it back into mush. An entity's continuous `scale` is bucketed
  into one of three sizes that were *painted* at that size, rather than resized at draw
  time.
- **Ground detail is baked, never drawn as entities.** Ten thousand tufts of grass cost
  the same twenty chunk blits as bare dirt. Anything that must move goes in
  `render/effects.js`, which is budgeted at about eighty sprites.
- **Chunk baking is sliced and time-budgeted.** A chunk costs 15–30 ms; `pump()` spends
  at most 4 ms per frame on it. Never make the bake atomic — that was the original
  stutter.
- **Documents are not part of the game skin.** `styles/report.css` stays clean white
  paper on purpose; a planta that looks like a game UI is a worse teaching artefact.

### What the simulation actually models

Four distinct error sources, because that separation is what teaches. Three are random:

1. **Centring**, drawn once per *occupation* rather than per observation — which is why
   short sights hurt, and why the student can watch it appear in the residuals.
2. **Direction**, the instrument's arc-second precision plus a pointing term that grows
   on short sights.
3. **Distance**, the classic `a mm + b ppm` combined in quadrature.

The fourth is **systematic**, and the distinction is the whole point:

4. **Collimation** `c` — a fixed mechanical misalignment, the same on every reading from
   that instrument forever. Averaging a thousand readings on one face leaves it exactly
   where it was; one pair of faces removes it. Observing on both faces (PD/PI) is
   optional per sight, so a rushed single-face survey stays possible and is measurably
   worse, and the field book shows `2c = PD − (PI − 180°)` so the student can read off
   how far out the instrument is. The starting 10" instrument carries 22"; the 1" carries
   three.

The traverse is treated at the level the course teaches: angular closure against a
tolerance, equal distribution, azimuth propagation, linear closure, relative precision,
and a Bowditch or transit compensation — explicitly *not* a rigorous least-squares
adjustment, and the panel says so. Least squares appears in exactly one place where it
is warranted and self-contained: the free station, solved as a closed-form 2D Helmert
fit with no matrix library.

## Status

The full loop runs across all six properties: pick a job from the board, survey it,
close the traverse, deliver the planta and the memorial, get paid, and spend it on a
better instrument. Control left in the ground carries across to neighbouring jobs, and
the board shows how much of it each property can reuse. Progress is saved continuously
and the game offers to resume it.

**Every parcel is guaranteed to admit a closable traverse**, on every difficulty. World
generation ends by siting a ring of stations the way a surveyor would — spread around the
centroid, in bearing order so the polygon is simple — and clearing the fewest obstacles
that open one route, iterating until it converges. `tests/world.test.mjs` asserts it over
five seeds x three difficulties x six parcels, using the game's own `closableRing()`
rather than a copy of the logic. Difícil still carries 3.3x fácil's sight-blocking
obstacles, so the guarantee did not flatten it.

Only difícil runs a time limit. Running out **ends the job rather than voiding it**: the
documents are still produced and the fee is reduced on its own line in the payment
breakdown. Forty minutes of careful work destroyed by a timer punishes without teaching
anything.
