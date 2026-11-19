// Porto Vela — display: HUD, the #msg pill (fix F2), portrait dialogs,
// the bright 190px minimap (fix F7), start / pause overlays and the
// autopilot results div.
import { S, clamp } from './settings.js';

export function createDisplay(g) {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), health: $('health-fill'), armour: $('armour-fill'),
    cash: $('cash'), stars: $('stars'), clock: $('clock'), rep: $('rep'),
    mission: $('mission'), msg: $('msg'), dialog: $('dialog'),
    dialogName: $('dialog-name'), dialogText: $('dialog-text'),
    dialogPortrait: $('dialog-portrait'), minimap: $('minimap'),
    start: $('start'), pause: $('pause'), results: $('test-results'),
    speed: $('speed'),
  };
  const mapCtx = els.minimap.getContext('2d');
  let msgTimer = null;
  let dialogTimer = null;
  let mapTimer = 0;

  const msg = (text, dur = 3000) => {
    els.msg.textContent = text;
    els.msg.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => els.msg.classList.remove('show'), dur);
  };

  const dialog = (name, text, dur = 5000) => {
    els.dialogName.textContent = name;
    els.dialogText.textContent = text;
    els.dialogPortrait.textContent = name[0];
    els.dialogPortrait.style.background = name === 'Mara' ? '#c22a2a' : '#2a5ac2';
    els.dialog.classList.add('show');
    clearTimeout(dialogTimer);
    dialogTimer = setTimeout(() => els.dialog.classList.remove('show'), dur);
  };

  const setStars = (n) => {
    els.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    els.stars.classList.toggle('hot', n >= 3);
  };

  const rankFor = (rep) => (rep >= 1280 ? 'KING OF VELA' : rep >= 640 ? 'DRIVER' : 'ROOKIE');

  // Minimap: bright, 190px. Land, roads, sand, sea, park, docks; markers
  // S/G/Y/! and the player arrow — a white triangle pointing DOWN,
  // rotated by -heading.
  const drawMap = () => {
    const W = S.mapSize, ctx = mapCtx;
    const px = (x) => ((x + 300) / 600) * W;
    const C = S.mapColors;
    ctx.fillStyle = C.land; ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = C.sea; ctx.fillRect(0, px(296), W, W - px(296));
    ctx.fillStyle = C.sand; ctx.fillRect(0, px(224), W, px(296) - px(224));
    ctx.fillStyle = C.docks; ctx.fillRect(px(224), 0, W - px(224), px(224));
    ctx.fillStyle = C.park;
    ctx.fillRect(px(-96), px(-96), px(-32) - px(-96), px(-32) - px(-96));
    ctx.fillRect(px(96), px(32), px(160) - px(96), px(96) - px(32));
    ctx.fillStyle = C.road;
    for (let c = -256; c <= 256; c += 64) {
      ctx.fillRect(px(c - 3), 0, px(c + 3) - px(c - 3), px(224));
      ctx.fillRect(0, px(c - 3), px(224), px(c + 3) - px(c - 3));
    }
    // Markers
    const marker = (x, z, label, color) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px(x), px(z), 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, px(x), px(z));
    };
    marker(S.safehouse.x, S.safehouse.z, 'S', '#2aa85a');
    marker(S.garage.x, S.garage.z, 'G', '#d8a82a');
    marker(S.yacht.x, S.yacht.z, 'Y', '#2a5ac2');
    const t = g.missions.chaseTarget;
    if (t) {
      const pulse = 5 + Math.sin(g.time * 5) * 2;
      ctx.fillStyle = '#ff2233';
      ctx.beginPath(); ctx.arc(px(t.x), px(t.z), pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', px(t.x), px(t.z));
    }
    // Player arrow: triangle pointing down, rotated -heading
    ctx.save();
    ctx.translate(px(g.player.x), px(g.player.z));
    ctx.rotate(-g.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 8); ctx.lineTo(-6, -6); ctx.lineTo(6, -6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  };

  const update = (dt) => {
    const mins = S.startClockMin + g.time * S.clockRate;
    const hh = Math.floor(mins / 60) % 24, mm = Math.floor(mins % 60);
    els.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    els.cash.textContent = '$' + Math.floor(g.cash).toLocaleString();
    els.health.style.width = clamp(g.player.health, 0, 100) + '%';
    els.armour.style.width = clamp(g.player.armour, 0, 100) + '%';
    const rep = Math.floor(g.missions.completed.size * 160 + g.distance / 50);
    els.rep.textContent = `${rankFor(rep)} · REP ${rep}`;
    els.mission.textContent = g.missions.active ? g.missions.stepText() : 'No active job — press 1-8 to start one';
    els.speed.textContent = g.player.car
      ? `${Math.round(Math.abs(g.player.car.speed) * 3.6)} km/h`
      : (g.state === 'playing' ? 'ON FOOT' : '');
    mapTimer += dt;
    if (mapTimer > 0.1) { mapTimer = 0; drawMap(); }
  };

  const showStart = (show) => els.start.classList.toggle('hidden', !show);
  const showPause = (show) => els.pause.classList.toggle('hidden', !show);

  return {
    msg, dialog, setStars, update, drawMap, showStart, showPause,
    setResults: (t) => { els.results.textContent = t; },
    els,
  };
}
