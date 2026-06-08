// effects.js — Efek visual: hujan ringan, partikel, impact, contact shadows

import * as THREE from 'three';

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
const isLowEnd  = isMobile && (navigator.hardwareConcurrency||4) <= 4;
import { state } from './state.js';
import { setRainVolume } from './audio.js';

let scene;

// ─── RAIN SYSTEM ─── (dikecilkan: 2500 partikel, lebih halus)
const RAIN_COUNT = isLowEnd ? 200 : isMobile ? 500 : 1500;
let rainPoints, rainPositions, rainVelocities;
const rainSplashes = [];

const contactShadows = new Map();
const MAX_DECALS = 30;
const smokeParticles = [];
export const effectParticles = [];

export function initEffects(s) {
  scene = s;
  createRainSystem();
}

function createRainSystem() {
  const geo = new THREE.BufferGeometry();
  rainPositions  = new Float32Array(RAIN_COUNT * 3);
  rainVelocities = new Float32Array(RAIN_COUNT);

  for (let i = 0; i < RAIN_COUNT; i++) {
    rainPositions[i*3]   = (Math.random()-0.5)*60;
    rainPositions[i*3+1] = Math.random()*40;
    rainPositions[i*3+2] = (Math.random()-0.5)*60;
    rainVelocities[i]    = 14 + Math.random()*8; // lebih lambat = lebih halus
  }

  geo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xccddff,
    size: 0.045,          // lebih kecil
    transparent: true,
    opacity: 0.35,        // lebih transparan
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  rainPoints = new THREE.Points(geo, mat);
  rainPoints.visible = false;
  rainPoints.frustumCulled = false;
  scene.add(rainPoints);
}

export function updateRain(dt, cameraPos) {
  const r = state.rain;
  const targetIntensity = r.active ? 1 : 0;
  r.current += (targetIntensity - r.current) * dt * 1.2;

  if (r.current < 0.01) {
    rainPoints.visible = false;
    setRainVolume(0);
    updateSplashes(dt);
    return;
  }

  rainPoints.visible = true;
  rainPoints.material.opacity = 0.18 + r.current * 0.22; // max opacity 0.4
  setRainVolume(r.current * 0.55); // suara lebih pelan

  const posAttr = rainPoints.geometry.attributes.position;

  for (let i = 0; i < RAIN_COUNT; i++) {
    rainPositions[i*3+1] -= rainVelocities[i] * dt * r.current;

    if (rainPositions[i*3+1] < 0) {
      rainPositions[i*3]   = cameraPos.x + (Math.random()-0.5)*60;
      rainPositions[i*3+1] = 38 + Math.random()*8;
      rainPositions[i*3+2] = cameraPos.z + (Math.random()-0.5)*60;

      // Splash lebih jarang (4%) dan hanya saat hujan penuh
      if (r.current > 0.6 && Math.random() < 0.04) {
        spawnPuddleSplash(new THREE.Vector3(
          rainPositions[i*3], 0.01, rainPositions[i*3+2]
        ));
      }
    }

    const dx = rainPositions[i*3]   - cameraPos.x;
    const dz = rainPositions[i*3+2] - cameraPos.z;
    if (Math.abs(dx) > 30) rainPositions[i*3]   = cameraPos.x + (Math.random()-0.5)*60;
    if (Math.abs(dz) > 30) rainPositions[i*3+2] = cameraPos.z + (Math.random()-0.5)*60;
  }

  posAttr.needsUpdate = true;
  updateSplashes(dt);
}

function spawnPuddleSplash_ORIG(pos) {
  // Batasi jumlah splash agar tidak berat
  if (rainSplashes.length > 15) return;
  const geo = new THREE.RingGeometry(0.0, 0.04, 7);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xaaccff, side: THREE.DoubleSide,
    transparent: true, opacity: 0.5, depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI/2;
  ring.position.copy(pos);
  ring.userData.life = 0; ring.userData.maxLife = 0.35;
  scene.add(ring);
  rainSplashes.push(ring);
}

function updateSplashes(dt) {
  for (let i = rainSplashes.length-1; i >= 0; i--) {
    const s = rainSplashes[i];
    s.userData.life += dt;
    const t = s.userData.life / s.userData.maxLife;
    s.scale.setScalar(1 + t*3);
    s.material.opacity = 0.5*(1-t);
    if (t >= 1) {
      scene.remove(s); s.geometry.dispose(); s.material.dispose();
      rainSplashes.splice(i, 1);
    }
  }
}

export function toggleRain() { state.rain.active = !state.rain.active; }
export function setRainActive(v) { state.rain.active = v; }

// ─── CONTACT SHADOWS ───
export function createContactShadow(entity) {
  const geo = new THREE.CircleGeometry(0.55, 10);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false,
  });
  const shadow = new THREE.Mesh(geo, mat);
  shadow.rotation.x = -Math.PI/2;
  shadow.position.y = 0.02;
  scene.add(shadow);
  contactShadows.set(entity.uuid, shadow);
  return shadow;
}

export function updateContactShadow(entity) {
  const shadow = contactShadows.get(entity.uuid);
  if (!shadow) return;
  shadow.position.x = entity.position.x;
  shadow.position.z = entity.position.z;
  shadow.material.opacity = Math.max(0, 0.3 - Math.max(0, entity.position.y)*0.1);
}

export function removeContactShadow(entity) {
  const shadow = contactShadows.get(entity.uuid);
  if (shadow) {
    scene.remove(shadow); shadow.geometry.dispose(); shadow.material.dispose();
    contactShadows.delete(entity.uuid);
  }
}

// ─── BULLET IMPACTS ───
export function createWallImpact(pos, normal) {
  for (let i = 0; i < 5; i++) {
    const size = 0.025 + Math.random()*0.045;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size,size,size),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.08,0.15,0.55+Math.random()*0.2),
        transparent: true, opacity: 0.9,
      })
    );
    mesh.position.copy(pos);
    mesh.userData.vel = new THREE.Vector3(
      normal.x*0.4+(Math.random()-0.5)*2.5,
      0.8+Math.random()*2.5,
      normal.z*0.4+(Math.random()-0.5)*2.5,
    );
    mesh.userData.life = 0.35+Math.random()*0.25;
    mesh.userData.maxLife = mesh.userData.life;
    scene.add(mesh); effectParticles.push(mesh);
  }
  // Flash
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.05,5,5),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
  );
  flash.position.copy(pos);
  flash.userData.life = 0.05; flash.userData.maxLife = 0.05; flash.userData.isFlash = true;
  scene.add(flash); effectParticles.push(flash);
  spawnBulletDecal(pos, normal);
}

// ── Slash blood: muncrat mengikuti arah sapuan blade ──
export function createSlashBlood(pos, fwd, slashDir) {
  // Arah muncrat = campuran fwd + komponen samping slash
  const sideVec = new THREE.Vector3(fwd.z * slashDir, 0, -fwd.x * slashDir).normalize();
  const splashDir = fwd.clone().multiplyScalar(0.6).addScaledVector(sideVec, 0.8).normalize();

  // Partikel darah besar (arc panjang)
  for (let i = 0; i < 8; i++) {
    const size = 0.04 + Math.random() * 0.08;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size * 0.4, size),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.55 + Math.random()*0.2, 0, 0),
        transparent: true, opacity: 1,
      })
    );
    mesh.position.copy(pos).add(new THREE.Vector3(
      (Math.random()-0.5)*0.15, (Math.random()-0.5)*0.1, (Math.random()-0.5)*0.15
    ));
    const speed = 3 + Math.random() * 5;
    mesh.userData.vel = new THREE.Vector3(
      splashDir.x * speed + (Math.random()-0.5)*2,
      1.5 + Math.random() * 4,
      splashDir.z * speed + (Math.random()-0.5)*2,
    );
    mesh.userData.life = 0.5 + Math.random() * 0.4;
    mesh.userData.maxLife = mesh.userData.life;
    scene.add(mesh); effectParticles.push(mesh);
  }

  // Droplet kecil (spray halus)
  for (let i = 0; i < 6; i++) {
    const size = 0.015 + Math.random() * 0.025;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshBasicMaterial({ color: 0x880000, transparent: true, opacity: 0.9 })
    );
    mesh.position.copy(pos);
    mesh.userData.vel = new THREE.Vector3(
      splashDir.x * (6+Math.random()*6) + (Math.random()-0.5)*3,
      2 + Math.random() * 5,
      splashDir.z * (6+Math.random()*6) + (Math.random()-0.5)*3,
    );
    mesh.userData.life = 0.3 + Math.random() * 0.3;
    mesh.userData.maxLife = mesh.userData.life;
    scene.add(mesh); effectParticles.push(mesh);
  }

  // Tetesan di tanah (decal bulat merah)
  const numDrips = 2 + Math.floor(Math.random()*3);
  for (let i = 0; i < numDrips; i++) {
    const geo = new THREE.CircleGeometry(0.04 + Math.random()*0.05, 7);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x660000, transparent: true, opacity: 0.85, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1,
    });
    const drop = new THREE.Mesh(geo, mat);
    drop.rotation.x = -Math.PI/2;
    drop.position.set(
      pos.x + splashDir.x * (0.2 + Math.random()*0.6) + (Math.random()-0.5)*0.3,
      0.01,
      pos.z + splashDir.z * (0.2 + Math.random()*0.6) + (Math.random()-0.5)*0.3,
    );
    drop.userData.life = 14 + Math.random()*6;
    scene.add(drop); effectParticles.push(drop);
    // override fade: pakai life langsung
    drop.userData.maxLife = drop.userData.life;
    drop.userData.isBloodDrop = true;
  }
}

export function createBloodImpact(pos, dir) {
  for (let i = 0; i < 6; i++) {
    const size = 0.03+Math.random()*0.055;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size,size,size),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.55+Math.random()*0.25,0,0),
        transparent: true, opacity: 1,
      })
    );
    mesh.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*0.12,0,(Math.random()-0.5)*0.12));
    mesh.userData.vel = new THREE.Vector3(
      dir.x*1.2+(Math.random()-0.5)*3,
      1.5+Math.random()*3,
      dir.z*1.2+(Math.random()-0.5)*3,
    );
    mesh.userData.life = 0.4+Math.random()*0.35;
    mesh.userData.maxLife = mesh.userData.life;
    scene.add(mesh); effectParticles.push(mesh);
  }
}

const decalList = [];
function spawnBulletDecal(pos, normal) {
  const geo = new THREE.CircleGeometry(0.055+Math.random()*0.035, 7);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x111111, transparent: true, opacity: 0.75, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1,
  });
  const decal = new THREE.Mesh(geo, mat);
  decal.position.copy(pos).addScaledVector(normal, 0.01);
  const up = new THREE.Vector3(0,1,0);
  if (Math.abs(normal.dot(up)) > 0.9) decal.rotation.x = -Math.PI/2;
  else decal.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
  decal.userData.life = 18;
  scene.add(decal); decalList.push(decal);
  if (decalList.length > MAX_DECALS) {
    const old = decalList.shift();
    scene.remove(old); old.geometry.dispose(); old.material.dispose();
  }
}

export function spawnMuzzleSmoke(pos, dir) {
  if (smokeParticles.length > 8) return; // batasi smoke
  for (let i = 0; i < 2; i++) {
    const size = 0.04+Math.random()*0.04;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size,5,5),
      new THREE.MeshBasicMaterial({ color:0x999999, transparent:true, opacity:0.18, depthWrite:false })
    );
    mesh.position.copy(pos).addScaledVector(dir, 0.04+i*0.02);
    mesh.userData.vel = new THREE.Vector3(
      (Math.random()-0.5)*0.2, 0.25+Math.random()*0.4, (Math.random()-0.5)*0.2
    );
    mesh.userData.life = 0.5+Math.random()*0.3;
    mesh.userData.maxLife = mesh.userData.life;
    mesh.userData.isSmoke = true;
    scene.add(mesh); smokeParticles.push(mesh);
  }
}

export function updateEffectParticles(dt) {
  const GRAVITY = -9.8;
  for (let i = effectParticles.length-1; i >= 0; i--) {
    const p = effectParticles[i];
    p.userData.life -= dt;
    if (p.userData.life <= 0) {
      scene.remove(p); p.geometry.dispose(); p.material.dispose();
      effectParticles.splice(i, 1); continue;
    }
    const t = p.userData.life / p.userData.maxLife;
    if (p.userData.isFlash) {
      p.material.opacity = t; p.scale.setScalar(1-t);
    } else if (p.userData.isBloodDrop) {
      // Tetesan darah di tanah: fade perlahan di akhir hayat
      p.material.opacity = t < 0.15 ? t/0.15 * 0.85 : 0.85;
    } else {
      const vel = p.userData.vel;
      if (vel) {
        vel.y += GRAVITY*dt;
        p.position.addScaledVector(vel, dt);
        // Pantul jika menyentuh tanah
        if (p.position.y < 0.01) {
          p.position.y = 0.01;
          if (vel) { vel.y = -vel.y * 0.25; vel.x *= 0.7; vel.z *= 0.7; }
        }
      }
      p.material.opacity = t;
      p.scale.setScalar(Math.max(0.1, t));
    }
  }
  for (let i = smokeParticles.length-1; i >= 0; i--) {
    const p = smokeParticles[i];
    p.userData.life -= dt;
    if (p.userData.life <= 0) {
      scene.remove(p); p.geometry.dispose(); p.material.dispose();
      smokeParticles.splice(i, 1); continue;
    }
    const t = p.userData.life / p.userData.maxLife;
    p.position.addScaledVector(p.userData.vel, dt);
    p.scale.setScalar(1+(1-t)*2.5);
    p.material.opacity = t*0.18;
  }
  for (let i = decalList.length-1; i >= 0; i--) {
    const d = decalList[i];
    d.userData.life -= dt;
    if (d.userData.life < 2) d.material.opacity = (d.userData.life/2)*0.75;
    if (d.userData.life <= 0) {
      scene.remove(d); d.geometry.dispose(); d.material.dispose();
      decalList.splice(i, 1);
    }
  }
}

export function spawnPuddleSplash(pos) {
  if (isMobile) return;
  spawnPuddleSplash_ORIG(pos);
}
