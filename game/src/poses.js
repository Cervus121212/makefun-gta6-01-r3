// Porto Vela — poses: the four staged dossier screenshots. Each pose
// freezes the world (police and the player car stop dead) so the frame is
// exactly reproducible, then reports SHOT-READY.
export function createPoses(g) {
  const ready = () => {
    // Paint the HUD + minimap once: in shot mode the main loop is frozen,
    // so display.update never runs and the minimap would stay blank.
    g.display.update(0);
    g.display.drawMap();
    g.renderer.render(g.scene, g.camera3);
    document.title = 'SHOT-READY';
    window.__shotReady = true;
  };

  const freeze = () => { g.shotFreeze = true; };

  const poses = {
    cover() {
      g.state = 'playing';
      g.display.showStart(false); // the cover shows the city, not the title
      g.setPlayer(-60, -150);
      g.player.heading = Math.PI / 2;
      g.cam.yaw = Math.PI / 2;
      g.cam.pose({ x: -100, y: 16, z: -200 }, { x: -20, y: 2, z: -120 });
      g.display.msg('Porto Vela — an open-world crime story', 5000);
      freeze(); ready();
    },
    chase() {
      // Fix F3: camera ~20 m, cruisers staged, heli low, player car ~66 px.
      // Staged straight down the x=0 road centreline: with this seed's
      // city, any off-centre camera has a block building in the sightline
      // and hides the car. Road staging keeps the same ~20 m distance
      // and the same 3/4 rear view, with nothing between lens and car.
      g.state = 'playing';
      g.display.showStart(false);
      g.police.setStars(3);
      // Spawn the units NOW: in shot mode the main loop is frozen, so
      // cops.update() never runs to top the units up — setStars alone
      // only sets the number. Without this the chase frame has no police.
      while (g.police.cars.length < 3) g.police.spawnCruiser();
      if (!g.police.heli) g.police.spawnHeli();
      const car = g.cars.playerCar;
      g.player.car = car;
      car.x = 0; car.z = 100; car.heading = 0; car.speed = 0;
      car.mesh.position.set(0, 0, 100); car.mesh.rotation.y = 0;
      g.player.x = 0; g.player.z = 100; g.player.heading = 0;
      const spots = [[3, 84], [-4, 92], [5, 116]];
      g.police.cars.forEach((c, i) => {
        if (spots[i]) {
          c.x = spots[i][0]; c.z = spots[i][1];
          c.mesh.position.set(c.x, 0, c.z);
          c.mesh.rotation.y = Math.atan2(0 - c.x, 100 - c.z);
        }
      });
      if (g.police.heli) {
        g.police.heli.mesh.position.set(6, 22, 90);
        g.police.heli.x = 6; g.police.heli.z = 90;
      }
      g.cam.pose({ x: 0, y: 4.5, z: 78 }, { x: 0, y: 3, z: 100 });
      freeze(); ready();
    },
    mission() {
      // Fix F8: docks camera ~28 m, rivals staged, dialog docked bottom-left.
      g.state = 'playing';
      g.display.showStart(false);
      g.setPlayer(252, 108);
      g.player.heading = Math.atan2(264 - 252, 120 - 108);
      g.cam.yaw = g.player.heading;
      g.fight.clearEnemies();
      g.fight.spawnEnemies(4, 264, 120, { hat: true });
      g.display.dialog('Mara', 'Four of my rivals are counting my money on my dock, Dante. End it — and bring me the cash.', 8000);
      g.display.els.dialog.classList.add('shot-mission');
      g.cam.pose({ x: 244, y: 8, z: 100 }, { x: 264, y: 2, z: 120 });
      freeze(); ready();
    },
    title() {
      g.state = 'title';
      g.display.showStart(true);
      g.cam.pose({ x: 80, y: 30, z: -240 }, { x: 0, y: 5, z: 0 });
      freeze(); ready();
    },
  };

  const applyPose = (name) => {
    if (!poses[name]) return false;
    g.shotMode = name;
    poses[name]();
    return true;
  };

  return { applyPose, poses };
}
