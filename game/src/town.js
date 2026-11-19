// Porto Vela — town: the procedural city. One canvas-painted ground plane
// (roads, sand, sea, docks, parks in a single draw call — fix F9), box
// buildings with six canvas facades and seven roof colours (fix F6), the
// beach props (fix F5), the docks (fix F8) and the big orange sun (fix F4).
import * as THREE from '../vendor/three.module.min.js';
import { S, clamp, lerp } from './settings.js';

const ROOF_COLORS = [0x8a4a3a, 0x5a6a7a, 0x7a7a5a, 0x9a8a6a, 0x4a5a4a, 0x6a4a5a, 0xb08a4a];
const FACADE_HUES = [0xc8b49a, 0xb8c0c8, 0xd8c8a8, 0xa8b8c0, 0xc8a898, 0xb0b8a8];
const BEACH_UMBRELLAS = [[-140, 284], [-60, 288], [20, 282], [120, 286]];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function textTex(text, fg, bg, w = 512, h = 128) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg; ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}

// Ground: one 600x600 plane, painted once. World x -> px, world z -> py.
function groundTexture() {
  const W = 1024, px = (x) => ((x + 300) / 600) * W;
  return canvasTex(W, W, (ctx) => {
    ctx.fillStyle = '#55606b'; ctx.fillRect(0, 0, W, W); // land base
    // Sea: z >= 296 (south edge)
    ctx.fillStyle = '#2a7a9e'; ctx.fillRect(0, px(296), W, W - px(296));
    // Sand: beach z 224..296
    ctx.fillStyle = '#dcc78f'; ctx.fillRect(0, px(224), W, px(296) - px(224));
    // Docks apron: x >= 224
    ctx.fillStyle = '#96999e'; ctx.fillRect(px(224), 0, W - px(224), px(224));
    // Parks (two green squares)
    ctx.fillStyle = '#6a9a5a';
    ctx.fillRect(px(-96), px(-96), px(-32) - px(-96), px(-32) - px(-96));
    ctx.fillRect(px(96), px(32), px(160) - px(96), px(96) - px(32));
    // Roads: vertical + horizontal strips at multiples of 64, width 16
    ctx.fillStyle = '#9aa3ad';
    for (let c = -256; c <= 256; c += 64) {
      ctx.fillRect(px(c - 8), 0, px(c + 8) - px(c - 8), px(224));
      ctx.fillRect(0, px(c - 8), px(224), px(c + 8) - px(c - 8));
    }
    // Road centre lines, faint
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.setLineDash([14, 18]);
    for (let c = -256; c <= 256; c += 64) {
      ctx.beginPath(); ctx.moveTo(px(c), 0); ctx.lineTo(px(c), px(224)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, px(c)); ctx.lineTo(px(224), px(c)); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Sidewalk edge: thin pale border along road strips
    ctx.strokeStyle = 'rgba(230,230,220,0.5)'; ctx.lineWidth = 3;
    for (let c = -256; c <= 256; c += 64) {
      ctx.strokeRect(px(c - 8), 0, px(c + 8) - px(c - 8), px(224));
      ctx.strokeRect(0, px(c - 8), px(224), px(c + 8) - px(c - 8));
    }
  });
}

function facadeTextures() {
  return FACADE_HUES.map((hue, i) => canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#' + hue.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, w, h);
    // Window grid, pattern varies per facade
    const cols = 4 + (i % 3), rows = 8 + (i % 4);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = ((r * 7 + c * 3 + i) % 5) === 0;
      ctx.fillStyle = lit ? '#ffd98a' : '#2a3644';
      ctx.fillRect(10 + c * ((w - 20) / cols) + 2, 12 + r * ((h - 24) / rows) + 2,
        (w - 20) / cols - 5, (h - 24) / rows - 5);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, h - 14, w, 14);
  }));
}

function sunSprite(color, radius, opacity) {
  const tex = canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,138,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.set(radius * 2, radius * 2, 1);
  return s;
}

export function createTown(g) {
  const { scene, rng } = g;
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // --- ground (1 draw call) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // --- buildings ---
  const facades = facadeTextures();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMats = ROOF_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const facadeMats = facades.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  let buildingCount = 0;
  for (let bx = -4; bx <= 4; bx++) for (let bz = -4; bz <= 4; bz++) {
    const cx = bx * 64, cz = bz * 64;
    if (cz >= 224 || cx >= 224) continue; // beach / docks, no blocks there
    const downtown = Math.abs(cx) <= 64 && Math.abs(cz) <= 64;
    const n = downtown ? 2 : rng.chance(0.6) ? 2 : 1;
    for (let k = 0; k < n; k++) {
      // Stay inside the block interior (±24 m): a building must never
      // poke into the road, or cars and sightlines clip its corner.
      const w = rng.range(14, 20), d = rng.range(14, 20);
      const h = downtown ? rng.range(18, 42) : rng.range(8, 22);
      const ox = (k === 0 ? -11 : 11) + rng.range(-2, 2);
      const oz = (k === 0 ? -10 : 10) + rng.range(-2, 2);
      const x = cx + ox, z = cz + oz;
      const mesh = new THREE.Mesh(boxGeo, facadeMats[rng.int(0, 5)]);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, h / 2, z);
      group.add(mesh);
      // Roof slab on ~35% of buildings (fix F6)
      if (rng.chance(0.35)) {
        const roof = new THREE.Mesh(roofGeo, roofMats[rng.int(0, 6)]);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(x, h + 0.4, z);
        group.add(roof);
      }
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      buildingCount++;
    }
  }

  // --- safehouse + garage markers (simple structures, colliders kept) ---
  const shMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const safehouse = new THREE.Mesh(boxGeo, shMat);
  safehouse.scale.set(16, 7, 12); safehouse.position.set(-60, 3.5, -176);
  group.add(safehouse);
  colliders.push({ minX: -68, maxX: -52, minZ: -182, maxZ: -170 });
  const garage = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x4a5a6a }));
  garage.scale.set(18, 6, 12); garage.position.set(-120, 3, 16);
  group.add(garage);
  colliders.push({ minX: -129, maxX: -111, minZ: 10, maxZ: 22 });

  // --- billboards facing the beach (fix F6) ---
  const mkBillboard = (text, x, z) => {
    const tex = textTex(text, '#ffe9a8', '#28304a');
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 9),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    m.position.set(x, 16, z);
    group.add(m);
    const pole = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x333333 }));
    pole.scale.set(1, 12, 1); pole.position.set(x, 6, z - 0.5);
    group.add(pole);
  };
  mkBillboard('HOTEL MIRAMAR', -120, 210);
  mkBillboard('CASINO DEL MAR', 120, 210);

  // --- district signs (fix F6) ---
  for (const d of S.districts) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 5),
      new THREE.MeshBasicMaterial({ map: textTex(d.name, '#ffffff', '#1a2a3a') }),
    );
    m.position.set(d.x, 7, d.z);
    group.add(m);
  }

  // --- beach props (fix F5) ---
  const umbMat = new THREE.MeshLambertMaterial({ color: 0xe85a5a });
  const umbMat2 = new THREE.MeshLambertMaterial({ color: 0x3a8ad8 });
  for (let i = 0; i < BEACH_UMBRELLAS.length; i++) {
    const [x, z] = BEACH_UMBRELLAS[i];
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6),
      new THREE.MeshLambertMaterial({ color: 0xddddcc }));
    pole.position.set(x, 1.5, z); group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(3, 1.4, 8), i % 2 ? umbMat2 : umbMat);
    top.position.set(x, 3.4, z); group.add(top);
  }
  const towelCols = [0xff5a5a, 0x5aff8a, 0x5a8aff, 0xffe95a, 0xff8ad8, 0x8affff];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2),
      new THREE.MeshLambertMaterial({ color: towelCols[i] }));
    t.rotation.x = -Math.PI / 2;
    t.position.set(-160 + i * 52, 0.06, 272 + (i % 2) * 8);
    group.add(t);
  }
  // Lifeguard tower (-80, 288)
  const tower = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    const leg = new THREE.Mesh(boxGeo, legMat);
    leg.scale.set(0.3, 4, 0.3); leg.position.set(lx, 2, lz); tower.add(leg);
  }
  const hut = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffd23a }));
  hut.scale.set(4, 2.4, 4); hut.position.set(0, 5, 0); tower.add(hut);
  tower.position.set(-80, 0, 288);
  group.add(tower);

  // --- docks (fix F8): containers, floodlights, yacht ---
  const contCols = [0xa83a3a, 0x3a6aa8, 0x3aa86a, 0xa88a3a];
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: contCols[i % 4] }));
    c.scale.set(12, 2.6, 2.6);
    c.position.set(236 + (i % 5) * 14, 1.3, -40 + Math.floor(i / 5) * 90);
    c.rotation.y = (i % 2) * 0.02;
    group.add(c);
    colliders.push({ minX: c.position.x - 6, maxX: c.position.x + 6, minZ: c.position.z - 1.3, maxZ: c.position.z + 1.3 });
  }
  // 4 floodlights, emissive; one at (258, 126)
  const floodSpots = [[258, 126], [240, 20], [270, 200], [236, -120]];
  const floodMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
  for (const [x, z] of floodSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 12, 6),
      new THREE.MeshLambertMaterial({ color: 0x444444 }));
    pole.position.set(x, 6, z); group.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), floodMat);
    lamp.position.set(x, 12.4, z); group.add(lamp);
  }
  // Yacht La Sirena at the marina (60, 232)
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf2f2ee }));
  hull.scale.set(6, 2, 16); hull.position.y = 1; yacht.add(hull);
  const cabin = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2a4a6a }));
  cabin.scale.set(4, 2, 8); cabin.position.y = 3; yacht.add(cabin);
  yacht.position.set(60, 0, 232);
  group.add(yacht);

  // --- sun: disc r36 + halo r58 (fix F4) ---
  const sunDisc = sunSprite('#ff8a1e', S.sunR, 1);
  sunDisc.position.set(S.sunPos.x, S.sunPos.y, S.sunPos.z);
  const sunHalo = sunSprite('#ff8a1e', S.haloR, 0.28);
  sunHalo.position.set(S.sunPos.x, S.sunPos.y, S.sunPos.z);
  group.add(sunDisc); group.add(sunHalo);

  // Daylight -> dusk slide over dayLength (fix F4)
  const daySky = new THREE.Color(0x8fb4d6), duskSky = new THREE.Color(0xc96a3f);
  const dayFog = new THREE.Color(0x8fb4d6), duskFog = new THREE.Color(0x9a5a44);
  let elapsed = 0;
  const update = (dt) => {
    elapsed += dt;
    const t = clamp(elapsed / S.dayLength, 0, 1);
    const sky = daySky.clone().lerp(duskSky, t);
    g.scene.background = sky;
    if (g.scene.fog) g.scene.fog.color.copy(dayFog.clone().lerp(duskFog, t));
    const sunCol = new THREE.Color(S.sunDay).lerp(new THREE.Color(S.sunDusk), t);
    sunDisc.material.color.copy(sunCol);
    g.sunLight.intensity = lerp(1.15, 0.75, t);
    g.sunLight.color.copy(new THREE.Color(0xfff2d8).lerp(new THREE.Color(0xffb070), t));
  };

  return {
    colliders, buildingCount, group, sunDisc, sunHalo, update,
    isBeach: (x, z) => z >= S.beachZ && z < S.seaZ && x < S.docksX,
    isSea: (x, z) => z >= S.seaZ,
    isDocks: (x, z) => x >= S.docksX && z < S.beachZ,
  };
}
