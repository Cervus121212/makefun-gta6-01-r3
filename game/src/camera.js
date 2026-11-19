// Porto Vela — camera: third-person chase cam. yaw IS the view direction
// (and the aim direction — the probe sets cam.yaw then clicks). Fix F1:
// while driving and idle >1.5 s the view eases back behind the heading at
// 2.2/s (1.4/s when nearly aligned); on foot the camera never auto-eases,
// so a staged aim stays put. Target yaw error <= 3 degrees when settled.
import * as THREE from '../vendor/three.module.min.js';
import { S, clamp, angDiff } from './settings.js';

export function createCamera(g) {
  const cam = { yaw: S.spawn.heading, pitch: 0.32, yawError: 0, lastDragT: 10, dist: S.camDist };

  const update = (dt) => {
    const p = g.player;
    cam.lastDragT += dt;
    // F1: follow the heading only while driving and the mouse has been idle
    if (p.car && cam.lastDragT > S.idleEaseAfter) {
      const err = angDiff(p.heading, cam.yaw);
      const rate = Math.abs(err) < 0.15 ? S.camEaseNear : S.camEase;
      const step = clamp(err, -rate * dt, rate * dt);
      cam.yaw += step;
    }
    cam.yawError = Math.abs(angDiff(cam.yaw, p.heading)) * 180 / Math.PI;
    const speed = p.car ? Math.abs(p.car.speed) : 0;
    cam.dist = S.camDist + speed * S.camDistSpeed;
    const back = cam.dist, up = S.camHeight + cam.pitch * 6;
    const cx = p.x - Math.sin(cam.yaw) * back;
    const cz = p.z - Math.cos(cam.yaw) * back;
    g.camera3.position.set(cx, up, cz);
    g.camera3.lookAt(p.x + Math.sin(cam.yaw) * 4, 1.6, p.z + Math.cos(cam.yaw) * 4);
    const fov = S.fovMin + (S.fovMax - S.fovMin) * clamp(speed / S.maxSpeed, 0, 1);
    if (Math.abs(g.camera3.fov - fov) > 0.1) {
      g.camera3.fov = fov;
      g.camera3.updateProjectionMatrix();
    }
  };

  // Place the camera for a posed screenshot, bypassing the chase logic.
  const pose = (pos, look) => {
    g.camera3.position.set(pos.x, pos.y, pos.z);
    g.camera3.lookAt(look.x, look.y, look.z);
    cam.yaw = Math.atan2(look.x - pos.x, look.z - pos.z);
  };

  cam.update = update;
  cam.pose = pose;
  return cam;
}
