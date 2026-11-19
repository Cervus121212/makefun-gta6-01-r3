// Porto Vela — fight: pistol + SMG, tracers, enemy shooters, armour and
// the death / respawn loop. Shots fly straight along cam.yaw — the probe
// sets cam.yaw = atan2(dx, dz) and clicks, so yaw is the aim direction.
import * as THREE from '../vendor/three.module.min.js';
import { S, clamp, dist2d, angDiff } from './settings.js';

export function createFight(g) {
  const { scene } = g;
  const combat = {
    enemies: [], tracers: [],
    ammo: { pistol: Infinity, smg: 120 },
    weaponIndex: 0, cooldown: 0,
  };
  const weaponNames = ['pistol', 'smg'];

  const spawnEnemies = (n, x, z, opts = {}) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Group();
      const jacket = opts.jacket ?? 0xc22a2a; // rivals wear red (fix F8)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.5),
        new THREE.MeshLambertMaterial({ color: jacket }));
      body.position.y = 0.8; mesh.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45),
        new THREE.MeshLambertMaterial({ color: 0xd8b898 }));
      head.position.y = 1.85; mesh.add(head);
      if (opts.hat) {
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 8),
          new THREE.MeshBasicMaterial({ color: 0xffe95a })); // yellow emissive hat
        hat.position.y = 2.12; mesh.add(hat);
      }
      const ex = x + g.rng.range(-6, 6), ez = z + g.rng.range(-6, 6);
      mesh.position.set(ex, 0, ez);
      scene.add(mesh);
      const e = { mesh, x: ex, z: ez, hp: 100, shootTimer: g.rng.range(0.4, 1.2), jacket };
      combat.enemies.push(e);
      out.push(e);
    }
    return out;
  };

  const clearEnemies = () => {
    for (const e of combat.enemies) scene.remove(e.mesh);
    combat.enemies.length = 0;
  };

  const addTracer = (from, to) => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe95a }));
    scene.add(line);
    combat.tracers.push({ line, life: 0.09 });
  };

  const shoot = () => {
    if (g.state !== 'playing' || combat.cooldown > 0) return false;
    const w = S.weapons[combat.weaponIndex];
    const name = weaponNames[combat.weaponIndex];
    if (combat.ammo[name] <= 0) {
      combat.weaponIndex = 0;
      g.display.msg('SMG dry — back to the pistol');
      return false;
    }
    combat.cooldown = w.rate;
    if (name === 'smg') combat.ammo.smg -= 1;
    const p = g.player;
    const ox = p.x, oy = p.car ? 1.4 : 1.5, oz = p.z;
    const yaw = g.cam.yaw;
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    // Nearest enemy inside the cone and range takes the hit
    let best = null, bd = w.range;
    for (const e of combat.enemies) {
      const d = dist2d(ox, oz, e.x, e.z);
      if (d > w.range) continue;
      const a = Math.abs(angDiff(Math.atan2(e.x - ox, e.z - oz), yaw));
      if (a < 0.09 && d < bd) { bd = d; best = e; }
    }
    const hx = ox + dx * bd, hz = oz + dz * bd;
    addTracer({ x: ox, y: oy, z: oz }, { x: hx, y: oy, z: hz });
    if (g.sound) g.sound.gunshot();
    if (best) {
      best.hp -= w.dmg;
      if (best.hp <= 0) {
        scene.remove(best.mesh);
        combat.enemies.splice(combat.enemies.indexOf(best), 1);
        if (g.police.stars < 1) g.police.setStars(1);
      }
    }
    return true;
  };

  const hurtPlayer = (dmg, cause) => {
    const p = g.player;
    if (g.state !== 'playing' || p.health <= 0) return;
    let left = dmg;
    if (p.armour > 0) { const absorbed = Math.min(p.armour, left); p.armour -= absorbed; left -= absorbed; }
    p.health -= left;
    if (p.health <= 0) {
      p.health = 0;
      g.display.msg(cause === 'busted' ? 'Busted! Rook dragged you to the safehouse.' : 'Wasted! You wake up at the safehouse.');
      // Respawn: safehouse, full health, heat off, car stays where it was
      if (p.car) { p.car.speed = 0; p.car = null; }
      p.x = S.spawn.x; p.z = S.spawn.z; p.heading = S.spawn.heading;
      p.health = 100; p.armour = 0;
      g.police.setStars(0);
      g.cash = Math.max(0, g.cash - 200);
      g.cam.yaw = p.heading;
      p.mesh.position.set(p.x, 0, p.z);
    }
  };

  const update = (dt) => {
    combat.cooldown = Math.max(0, combat.cooldown - dt);
    for (const t of [...combat.tracers]) {
      t.life -= dt;
      if (t.life <= 0) { scene.remove(t.line); combat.tracers.splice(combat.tracers.indexOf(t), 1); }
    }
    const p = g.player;
    for (const e of [...combat.enemies]) {
      const d = dist2d(e.x, e.z, p.x, p.z);
      if (d < 40) {
        const a = Math.atan2(p.x - e.x, p.z - e.z);
        e.mesh.rotation.y = a;
        if (d > 6) { e.x += Math.sin(a) * 3.2 * dt; e.z += Math.cos(a) * 3.2 * dt; }
        e.mesh.position.set(e.x, 0, e.z);
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < S.enemyRange) {
          e.shootTimer = S.enemyShotEvery;
          hurtPlayer(S.enemyShotDmg, 'shot');
          addTracer({ x: e.x, y: 1.4, z: e.z }, { x: p.x, y: 1.2, z: p.z });
        }
      }
    }
  };

  combat.shoot = shoot;
  combat.spawnEnemies = spawnEnemies;
  combat.clearEnemies = clearEnemies;
  combat.hurtPlayer = hurtPlayer;
  combat.update = update;
  combat.weaponNames = weaponNames;
  return combat;
}
