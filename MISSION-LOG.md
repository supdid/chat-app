# Valk work log

## 2026-08-19: Block Battle + parked Web Swing passes shipped to GitHub — server pull pending

`d4df9a4` commits Block Battle (`public/blockbattle.*`, menu link) and the parked Web Swing
passes 14+; `69a025e` merges isaac's Firefight/PvP/security work (~100 commits). Conflicts were
in `webswing.js`/`.html` (his PvP vs the polish passes — both kept, strike rows added to the
redesigned controls list) and `CACHE_NAME` (v112 vs v137 → **v138**). All four harnesses green
post-merge, `node --check` clean on webswing/blockbattle/sw.

**To make it live** (isaac, on the box): `cd ~/chat-app && git pull && systemctl --user restart
chat-app`. Live site still serves v87 — nothing since Aug 12 has been deployed. The deploy key
from this laptop (`~/.ssh/id_ed25519_valk.pub`, see the Aug 15 note below) is still unadded; the
box is behind cloudflared with no public SSH, so the address has to come from isaac too.

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

# 5-hour update shift — 2026-08-16, 14:41 → 19:43

User instruction: "work on updates and sit on fixes for 5 hours." Interpreted and confirmed in the
kickoff message as: additive improvements (not bug-hunting — pass 19 declared that well dry), and
NOTHING commits/pushes/deploys — all work parks in the tree. Session/lives/fail-state redesign
stays off-limits (still the user's open call).

Infrastructure: recurring cron `c874f30c` hourly at :07; one-shot `ad7487e3` at 19:43 winds
everything down (deletes the loop, restores `standby-timeout-ac 15`, stops keep-awake pid 37384);
keep-awake self-releases ~20:17 regardless. `standby-timeout-ac` is 0 for the shift.

**Update queue** (blind-safe, harness-friendly; pick from the top each fire):
1. ~~Bonus orb~~ (done, pass 20)
2. Landing roll: land at 20–32 m/s while holding forward → roll converts the fall into forward
   speed instead of a dust-stop; the wipeout threshold above it is unchanged. Fills the dead zone
   between "fine landing" and "crash" with a skill move. Fully harness-testable.
3. Session-local stats: best air chain / top speed this visit, shown small in the menu on return.
4. Deterministic per-day dusk tint (date-seeded, same for every player on the same day — city
   geometry stays CITY_SEED-deterministic and untouched).
5. Whatever a fresh look at the queue suggests — but additive only.

**Pass 23 — 17:07, shift iteration 4: per-day dusk.**
Queue item 4. Six authored palettes (sky gradient stops, fog, sun tint, clear color — geometry,
orbs and physics untouched), picked by a hash of the **UTC** date: a room shares a *moment*, not a
timezone, so two players in one room always see the same sky wherever they are. Palette 0 is the
exact pre-existing look, kept in rotation; the other five (ember/violet/teal/rose/storm) stay in
the dusk family the lighting was tuned for — weather, not a day/night cycle. The ×31 date-string
hash happens to switch palettes literally every day (365/365 across 2026) with all six reached.
harness4 §28: UTC key format + zero-padding, structural validation of every palette (a bad hex is
an invisible black sky in production), determinism, legacy palette 0 pinned byte-for-byte, and the
year-long rotation sweep. Honest limit: the five new palettes are color-reasoned, not eyeballed —
they're one authored array to tweak if any day looks off. CACHE v109.

Queue: open — additive only. Candidates for remaining fires: ghost name-tag polish is stub-bound
(skip); a menu "today's sky" note tying the records row to the dusk name is trivial-but-nice;
otherwise extend along the trip arc (bonus orb → roll → records).

**Pass 22 — 16:07, shift iteration 3: personal records.**
Queue item 3. The game kept a best *score* and threw away the two numbers players actually brag
about: longest air chain and top speed. Both now persist (`webswing_best_chain`,
`webswing_top_speed`) and greet the player in the menu — a quiet mono row above Start ("Personal
best / score 120 · chain ×7 · 54 m/s"), hidden entirely on a first visit (no row of zeroes).
Deliberately **not** toasts: a "new record!" popup would fire constantly through anyone's first
session. Chain capture rides `setChainLabel()` so no increment site can miss it; speed rounds and
clamps before comparing so localStorage sees at most ~55 writes ever, not one per frame.
`recordsSummary()` is pure; harness4 §27 asserts capture/monotonicity/clamping and the exact
summary copy for every combination (including "chain ×1 isn't worth printing"). 29/29 JS-queried
ids verified in the HTML. CACHE v108.

Queue remaining: date-seeded dusk tint, then open (additive only).

**Pass 21 — 15:07, shift iteration 2: landing roll.**
Queue item 2. The band just under the crash threshold (20–32 m/s) is now a skill window: hold
forward as you touch down and the landing **rolls** — the air chain survives the touch (every other
airborne landing still resets it), and `ROLL_CONVERT` (0.35) of the fall speed converts into
forward speed along the current heading, capped at `MAX_SPEED`. Above the threshold nothing
changes: the roll is window mastery, not a pardon. A held 0.4s tuck pose (`roll`, added to
harness2's set with a knees-in/torso-forward assertion), soft `roll` sound, small dust, no input
lockout — it's a reward, not a stun.

Enabling refactor: the landing branch lived inside `groundCheck()` behind the raycast, which
returns nothing under the stub harness — the rules were untestable in place. Extracted to
`resolveLanding(groundY)`; `groundCheck` now just decides *whether* you landed, `resolveLanding`
decides what the landing *means*. harness4 §26 drives the full rule matrix directly: roll
(chain/boost/timer), plain landing, crash unaffected (roll can't save you past 32), below-window,
both inclusive edges, heading preservation (exact ratio), the speed cap, the near-stationary case
(chain kept, no boost), pose gating, and the already-grounded no-op. CACHE v107.
One rare cyan prize on the map at a time — cyan against the reward palette's amber, so it reads as
a different kind of thing from across the city. Spawns far from the player (tries for ≥80u
horizontal, best-effort farthest-clear candidate otherwise, never inside geometry — reuses
`randomOrbPosition` + `orbClearOfBuildings`), pays a flat +15, joins the air chain when taken
airborne, blinks its last 5s as a leaving-soon warning, then relocates on a 45s cadence (first one
~18s into a run). Client-local like all orbs; only scores sync. State lives in real variables
(`bonusActive/bonusLife/bonusTimer/bonusPos`) precisely so the stub-THREE harness can assert the
whole lifecycle: §25 covers timer→spawn, one-at-a-time (spawn timer frozen while active), 200
placement spawns (200/200 met the 80u bar, all clear, all finite), expiry→retimer, airborne
collection (+15, chain, deactivate, retimer), grounded collection (no chain), and no distant
pickup. Menu rule row added to both lists. CACHE v106.

**Pass 19 — 2026-08-15, iteration 17 — FINAL. Loop stopped by its own criterion.**

Fresh line-by-line read of the last unexamined sections (renderer setup, texture makers, strand
builder, touch pinch/look). Two finds, both small:

- **Resize now re-applies `setPixelRatio`** (before `setSize`, which computes the drawing buffer
  from the current ratio). Dragging the window between a 1x and 2x monitor fires resize but kept
  the startup ratio — blurry on the way up, wasted fill-rate on the way down.
- **The touch stick is analog now.** The wish vector was always renormalized to unit length, so a
  10% deflection sprinted at full speed. It now normalizes only above unit length: keyboard
  cardinals and diagonals are bit-identical (asserted: cardinal = RUN_SPEED closed-form, diagonal =
  cardinal), and a partial stick deflection walks. The analog path itself is untestable under the
  harness (isTouchDevice is a const, no touch in the sandbox) — reasoned, not proven.

That the best a full read produces is two one-liners is the stop signal declared in pass 18.
**Cron `fdb71861` deleted — no loop is running.** `standby-timeout-ac` restored to 15 min; the
keep-awake process had already self-released at its 09:00 deadline. Restart the mission any time
with `/loop 1h <the pass-14 prompt>`.

**State at stop:** everything through v99 is committed and pushed (`a2dbb8a`). Passes 14-19
(v100→v105: ghost liveness, frame-rate independence + score coercion, yaw seam + safe-area,
chrome design pass, wind lifecycle, this pass) are **uncommitted in the working tree** per the
loop's no-commit rule. Deploy to the live server has never happened — it still awaits the deploy
key (`~/.ssh/id_ed25519_valk.pub`) being added on the box. Open items for a human: session
structure (design decision), swing-constraint oscillation and the pass-17 chrome design (need
eyes), a device check of the safe-area insets.

**Pass 18 — 2026-08-15, iteration 16 (the wind droned forever in a hidden tab):**

The frame loop is rAF-driven and rAF freezes in a hidden tab — but **WebAudio keeps running**.
Hide the tab mid-dive and `updateWind()` never runs again, so the looped noise source kept playing
at its last gain indefinitely while the user read another tab. Second hole in the same area: after
the start click nothing ever calls `audioCtx.resume()` again, so an OS-suspended context (phone
call, interruption — routine on iOS) left the game silent until a full reload.

Fix: a `visibilitychange` handler (separate from the input-clearing one — input concerns stay in
the input section) flips `windSuspended` and writes the gain directly — the one place it can be
silenced once frames stop — and on return calls `resume()` if the context is suspended.
`windTargetGain(spd)` is the extracted pure decision (`muted || suspended → 0, else the curve`),
same pattern as `windParamsForSpeed`: the graph is unassertable under test, the decision isn't.
harness4 §23 pins all three states plus exact agreement with the curve in the normal state.

**Pass 17 — 2026-08-15, iteration 15 (design pass on the chrome, guided by frontend-design):**

The user installed the frontend-design plugin mid-loop — read as a steer toward visual work. The
least-designed surface was the DOM chrome: template glassmorphism panel, gradient title text, and a
paragraph-length controls list. Direction chosen (skill's process, plan-then-critique):

- **The subject designs the chrome.** The menu card now *hangs in a web* — two taut strands run
  from the top screen corners and cross behind the panel (pseudo-elements on `#menu`, NOT `.panel`,
  whose `overflow-y: auto` would clip them; deliberately asymmetric angles; each strand's gradient
  brightens at its own anchor corner). Suit red/blue survive as a 2-line inset keyline on the
  panel's top edge instead of gradient text.
- **Amber = reward, red = risk, as a system.** The accent is the orb's own amber (the thing the
  player chases); score pill, SWING in the title, Start button, rule markers, leaderboard scores.
  The suit red appears exactly once in the copy system: the Wipeout line.
- **Controls list → key map.** `<kbd>` chips + one job per line, then four labeled scoring rules
  (three amber `gain`, one red `risk`). Same information, a fraction of the reading. Both lists'
  ids (`controls-list-desktop`/`-touch`) unchanged — verified all 27 JS-queried ids survive.
- **Monospace as the instrument voice**: score/speed/best readouts and leaderboard scores, tabular
  numerals. Leaderboard rows get real rank numbers via CSS counters, gated with `li:has(span)` so
  the empty state isn't numbered (no-`:has()` browsers just skip numbering).
- **One orchestrated entrance** (panel settles, strands fade), inside
  `prefers-reduced-motion: no-preference`. Cut in the restraint pass: halftone, ambient animation,
  any second accent.

Verified: all harnesses pass (JS untouched), 27/27 ids present, CSS braces balanced. Honest limit:
this is the one pass whose result genuinely needs eyes — the geometry of the strands (36°/−41°)
is reasoned, not seen. If it reads badly on screen, the strands are pure decoration and can be
deleted as one block (`#menu::before/::after`) without touching anything else.

**Pass 16 — 2026-08-15, iteration 14 (ghosts pirouetted at the ±π seam; notch-safe touch layout):**

The yaw wrap flagged in pass 15, fixed. atan2 yaws live on a circle, but the ghost lerp treated
them as plain numbers, so the ±π seam read as distance: a player reversing from +3.1 to −3.1 rad
(a 0.083 rad turn through the seam) sent their ghost spinning ~6.2 rad the long way. In a game
that's all direction reversals, every ghost pirouetted regularly.

`angleDelta(from, to)` returns the shortest-path difference in (−π, π]; the ghost yaw ease now
applies it. The **local** avatar snaps yaw by direct assignment (no lerp), so it never had the bug
and is untouched. harness4 §22 pins the two seam crossings, a ~1500-pair sweep asserting range and
`from + delta ≡ to (mod 2π)`, and a convergence sim showing easing across the seam travels ~0.083
rad, not 6.2.

CSS rider: the page opts into the full screen (`viewport-fit=cover`) but nothing consumed the
safe-area insets, so on notched phones the joystick and buttons sat under the home-indicator bar
and the HUD corner under the landscape sensor housing. All four anchored elements (joystick,
buttons, back-link, HUD padding) now add `env(safe-area-inset-*)` using the double-declaration
fallback pattern — browsers without `env()` keep the first declaration. Not harness-verifiable
(CSS); the pattern is standard and degrades to the previous values.

**Pass 15 — 2026-08-15, iteration 13 (the game played differently at 144Hz than at 60Hz):**

Most physics integrates with `dt` correctly, but several smoothing factors were **per-frame
constants**: ground accel `* 0.3`/frame, air control `* 0.06`/frame, ground friction `*= 0.8`/frame,
camera + ghost lerps `* 0.25`/frame, dust drag `* 0.94`/frame. At 144Hz that's ~2.4x harder
acceleration and per-second friction of 0.8^144 vs 0.8^60 — a high-refresh player and a 60Hz player
were playing measurably different games, feeding the same leaderboard.

Fix: `expBlend(rate, dt) = 1 - exp(-rate * dt)` everywhere, with rates calibrated so **60fps
behavior reproduces the old per-frame factors exactly** (rate = 60·-ln(1-f), or 60·-ln(f) for decay
multipliers): CAM/GHOST 17.3, GROUND_ACCEL 21.4, AIR_ACCEL 3.7, FRICTION 13.4, DUST 3.7. The
already-dt-scaled Euler forms (shake 5.5, fov 4, trail 6, POSE_BLEND 11) were converted to the same
exp form — Euler `dt*k` is only approximately rate-independent and drifts at 30Hz. The exponential
recurrence has a closed form (v(T) = wish + (v0-wish)·e^(-kT)), so convergence is *exactly* the
same at any rate, not just approximately.

harness4 §20 pins three things: the composition property (two half-steps land exactly where one
full step does, <1e-12), the 60fps calibration (old factors reproduced within 0.2%), and end-to-end
physics — one simulated second of holding W (and one of friction decay) at 30/60/144Hz through the
real `updateInputMove` must agree within 1e-9. §12's allocation test still passes (Math.exp
allocates nothing), and harness2 still passes with the pose-blend form change.

Rider: `sanitizeScore()` coerces leaderboard scores to a clamped integer before they cross
`innerHTML`. The server already clamps (`server.js:2612`), so this is belt-and-braces against a
future server regression becoming an XSS in every viewer's leaderboard — not a live hole. §21.

Not touched, deliberately: the ghost yaw lerp's wrap-around at ±π (a ghost turning from +3.1 to
-3.1 rad briefly spins the long way). Pre-existing, cosmetic, and orthogonal to rate independence.

**Pass 14 — 2026-08-15, iteration 12 (stale ghosts — the parked item, unparked):**

Context: everything through v99 was committed and pushed earlier today (`7361033` + merge
`a2dbb8a`, which preserved supdid's voice-call work and kept CACHE_NAME at v99). Deploy to the
server is still pending — isaac/Asher need to add the deploy key from `~/.ssh/id_ed25519_valk.pub`.
This pass's work is uncommitted on top, per the loop rules.

Pass 9 parked ghost pruning: "any timeout risks deleting a live player during a temporary stall,
and a vanishing teammate is worse than a motionless one. That needs a real heartbeat, not a guess."
Re-examined, the objection dissolves in two steps:

1. **The heartbeat already exists.** `sendPosBroadcast()` streams sw-pos at ~10/s foregrounded and
   ~1/s backgrounded (rAF throttling) regardless of movement. No packet for 15s = suspended or gone.
2. **The real hazard was deletion, so don't delete — hide.** A phone resuming from its lock screen
   keeps its socket and id, and the server never re-announces it; sw-pos for an unknown id is
   dropped on the floor. A *deleted* ghost would therefore be invisible forever. A *hidden* one
   snaps back on its next packet.

Implementation: `GHOST_HIDE_MS` (15s) hides body + strand and skips the per-frame lerp/pose work;
`touchRemotePlayer()` (receive-side) stamps `lastSeen` and revives; `GHOST_DROP_MS` (5 min) finally
drops the slot so a long-lived room doesn't accumulate dead entries — far past any plausible
suspend-and-resume, at which point the socket itself would be long dead. Strand re-show is free:
`updateWebStrand` handles it the frame after revival, and is skipped while hidden so it can't
re-show a hidden ghost's rope.

harness4 §19 drives it with a controllable clock (`performance.now` is a sandbox global): fresh
ghost visible → hides past 15s → **entry still in the map** → one packet revives → a 1Hz
backgrounded sender never flickers hidden across 60s → drops at 5min → mid-iteration Map deletion
leaves the other live ghost untouched. Assertions are on `rp.hidden`/`lastSeen`/map membership —
real values, never the stubbed `group.visible`.

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

# Block Battle (FPS) feature drop — 2026-08-17, evening

Built on top of Asher's step-6 weapon ladder in `public/game.js` — renamed minutes later to
`public/blockbattle.js` by the rename pass; everything below survived the move. Six features, all
client-side. `CACHE_NAME` bumped v109 → v110 for the deploy.

- **Sound** — all synthesized WebAudio (`playTone`/`playNoise` + a `GUN_SOUNDS` table), no audio
  files. The context boots inside the "Click to play" click because browsers require a user gesture;
  every sfx function no-ops until then, so pre-click sounds (wave 1's fanfare) are silently skipped
  rather than erroring.
- **Bot line of sight + AI states** — `lineOfSightClear()` samples the `occupied` column map every
  fifth of a block, so tower walls are now real cover both ways. Bots wander blind → chase on sight
  (orbit inside 4 blocks, `orbitSign` picks the direction per bot) → hunt the last seen position for
  4s → give up. A bot whose fire timer expires without sight holds at 0.3–0.7s, so peeking gives you
  a beat before the shot. They face where they walk now, only facing you when they see you — which
  quietly telegraphs "I've been spotted".
- **Waves replace respawns** — wave N is `min(1+N, 8)` bots, fire interval shrinks 0.35s/wave with a
  1.8s floor. Dead bots are fully removed (`removeBot` cleans `meshToBot`/`botMeshes`, so raycasts
  don't hit ghosts); empty field → "cleared" banner → 3s breather → next wave. Wave state freezes
  while the player is dead.
- **Best run in localStorage** — key `valk-fps-best`, `{wave, kills}`. Kills still carry across
  deaths for the weapon ladder, so the scoreboard counts per-run kills via `killsAtRunStart`. Death
  screen shows this run, the best, and a New Record line.
- **Health packs** — every dead bot drops a spinning green cross: +25, despawns in 10s, blinks its
  last 2s, and refuses to be consumed at full health so it's still there when you need it.
- **Slide-jump** — Space mid-slide carries the slide's full velocity into the air (`airMom*`,
  cleared on landing); input steers at 25% while airborne. Sprint-slide-jump chains are now the fast
  way across the map. FOV boost applies during it.

Not done (next up, big): **1v1 multiplayer** — Asher wants an invite sent inside Valk chat that the
other player accepts. Needs server-side rooms + position/shot sync in `server.js`; plan before
touching, the chat server is live.

## Mode select — added 2026-08-17, late evening

Block Battle now opens on a mode screen (`#mode-select`, z-26 — above hint/death, under the back
link) with three choices:

- **Wave Challenge** — the existing escalating-waves game, untouched.
- **FS** — 4 enemies at all times (`FS_BOTS`), each respawning elsewhere 5s after dying
  (`FS_RESPAWN_TIME`, the old pre-wave behavior, via a re-added `respawnBot`). Own best-kills
  scoreboard under localStorage key `valk-fps-best-fs`; the death screen branches on mode.
- **Online Play** — disabled placeholder ("Coming soon") until the 1v1-through-Valk-invites
  feature is built.

Wiring that matters: all wave logic is gated on `mode === 'wave'` so FS never triggers
wave-cleared banners; `respawn()` and the dead-bot branch branch per mode; **the knife finisher's
'launch' death also respawns in FS instead of `removeBot`** — without that, finisher kills would
permanently shrink the FS field to zero bots. M on the death screen exits pointer lock and returns
to the mode screen (works from the pause overlay too); mode buttons `stopPropagation` so the
document-level dead-click respawn doesn't fire. The sim already starts paused until pointer lock,
so nothing runs behind the mode screen. `sw.js` was already bumped to v111 for the next deploy —
these changes ride along, no extra bump.

## Wave-mode sidekicks — added 2026-08-17, late evening

Wave Challenge now fields blue bots on the player's team: **one sidekick joins on wave 1, a second
on wave 2, capped at `MAX_ALLIES = 2`** (Asher's ask: "two for each person, max two sidekicks").
FS mode has none. How it hangs together:

- **Roster** — `allies[]` next to `bots[]`. `startWave` sweeps out the dead, heals survivors to
  `ALLY_MAX_HEALTH` (100), and tops up to `min(wave, MAX_ALLIES)`, so a fallen sidekick walks back
  in with the next wave. They spawn on the first clear spot within ~1–3 blocks of the player.
  `startMode` and `respawn` clear the roster with everything else.
- **Sidekick AI** — mirror of the red-bot loop: pick the nearest living red (preferring one in
  sight), chase it out of sight or past 5 blocks, strafe inside 3, hold-and-shoot in between, with
  the same wedge-sidestep trick. No enemies → fall in ~2 blocks off the player's shoulder. Eyes
  glow cyan when they have a target (the reds' red-eye tell, in team colors). Fire every
  `ALLY_FIRE_INTERVAL` (1.5s) for `ALLY_DAMAGE` (10) — a sidekick needs 5 hits to drop a 50hp bot,
  so they help without stealing the show.
- **Red bots now pick targets** — `seesPlayer` became `seesTarget` + `tgtX/Y/Z`: each frame a bot
  targets the nearest of {player, living sidekicks} it has line of sight to, and chases/faces/
  shoots *that*. Sidekicks genuinely draw fire.
- **One bullet system** — `fireBullet(ox, oz, tx, ty, tz, friendly)` serves both teams; friendly
  bullets are blue (`allyBulletMat`) and only test red bots, hostile ones test the player then
  sidekicks. `sfxBotShot` volume now keys off the shooter's distance to the *player* (the
  listener), not to whatever it's aiming at.
- **No score inflation** — `damageBot`'s `kills += killCredit || 1` became `kills += killCredit`;
  sidekick hits pass 0, so ally kills still drop health packs and play the kill chime but don't
  climb the weapon ladder or the per-run scoreboard. All player call sites already passed 1/2
  explicitly.
- **No friendly fire** — ally meshes are never added to the raycast list (player shots pass
  through), friendly bullets skip the player, and RPG blasts/knife arcs only iterate `bots`.
- Wave-clear still keys off `bots.length === 0` — allies live in their own array, so a surviving
  sidekick doesn't stall the next wave. `sw.js` already sits at an uncommitted v112 bump for the
  next deploy; these ride along, no extra bump (JS is network-first anyway).

## Sniper scopes — added 2026-08-18

Both snipers (`scope: true` in WEAPONS) zoom while right-click is held: FOV 70 → 42 (`SCOPE_ZOOM`
0.6, a 40% zoom), mouse sensitivity scaled by the same factor, gun viewmodel hidden behind a CSS
ring overlay (`#scope-overlay`, z-9 so the crosshair stays visible as the center dot). `scopedNow()`
gates everything so right-click on non-snipers (or with the knife out, or dead) does nothing;
`contextmenu` is suppressed page-wide. Scope releases on mouseup, blur, and is ignored while paused
(mousedown requires pointer lock).
