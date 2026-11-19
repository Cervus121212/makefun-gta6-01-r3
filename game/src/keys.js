// Porto Vela — keys: keyboard + mouse. Drag looks around (and resets the
// camera idle timer), a still click shoots, E interacts / enters / exits,
// Enter starts, P pauses, M mutes, R cycles radio, 1/2 swap weapons,
// 1-8 start story jobs.
export function createKeys(g) {
  const keys = new Set();
  let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, moved = 0;

  const onKeyDown = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'Enter' && g.state === 'title') g.startGame();
    else if (e.code === 'Enter' && g.state === 'paused') g.togglePause();
    if (e.code === 'KeyP' && (g.state === 'playing' || g.state === 'paused')) g.togglePause();
    if (e.code === 'KeyM') g.sound.toggleMute();
    if (e.code === 'KeyR') g.sound.nextStation();
    if (e.code === 'KeyE') g.interactPressed = true;
    if (e.code === 'KeyQ') {
      g.combat.weaponIndex = (g.combat.weaponIndex + 1) % 2;
      g.display.msg('Weapon: ' + g.combat.weaponNames[g.combat.weaponIndex].toUpperCase());
    }
    // Numbers do double duty: with no job running they start jobs 1-8;
    // mid-job, 1/2 swap weapons.
    if (/^Digit[1-8]$/.test(e.code)) {
      const n = Number(e.code.slice(5));
      if (g.state === 'playing' && !g.missions.active) g.missions.start(n);
      else if (g.state === 'playing' && (n === 1 || n === 2)) {
        g.combat.weaponIndex = n - 1;
        g.display.msg('Weapon: ' + g.combat.weaponNames[g.combat.weaponIndex].toUpperCase());
      }
    }
  };
  const onKeyUp = (e) => keys.delete(e.code);

  const onMouseDown = (e) => {
    if (e.target.closest('button')) return;
    dragging = true; moved = 0;
    lastX = downX = e.clientX; lastY = downY = e.clientY;
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    g.cam.yaw -= dx * 0.004;
    g.cam.pitch = Math.max(-0.1, Math.min(0.7, g.cam.pitch + dy * 0.003));
    g.cam.lastDragT = 0;
  };
  const onMouseUp = (e) => {
    if (dragging && moved < 6 && g.state === 'playing') g.combat.shoot();
    dragging = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', () => keys.clear());

  return { keys };
}
