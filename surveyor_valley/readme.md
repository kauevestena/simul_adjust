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
- `tests/movement.test.mjs` — walking: the speed ramps, the turn, and the slide along a
  fence, a tree and the water line. Also that being stopped by something stops the legs,
  which is the difference between a walk cycle and a sprite scrubbing in place.
- `tests/assistant.test.mjs` — Ligeirinho. Mostly the ways an errand can FAIL, because a
  reading now waits for him: a corner he cannot reach gives up rather than never arriving,
  a merely long run is not mistaken for a stuck one, a 45 m/s dash does not step over a
  fence, and one wedged behind something while following is picked up rather than lost.
  The two fence tests build their own fence: nothing in the generator plants one any more,
  and a property of the collision solver should not stop being tested because the valley
  ran out of obstacles to test it with.
- `tests/discovery.test.mjs` — finding the buried boundary corners, and the assertion the
  whole file exists for: **no parcel is impossible to deliver**. Before it, a corner that
  started hidden could be seen and never measured, so `parcelProgress` never completed —
  67% of médio parcels and 90% of difícil ones could not be delivered at all, from the
  first commit onwards. It is the cheapest test here and the most valuable. It also asserts
  each corner's entity EXISTS before asking whether it is buried: written the obvious way,
  `w.entity(id)?.hidden`, a corner with no entity at all read as "not buried" and sailed
  through the very check meant to catch it.
- `tests/readout.test.mjs` — the live instrument face. That the circle reading inverts the
  reduction, that the angle from the ré is zero when aimed at the ré whatever the circle
  reads, that a free station reports no ré at all, and that the readout agrees with a real
  observation to within the instrument's own precision. It also pins the frame: surveyed
  coordinates are born at an arbitrary (1000, 1000) while the valley sits at the origin,
  so mixing the two gives a believable distance that is a kilometre wrong.
- `tests/persistence.test.mjs` — saving and resuming a campaign, and refusing a
  corrupt or future-version save rather than trusting it.
- `tests/offline.test.mjs` — the service worker's precache list matches the files on disk,
  and the PixiJS pin, its SRI hash and the cached URL all agree.
- `tests/render.test.mjs` — the art pipeline. Sprite painters are deterministic and
  outlined, the shading ramp shifts hue in the right direction for every base colour,
  ground chunks bake identically in slices as in one pass, and the camera never leaves
  the pixel grid. All DOM-free, because a sprite is a plain `{w, h, data}`. It also
  asserts that **the ground is painted where the terrain actually is** — the test whose
  absence let the whole soil map ship mirrored north-for-south inside every chunk, and
  which only works because it is asserted on a chunk whose halves differ.

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
  stutter, and every stage including the soil classification is sliced for the same
  reason.
- **Soil is classified at 4 samples per metre and the painters index that grid, not
  metres.** The producer counts rows northward; a painter that counts them the other way
  mirrors the chunk, which is exactly what happened. The grid's orientation now has a
  test.
- **There is one collision solver, and both people use it.** `player.js#slideStep` takes a
  radius; Ligeirinho passes a smaller one and sub-steps it, because at 45 m/s a fixed step
  is 0.75 m and `canStand` tests a position rather than a swept path. A second
  implementation would drift, and the drift would look like the assistant wading through
  water the player was just stopped from crossing.
- **The player's appearance is baked into the atlas sheet**, so `atlas.build(look)` is
  re-callable and `SKIN_TONES`/`HAIR_TONES`/`HAT_STYLES` in `render/palette.js` are a
  **save format** — a look is stored as indices into them. Append only; inserting a tone
  in the middle repaints every existing player's face.
- **`hidden` on an entity means NOT YET FOUND, not "far away".** A buried corner is
  cleared for good by `game/discovery.js` once the crew has been within `revealRadius`,
  and the ids are remembered in `state.revealedMarks` so a reload does not re-bury them.
  Every path that decides what the instrument may be pointed at can therefore keep its
  plain `if (ent.hidden) continue` — the flag carries the whole rule. Read as a draw
  distance instead, it silently made two of the three difficulty settings unfinishable.
- **A rule that depends on WHERE THE PLAYER IS needs the loop, not an event.** The tool
  rail is refreshed by `refreshUI` on a couple of dozen discrete events; `atInstrument` is
  the one verdict that changes by walking, so the loop watches it and refreshes the rail on
  the flip. Without that, `toolbar.js` sets a real `disabled` attribute and walking back to
  the instrument never cleared it — a dead button, not a stale tooltip.
- **Ligeirinho's errands are one queue with two kinds**, `sight` and `marco`, in
  `main.js`. They differ where they should: leaving the instrument cancels a sight and not
  a marco, and a sight is taken even when he gives up short of the point while a monument
  is not — a prism two metres out is a slightly worse reading, a monument two metres out
  is simply in the wrong place.
- **Compensating the traverse RE-RADIATES the detail.** `service.js#reradiate` inverts the
  adjusted coordinates for the azimuth to the ré and reduces every observation again, which
  is the hand method and the only reason the cálculos panel changes anything at all — it
  used to move the stations and stop, leaving every corner where the unadjusted ones had
  put it. The adjusted reduction lands in `adjE/adjN` BESIDE the observed one, never over
  it: a caderneta that rewrote its own reductions would stop being a record, and keeping
  them apart is also what makes a second run recompute instead of compound.
- **A traverse is computed from the raw survey, never from its own last answer.**
  `assignCoordinates` keeps `radiatedE/radiatedN`, and `buildTraverseInput` reads those.
  Without it, rewriting the stations fed the next run a moved starting azimuth and
  bowditch → transit → bowditch did not give the first answer back — so a student toggling
  the rule to compare them was watching a drift.
- **Truth is shown in exactly one place**: the debrief. `network.js#datumShift` removes the
  arbitrary origin (the frames differ by a pure translation — arbitrary origin, map north),
  and what is left is the error the player earned. The error plot is built by
  `report/errorfigure.js` and is deliberately NOT part of the planta: the planta is the
  deliverable and imitates a legal instrument.
- **The overlay canvas is UNDER the HTML panels**, so anything pinned to an edge can be
  drawn behind one and be, for the player, simply absent. `main.js#measureSafeArea` reports
  what the panels cover and every edge marker clamps inside it. Each panel owns exactly ONE
  edge — testing all four let the full-width HUD bar count as a 1280 px left inset *and* a
  1280 px right inset, walling off the whole canvas.
- **Touch joins `input.intent()` rather than bypassing it.** The thumbstick contributes a
  unit direction and a deflection past 70% stands in for Shift, so `game/player.js` does
  not know touch exists. `setPointerCapture` is wrapped, because it throws whenever the
  pointer has already gone — and an uncaught throw there took the whole `pointerdown`
  branch down with it, silently disabling pinch and two-finger pan.
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
close the traverse, deliver the planta and the memorial, walk to the farmhouse to be paid,
and spend it on a better instrument. Control left in the ground carries across to
neighbouring jobs, and the board shows how much of it each property can reuse. Progress is
saved continuously and the game offers to resume it.

**You survey with a crew of two.** A reading can only be taken from the instrument — you
have to be within a metre of the monument the tripod stands on — and the reason that is
not merely a restriction is **Ligeirinho**, the auxiliar de topografia, who carries the
prism. Click a corner and he sprints to it at 45 m/s; the reading lands when he arrives,
not when you click. A total station is not a one-person tool, and the game used to pretend
otherwise: you set the tripod up once and then measured the whole parcel from wherever you
had wandered off to.

He moves through the player's own collision solver, so he goes round fences and stops at
water exactly as you do, and the dash is sub-stepped because at 45 m/s a fixed step is
0.75 m and would clear a fence without ever occupying an illegal position. He gives up
when he stops **getting closer**, not when the errand has merely taken a while — that
distinction matters, because a flat time budget expired on long batch sights while he was
still running perfectly well, and the reading was then quietly taken from wherever he had
got to. If a corner is genuinely unreachable — in a marsh, hard against a building — he
plants the pole as close as he can and the reading is taken anyway, which is what a real
prism man does and what stops an unreachable corner softlocking a sight.

Standing at the instrument would be a cage rather than a rule if the corners you must
click could be off screen, so **the camera lets go while you are set up and still**: the
right-drag pan sticks instead of being yanked back, and setting up frames the whole figure
(which is what `camera.fit` was written for, and had never once been called).

**"Medir todos os visíveis" exists only on fácil.** The manual-sight quota is a tutorial
gate that opens; this one never does, so the button is hidden rather than shown locked.
On fácil the batch is a tour — Ligeirinho visits every target in turn, because each one is
a real sight with the prism actually on the point.

**The owner pays at the sede, and the owner is standing there.** Delivering produces the
planta and the memorial wherever you are standing and banks nothing; a toast names the
property and the owner, and the money is settled when you knock. Nothing is drawn over the
farmhouse to point at it — a pin and an edge arrow were there and came out again, because
the building sits near the middle of the parcel you have spent the whole job walking, and
the person you are looking for is standing outside it wearing their name. Every homestead now has its owner on the doorstep,
not only the one whose job you are doing: the neighbours a memorial descritivo lists as
confrontantes are people you have walked past, and reading a name off somebody's hat is a
cheaper way to learn the cast than reading the document. The payment screen opens with the
same face, painted from the same look as the sprite outside.

Which body an owner is painted with is carried beside their name in `world/names.js` rather
than guessed from it. A name is not a reliable guide to anybody, and inferring one from the
ending of "Epaminondas" would be wrong sometimes and wrong in a way that reads as
carelessness about the people these names belong to.

**The paddock fence is gone.** It ringed every farmhouse, and it was a net: Ligeirinho
dashes in a straight line and slides off what he hits, and nothing routes him around a
concave obstacle or times a FOLLOW out. Dropped inside one he was still inside it after
thirty seconds in **17 of 36 cases** — which is for ever, because nothing in the game could
recover him, and a crew with no prism man silently plants monuments nowhere near where you
asked. It had already cost the sede a gate for the same family of reason (a closed ring
sealed the farmhouse in, and only 54 of 72 were reachable on foot). A yard you can walk into
is worth more than scenery with a trap in it. `updateAssistant` also grew the general
version of the cure: wedged, far away and getting no closer, he turns up beside you having
taken the path he knows and you do not.

**No boundary corner stands in open water.** The soil is a noise field and the parcels are
a Voronoi partition cut without ever consulting it, so nothing stopped a corner landing in
a pond — measured over eight seeds, three of 261 did, and a marco in a lake is not a thing:
`canStand` refuses water, so the prism cannot be held plumb over it either. The WATER gives
way rather than the corner moving, because the partition is exact and its exactness is what
makes the confrontantes and the shared marcos true. It gives way to marsh, which already
rings every lake in this generator, so what you see is a shoreline a couple of metres
further out and never a suspicious dry disc.

**Some corners have to be found before they can be measured.** On médio and difícil the
generator buries a share of the boundary marks in scrub — 15% and 40% — so the job starts
with a walk round the perimeter, which is how the owner shows you the evidence. Walking
within 15 m of one clears it for good, Ligeirinho turns them up as readily as you do, and
the discovery is remembered across a reload.

That lever was written and never connected. `hidden` was honoured by the renderer and
ignored nowhere else: every path deciding what the instrument may be pointed at skipped
hidden marks outright and permanently, so a buried corner could be seen and never
measured — which keeps `parcelProgress` incomplete, which keeps ENTREGA locked. Measured
over five seeds, **67% of médio parcels and 90% of difícil parcels could not be delivered
at all**, from the first commit onwards. `tests/discovery.test.mjs` now asserts the
opposite over fifteen worlds.

**A buried corner announces itself.** The active parcel's boundary is drawn from the true
geometry at all times, so before this the line simply BENT at a corner whose mark was still
in the scrub — nothing on it, nothing clickable, and a click there answered "nenhum alvo
sob o cursor", which was a lie. Every corner of the parcel you are surveying now carries
its state: a dashed ring with a question mark for one nobody has found, blue for found and
not yet measured, green for done, plus one arrow at the frame edge for the nearest corner
still missing. Clicking a buried one says it is overgrown and how far you have to walk.
Showing where they are is not a giveaway — the premise of the job is that the owner already
walked the boundary and pointed them out; the walk, and on difícil the clock, still cost
what they cost.

**Compensating the traverse now reaches the survey.** The cálculos panel calls itself the
didactic centrepiece and it is, but it used to change nothing: compensation rewrote the
station coordinates and stopped there, while every boundary corner kept the coordinate it
had been radiated to from the unadjusted ones. Measured on a clean survey — stations moved
up to 5 mm, **corners moved 0.0000 m**, and the delivered area was identical to the
millimetre. Now the detail is reduced again from the adjusted network, exactly as it is
done by hand, and over sixteen surveys compensation improved the corner RMS in thirteen of
them; the three it did not were the tightest closures, where the closure is mostly noise
and redistributing it is as likely to hurt as help. Which is itself the lesson.

**The debrief says WHICH corner you got wrong.** Area error, perimeter error and the side
RMS are datum-invariant and answer "how good was this?"; none of them can answer "where did
it go wrong?", and that is the only question a student can act on. There is now a table of
per-corner errors, worst first, and a **carta de erros** — the surveyed polygon with an
error vector at every corner, exaggerated by a stated factor because the vectors are
millimetres on a fifty-metre figure. It never joins the planta or the PDF.

**It runs on a tablet.** Movement was WASD-only, so a touchscreen could not walk — not
awkward, unplayable: no reaching a corner, no finding a buried mark, no walking to the
sede. There is a thumbstick, pinch to zoom (stepped to the same rungs, because the art is
pixel-exact only at whole multiples of 16 px/m), two fingers to pan, and tap to act. The
roteiro folds into its title bar, since on a 1024 px tablet it covered a quarter of the
play area and silently swallowed every tap that landed on it.

**The caderneta exports as CSV** — one row per observation with its setup context repeated,
carrying both the observed reduction and the compensated one. It is the artefact a student
hands in and it could not leave the browser.

**A marco goes in at your feet, or wherever you point.** Space plants one where you stand;
click firm ground further off and Ligeirinho runs out and plants it there. The ground is
judged at the click rather than on arrival — the soil does not change while he runs, so
being made to wait a second to be told the spot was never legal is worse feedback than an
instant no — and the tripod preview follows the cursor for exactly that reason. If he
cannot reach a spot that passed the check, nothing is planted: a monument in the wrong
place is worse than no monument, which is the one place his errands differ from a sight.

**Estação livre works where there is no monument**, which is the only place anybody wants
it. The resection maths always allowed it and the dialog did not: it refused to open
unless a marco was within a metre. Standing on open ground now opens it in its own right,
with a live count of the coordinated points in sight from where you are — and the point
under your own tripod is correctly not one of them.

**There is one way to orient the circle**: zero on the ré. "Orientar pelo azimute" is
gone, because you cannot do it — the limb reads what it reads when you point the
telescope, and zero is the one value the instrument lets you force. Teaching a workflow
the hardware does not have is worse than teaching one fewer.

At the opening dialog you **choose your surveyor** — body, skin tone, hair colour and hat.
Every option is a small portrait of the surveyor it would produce rather than a colour
square, and each one paints the look you have now with only its own dimension varied, so
picking a hat repaints the faces wearing it. Sixteen 24x34 sprites is about thirteen
thousand pixels, which is nothing, and it buys the one thing a row of swatches cannot
show: how the pieces sit together. You also get a name shuffled out of famous Brazilian
athletes' first names and surnames, so you start as Ayrton Fittipaldi or Marta Kuerten
unless you type your own. That name is not decoration: it signs the planta and the
memorial descritivo, and it was initialised empty and never assigned, so every document a
student produced came out signed "Surveyor Valley".

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

Properties run **0.11–0.47 ha with 4 to 8 corners** — about a 50 m square, a 200 m lap,
roughly 40 minutes of estimated field time. They started out at up to 4.7 ha and sixteen
corners, which is a long afternoon for one exercise. Corner count is what actually sets
the length — the estimator charges 3.5 minutes a vertex against roughly 1.3 per 60 m
walked — so the boundaries were straightened as well as shortened, which is also the
truer picture: a rural boundary runs straight from one marco to the next unless it is
following a river.

Shrinking a parcel makes closure **harder**, not easier, and the tolerances moved with it
each time. Linear closure error is built from things that do not shrink — 2.5 mm of
instrument centring, 5.0 mm of target centring, the EDM's 10 mm constant — while relative
precision is perimeter over that error. The required **1:1000 / 1:1500 / 1:2000** look
loose for cadastral work and honestly are: a 40 m figure closed with a 10" instrument
cannot do better, and that relative precision falls with the size of the figure is a real
surveying fact worth meeting. They are set from 36 measured surveys with the starter kit
(median 1:3787, worst 1:1235) so that fácil is free, médio costs care and difícil wants a
better instrument — which is what the shop is for. The best survey observed closed at
1:38,266, so the ceiling is the kit, not the ground. Missing the requirement costs
quality, and therefore pay; it never blocks delivery.

**Every azimuth is measured from the map's north.** There used to be a choice at the first
setup — a compass bearing good to 30', or declaring the line to the ré to be north — and
both rotated the surveyed frame away from the world, so the arrow on screen pointed one
way and every azimuth in the memorial was measured from another, with nothing saying so.
The origin is still an arbitrary local (1000, 1000), which costs nothing: azimuth is
`atan2(dE, dN)` and is exactly invariant under translation.

While the instrument is set up, the **ré is drawn as a dashed blue line** and a live
instrument face in the lower right shows the circle reading, the angle turned from the ré,
the azimuth and the distance to whatever you are aiming at — over a drawing of the
horizontal circle itself, with the ré ray, the target ray and the swept angle shaded
between them.

**The dial is drawn north-up**, always: it is oriented exactly like the map above it, so
the dashed ré on the diagram points the same way as the dashed ré on the ground, and the
two can be compared without rotating either in your head. It was first drawn on the
instrument's own face, which put the ré at twelve o'clock whenever the circle was zeroed on
it and pushed north round by θ₀ — truthful about the instrument, and confusing on screen,
because the picture and the map then disagreed about which way was up. Rotating both rays
by θ₀ leaves the angle between them untouched, so nothing didactic was lost; `Az = Hz + θ₀`
is still there as the two numbers in the rows below. Swinging the telescope and watching
them move is the point: `src/survey/readout.js` is the noiseless twin of `sightTarget`, and
`tests/readout.test.mjs` asserts the two agree.

**SPACE acts with the current tool, where you stand** — drive the monument at your feet,
set up over the monument you occupy, or sight the target under the cursor. It shares one
dispatcher with the left click, which was always position-independent anyway, and it never
declines in silence: every job starts on the walk tool, so a key that did nothing there was
indistinguishable from a key that had never been implemented.

The surveyor breathes while standing and while crouched at the instrument — a lopsided
cycle that rests for two thirds of it, because an even alternation reads as a mechanical
flicker rather than as lungs. The kneel is now chosen by *being at the tripod* rather than
by a station existing at all, which until this round left the surveyor sliding around the
whole valley permanently folded up.
