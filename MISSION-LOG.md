# Valk work log

## ⚠️ Deploying now requires one extra step

**Bump `CACHE_NAME` in `public/sw.js` on every deploy.** Changing that string is what makes the
browser see `sw.js` as a new file, which is what puts a worker into the "waiting" state, which is
what raises the update screen. Deploy without bumping it and returning users get no update prompt.

`sw.js` no longer calls `skipWaiting()` on install — that was deliberate and is load-bearing. A
worker that skips straight to active leaves nothing waiting, so there is no update to detect and the
button has nothing to press. It now activates only on the `SKIP_WAITING` message the button sends.

## Update gate (`public/update-prompt.js`)

Full-screen black overlay with a single green Update button, shown only when a new version is
waiting. Pressing it activates the new worker, which clears old caches, then reloads.

- Self-contained: injects its own styles and DOM, so no page markup depends on it.
- Also does the service-worker registration for every page, replacing the inline snippet 13 pages
  each carried. Wired into all 19 pages. `admin.html` keeps its own separate registration for push
  notifications — registering the same URL twice returns the same registration, so both coexist.
- **The critical guard:** the overlay only appears when `navigator.serviceWorker.controller` already
  exists. Without that check every first-time visitor would be met with a black screen demanding
  they update an app they just opened.
- Reload happens on `controllerchange`, but only if the user pressed the button — `clients.claim()`
  fires that same event on a fresh install, which would otherwise bounce new visitors.
- If activation stalls, it reloads anyway after 6s rather than trap anyone behind a gate with no
  escape.
- Tested by `scratchpad/harness3.js`, which drives it through a fake service-worker lifecycle
  (15 checks: first install, update available, already-waiting worker, stalled activation).

# Minigame polish mission

Working down the `index.html` menu column, improving graphics and gameplay for each game.
Budget ~45 min wall-clock per game, then move on. Stop after 2048.

**Current mission (2026-08-14 evening): Web Swing only, overnight.** The menu-column sweep is
paused; the user asked for Web Swing gameplay + graphics specifically.

## ⚠️ Why the previous overnight run produced almost nothing

The machine was asleep, not the loop broken. Cron fires only while the host is awake, and missed
slots are **not** backfilled. Of ~10 hourly slots on the night of 13→14 Aug, one fired at 00:50 into
a 2-second maintenance wake (queued, never executed) and one ran for two minutes at 07:34 before the
system slept again at 07:36. Everything attributed to "overnight" was actually finished at 15:39.

Mitigation now in place for this run:

- `powercfg /change standby-timeout-ac 0` (+ hibernate 0). **Reverted with `standby-timeout-ac 15`.**
- A `SetThreadExecutionState(ES_CONTINUOUS|ES_SYSTEM_REQUIRED)` holder process, which does not
  depend on the power plan. Script: `scratchpad/keep-awake.ps1`; it self-releases at 09:00.
- Both only cover **AC power** — on battery the machine will still sleep, and closing the lid may
  still sleep it regardless (this machine doesn't expose LIDACTION to `powercfg /query`).

## Verification (required before moving off a game)

Portable Node (no admin, lives in the session scratchpad):

```
$s = "C:\Users\asher\AppData\Local\Temp\claude\C--Users-asher\d1837156-41ab-4e88-9237-73e7994775ff\scratchpad"
& "$s\node-v24.19.0-win-x64\node.exe" --check public\<game>.js
& "$s\node-v24.19.0-win-x64\node.exe" "$s\harness.js" public\<game>.js
```

`harness.js` executes a browser script's module scope against auto-stubbed THREE/DOM globals —
catches use-before-definition and typo'd identifiers that `--check` cannot. `harness2.js` is the
webswing-specific animation-maths test (takes the file path as an argument). `harness4.js` is the
webswing **gameplay**-maths test — near-miss scoring, cooldown/chain rules, wipeout lockout, ribbon
vertices.

**How harness4 reaches module-scope state:** `vm.runInNewContext` only exposes `function`
declarations and `var` on the sandbox object — `const`/`let` (so `player`, `buildings`, `score`,
the tuning constants) stay in the script's own lexical scope and are invisible from outside. It
therefore *appends* its assertion epilogue to the source and runs the combined text, so the epilogue
shares that scope. It also swaps in a real `THREE.Vector3` so the ribbon's cross-product path is
genuinely exercised. Anything still stubbed (e.g. `trailMesh.visible`) **cannot be asserted on** —
assigning to a stub Proxy is a no-op and reading returns another Proxy, never a real boolean. Assert
on the underlying value instead (`trailStrength`), or you'll write a test that can never pass.

## Order and status

| # | Game | File | Started | Status |
|---|------|------|---------|--------|
| 1 | Web Swing | `webswing.js` | 2026-08-13 21:31 | **done** 21:40 |
| 2 | Build Craft | `buildcraft.js` | 2026-08-13 21:40 | **done** 21:42 |
| 3 | Geometry Wave | `geometrywave.js` | 2026-08-13 21:42 | **done** 21:45 |
| 4 | Seince Jump | `seince-jump.js` | 2026-08-14 | **graphics done**, gameplay not started |
| 5 | Fighter Plane | `fighterplane.js` | | pending |
| 6 | Pictionary | `pictionary.js` | | pending |
| 7 | Trivia Night | `trivia.js` | | pending |
| 8 | Tic-Tac-Toe | `tictactoe.js` | | pending |
| 9 | Chess | `chess.js` | | pending |
| 10 | Hangman | `hangman.js` | | pending |
| 11 | Snake | `snake.js` | | pending |
| 12 | 2048 | `2048.js` | | pending — **stop after this** |

## Log

### 1. Web Swing

**Earlier this session (already done):**
- Hold Space / touch ⤒ while on a web to climb the strand (`WEB_CLIMB_SPEED`).
- Graphics pass: sRGB + ACES colour pipeline, sun shadows (desktop only), Lambert→Standard
  materials, richer facade/road textures, grid-aligned road tiling, rooftop clutter, five-stop sky,
  haze fog, anisotropic filtering.
- Avatar rebuilt as a joint hierarchy (shoulder/elbow, hip/knee) with six blended poses: wall,
  rope, swing, run, air, idle. Web now leaves the hands.
- Caught by harness2: rope pose drove the shoulder past PI (arm folding behind the head). Fixed.
- Caught during review: roof props were consuming the city's seeded RNG, which would have
  regenerated the whole skyline. Moved to their own stream.

**This pass (graphics + gameplay):**
- Graphics: speed-driven FOV kick + CSS edge-rush overlay (both off one normalised speed value);
  distant skyline silhouette ring (InstancedMesh, 1 draw call); drifting cloud sprites parked below
  the tower top; roof parapets on every building (InstancedMesh, 1 draw call); landing dust puff
  (fixed-size reused Points cloud, no per-landing allocation); shared radial glow texture driving
  orb haloes and a sun glow aligned to the light's own direction.
- Gameplay: **dive** (Shift / touch ⤓) — drives you downward and steers toward your aim, with its
  own avatar pose; **air chain** — orbs taken without touching ground stack up to +5 each, HUD pill
  + reset on landing; **grapple bail-out** — web or jump cancels a zip mid-flight keeping its
  velocity (previously a zip locked out every action until it landed); live speed readout.
- Fixed while writing: `player.diving` was cleared inside a block that early-returns for
  swinging/climbing, so grabbing a wall mid-dive left the flag and pose stuck on.

**Pass 3 — 2026-08-14 evening (overnight mission, gameplay + graphics):**

Gameplay — the game had no risk and no reward for style, so the safe line scored as well as the
exciting one:
- **Near misses.** Skimming a facade under `THRILL_RADIUS` (3.4) at over `THRILL_SPEED_MIN` (22)
  pays out, scaled by how close you shaved it, and chains up to ×5 while you keep landing them
  inside a 2.2s window. Cooldown is stored **per building** (`b.thrillAt`), not globally: a global
  timer would have made a genuine slalom between two towers score only the first tower, and no
  timer at all would tick a payout every frame while hugging one wall.
- **Wipeouts.** Hitting the ground above `WIPEOUT_SPEED` (32) sprawls you — input, jump and web all
  locked out for ~1s, air chain forfeited, heavy shake and dust. This is what finally gives the dive
  and the pump-release boost a downside to weigh; before this a dive straight into the street was
  free.

Graphics:
- **Speed ribbon** — billboarded triangle strip through the last 22 positions. Additive blending
  does the fade for free (black tail vertices are transparent under additive), so no custom shader.
- **Web impact pop** — expanding additive flare where a web actually bites, reusing `GLOW_TEXTURE`.
  Before this the strand simply existed on the next frame with no read on where it caught.
- **Camera shake** — applied *after* `lookAt`, so it never disturbs the aim the player is steering
  with. Amplitude is a max, not a sum, so a crash during a near miss can't stack into a seizure.
- **`sprawl` pose** added to the avatar set (held, not cycled — the stillness is what sells it).

Refactor: `addScore()` extracted, since orb pickups and near misses both need the best-score and
leaderboard bookkeeping and it would otherwise be duplicated.

**Pass 4 — 2026-08-14, iteration 2 (make the pump/release skill loop legible):**

The pump mechanic was the game's biggest reward and was **completely invisible**. Holding A/D built
`pumpMomentum` 0→1, which multiplied velocity by up to 1.8x on release, and nothing on screen showed
the charge or when to spend it — the menu just said "let go at the right moment" and left you to
guess which moment that was.

- **Perfect release** (`isPerfectRelease()`): pays only when charge ≥ `PERFECT_PUMP_MIN` (0.55)
  **and** you're still rising (`vy` ≥ `PERFECT_RISE_MIN`, 2.0). Letting go at the top of the arc or
  on the way down wastes the charge however hard you pumped — that's the skill the boost always
  implied but never actually tested. Pays bonus score, a 1.25x stronger boost, its own rising sound
  (plain `release` falls, so the two can't be confused) and a small shake.
- **Charge meter** (`#pump-meter`, shown only while attached): bar = charge; amber = charged but not
  in the window; **pulsing green = charged and rising**, i.e. exactly when `isPerfectRelease()` pays.
  The meter shows the window instead of making the player infer it. State is cached in
  `pumpMeterState` so classList isn't rewritten every frame, and the hint text is set from JS —
  `content:` does nothing on a real element, only on `::before`/`::after`.

**Pass 13 — 2026-08-15, iteration 11 (alt-tab mid-dive and you came back still diving):**

Checked the usual omissions first — window resize *is* handled (`webswing.js:252`) and the
leaderboard request path is wired correctly, so neither needed work. But there was no `blur` handler
anywhere in the file, and `keyup` was the only thing that ever cleared `keys`.

A key released while the window doesn't have focus never delivers a keyup, so it stays latched
indefinitely. Alt-tab while holding Shift and you return **permanently diving**; W leaves you
running forever; Space leaves you hauling up the web forever. It only cleared when you happened to
press and release that same key again.

`clearHeldInput()` releases every key plus the touch hold flags and joystick axes, wired to both
`blur` and `visibilitychange` — switching tabs doesn't reliably fire `blur` on the window, and
backgrounding a phone browser generally fires only `visibilitychange`. It also re-centres the
joystick knob through `resetJoystickVisual`, a hook the touch block assigns: without that the stick
stays visually pushed over *and* its tracked touch id never matches a later touchend.

The tests assert the derived helpers (`diveHeld()`, `webClimbHeld()`, `readMoveInput()`) as well as
the raw flags, then run 30 frames of `updateInputMove` to confirm the player actually stops being
driven. Clearing the raw flags while leaving a helper latched would be the identical bug wearing a
hat, and asserting only on `keys` would not catch it.

**Pass 12 — 2026-08-15, iteration 10 (you could fall out of the world and never come back):**

Audited every remaining "put the player here" site against pass 11's pattern. The two already fixed
were the only lip cases (`spawnPlatform` is the roof *centre*, so it's fine; `resolveWallCollisions`
is horizontal-only and `groundCheck` already runs first, which the comment in `update()` explains).
But the audit turned up something worse: **no out-of-bounds handling anywhere.**

The ground plane is finite — `(GRID+4) * CELL` = 312 units, so ±156 — and `shootWeb()` deliberately
anchors to empty air at max range when nothing is hit, which is precisely what lets you sling past
the city edge. Beyond the plane there is nothing to raycast against, so `groundCheck()` finds no
hit, `grounded` stays false, gravity never stops and `player.y` runs to -∞. There is no reset,
no death, no respawn: the only escape was reloading the page, which loses the run.

A second, quieter hole in the same area: **`groundCheck()` can tunnel.** Its ray starts at
`player.y + 1.0`, so once a single frame carries the player more than ~1 unit below the ground the
ray originates *underneath* the plane and misses it entirely. At `MAX_SPEED` with a 0.05s frame (the
`dt` cap) one step is 2.75 units, so this is reachable on a slow device during a fast dive.

`enforceWorldBounds()` adds two backstops, called after the collision pass so it only sees positions
the normal physics failed to catch:
1. **Hard floor inside the plane's footprint** — below y=0 there is always wrong, so clamping is
   unambiguous. Covers the tunnelling case whatever caused it.
2. **Void respawn** past the plane, below `VOID_Y` (-25). Nothing legitimate reaches that: the
   ground is solid across the entire plane, so it's only attainable off the edge.

The respawn **deliberately does not touch the score.** Falling through a hole in the world is not a
mistake the player made and must not cost them a run — that's asserted explicitly. The air chain
does reset, since they've effectively touched down. Being off the plane but still *high* is left
alone: they can still swing back, and teleporting them would be the intrusive choice.

`GROUND_TILES`/`GROUND_SIZE`/`GROUND_HALF` moved to module scope. The physics needs the same numbers
the mesh is built from, and computing them in two places is how a floor check silently drifts away
from the actual ground.

**Pass 11 — 2026-08-15, iteration 9 (the rooftop zip had the same lip bug, plus one of its own):**

Pass 10's fix suggested a family, and the grapple had it too. `shootWeb()` set
`grappleTarget = { x: point.x, y: b.h + 1, z: point.z }`, where `point` is the raycast hit — which
sits **on the building's surface**. This branch fires for hits within `GRAPPLE_TOP_MARGIN` (4) of the
top, usually an upper *wall* face, so `point.x`/`point.z` is exactly on the footprint boundary. The
zip therefore delivered the player to a spot balanced on the roof lip, where `groundCheck()`'s
downward ray can miss the roof and hit the ground plane instead.

A second, independent defect in the same line: **`y: b.h + 1`**. `updateGrapple()` sets
`grounded = true` on arrival, but `groundCheck()` only agrees within 0.15 of the surface, so arriving
a full unit above the roof made that flag wrong on the very next frame. Every single zip ended in a
small drop, and the `grounded = true` was simply a lie.

`roofArrivalPoint(b, point)` clamps the landing to `MANTLE_INSET` inside the footprint on both axes
and puts it at `b.h + 0.05`, inside the grounded window. Hits already well inside the roof's top
face are left exactly where they are rather than dragged toward the centre, and a building narrower
than twice the inset clamps to its centre instead of overshooting past the far wall.

Also corrected: the impact flare now fires at `point` (where the web actually bit) rather than at
`(point.x, b.h + 1, point.z)`, which was neither the bite nor the landing.

**Both of the last two passes were the same root cause** — code that computes a position on a
surface boundary and then treats it as a position you can stand on. Worth checking any future
"put the player here" maths against `groundCheck()`'s 0.15 window and the footprint edge.

**Pass 10 — 2026-08-15, iteration 8 (climbing a tower ended in falling off the top of it):**

The wall climb's entire payoff was broken. `updateClimb()` topped out with
`player.y = b.h; climbing = false; grounded = true` — but the player is pinned at
`climbFixedCoord`, which is `CLIMB_OFFSET` (0.5) **outside** the facade. They finished hovering past
the roof edge with nothing beneath them.

It doesn't stop at "looks wrong". `groundCheck()` runs later in that same frame (`climbing` is
already false, so the `!player.climbing` gate passes), casts down from past the lip, misses the roof
entirely and hits the **ground plane** — which is in `collidables` (`webswing.js:408`). `player.y`
is nowhere near `groundY + 0.15`, so `grounded` immediately flips back to false and the player
free-falls the full height of the building. Velocity is zero after a climb, so `tryStartClimb()`
can't re-grab either (it needs hSpeed ≥ 0.3). Climb an 84-unit tower, fall 84 units.

Fix: `MANTLE_INSET` (`CLIMB_OFFSET + PLAYER_RADIUS + 0.3`) steps the player inward along
`-climbNormal` when topping out, so a roof is actually underneath. Verified on both climb axes,
with an explicit margin check rather than just "inside the footprint" — landing exactly on the lip
would pass a containment test and still be one float away from falling.

Bottoming out was already correct and is left alone: standing on the ground `CLIMB_OFFSET` out from
the wall is fine, because the ground is there.

**Pass 9 — 2026-08-15, iteration 7 (remote ghost animation — a hard-coded tick rate):**

Multiplayer was the one substantial area this mission hadn't looked at. The ghost speed estimate was
`positionDelta * 10`, hard-coding "10 packets a second".

`sendPosBroadcast()` only guarantees *at most* 10/s — it's throttled **inside the frame loop**, so
the real gap is ~116ms at 60fps (the first frame after 100ms elapses), and far longer whenever the
sender's tab is backgrounded, where `requestAnimationFrame` drops to roughly 1Hz. At a 1s gap the
old maths reported speeds **10× too high**, which flipped the ghost into the 'air' pose and drove
its limb cycle to ~257 rad/s — about 4 rad *per frame*, i.e. visible strobing rather than animation.
The same spike hit on every player's first packet, where the ghost is parked at spawn (or at the
world origin for players already in the room — `server.js:2583` registers them at 0,0,0 until their
first update), making that initial ~100-unit correction read as movement.

- `updateRemoteSpeed()` measures against `performance.now()` instead of assuming a rate, floors the
  interval at 30ms so a burst of packets can't divide by ~0, and clamps both components to
  `MAX_SPEED` — a ghost can't legitimately outrun the cap the local player is held to.
- **First packet is explicitly not movement**: speeds are zeroed and only the clock is stamped.
- `MAX_POSE_CYCLE` (12) caps the limb cycle rate for **both** local and remote avatars. Phase advance
  is rad/s and a full cycle is 2π, so 12 is already ~2 cycles a second — a hard sprint. The local
  player shared the same uncapped `2.2 + h * 0.85` formula and could reach ~29 after a fast landing.

Not done, deliberately: **stale-ghost pruning**. A player who drops without a `sw-player-left` leaves
a ghost forever, but any timeout risks deleting a live player during a temporary stall, and a
vanishing teammate is worse than a motionless one. That needs a real heartbeat, not a guess.

**Pass 8 — 2026-08-15, iteration 6 (reduced motion — fixing something this mission introduced):**

Camera shake (added in pass 3), the speed FOV kick and the edge-rush overlay are all **camera-space
motion**, which is exactly the category that triggers vestibular symptoms. None of them checked
`prefers-reduced-motion`. The only rule honouring it anywhere in `public/` was the pump meter's CSS
pulse, added in pass 4. For someone susceptible, an unconditioned camera shake doesn't make a game
unpleasant — it makes it unplayable, so this was an exclusion bug, not a polish item.

- `reducedMotion` reads `matchMedia('(prefers-reduced-motion: reduce)')`, guarded with a `typeof`
  check (the harness's `window` has no `matchMedia`), and **updates live** via the `change` event —
  `addEventListener` with an `addListener` fallback for Safari < 14. Turning it on mid-run also
  zeroes any shake already in flight rather than letting it ring out.
- Shake → **0**. FOV kick → **0**. Edge rush → **damped to 0.3**, not cut: it's a static vignette
  rather than camera movement, so it's far gentler and keeps some speed read.
- **Deliberately untouched:** the numeric speed readout and the world-space speed ribbon. Both carry
  the "how fast am I going" information without moving the camera, so honouring the setting costs
  the player no information — only the nausea. That's the line this pass draws.
- CSS: `#pickup-toast` now fades in place instead of flying up the screen. It fires on every pickup
  and every near miss, several a second during a good run.

`shakeScale()` / `fovSpeedAdd()` / `speedFxScale()` are split out as pure functions so each effect's
response is assertable directly rather than inferred from rendering. harness4 checks every in-game
shake source (wipeout, near miss, perfect release, hard landing) individually, plus 60 simulated
frames including a crash landing, confirming none of them leaks a shake through.

**Pass 7 — 2026-08-15, iteration 5 (the update loop now allocates nothing):**

Measured **4.38–5.97 `THREE.Vector3` allocations per frame** (~300/s at 60fps) across airborne,
swinging and grounded. Each object is small, but the churn is GC pressure and a GC pause lands as a
frame hitch during exactly the fast swings the game is built around.

Five hot sites, all now reusing module-scope scratch vectors: `aimDirection()`, `updateCamera()`'s
target position, `groundCheck()` (two per frame), `tryStartClimb()` (two per frame) and
`updateWebStrand()`. `DOWN_AXIS` replaced a fresh `(0,-1,0)` built every single frame.

After: **0.00 per frame in all three states.**

**The rule these depend on** — a scratch vector is consumed *within the call that fills it*, never
held across a call that might refill it. Every consumer is either immediate arithmetic or a three.js
method that copies its argument (`Raycaster.set`, `Quaternion.setFromUnitVectors`), which is what
makes sharing safe here. `aimDirection()` is the one to watch: it now returns a **shared** vector,
so a future caller that holds the result across a second `aimDirection()` call would read corrupted
data. All three current callers consume it immediately.

harness4 guards both halves: allocation count must stay at 0 per frame in all three states, and
`aimDirection()` must return a correctly overwritten unit vector on consecutive calls with different
angles — a partial `.set()` would leave a stale component and skew aiming in one axis only, which is
the failure mode shared scratch vectors actually produce.

`scratchpad/measure-alloc.js` (in the *current* session's scratchpad) is the standalone profiler —
it swaps in a counting `Vector3` and reports per-frame allocations by scenario.

**Pass 6 — 2026-08-15, iteration 4 (orb placement — a measured bug, not a taste call):**

**12.9% of orb spawns landed inside a building**, where an orb is both invisible and uncollectable.
Measured over 40k samples against the real seeded city, not estimated. With `ORB_COUNT` 45 that's
~6 dead orbs at any moment, and the 3.5s respawn re-rolled the same odds on every pickup.

The cause: the old air branch offset ±0.7·`CELL` (±16.8) from a building's **centre**, with no
containment check of any kind. Cells are 24 apart and footprints are 13–18 wide, so that range
reaches well into the building it started from and into its neighbours.

- `orbClearOfBuildings(x, y, z, margin)` — margin is **horizontal only**. A point above a roofline is
  clear of that building however close it is, which is exactly what a rooftop orb needs.
- `randomAirOrbPosition()` now places out from **one face** into the street, at a height that hugs
  the facade over its full range. That's the corridor you actually swing down — and where near
  misses pay, so the two systems now pull in the same direction.
- `ORB_CLEARANCE` 2.2: an orb closer than that can't be taken without clipping the wall, so it may
  as well be inside it. Pickup radius (2.6) and player radius (0.4) set the floor.
- Retry up to 12 times, then **fall back to a rooftop**, which is clear by construction — never
  return a point inside a wall.
- `ORB_ROOF_SHARE` dropped 0.5 → 0.3. Rooftop orbs are always reachable, but taking one means
  *landing*, which resets the air chain — the headline mechanic. Half the orbs were quietly working
  against it.

After: **0 of 20,000 inside a building**, minimum air clearance exactly 2.20, roof share 33% (the
0.3 roll plus ~3% boxed-in fallback).

Two harness traps hit while writing this, both worth knowing:
- The epilogue is a **template literal** — a backtick anywhere in it (even in a comment) ends the
  string and produces a baffling syntax error pointing at the next identifier.
- `resetWorld()` replaces the whole `buildings` array with a 2-building fixture, so anything
  measuring the *real* city has to snapshot it first (`REAL_CITY`) and restore. The orb test silently
  measured a 2-building world until that was fixed — it still "passed" its inside-a-building check,
  which is precisely how a meaningless green result looks.

**Pass 5 — 2026-08-15, iteration 3 (ambient wind — the missing sensory layer):**

The game had **no ambient sound whatsoever** — nine one-shot blips and otherwise silence. Every
speed cue built so far (FOV kick, edge rush, speed ribbon) was visual, so a 50 m/s dive between
towers sounded exactly like standing still on a rooftop.

- **Wind** (`startWind`/`updateWind`): one looping white-noise `BufferSource` → lowpass → gain, held
  open for the whole session. Gain and cutoff are driven off the same speed normalisation the FOV
  kick and edge rush use, so all three agree about how fast you're going.
- **Squared gain**, not linear — a linear ramp made a gentle swing sound like a gale. It stays out
  of the way at cruising speed and only really arrives near the top end.
- **One source for the session, never stopped.** Starting/stopping per swing would click and
  allocate on every release. This also forces the mute path: muting **zeroes the gain** rather than
  stopping the source, because a stopped `BufferSource` can never be restarted — stopping it would
  kill the wind permanently for anyone who toggles sound off and back on.
- **`setTargetAtTime`, not `.value =`.** The mute toggle moves the gain across its entire range in
  one frame and an instantaneous jump on an audio param is an audible click.
- `startWind()` is called from the start-button handler, after the click — the autoplay policy
  blocks a source started before a user gesture.

`windParamsForSpeed()` is deliberately split out as a pure function: under test the entire audio
graph is a stub where every assignment is a silent no-op, so the curve is the only part that *can*
be meaningfully asserted. harness4 covers clamping at both ends (raw `hypot` can exceed `MAX_SPEED`
for a frame before `update()`'s clamp lands), monotonicity and finiteness across the range, the
squared response, and that `updateWind()` is safe to call before `startWind()` has built the graph.

`harness4.js` extended: threshold-boundary cases, that scoring/boost happen only on a perfect
release, that a zero-charge release doesn't touch velocity, and a **21×49 sweep asserting the green
"ready" state agrees with `isPerfectRelease()` at every charge/rise combination** — if those ever
diverge the meter is lying about when to let go, which is worse than having no meter at all.

Verified: `node --check`, `harness.js`, `harness2.js` (8 poses), `harness4.js` (new — 20+ gameplay
assertions). All passing.

**Notes / constraints discovered:**
- `server.js:2596` relays a fixed field set for `sw-pos`, so remote ghost pose must be inferred
  client-side from packet deltas. Adding a `pose` field would need a server change. **This now also
  means remote ghosts can't show the sprawl pose** — a wipeout is local-only visually.
- City generation is seeded from `CITY_SEED` and must stay deterministic across clients — never
  draw from `rng` in `buildCity` without checking what it shifts.

### 2. Build Craft

Already by far the most complete game in the set — creative/survival, mobs, villagers, horses,
crafting, farming, fishing, boats, minecarts, rails, enchanting, claims, beds, PvP, armour, fall
damage, regen, minimap, fireworks, day/night, weather with rain, drifting blocky clouds, and
scrolling water (`buildcraft.js:4008` — I nearly reimplemented this before checking).

**This pass (graphics only):**
- **Star field** — 700 points on a 620-unit shell, upper hemisphere only (islands float, so stars
  below the horizon would read as fireflies). Fades in below sun height 0.12, dimmed to 20% under
  rain, recentred on the player each frame so it behaves as a skybox rather than parallaxing.
- **Sun/moon haloes** — additive sprites riding on the existing bodies, which were bare emissive
  boxes. Most visible at dawn/dusk, which this world passes through every 20 minutes.

**Deliberately not done:** sRGB output encoding / ACES tone mapping. It was the single biggest win
in Web Swing, but that game is going for realism whereas this one is deliberately flat pixel-art
with `NearestFilter` throughout. Correct colour management would visibly change an intentional
look, and I can't eyeball the result — worth doing only with the user watching.

**No gameplay change.** Nothing was identifiably missing, and inventing a feature for a game this
complete is more likely to be unwanted than useful. Flagged for the user rather than padded.

### 3. Geometry Wave

2D canvas, 725 lines. Attempts, per-level best in localStorage, and a progress bar already existed.

**This pass:**
- **Background** — flat `#0a1420` replaced with a vertical gradient plus a 70-point parallax star
  layer wrapped modulo canvas width per depth (no allocation per frame, never runs out).
- **Trail** — was one constant-width line at flat 0.6 alpha. Now drawn per-segment, tapering 1→4.2px
  and 0.08→0.8 alpha toward the head, which is what gives a read on direction and climb rate.
  Deliberately no `shadowBlur` on the segments: 50 blurred strokes a frame is the one canvas2d cost
  that would actually show.
- **Death debris** — 26-particle burst in the level's colour, with gravity. Updated outside the
  `running && !dying` gate, since the death pause is the only time it's on screen.
- **Gameplay/UX: personal-best marker on the run bar.** The best % was only ever text on the level
  select, so mid-run you couldn't see whether you were about to beat it — the whole tension of a
  game you replay this often. Refreshed in `resetAttempt()` rather than as the best is set, so the
  marker holds still during the attempt that beats it.

### 4. Seince Jump — graphics done, stopped before gameplay

2D canvas cube-runner in an IIFE, 523 lines. Attempts and best-attempt-count already tracked.

**This pass (graphics):**
- **Death burst** — the cube comes apart into 22 level-coloured fragments plus 8 white ones (so it
  reads against both the dark blocks and the bright ground band). Player is hidden while dead.
- **Landing dust** — kicked up and outward from the contact point, not radially, so it reads as
  impact rather than explosion.
- **Ghost trail** — 10 fading squares, the only thing showing the arc you just travelled, which is
  what makes a missed jump readable after the fact.
- **Background gradient cached** — was being rebuilt on every one of 60 frames a second.

**Unit trap worth knowing if anyone extends this:** this game's `dt` is in FRAMES (normalised to
60fps — see `loop()`), which is the unit `GRAVITY`/`JUMP_VEL` are written in. The particle system
works in seconds (px/s, s). The conversion lives at exactly one place, the `updateParticles(dt / 60)`
call in `loop()`. Particles are also stored in WORLD x / screen y, because the level scrolls under a
player pinned at `PLAYER_SCREEN_X`.

**Not done:** the planned gameplay addition — a furthest-progress % tracker and bar marker for
levels you haven't beaten yet (the game only stores best *attempt count*, so unbeaten levels give no
feedback on how far you got). This mirrors what was added to Geometry Wave. HTML hook would be
`.progress-track` in `seince-jump.html:38`.
