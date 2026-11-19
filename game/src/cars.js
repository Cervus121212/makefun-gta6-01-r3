// Porto Vela — cars: the player car, traffic AI, parked cars to steal and
// pedestrians. Driving physics: accel 16, brake 30, reverse 9, max 42 m/s,
// steer 1.9, drag 0.35, push-out collision vs building AABBs, clamp ±300.
import * as THREE from '../vendor/three.module.min.js';
import { S, clamp, dist2d } from './settings.js';

const CAR_COLORS = [0xc22a2a, 0x2a5ac2, 0x2aa85a, 0xd8a82a, 0x8a2ac2, 0xdddddd, 0x222222, 0x2aa8c2];
const PED_COLORS = [0xff5a5a, 0x5aff8a, 0x5a8aff, 0xffe95a, 0xff8ad8, 0x8affff, 0xffffff, 0xff8a3a];

export function buildCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2530 }));
  cabin.position.set(0, 1.15, -0.2); g.add(cabin);
  // One dark base slab reads as wheels + shadow from any angle (keeps draw calls low)
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.35, 4.5),
    new THREE.MeshLambertMaterial({ color: 0x141414 }));
  base.position.y = 0.22; g.add(base);
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffe95a }));
    sign.position.set(0, 1.6, -0.2); g.add(sign);
  }
  return g;
}

function syncMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
}

function collideBuildings(g, x, z, r) {
  for (const b of g.town.colliders) {
    const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r; z = cz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration axis
        const pl = x - b.minX, pr = b.maxX - x, pt = z - b.minZ, pb = b.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.minX - r; else if (m === pr) x = b.maxX + r;
        else if (m === pt) z = b.minZ - r; else z = b.maxZ + r;
      }
    }
  }
  return { x: clamp(x, -S.clamp, S.clamp), z: clamp(z, -S.clamp, S.clamp) };
}

export function createCars(g) {
  const { scene, rng } = g;
  const cars = { traffic: [], parked: [], pedestrians: [] };

  // Player car: parked by the garage, the M1 prize
  const playerCar = {
    kind: 'player', x: -108, z: 30, heading: Math.PI / 2, speed: 0,
    color: 0xc22a2a, mesh: buildCarMesh(0xc22a2a),
  };
  syncMesh(playerCar);
  scene.add(playerCar.mesh);

  // Parked cars to steal, scattered on roads
  const parkedSpots = [[-60, -96], [24, 120], [120, -24], [-184, 96], [56, -184], [-24, 184], [184, 120], [-180, 232]];
  for (let i = 0; i < parkedSpots.length; i++) {
    const [x, z] = parkedSpots[i];
    const kind = (x === -180 && z === 232) ? 'van' : 'parked';
    const mesh = buildCarMesh(CAR_COLORS[i % CAR_COLORS.length]);
    const car = { kind, x, z, heading: rng.range(0, Math.PI * 2), speed: 0, mesh };
    if (kind === 'van') car.mesh.scale.set(1.1, 1.25, 1.3);
    syncMesh(car); scene.add(mesh);
    cars.parked.push(car);
  }

  // Traffic: 14 cars that follow roads, turn at intersections, respawn
  const roadLines = [-256, -192, -128, -64, 0, 64, 128, 192, 256];
  const mkTraffic = () => {
    const vertical = rng.chance(0.5);
    const line = rng.pick(roadLines.filter((c) => Math.abs(c) < 224));
    const car = {
      kind: 'traffic', axis: vertical ? 'z' : 'x', dir: rng.chance(0.5) ? 1 : -1,
      x: vertical ? line + rng.range(-3, 3) : rng.range(-280, 280),
      z: vertical ? rng.range(-280, 200) : line + rng.range(-3, 3),
      speed: rng.range(8, 13), heading: 0,
      mesh: buildCarMesh(rng.pick(CAR_COLORS)),
    };
    car.heading = car.axis === 'z' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    syncMesh(car); scene.add(car.mesh);
    return car;
  };
  for (let i = 0; i < S.trafficCount; i++) cars.traffic.push(mkTraffic());

  // Pedestrians: 12 wanderers + 5 bright-clothed beach walkers (fix F5)
  const mkPed = (x, z, beach) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.5),
      new THREE.MeshLambertMaterial({ color: beach ? rng.pick(PED_COLORS) : rng.pick([0x888888, 0x444455, 0x775544, 0x557755]) }));
    mesh.position.set(x, 0.9, z);
    scene.add(mesh);
    return { x, z, heading: rng.range(0, Math.PI * 2), speed: rng.range(0.8, 1.6), mesh, beach: !!beach, flee: 0 };
  };
  for (let i = 0; i < S.pedCount; i++) {
    cars.pedestrians.push(mkPed(rng.range(-240, 200), rng.range(-240, 200), false));
  }
  for (let i = 0; i < S.beachPeds; i++) {
    cars.pedestrians.push(mkPed(rng.range(-160, 160), rng.range(292, 297), true));
  }

  const updateTraffic = (dt) => {
    for (const c of cars.traffic) {
      if (c.axis === 'z') c.z += c.dir * c.speed * dt;
      else c.x += c.dir * c.speed * dt;
      // Turn at intersections
      const along = c.axis === 'z' ? c.z : c.x;
      const near = Math.abs(((along % 64) + 64) % 64);
      if ((near < 1.5 || near > 62.5) && rng.chance(dt * 0.9)) {
        const cross = Math.round(along / 64) * 64;
        if (c.axis === 'z') { c.z = cross; c.axis = 'x'; c.dir = rng.chance(0.5) ? 1 : -1; }
        else { c.x = cross; c.axis = 'z'; c.dir = rng.chance(0.5) ? 1 : -1; }
      }
      c.heading = c.axis === 'z' ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      // Respawn on a fresh road instead of mirroring back
      if (c.x > 285 || c.x < -285 || c.z > 285 || c.z < -285) {
        const idx = cars.traffic.indexOf(c);
        scene.remove(c.mesh);
        cars.traffic[idx] = mkTraffic();
      } else syncMesh(c);
    }
  };

  const updatePeds = (dt) => {
    const px = g.player.x, pz = g.player.z;
    const inCar = !!g.player.car;
    for (const p of cars.pedestrians) {
      const d = dist2d(p.x, p.z, px, pz);
      if (inCar && d < 6) p.flee = 1.2; // run when a car gets close
      let sp = p.speed;
      if (p.flee > 0) { p.flee -= dt; sp = 5; p.heading = Math.atan2(p.x - px, p.z - pz); }
      else if (rng.chance(dt * 0.15)) p.heading = rng.range(0, Math.PI * 2);
      p.x += Math.sin(p.heading) * sp * dt;
      p.z += Math.cos(p.heading) * sp * dt;
      if (p.beach) { p.x = clamp(p.x, -180, 180); p.z = clamp(p.z, 288, 298); }
      else { p.x = clamp(p.x, -280, 210); p.z = clamp(p.z, -280, 210); }
      p.mesh.position.set(p.x, 0.9, p.z);
      p.mesh.rotation.y = p.heading;
    }
  };

  const updatePlayerCar = (dt) => {
    const p = g.player, inp = g.input;
    const car = p.car;
    if (!car) return;
    const fwd = inp.keys.has('KeyW') || inp.keys.has('ArrowUp');
    const back = inp.keys.has('KeyS') || inp.keys.has('ArrowDown');
    const left = inp.keys.has('KeyA') || inp.keys.has('ArrowLeft');
    const right = inp.keys.has('KeyD') || inp.keys.has('ArrowRight');
    if (fwd) car.speed += S.accel * dt;
    if (back) car.speed -= (car.speed > 0.5 ? S.brake : S.reverse) * dt;
    if (!fwd && !back) car.speed -= car.speed * S.drag * dt;
    car.speed = clamp(car.speed, -S.reverse, S.maxSpeed);
    const steerDir = car.speed >= 0 ? 1 : -1;
    if (left) car.heading -= S.steer * steerDir * dt * clamp(Math.abs(car.speed) / 10, 0, 1);
    if (right) car.heading += S.steer * steerDir * dt * clamp(Math.abs(car.speed) / 10, 0, 1);
    let nx = car.x + Math.sin(car.heading) * car.speed * dt;
    let nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = collideBuildings(g, nx, nz, 2.2);
    if (fixed.x !== nx || fixed.z !== nz) car.speed *= 0.4; // scrape, don't stop dead
    car.x = fixed.x; car.z = fixed.z;
    p.x = car.x; p.z = car.z; p.heading = car.heading;
    syncMesh(car);
  };

  const update = (dt) => {
    updatePlayerCar(dt);
    updateTraffic(dt);
    updatePeds(dt);
  };

  const tryEnterCarAt = (x, z) => {
    const all = [playerCar, ...cars.parked];
    let best = null, bd = 5;
    for (const c of all) {
      const d = dist2d(x, z, c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return false;
    g.player.car = best;
    g.player.heading = best.heading;
    g.display.msg('You are driving — W/S gas & brake, A/D steer');
    return true;
  };

  const exitCar = () => {
    const p = g.player;
    if (!p.car) return false;
    const car = p.car;
    p.car = null;
    p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
    p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
    p.mesh.position.set(p.x, 0, p.z);
    return true;
  };

  return {
    playerCar, traffic: cars.traffic, parked: cars.parked, pedestrians: cars.pedestrians,
    update, tryEnterCarAt, exitCar, buildCarMesh, syncMesh,
  };
}
