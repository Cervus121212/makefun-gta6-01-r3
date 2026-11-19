// Porto Vela — sound: everything is synthesised with WebAudio, no audio
// files. Three radio stations (kick + bass every 500 ms, each with its own
// tempo / root / wave), a two-tone siren whose gain follows the nearest
// police unit, an engine hum pitched by speed, and gunshot noise bursts.
import { S } from './settings.js';

export function createSound(g) {
  const sound = {
    muted: false, radioIdx: 0, radioOn: true,
    ctx: null, master: null, sirenOsc: null, sirenGain: null,
    engineOsc: null, engineGain: null, beatTimer: 0, beatStep: 0,
  };

  const ensure = () => {
    if (sound.ctx) {
      if (sound.ctx.state === 'suspended') sound.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      sound.ctx = new AC();
      sound.master = sound.ctx.createGain();
      sound.master.gain.value = sound.muted ? 0 : 0.5;
      sound.master.connect(sound.ctx.destination);
      // Siren: two alternating tones
      sound.sirenOsc = sound.ctx.createOscillator();
      sound.sirenOsc.type = 'sine'; sound.sirenOsc.frequency.value = 700;
      sound.sirenGain = sound.ctx.createGain(); sound.sirenGain.gain.value = 0;
      sound.sirenOsc.connect(sound.sirenGain); sound.sirenGain.connect(sound.master);
      sound.sirenOsc.start();
      // Engine hum
      sound.engineOsc = sound.ctx.createOscillator();
      sound.engineOsc.type = 'sawtooth'; sound.engineOsc.frequency.value = 50;
      sound.engineGain = sound.ctx.createGain(); sound.engineGain.gain.value = 0;
      const lp = sound.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      sound.engineOsc.connect(lp); lp.connect(sound.engineGain); sound.engineGain.connect(sound.master);
      sound.engineOsc.start();
      return true;
    } catch { return false; }
  };

  const tone = (freq, dur, type, vol, when = 0) => {
    if (!sound.ctx) return;
    const t0 = sound.ctx.currentTime + when;
    const o = sound.ctx.createOscillator(), gn = sound.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    gn.gain.setValueAtTime(vol, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(gn); gn.connect(sound.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  };

  const beat = () => {
    if (!sound.ctx || !sound.radioOn || g.state !== 'playing') return;
    const st = S.radio[ sound.radioIdx ];
    const step = sound.beatStep % 8;
    // Kick on the beat, bass line walking the minor scale
    if (step % 2 === 0) tone(120, 0.18, 'sine', 0.5);
    const scale = [1, 1, 1.189, 1.335, 1.498, 1.782];
    tone(st.root * scale[step % 6], 0.22, st.wave, 0.16);
    if (step === 4) tone(st.root * 2, 0.3, 'sine', 0.1);
    sound.beatStep++;
  };

  const setSiren = (active, nearestDist) => {
    if (!sound.ctx) return;
    const target = active ? Math.max(0, 0.22 - (nearestDist ?? 200) * 0.002) : 0;
    sound.sirenGain.gain.setTargetAtTime(target, sound.ctx.currentTime, 0.2);
    sound.sirenOsc.frequency.setTargetAtTime(
      (Math.floor(g.time * 2) % 2 === 0) ? 700 : 950, sound.ctx.currentTime, 0.05);
  };

  const gunshot = () => {
    if (!sound.ctx) return;
    const len = sound.ctx.sampleRate * 0.12;
    const buf = sound.ctx.createBuffer(1, len, sound.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = sound.ctx.createBufferSource(); src.buffer = buf;
    const gn = sound.ctx.createGain(); gn.gain.value = 0.4;
    src.connect(gn); gn.connect(sound.master); src.start();
  };

  const update = (dt) => {
    if (!sound.ctx) return;
    sound.beatTimer += dt;
    const interval = 30 / S.radio[sound.radioIdx].bpm; // eighth notes
    if (sound.beatTimer >= interval) { sound.beatTimer -= interval; beat(); }
    const speed = g.player.car ? Math.abs(g.player.car.speed) : 0;
    sound.engineOsc.frequency.setTargetAtTime(45 + speed * 4, sound.ctx.currentTime, 0.1);
    sound.engineGain.gain.setTargetAtTime(g.player.car ? 0.05 : 0, sound.ctx.currentTime, 0.1);
  };

  sound.ensure = ensure;
  sound.setSiren = setSiren;
  sound.gunshot = gunshot;
  sound.update = update;
  sound.nextStation = () => {
    sound.radioIdx = (sound.radioIdx + 1) % S.radio.length;
    const st = S.radio[sound.radioIdx];
    g.display.msg(`Radio: ${st.name} — ${st.dj}`);
  };
  sound.toggleMute = () => {
    sound.muted = !sound.muted;
    if (sound.master) sound.master.gain.value = sound.muted ? 0 : 0.5;
    g.display.msg(sound.muted ? 'Sound muted' : 'Sound on');
  };
  sound.stationName = () => S.radio[sound.radioIdx].name;
  return sound;
}
