// Porto Vela — boot: wires every module, runs the game loop and exposes
// the window.__game contract the probe and autopilot depend on.
import * as THREE from '../vendor/three.module.min.js';
import { S, clamp } from './settings.js';
import { makeRng, hashSeed } from './rng.js';
import { createTown } from './town.js';
import { createCars } from './cars.js';
import { createCops } from './cops.js';
import { createFight } from './fight.js';
import { createQuests } from './quests.js';
import { createCamera } from './camera.js';
import { createDisplay } from './display.js';
import { createKeys } from './keys.js';
import { createSound } from './sound.js';
import { createPoses } from './poses.js';
import { runAutopilot } from './selftest.js';

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed') || '1';
const seed = /^\d+$/.test(seedParam) ? Number(seedParam) : hashSeed(seedParam);
const lowfx = params.has('lowfx');
const autopilotMode = params.has('autopilot');
const shotMode = params.get('shot');

window.__errors = [];
window.__failedReqs = [];
window.__fps = 0;
window.__shotReady = false;
window.addEventListener('error', (e) => {
  if (e.target && (e.target.src || e.target.href)) {
    window.__failedReqs.push(String(e.target.src || e.target.href));
    return;
  }
  window.__errors.push(String(e.message || e.error || 'error'));
}, true);
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push('unhandled: ' + String(e.reason));
});

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowfx, powerPreference: 'high-performance' });
renderer.setPixelRatio(lowfx ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb4d6);
scene.fog = new THREE.Fog(0x8fb4d6, 220, 720);
const camera3 = new THREE.PerspectiveCamera(S.fovMin, window.innerWidth / window.innerHeight, 0.1, 1200);

const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3230, 0.9);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xfff2d8, 1.15);
sunLight.position.set(-200, 260, 180);
scene.add(sunLight);

const g = {
  THREE, renderer, scene, camera3, sunLight,
  rng: makeRng(seed), seed, lowfx,
  state: 'title', time: 0, cash: 0, distance: 0, timeScale: 1,
  sirenActive: false, shotFreeze: false, shotMode: null,
  interactPressed: false, fps: 0, save: { cash: 0, completed: [] },
  saveTimer: 0,
};

// Player: on-foot body, origin at the ground
const playerMesh = new THREE.Group();
const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.45),
  new THREE.MeshLambertMaterial({ color: 0x3a5a8a }));
pBody.position.y = 0.95; playerMesh.add(pBody);
const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45),
  new THREE.MeshLambertMaterial({ color: 0xd8b898 }));
pHead.position.y = 1.75; playerMesh.add(pHead);
playerMesh.position.set(S.spawn.x, 0, S.spawn.z);
scene.add(playerMesh);

g.player = {
  x: S.spawn.x, z: S.spawn.z, heading: S.spawn.heading,
  health: 100, armour: 50, car: null, mesh: playerMesh, speed: 0,
};

// Modules (creation order matters only for first-frame safety; the loop
// runs after all of them exist)
g.town = createTown(g);
g.cars = createCars(g);
g.traffic = g.cars.traffic;
g.pedestrians = g.cars.pedestrians;
g.combat = createFight(g);
g.fight = g.combat;
g.police = createCops(g);
g.missions = createQuests(g);
g.cam = createCamera(g);
g.display = createDisplay(g);
g.sound = createSound(g);
g.input = createKeys(g);
g.poses = createPoses(g);

g.consumeInteract = () => {
  const v = g.interactPressed;
  g.interactPressed = false;
  return v;
};

g.setPlayer = (x, z) => {
  const p = g.player;
  if (p.car) {
    p.car.x = x; p.car.z = z; p.car.speed = 0;
    p.car.mesh.position.set(x, 0, z);
  }
  p.x = x; p.z = z;
  p.mesh.position.set(x, 0, z);
};

g.exitCar = () => g.cars.exitCar();
g.tryEnterCarAt = (x, z) => g.cars.tryEnterCarAt(x, z);

g.startGame = () => {
  if (g.state === 'title') {
    g.state = 'playing';
    g.display.showStart(false);
    g.sound.ensure();
    g.display.msg('Porto Vela — press 1-8 to start a job, E to steal a car');
  }
};

g.togglePause = () => {
  if (g.state === 'playing') { g.state = 'paused'; g.display.showPause(true); }
  else if (g.state === 'paused') { g.state = 'playing'; g.display.showPause(false); }
};

g.resetRun = () => {
  g.cash = 0; g.time = 0; g.distance = 0; g.timeScale = 1; g.shotFreeze = false;
  g.fight.clearEnemies();
  if (g.missions.informant) { g.scene.remove(g.missions.informant.mesh); g.missions.informant = null; }
  g.missions.active = false; g.missions.index = 0; g.missions.step = 1;
  g.missions.completed.clear(); g.missions.chaseTarget = null; g.missions.timer = 0;
  g.police.setStars(0);
  const p = g.player;
  if (p.car) { p.car.speed = 0; p.car = null; }
  p.x = S.spawn.x; p.z = S.spawn.z; p.heading = S.spawn.heading;
  p.health = 100; p.armour = 50;
  p.mesh.position.set(p.x, 0, p.z);
  g.cam.yaw = p.heading; g.cam.lastDragT = 10;
  g.save = { cash: 0, completed: [] };
};

g.saveGame = () => {
  g.save = { cash: g.cash, completed: [...g.missions.completed] };
  try { localStorage.setItem(S.saveKey, JSON.stringify(g.save)); } catch { /* private mode */ }
  return g.save;
};

g.loadSave = () => {
  try {
    const raw = localStorage.getItem(S.saveKey);
    if (!raw) return false;
    const data = JSON.parse(raw);
    g.cash = data.cash || 0;
    g.missions.completed = new Set(data.completed || []);
    g.save = { cash: g.cash, completed: [...g.missions.completed] };
    return true;
  } catch { return false; }
};

// On-foot movement, relative to the camera yaw
const updateOnFoot = (dt) => {
  const p = g.player, inp = g.input.keys;
  if (p.car) return;
  const fwd = inp.has('KeyW') || inp.has('ArrowUp');
  const back = inp.has('KeyS') || inp.has('ArrowDown');
  const left = inp.has('KeyA') || inp.has('ArrowLeft');
  const right = inp.has('KeyD') || inp.has('ArrowRight');
  const run = inp.has('ShiftLeft') || inp.has('ShiftRight');
  let mx = 0, mz = 0;
  const fx = Math.sin(g.cam.yaw), fz = Math.cos(g.cam.yaw);
  if (fwd) { mx += fx; mz += fz; }
  if (back) { mx -= fx; mz -= fz; }
  if (left) { mx -= fz; mz += fx; }
  if (right) { mx += fz; mz -= fx; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    const sp = run ? S.runSpeed : S.walkSpeed;
    const nx = p.x + (mx / len) * sp * dt;
    const nz = p.z + (mz / len) * sp * dt;
    // Push-out vs buildings, same as cars but radius 1
    let cx = clamp(nx, -S.clamp, S.clamp), cz = clamp(nz, -S.clamp, S.clamp);
    for (const b of g.town.colliders) {
      const qx = clamp(cx, b.minX, b.maxX), qz = clamp(cz, b.minZ, b.maxZ);
      const dx = cx - qx, dz = cz - qz, d2 = dx * dx + dz * dz;
      if (d2 < 1) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); cx = qx + (dx / d); cz = qz + (dz / d); }
        else { cx = nx; cz = nz; }
      }
    }
    g.distance += Math.hypot(cx - p.x, cz - p.z);
    p.x = cx; p.z = cz;
    p.heading = Math.atan2(mx, mz);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
  }
};

const update = (dt) => {
  g.time += dt;
  updateOnFoot(dt);
  g.cars.update(dt);
  g.police.update(dt);
  g.combat.update(dt);
  g.missions.update(dt);
  // E: missions had first refusal; whatever is left enters / exits a car
  if (g.interactPressed) {
    g.interactPressed = false;
    if (g.player.car) g.cars.exitCar();
    else g.cars.tryEnterCarAt(g.player.x, g.player.z);
  }
  g.town.update(dt);
  g.display.update(dt);
  g.sound.update(dt);
  g.saveTimer += dt;
  if (g.saveTimer > 30) { g.saveTimer = 0; g.saveGame(); }
};

// FPS counter + main loop
let frames = 0, fpsT = performance.now(), last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const rawDt = Math.min((now - last) / 1000, 0.1);
  last = now;
  frames++;
  if (now - fpsT >= 1000) {
    g.fps = frames * 1000 / (now - fpsT);
    window.__fps = Math.round(g.fps);
    frames = 0; fpsT = now;
  }
  if (g.state === 'playing' && !g.shotFreeze) update(rawDt * g.timeScale);
  if (!g.shotFreeze) g.cam.update(rawDt);
  renderer.render(scene, camera3);
}

window.addEventListener('resize', () => {
  camera3.aspect = window.innerWidth / window.innerHeight;
  camera3.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__game = g;
g.loadSave();
requestAnimationFrame(tick);

// Modes: autopilot runs the suite; a shot pose stages one frame.
if (autopilotMode) {
  setTimeout(() => { runAutopilot(g); }, 600);
} else if (shotMode) {
  setTimeout(() => { g.poses.applyPose(shotMode); }, 900);
}
