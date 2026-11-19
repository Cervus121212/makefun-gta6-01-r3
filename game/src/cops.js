// Porto Vela — cops: wanted stars, cruisers that chase, foot cops at 2+
// stars, the helicopter at 3+ stars (orbit, dt-driven 0.35 rad/s), and the
// wanted decay that only counts cruiser / foot-cop distance — the heli
// never counts, or the heat would never cool off.
import * as THREE from '../vendor/three.module.min.js';
import { S, clamp, dist2d } from './settings.js';
import { buildCarMesh } from './cars.js';

export function createCops(g) {
  const { scene } = g;
  const police = {
    cars: [], cops: [], stars: 0, heli: null, nearestDist: Infinity,
    decayTimer: 0, sirenPhase: 0,
  };

  const spawnCruiser = () => {
    const a = g.rng.range(0, Math.PI * 2);
    const car = {
      kind: 'cruiser', x: g.player.x + Math.sin(a) * 60, z: g.player.z + Math.cos(a) * 60,
      heading: a, speed: 0, mesh: buildCarMesh(0x1a1a2a),
    };
    // White doors + light bar read as a police car
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    bar.position.set(0, 1.55, -0.2); car.mesh.add(bar);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.4, 1.6),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    door.position.set(0, 0.55, 0); car.mesh.add(door);
    car.mesh.position.set(car.x, 0, car.z);
    scene.add(car.mesh);
    police.cars.push(car);
    return car;
  };

  const spawnCop = () => {
    const a = g.rng.range(0, Math.PI * 2);
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.7, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
    body.position.y = 0.85; mesh.add(body);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8),
      new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    hat.position.y = 1.85; mesh.add(hat);
    const cop = { x: g.player.x + Math.sin(a) * 25, z: g.player.z + Math.cos(a) * 25, mesh, speed: S.copChaseSpeed };
    mesh.position.set(cop.x, 0, cop.z);
    scene.add(mesh);
    police.cops.push(cop);
    return cop;
  };

  const spawnHeli = () => {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5),
      new THREE.MeshLambertMaterial({ color: 0x2a3a4a }));
    body.position.y = 0; mesh.add(body);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.15, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1; mesh.add(rotor);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    light.position.set(0, -1, 2); mesh.add(light);
    mesh.position.set(g.player.x + 30, S.heliHeight, g.player.z);
    scene.add(mesh);
    police.heli = { mesh, rotor, angle: 0, x: mesh.position.x, z: mesh.position.z };
    return police.heli;
  };

  const removeUnit = (arr, u) => {
    const i = arr.indexOf(u);
    if (i >= 0) arr.splice(i, 1);
    scene.remove(u.mesh);
  };

  const setStars = (n) => {
    police.stars = clamp(Math.round(n), 0, 5);
    g.display.setStars(police.stars);
    if (police.stars === 0) {
      // Heat off: units stand down one at a time instead of vanishing
      for (const c of [...police.cars]) removeUnit(police.cars, c);
      for (const c of [...police.cops]) removeUnit(police.cops, c);
      if (police.heli) { scene.remove(police.heli.mesh); police.heli = null; }
    }
  };

  const update = (dt) => {
    const p = g.player;
    const wantCruisers = police.stars > 0 ? Math.min(S.cruiserBase + police.stars, S.cruiserMax) : 0;
    const wantCops = police.stars >= 2 ? Math.min(police.stars, S.footCopMax) : 0;
    while (police.cars.length < wantCruisers) spawnCruiser();
    while (police.cars.length > wantCruisers) removeUnit(police.cars, police.cars[0]);
    while (police.cops.length < wantCops) spawnCop();
    while (police.cops.length > wantCops) removeUnit(police.cops, police.cops[0]);
    if (police.stars >= S.heliStars && !police.heli) spawnHeli();
    if (police.stars < S.heliStars && police.heli) { scene.remove(police.heli.mesh); police.heli = null; }

    // Cruisers chase the player
    let nearest = Infinity;
    for (const c of police.cars) {
      const d = dist2d(c.x, c.z, p.x, p.z);
      nearest = Math.min(nearest, d);
      const want = Math.atan2(p.x - c.x, p.z - c.z);
      let dh = want - c.heading;
      dh = ((dh + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      c.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
      const sp = Math.min(S.cruiserSpeed + police.stars * 2, d > 40 ? S.cruiserSpeed + 6 : S.cruiserSpeed);
      c.x += Math.sin(c.heading) * sp * dt;
      c.z += Math.cos(c.heading) * sp * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Ram the player on foot, or shove the player's car
      if (d < 3.2 && !p.car) g.fight.hurtPlayer(12 * dt * 3, 'busted');
      if (d < 4 && p.car) { p.car.speed *= 0.96; }
    }
    // Foot cops chase on foot
    for (const c of police.cops) {
      const d = dist2d(c.x, c.z, p.x, p.z);
      nearest = Math.min(nearest, d);
      const a = Math.atan2(p.x - c.x, p.z - c.z);
      c.x += Math.sin(a) * c.speed * dt;
      c.z += Math.cos(a) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = a;
      if (d < 1.6 && !p.car) g.fight.hurtPlayer(10 * dt, 'busted');
    }
    // Heli orbits, dt-driven; it never counts for wanted decay
    if (police.heli) {
      const h = police.heli;
      h.angle += S.heliOrbitSpeed * dt;
      h.x = p.x + Math.sin(h.angle) * S.heliOrbitR;
      h.z = p.z + Math.cos(h.angle) * S.heliOrbitR;
      h.mesh.position.set(h.x, S.heliHeight, h.z);
      h.mesh.rotation.y = Math.atan2(p.x - h.x, p.z - h.z);
      h.rotor.rotation.y += dt * 22;
    }
    police.nearestDist = nearest;

    // Wanted decay: only cruiser / foot-cop distance counts
    if (police.stars > 0) {
      if (nearest > S.decayDist) {
        police.decayTimer += dt;
        if (police.decayTimer >= S.decayEvery) {
          police.decayTimer = 0;
          setStars(police.stars - 1);
          if (police.stars > 0) g.display.msg(`Heat cooling… ${police.stars} star${police.stars > 1 ? 's' : ''} left`);
          else g.display.msg('You lost them. Heat is off.');
        }
      } else police.decayTimer = 0;
    }

    // Siren: audible while wanted, louder the closer the nearest unit is
    g.sirenActive = police.stars > 0;
    if (g.sound) g.sound.setSiren(g.sirenActive, nearest);
  };

  police.setStars = setStars;
  police.update = update;
  police.spawnCruiser = spawnCruiser;
  police.spawnCop = spawnCop;
  police.spawnHeli = spawnHeli;
  return police;
}
