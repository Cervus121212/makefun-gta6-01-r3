// Porto Vela — quests: the 8 story jobs (Dante Reyes vs Mara Voss /
// Det. Rook), $19,000 in total. Steps are 1-based. E always prioritises a
// mission interact over entering a car.
import * as THREE from '../vendor/three.module.min.js';
import { S, dist2d } from './settings.js';
import { buildCarMesh } from './cars.js';

export function createQuests(g) {
  const missions = {
    index: 0, active: false, step: 1,
    completed: new Set(), chaseTarget: null,
    timer: 0, informant: null, cashSpot: false,
  };

  const def = (i) => S.missions[i - 1];
  const near = (x, z, r) => dist2d(g.player.x, g.player.z, x, z) < r;
  const setTarget = (t) => { missions.chaseTarget = t ? { x: t.x, z: t.z } : null; };
  const stepText = () => {
    if (!missions.active) return '';
    const d = def(missions.index);
    return `M${d.n} ${d.name} — ${d.steps[missions.step - 1].text}`;
  };

  const start = (i) => {
    if (i < 1 || i > 8 || missions.completed.has(i)) return false;
    if (missions.active) return false;
    const d = def(i);
    missions.index = i; missions.active = true; missions.step = 1;
    missions.timer = 0; missions.cashSpot = false;
    if (missions.informant) { g.scene.remove(missions.informant.mesh); missions.informant = null; }
    g.fight.clearEnemies();
    if (i === 3) g.police.setStars(3);
    if (i === 4) g.fight.spawnEnemies(4, S.dealSpot.x, S.dealSpot.z, { hat: true });
    if (i === 6) {
      const mesh = buildCarMesh(0x2aa85a);
      g.scene.add(mesh);
      missions.informant = { mesh, angle: 0, x: 40, z: 80, hp: 120 };
    }
    if (i === 8) g.police.setStars(4);
    setTarget(d.steps[0].target);
    g.display.msg(`Job started: ${d.name} — ${d.brief}`);
    g.display.dialog('Mara', d.brief);
    return true;
  };

  const complete = () => {
    const d = def(missions.index);
    g.cash += d.reward;
    // eslint-disable-next-line no-console
    console.log(`[quest] complete M${d.n} ${d.name} +$${d.reward} cash now $${g.cash}`);
    missions.completed.add(d.n);
    g.display.msg(`Job done: ${d.name} +$${d.reward.toLocaleString()}`);
    g.display.dialog('Mara', d.n === 8
      ? 'That is how you become King of Vela, Dante. The port is yours now.'
      : `Clean work, Dante. $${d.reward.toLocaleString()} is yours.`);
    if (missions.informant) { g.scene.remove(missions.informant.mesh); missions.informant = null; }
    missions.active = false; missions.index = 0; missions.step = 1;
    setTarget(null);
    g.saveGame();
  };

  const fail = (why) => {
    const d = def(missions.index);
    g.display.msg(`Job failed: ${d.name} — ${why}`);
    if (missions.informant) { g.scene.remove(missions.informant.mesh); missions.informant = null; }
    missions.active = false; missions.index = 0; missions.step = 1;
    setTarget(null);
  };

  const advance = () => {
    const d = def(missions.index);
    missions.step += 1;
    if (missions.step > d.steps.length) { complete(); return; }
    setTarget(d.steps[missions.step - 1].target);
    g.display.msg(d.steps[missions.step - 1].text);
  };

  const update = (dt) => {
    // The informant sedan circles the plaza on an ellipse, always moving
    if (missions.informant) {
      const inf = missions.informant;
      if (inf.hp > 0) {
        inf.angle += 0.12 * dt;
        inf.x = 40 + Math.cos(inf.angle) * 35;
        inf.z = 80 + Math.sin(inf.angle) * 27.5;
        inf.mesh.position.set(inf.x, 0, inf.z);
        inf.mesh.rotation.y = Math.atan2(-Math.sin(inf.angle) * 35, Math.cos(inf.angle) * 27.5);
        // Ram damage: 120/s while the player's car is within 7 m
        if (g.player.car && dist2d(g.player.x, g.player.z, inf.x, inf.z) < 7) {
          inf.hp -= 120 * dt;
          inf.mesh.rotation.z = 0.06;
          if (inf.hp <= 0) {
            inf.mesh.rotation.z = 0.5; // wrecked, on its side
            g.display.msg('The informant is wrecked. Rook lost his snitch.');
          }
        }
      }
    }
    if (!missions.active) return;
    const i = missions.index, s = missions.step;
    // E is only consumed by a mission when the player is standing on its
    // interact spot; anywhere else the press stays buffered for entering cars.
    const wantE = (i === 1 && s === 1 && near(S.garage.x, S.garage.z, 6))
      || (i === 2 && s === 1 && near(S.docksPickup.x, S.docksPickup.z, 5))
      || (i === 4 && s === 2 && near(S.dealSpot.x, S.dealSpot.z, 4));
    const ePressed = wantE ? g.consumeInteract() : false;
    switch (i) {
      case 1:
        if (s === 1 && near(S.garage.x, S.garage.z, 6) && ePressed) {
          g.display.msg('Keys in hand. The Vela Runner is yours — drive home.');
          advance();
        } else if (s === 2 && near(S.safehouse.x, S.safehouse.z, 7)) complete();
        break;
      case 2:
        if (s === 1 && near(S.docksPickup.x, S.docksPickup.z, 5) && ePressed) advance();
        else if (s === 2 && near(S.safehouse.x, S.safehouse.z, 7)) complete();
        break;
      case 3:
        if (g.police.stars === 0) complete();
        break;
      case 4:
        if (s === 1 && g.fight.enemies.length === 0) {
          missions.cashSpot = true;
          g.display.msg('All four down. Grab the cash.');
          advance();
        } else if (s === 2 && near(S.dealSpot.x, S.dealSpot.z, 4) && ePressed) complete();
        break;
      case 5:
        if (s === 1 && near(S.marina.x, S.marina.z, 6)) {
          missions.timer = 90;
          g.display.msg('Crew aboard! North, now — 90 seconds!');
          advance();
        } else if (s === 2) {
          missions.timer -= dt;
          if (near(S.getawayNorth.x, S.getawayNorth.z, 7)) complete();
          else if (missions.timer <= 0) fail('the crew got caught at the roadblock');
        }
        break;
      case 6:
        if (missions.informant && missions.informant.hp <= 0) complete();
        break;
      case 7:
        if (s === 1 && g.player.car && g.player.car.kind === 'van') {
          g.police.setStars(3);
          g.display.msg('Van stolen! Three stars — get home!');
          advance();
        } else if (s === 2 && near(S.safehouse.x, S.safehouse.z, 7)) complete();
        break;
      case 8:
        if (s === 1) {
          if (g.police.stars >= 4) {
            missions.timer += dt;
            if (missions.timer >= 60) { advance(); g.display.msg('Sixty seconds. Now get to the yacht!'); }
          }
        } else if (s === 2 && near(S.yacht.x, S.yacht.z, 7)) complete();
        break;
      default: break;
    }
    // Keep the HUD objective fresh
    if (missions.active) {
      const d = def(missions.index);
      setTarget(d.steps[missions.step - 1].target);
    }
  };

  missions.start = start;
  missions.update = update;
  missions.stepText = stepText;
  missions.complete = complete;
  missions.fail = fail;
  return missions;
}
