// Porto Vela — selftest: the ?autopilot=1 suite. 43 checks that drive the
// real game through its public window.__game API — driving, camera settle,
// police, combat, all eight missions, save/load, the chase-pose car size
// — then writes AUTOPILOT-PASS / AUTOPILOT-FAIL into the title and a
// "43/43 PASS" line into #test-results.
import * as THREE from '../vendor/three.module.min.js';
import { S } from './settings.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(r));
async function waitFor(fn, timeout = 10000, step = 120) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeout) {
    if (fn()) return true;
    await sleep(step);
  }
  return fn();
}

export async function runAutopilot(g) {
  const results = [];
  const check = async (name, fn) => {
    try {
      const ok = await fn();
      results.push([name, !!ok]);
      // eslint-disable-next-line no-console
      console.log(`[autopilot] ${ok ? 'PASS' : 'FAIL'} ${name}`);
    } catch (e) {
      results.push([name, false]);
      console.log(`[autopilot] FAIL ${name}: ${e.message}`);
    }
  };
  const aimAt = (x, z) => { g.cam.yaw = Math.atan2(x - g.player.x, z - g.player.z); };
  const pressE = async () => { g.interactPressed = true; await frame(); await frame(); await sleep(150); };

  g.resetRun();
  await sleep(300);

  await check('game object exists', () => !!g && !!window.__game);
  await check('renderer and scene exist', () => !!g.renderer && !!g.scene);
  await check('player spawns at (-60,-150)', () => Math.abs(g.player.x + 60) < 1 && Math.abs(g.player.z + 150) < 1);
  await check('startGame enters playing state', () => { g.startGame(); return g.state === 'playing'; });

  // Driving + camera settle (fix F1)
  await check('enter car at garage', () => {
    g.setPlayer(-108, 30);
    return g.cars.tryEnterCarAt(g.player.x, g.player.z) && !!g.player.car;
  });
  await check('car accelerates past 5 m/s', async () => {
    g.input.keys.add('KeyW');
    const ok = await waitFor(() => Math.abs(g.player.car.speed) > 5, 6000);
    g.input.keys.delete('KeyW');
    return ok;
  });
  await check('camera yaw error settles <= 3 deg', async () => {
    g.input.keys.add('KeyW');
    g.cam.yaw += 0.5; g.cam.lastDragT = 0; // staged drag, then hands off
    // Wait on GAME time, not wall time: headless swiftshader runs slow,
    // so the 1.5 s idle gate must be measured in game seconds.
    const settled = await waitFor(() => g.cam.lastDragT > 2.4, 12000);
    await sleep(400);
    const err = g.cam.yawError;
    g.input.keys.delete('KeyW');
    return settled && err <= 3;
  });
  await check('draw calls < 600', async () => { await frame(); await frame(); return g.renderer.info.render.calls < 600; });
  await check('minimap is 190px', () => {
    const m = document.getElementById('minimap');
    return m && m.width === 190 && m.height === 190;
  });
  await check('msg pill shows', async () => {
    g.display.msg('autopilot probe', 2000);
    return document.getElementById('msg').classList.contains('show');
  });
  await check('radio cycles 3 stations', () => {
    const a = g.sound.stationName();
    g.sound.nextStation(); const b = g.sound.stationName();
    g.sound.nextStation(); const c = g.sound.stationName();
    g.sound.nextStation();
    return a !== b && b !== c && a === g.sound.stationName();
  });
  await check('save/load roundtrip', () => {
    g.cash = 1234; g.saveGame();
    g.cash = 99999; g.loadSave();
    return g.cash === 1234;
  });
  await check('3 stars spawns heli', async () => {
    g.police.setStars(3);
    await sleep(400);
    return !!g.police.heli;
  });
  await check('3 stars spawns >= 5 cruisers', () => g.police.cars.length >= 5);
  await check('0 stars clears police', async () => {
    g.police.setStars(0);
    await sleep(300);
    return g.police.cars.length === 0 && g.police.cops.length === 0 && !g.police.heli;
  });

  // Combat
  await check('shoot hits an enemy', async () => {
    g.setPlayer(0, 0);
    if (g.player.car) g.cars.exitCar();
    const es = g.fight.spawnEnemies(1, 10, 10);
    aimAt(es[0].x, es[0].z); // aim at the ACTUAL enemy, not the spawn centre
    const hp0 = es[0].hp;
    g.combat.shoot();
    await sleep(100);
    return es[0].hp < hp0;
  });
  await check('SMG ammo decreases on shoot', async () => {
    g.combat.weaponIndex = 1;
    const a0 = g.combat.ammo.smg;
    const e = g.fight.enemies[0];
    if (e) aimAt(e.x, e.z);
    await sleep(450); // let the pistol cooldown (0.32 s GAME time) expire
    await waitFor(() => g.combat.cooldown <= 0, 5000);
    g.combat.shoot();
    await sleep(150);
    g.combat.weaponIndex = 0;
    return g.combat.ammo.smg === a0 - 1;
  });
  g.fight.clearEnemies();

  // Missions M1-M8, in order, through the real quest logic
  g.resetRun();
  g.startGame();
  await check('M1 First Wheels completes (+500)', async () => {
    g.missions.start(1);
    g.setPlayer(-120, 24); await pressE();
    g.setPlayer(-60, -168);
    return waitFor(() => g.missions.completed.has(1), 5000);
  });
  await check('M2 The Pickup completes (+800)', async () => {
    g.missions.start(2);
    g.setPlayer(264, 60); await pressE();
    g.setPlayer(-60, -168);
    return waitFor(() => g.missions.completed.has(2), 5000);
  });
  await check('M3 Hot Pursuit completes (+1200)', async () => {
    g.missions.start(3);
    g.police.setStars(0);
    return waitFor(() => g.missions.completed.has(3), 5000);
  });
  await check('M4 spawns 4 rivals', async () => {
    g.missions.start(4);
    await sleep(200);
    return g.fight.enemies.length === 4;
  });
  await check('M4 Dockside Deal completes (+2000)', async () => {
    g.setPlayer(256, 116);
    if (g.player.car) g.cars.exitCar();
    g.setPlayer(256, 116);
    g.player.health = 100; g.player.armour = 100; // survive the crossfire
    for (let tries = 0; tries < 40 && g.fight.enemies.length > 0; tries++) {
      const e = g.fight.enemies[0];
      aimAt(e.x, e.z);
      g.combat.shoot();
      await sleep(420);
    }
    if (g.fight.enemies.length > 0) return false;
    await sleep(300);
    g.setPlayer(264, 120); await pressE();
    return waitFor(() => g.missions.completed.has(4), 5000);
  });
  await check('M5 Getaway Driver completes (+2500)', async () => {
    g.missions.start(5);
    g.setPlayer(60, 232);
    await waitFor(() => g.missions.step === 2, 5000);
    g.setPlayer(-150, -232);
    return waitFor(() => g.missions.completed.has(5), 5000);
  });
  await check('M6 informant sedan spawns', async () => {
    g.missions.start(6);
    await sleep(300);
    return !!g.missions.informant && g.missions.informant.hp === 120;
  });
  await check('M6 The Informant completes (+3000)', async () => {
    // The player car drove off during the driving test — bring it back
    // to the garage before trying to enter it.
    const pc = g.cars.playerCar;
    pc.x = -108; pc.z = 30; pc.heading = Math.PI / 2; pc.speed = 0;
    pc.mesh.position.set(-108, 0, 30); pc.mesh.rotation.y = Math.PI / 2;
    g.setPlayer(-108, 30);
    if (!g.cars.tryEnterCarAt(g.player.x, g.player.z)) return false;
    const t0 = performance.now();
    while (performance.now() - t0 < 9000) {
      const inf = g.missions.informant;
      if (!inf || inf.hp <= 0) break;
      if (!g.player.car) return false;
      g.player.car.x = inf.x; g.player.car.z = inf.z;
      g.player.x = inf.x; g.player.z = inf.z;
      await sleep(120);
    }
    return waitFor(() => g.missions.completed.has(6), 5000);
  });
  await check('M7 van steal sets 3 stars', async () => {
    g.missions.start(7);
    if (g.player.car) g.cars.exitCar();
    g.setPlayer(-180, 232); await pressE();
    return waitFor(() => g.player.car && g.player.car.kind === 'van' && g.police.stars === 3, 5000);
  });
  await check('M7 Beachfront Heist completes (+4000)', async () => {
    g.setPlayer(-60, -168);
    return waitFor(() => g.missions.completed.has(7), 5000);
  });
  await check('M8 survive step advances', async () => {
    g.missions.start(8);
    g.timeScale = 10;
    const ok = await waitFor(() => g.missions.step === 2, 30000);
    g.timeScale = 1;
    return ok;
  });
  await check('M8 King of Vela completes (+5000)', async () => {
    g.setPlayer(60, 232);
    return waitFor(() => g.missions.completed.has(8), 5000);
  });
  await check('cash totals $19,000', () => {
    console.log(`[autopilot] final cash $${g.cash}`);
    return g.cash === 19000;
  });

  // Wanted decay: only cruiser/cop distance counts
  await check('wanted decays when police are far', async () => {
    g.police.setStars(2);
    g.timeScale = 8;
    const spots = [[-280, -280], [280, -280], [-280, 200], [200, 200]];
    let decayed = false;
    for (let i = 0; i < 40; i++) {
      const [x, z] = spots[i % 4];
      g.setPlayer(x, z);
      await sleep(300);
      if (g.police.stars < 2) { decayed = true; break; }
    }
    g.timeScale = 1;
    return decayed;
  });
  await check('traffic has 14 cars and moves', async () => {
    const c0 = g.cars.traffic[0];
    const x0 = c0.x, z0 = c0.z;
    await sleep(1200);
    return g.cars.traffic.length === 14 && (c0.x !== x0 || c0.z !== z0);
  });
  await check('17 pedestrians, 5 on the beach', () => {
    const ps = g.cars.pedestrians;
    return ps.length === 17 && ps.filter((p) => p.beach && p.z >= 288 && p.z <= 298).length === 5;
  });
  await check('heli orbit angle advances', async () => {
    g.police.setStars(3);
    await sleep(300);
    const a0 = g.police.heli.angle;
    await sleep(1000);
    const moved = g.police.heli.angle > a0;
    g.police.setStars(0);
    return moved;
  });
  await check('siren on at 2 stars, off at 0', async () => {
    g.police.setStars(2);
    await sleep(300);
    const on = g.sirenActive === true;
    g.police.setStars(0);
    await sleep(200);
    return on && g.sirenActive === false;
  });
  await check('resetRun restores spawn and cash 0', () => {
    g.resetRun();
    return g.cash === 0 && g.missions.completed.size === 0
      && Math.abs(g.player.x + 60) < 1 && g.police.stars === 0;
  });

  // Chase pose: the player car's projected HEIGHT should read ~66 px on
  // screen at the staged ~20 m camera (fix F3). The car's length projects
  // diagonally from this 3/4 angle, so the bounding-box width is wider;
  // the height is the honest vertical size of the car in frame.
  await check('chase pose car reads ~66px', async () => {
    g.startGame();
    g.poses.applyPose('chase');
    await frame(); await frame();
    const car = g.cars.playerCar;
    const v = new THREE.Vector3();
    const pts = [];
    for (const [dx, dy, dz] of [[-1.1, 0, -2.3], [1.1, 0, -2.3], [-1.1, 1.6, -2.3], [1.1, 1.6, -2.3], [-1.1, 0, 2.3], [1.1, 0, 2.3], [-1.1, 1.6, 2.3], [1.1, 1.6, 2.3]]) {
      v.set(car.x + dx, dy, car.z + dz).project(g.camera3);
      pts.push([(v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight]);
    }
    const ys = pts.map((p) => p[1]);
    const heightPx = Math.max(...ys) - Math.min(...ys);
    g.shotFreeze = false;
    g.police.setStars(0);
    console.log(`[autopilot] chase car height ${Math.round(heightPx)}px`);
    return heightPx >= 40 && heightPx <= 90;
  });
  await check('sun disc is orange and halo present', () => {
    // getHex() reports sRGB channels; the stored colour is linear, so
    // read it back through the sRGB conversion, not the raw floats.
    const hex = g.town.sunDisc.material.color.getHex();
    const r = (hex >> 16) & 0xff, gg = (hex >> 8) & 0xff, b = hex & 0xff;
    return r === 0xff && gg >= 0x50 && gg <= 0x8a && b <= 0x20
      && !!g.town.sunHalo && Math.abs(g.town.sunHalo.material.opacity - 0.28) < 0.01;
  });
  await check('city has 50+ building colliders', () => g.town.colliders.length >= 50);
  await check('fps counter is live', () => g.fps > 0);
  await check('no console errors recorded', () => window.__errors.length === 0);
  await check('no failed requests recorded', () => window.__failedReqs.length === 0);
  await check('Mara dialog shows', async () => {
    g.display.dialog('Mara', 'Autopilot probe line', 2000);
    return document.getElementById('dialog-text').textContent === 'Autopilot probe line';
  });

  const passed = results.filter((r) => r[1]).length;
  const total = results.length;
  const line = `${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`;
  g.display.setResults(line + ' — ' + results.filter((r) => !r[1]).map((r) => r[0]).join('; '));
  document.title = passed === total ? 'AUTOPILOT-PASS' : 'AUTOPILOT-FAIL';
  console.log(`[autopilot] ${line}`);
  return { passed, total, results };
}
