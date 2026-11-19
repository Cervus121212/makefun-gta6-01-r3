// Porto Vela — settings: every tuned number for the city, driving, police,
// combat, missions and radio lives here so the other modules stay thin.
export const S = {
  // City grid (metres). Blocks are 64 m, roads 16 m, city spans -256..256.
  block: 64, road: 16, gridMin: -256, gridMax: 256, half: 288, clamp: 300,
  beachZ: 224, docksX: 224, seaZ: 296,
  dayLength: 480, // seconds for the daylight -> dusk slide
  startClockMin: 18 * 60 + 53, // 18:53
  clockRate: 0.25, // game minutes per real second

  // Spawns and landmarks
  spawn: { x: -60, z: -150, heading: Math.PI / 2 },
  safehouse: { x: -60, z: -168 },
  garage: { x: -120, z: 24 },
  yacht: { x: 60, z: 232 },
  marina: { x: 60, z: 232 },
  docksPickup: { x: 264, z: 60 },
  dealSpot: { x: 264, z: 120 },
  getawayNorth: { x: -150, z: -232 },
  heistVan: { x: -180, z: 232 },

  // Driving
  accel: 16, brake: 30, reverse: 9, maxSpeed: 42, steer: 1.9, drag: 0.35,
  walkSpeed: 6, runSpeed: 9.5,

  // Camera (fix F1)
  camDist: 11, camDistSpeed: 0.06, camHeight: 4.2, fovMin: 62, fovMax: 70,
  camEase: 2.2, camEaseNear: 1.4, idleEaseAfter: 1.5,

  // Police
  cruiserBase: 2, cruiserMax: 7, footCopMax: 4, heliStars: 3,
  heliOrbitR: 30, heliOrbitSpeed: 0.35, heliHeight: 24,
  decayDist: 55, decayEvery: 10, // seconds apart, only when no cruiser/cop near
  copChaseSpeed: 7, cruiserSpeed: 30,

  // Combat
  weapons: [
    { name: 'Pistol', dmg: 34, range: 42, rate: 0.32, ammo: Infinity },
    { name: 'SMG', dmg: 22, range: 36, rate: 0.11, ammo: 120 },
  ],
  enemyShotDmg: 2, enemyShotEvery: 1.2, enemyRange: 30,

  // World population
  trafficCount: 14, pedCount: 12, beachPeds: 5,

  // Sun (fix F4)
  sunPos: { x: -260, y: 78, z: 330 }, sunR: 36, haloR: 58,
  sunDay: 0xff8a1e, sunDusk: 0xff5a14,

  // Minimap (fix F7)
  mapSize: 190,
  mapColors: {
    land: '#4d555e', road: '#9aa3ad', sand: '#dcc78f', sea: '#2a7a9e',
    park: '#6a9a5a', docks: '#96999e',
  },

  // Save
  saveKey: 'portovela-save-v3',

  // Radio: three synth stations, kick + bass every 500 ms
  radio: [
    { name: 'COSTA 88', dj: 'DJ Neon', bpm: 112, root: 55, wave: 'sawtooth' },
    { name: 'LA VOZ 104', dj: 'La Voz', bpm: 96, root: 49, wave: 'square' },
    { name: 'ONDA 97', dj: 'DJ Marea', bpm: 124, root: 65.4, wave: 'triangle' },
  ],

  districts: [
    { name: 'OLD TOWN', x: -160, z: -160 },
    { name: 'MARINA', x: 60, z: 200 },
    { name: 'DOCKS', x: 250, z: 40 },
    { name: 'BEACHFRONT', x: -120, z: 260 },
    { name: 'DOWNTOWN', x: 0, z: 0 },
    { name: 'NORTHSIDE', x: -160, z: 160 },
    { name: 'HARBOR HEIGHTS', x: 160, z: -160 },
  ],

  // Missions: step 1-based. reward totals $19,000 (the design doc's
  // "$18,000" is an arithmetic slip: 500+800+1200+2000+2500+3000+4000+5000).
  missions: [
    { n: 1, name: 'First Wheels', reward: 500,
      brief: 'Pick up the getaway car at the garage, then bring it home.',
      steps: [
        { text: 'Go to the garage and press E', target: { x: -120, z: 24 } },
        { text: 'Drive home to the safehouse', target: { x: -60, z: -168 } },
      ] },
    { n: 2, name: 'The Pickup', reward: 800,
      brief: 'Mara left a package at the docks. Collect it, bring it home.',
      steps: [
        { text: 'Collect the package at the docks (E)', target: { x: 264, z: 60 } },
        { text: 'Bring it back to the safehouse', target: { x: -60, z: -168 } },
      ] },
    { n: 3, name: 'Hot Pursuit', reward: 1200,
      brief: 'Rook put three stars on you. Lose the heat — get to zero stars.',
      steps: [
        { text: 'Lose the cops — get wanted down to 0 stars', target: null },
      ] },
    { n: 4, name: 'Dockside Deal', reward: 2000,
      brief: 'Four of Mara\'s rivals are at the docks. Clear them out, take the cash.',
      steps: [
        { text: 'Take out all 4 rivals at the docks', target: { x: 264, z: 120 } },
        { text: 'Grab the cash (E)', target: { x: 264, z: 120 } },
      ] },
    { n: 5, name: 'Getaway Driver', reward: 2500,
      brief: 'Pick up the crew at the marina and run north. 90 seconds.',
      steps: [
        { text: 'Reach the marina pickup', target: { x: 60, z: 232 } },
        { text: 'Escape north — 90 seconds!', target: { x: -150, z: -232 } },
      ] },
    { n: 6, name: 'The Informant', reward: 3000,
      brief: 'A green sedan is circling the plaza, talking to Rook. Ram it off the road.',
      steps: [
        { text: 'Ram the green sedan until it is wrecked', target: { x: 40, z: 80 } },
      ] },
    { n: 7, name: 'Beachfront Heist', reward: 4000,
      brief: 'Steal the van on the beachfront, then lose the heat at home.',
      steps: [
        { text: 'Steal the van on the beachfront (E)', target: { x: -180, z: 232 } },
        { text: 'Bring it home to the safehouse', target: { x: -60, z: -168 } },
      ] },
    { n: 8, name: 'King of Vela', reward: 5000,
      brief: 'Four stars, sixty seconds. Survive, then meet Mara on the yacht.',
      steps: [
        { text: 'Survive 60 seconds at 4 stars', target: null },
        { text: 'Meet Mara on the yacht La Sirena', target: { x: 60, z: 232 } },
      ] },
  ],
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// Shortest signed angle difference, radians.
export const angDiff = (a, b) => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
