# Porto Vela r3 — BUILD LOG

Anchor: `makefun anchor 91754ebcca7a15be174b59dcddc80615f1ea1bca round 34081930`
Kit level 20: `~/workspace/makefun/kit/gta6-01-kit20/extracted/gta6-01-kit/`
Builder session: fresh full rebuild from `gta6-01-r3-design.md` only.
No file was copied, pasted or re-typed from any earlier game build; the only
identical files are the two kit libraries (three.module.min.js,
vendor/makefun-game.ts) plus LICENSE from init.

## Plan
1. Verify the Chrome/CDP harness with a minimal test page (per the revised
   brief — no earlier build used for this).
2. Write the whole game fresh: 14 modules under game/src/ + index.html,
   main.ts, serve.ts, shots.json.
3. Test: node --check, HTTP 200, CDP smoke, autopilot 43/43, mission
   probes, 4 dossier screenshots (visual check), main.ts dossier build.
4. Commit on top of the anchor. No push, no submit, recorder left running.

## Harness verification (minimal page, /tmp/harness-test)
- index.html + app.js: one local module script importing the vendored
  three.module.min.js by file URL — the exact import the game uses.
- Result: title PROBE-READY, 0 console errors, 0 failed requests, no
  `net::ERR_ABORTED`. Harness OK.
- Notes for the next session:
  - The CDN variant of the probe failed in headless Chrome with
    `net::ERR_TUNNEL_CONNECTION_FAILED` for unpkg.com (browser egress
    blocks it; shell curl works). The game vendors three.js locally, so
    it is unaffected — but never rely on a CDN at runtime here.
  - Chrome only starts with `--hatch-webgl-allowed-domains-file` +
    `--hatch-webgl-allowed-domains-sha256` (policy file
    `~/workspace/makefun/webgl-policy.txt`, copied to /tmp — /tmp is
    wiped on VM restart) plus `--allow-file-access-from-files`.
  - `http://127.0.0.1` loads are blocked by Local Network Access checks
    when navigated from about:blank, so all CDP tests load the game via
    `file://`. serve.ts was verified separately with curl (HTTP 200).
  - Headless swiftshader runs at ~5 fps; dt is clamped to 0.1 s, so game
    time runs at ~0.5x wall time. Time-based test waits must poll on
    GAME time, not wall time.
- Transparency: before the strict no-r2 rule arrived in this session, one
  harness load of the earlier build was done via CDP (it formed
  `window.__game`, 0 errors). After the rule arrived, no earlier-build
  directory was opened or listed again; everything below was built from
  the design document only.

## What was built (2,081 lines across 14 modules)
- `settings.js` — all tuned numbers, mission defs, radio, districts.
- `rng.js` — mulberry32 seeded RNG, `?seed=` replays the same city.
- `town.js` — one canvas-painted ground plane (roads/sand/sea/docks/parks,
  1 draw call), box buildings with 6 canvas facades + 7 roof colours
  (roofs on ~35%), billboards, 7 district signs, beach props, docks
  (containers, 4 emissive floodlights, yacht La Sirena), sun disc + halo.
- `cars.js` — player car, 14 traffic cars (road following, turn at
  intersections, respawn), 8 parked cars to steal, 17 pedestrians
  (12 street + 5 bright beach walkers), driving physics + AABB push-out.
- `cops.js` — wanted stars, cruisers min(2+★,7), foot cops min(★,4) at
  2+★, heli at 3+★ (dt-driven orbit 0.35 rad/s), decay only from
  cruiser/foot-cop distance (heli never counts), siren by nearest dist.
- `fight.js` — pistol 34 dmg/42 m/0.32 s, SMG 22/36/0.11 s/120 ammo,
  tracers, enemy shooters (2 dmg, armour first), death/respawn.
- `quests.js` — 8 story jobs, steps 1-based, E prioritises mission
  interact over entering a car.
- `camera.js` — chase cam, F1 idle-ease (2.2/s, 1.4/s when near, after
  1.5 s idle, driving only); yaw is the view/aim direction.
- `display.js` — HUD, #msg pill (F2), Mara portrait dialogs, bright
  190 px minimap (F7) with S/G/Y/! markers and a white down-triangle
  player arrow rotated by -heading.
- `keys.js` — keyboard + mouse drag look, click shoot, 1–8 start jobs
  (1/2 swap weapons mid-job), Q cycles weapons, R radio, M mute, P pause.
- `sound.js` — all WebAudio synth: 3 radio stations (kick + bass),
  two-tone siren, engine hum, gunshot noise.
- `poses.js` — cover / chase / mission / title shots, world frozen.
- `selftest.js` — the ?autopilot=1 suite, 43 checks.
- `boot.js` — wiring, game loop, `window.__game` contract.
- `index.html`, `main.ts`, `serve.ts`, `shots.json` (4 shots).
- three.js 0.160.0 vendored (670,681 bytes, downloaded from unpkg with
  a 30 s timeout); `vendor/makefun-game.ts` from the kit starter.

## Fixes F1–F9 (all in)
- F1 camera yaw error ≤3° when settled (autopilot: PASS).
- F2 #msg pill 14 px, top 12%, dark + gold border.
- F3 chase pose: player car reads 64 px tall on screen (target ~66 px).
- F4 sun disc r36 0xff8a1e + halo r58 opacity 0.28, daylight → dusk
  slide over 480 s.
- F5 beach: 4 umbrellas, 6 towels, lifeguard tower (-80,288), 5 bright
  beach walkers z 292–297.
- F6 skyline: 6 facades, 7 roof colours (~35%), HOTEL MIRAMAR +
  CASINO DEL MAR billboards facing the beach, 7 district signs.
- F7 minimap 190 px, bright palette, markers + player arrow.
- F8 docks apron #96999e, 4 emissive floodlights (one at (258,126)),
  rivals in red jackets + yellow emissive hats, mission camera ~28 m,
  dialog docked bottom-left (class `shot-mission`).
- F9 performance: draw calls measured 105 in the probe (target ~357,
  check <600) — ground is a single painted plane, cars use 3 meshes.

## Test results
- `node --check`: 14/14 modules pass.
- serve.ts: index 200, boot.js 200, three.module.min.js 200 (curl).
- CDP smoke (file://): `window.__game` formed, 0 console errors,
  0 failed requests.
- Autopilot `?autopilot=1`: **43/43 PASS** — title AUTOPILOT-PASS.
  Key values: final cash $19,000 (all 8 missions), chase car height
  64 px, draw calls <600, yaw error ≤3°, heli spawns at 3★ and orbits,
  wanted decays when police are far, save/load roundtrip OK,
  radio cycles 3 stations, siren on at 2★ / off at 0★.
- Missions 2–8 probed through the autopilot (each start → complete
  through the real quest logic, no shortcuts except teleports).
- Screenshots (cdp-shot.mjs, real renders, visually checked):
  1-cover.jpg 80,523 B, 2-chase.jpg 61,526 B, 3-mission.jpg 47,173 B,
  4-title.jpg 98,045 B — all under the 256 KiB dossier cap.
- `main.ts`: MAKEFUN_OUTPUT_DIR=/tmp/r3-out → dossier.json 478,709 B,
  game/ 780 KiB / 16 files, screenshots 288 KiB. OK.

## Deviations / bugs found while testing (all fixed in-session)
1. Design doc's mission reward total "$18,000" is an arithmetic slip:
   500+800+1200+2000+2500+3000+4000+5000 = **$19,000**. The game and
   the autopilot use $19,000.
2. Buildings could poke into roads (offsets ±12 + width up to 26):
   constrained to width ≤20, offsets ±11, so every building stays
   inside its block interior (±24 m). This also fixed the chase camera
   sightline (see 3).
3. Chase pose moved off the design doc's camera (-19,4.5,58): with this
   seed's city a block building stands in that sightline and hides the
   car. Staged straight down the x=0 road centreline instead —
   camera (0,4.5,78) → look (0,3,100), car at (0,100), cruisers at
   (3,84), (-4,92), (5,116), heli at (6,22,90). Same ~20 m distance,
   car reads 64 px.
4. Poses must spawn police units directly and hide the start overlay
   and paint the minimap once: in shot mode the main loop is frozen,
   so cops.update() never tops units up (chase frame had no police),
   the title overlay covered the 3D scene, and the minimap stayed blank.
5. Sun colour must be read via getHex() — THREE stores colours linear,
   so the raw green float (0.25) is not the sRGB value (0x8a).
6. Autopilot waits must poll game time (see harness notes, ~5 fps).
7. `cops.js` first returned a spread copy of the police object, so
   `police.stars` never updated for readers — fixed to return the live
   object. Same class of bug checked in the other modules (arrays are
   shared by reference, safe).

## Files written this session
game/index.html, game/src/{boot,camera,cars,cops,display,fight,keys,poses,
quests,rng,selftest,settings,sound,town}.js, game/vendor/three.module.min.js,
main.ts, serve.ts, shots.json, screenshots/{1-cover,2-chase,3-mission,
4-title}.jpg, vendor/makefun-game.ts, BUILD_LOG.md (this file).
