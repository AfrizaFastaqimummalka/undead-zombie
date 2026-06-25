// zombies.js — zombie GLB model + AI + animation
// zombie.glb: Sketchfab model, 1 anim "Take 01", skinned mesh, 23 bones
// ARSITEKTUR: GLB instances di-add langsung ke SCENE (bukan child zombie group)
// Transform posisi/rotasi di-sync manual di updateTargets

import * as THREE from 'three';
import { PI, PI2, state } from './state.js';
import { playZombieGrowl, playZombieAttack, playHit as playHitSound, playPlayerHurt, playPickup } from './audio.js';
import { updateHUD, showMessage, hideMessage, showDamageOverlay, showHitmarker, gameOver } from './ui.js';
import { createContactShadow, updateContactShadow, removeContactShadow } from './effects.js';

let scene, camera;

// ── GLB state ──
let glbTemplate    = null;  // master clone di scene (invisible, untuk SkeletonUtils.clone)
let glbAnimClip    = null;  // AnimationClip "Take 01"
let glbSkeleton    = null;  // SkeletonUtils module
let glbReady       = false;

// Map: zombie group → { model, mixer, action }
const glbInstances = new Map();

// ─────────────────────────────────────────────────────
// LOAD zombie.glb
// ─────────────────────────────────────────────────────
async function loadZombieGLB() {
  try {
    const headRes = await fetch('https://ffnqefdbc21kaq5a.public.blob.vercel-storage.com/zombie.glb', { method: 'HEAD' });
    if (!headRes.ok) throw new Error('File not found: models/zombie.glb');

    const [{ GLTFLoader }, skeletonMod] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js'),
      import('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/SkeletonUtils.js'),
    ]);
    // Three.js 0.170: SkeletonUtils export named function 'clone' langsung
    const cloneFn = skeletonMod.clone
                 || (skeletonMod.SkeletonUtils && skeletonMod.SkeletonUtils.clone)
                 || (skeletonMod.default && skeletonMod.default.clone);
    if (!cloneFn) throw new Error('SkeletonUtils.clone not found in module: ' + Object.keys(skeletonMod).join(', '));
    glbSkeleton = { clone: cloneFn };

    const gltf  = await new GLTFLoader().loadAsync('https://ffnqefdbc21kaq5a.public.blob.vercel-storage.com/zombie.glb');
    const model = gltf.scene;

    // Sembunyikan shadow plane Sketchfab (Plane_0)
    model.traverse(o => {
      if (o.name === 'Plane_0' || o.name === 'Plane') o.visible = false;
    });

    // Normalisasi tinggi → 1.8 unit
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const h   = box.max.y - box.min.y;
    const sc  = h > 0 ? 1.8 / h : 1;
    model.scale.setScalar(sc);
    model.updateMatrixWorld(true);

    // Injak lantai ke Y=0
    const box2 = new THREE.Box3().setFromObject(model);
    model.position.y = -box2.min.y;
    model.updateMatrixWorld(true);

    // Fix material (hapus metalness, pertahankan texture)
    model.traverse(o => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.castShadow    = true;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => {
        if (!m) return;
        if (m.metalness !== undefined) m.metalness = 0;
        if (m.roughness !== undefined) m.roughness = 0.75;
        m.needsUpdate = true;
      });
    });

    // Simpan template di scene sebagai staging (invisible)
    model.visible = false;
    model.name    = '__zombieTemplate';
    scene.add(model);

    glbTemplate = model;
    glbAnimClip = (gltf.animations && gltf.animations.length > 0) ? gltf.animations[0] : null;
    glbReady    = true;

    console.log('[zombies] GLB ready ✓  scale=' + sc.toFixed(3) +
                '  anim=' + (glbAnimClip ? glbAnimClip.name : 'none'));

    // Upgrade zombie yang sudah spawn pakai procedural
    upgradeExisting();

  } catch (e) {
    console.warn('[zombies] GLB load failed → procedural fallback:', e.message);
    glbReady = false;
  }
}

// ─────────────────────────────────────────────────────
// BUAT SATU INSTANCE GLB
// Penting: model di-add ke SCENE langsung, bukan ke zombie group
// Posisi di-sync manual setiap frame
// ─────────────────────────────────────────────────────
function createGLBInstance(zombieGroup) {
  // Clone skeleton + mesh dari template
  const clone = glbSkeleton.clone(glbTemplate);
  clone.visible = true;
  clone.name    = '__zombieInstance';

  // Clone material agar flash merah tidak menular
  clone.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.frustumCulled = true;   // Three.js auto-cull zombie di luar view
    o.castShadow    = false;  // hemat GPU: matikan shadow per-zombie
    if (o.material) {
      o.material = Array.isArray(o.material)
        ? o.material.map(m => m ? m.clone() : m)
        : o.material.clone();
    }
  });

  // Tag DULU sebelum scene.add — agar raycast bisa trace ke zombieGroup
  clone.userData.zombieGroup = zombieGroup;
  clone.traverse(o => { o.userData.zombieGroup = zombieGroup; });

  // Tambah langsung ke scene (BUKAN ke zombieGroup)
  scene.add(clone);

  // Setup AnimationMixer
  const mixer  = new THREE.AnimationMixer(clone);
  let   action = null;
  if (glbAnimClip) {
    action = mixer.clipAction(glbAnimClip);
    action.loop      = THREE.LoopRepeat;
    action.timeScale = 1.0;
    action.reset().play();
  }

  // Cache material references → hemat traverse saat flash merah
  const cachedMats = [];
  const origColors = [];
  clone.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      if (m && m.color) {
        cachedMats.push(m);
        origColors.push(m.color.getHex());
      }
    });
  });

  // Simpan referensi
  glbInstances.set(zombieGroup.uuid, { clone, mixer, action, cachedMats, origColors });

  return { clone, mixer, action };
}

// ─────────────────────────────────────────────────────
// HAPUS GLB INSTANCE
// ─────────────────────────────────────────────────────
function removeGLBInstance(zombieGroup) {
  const inst = glbInstances.get(zombieGroup.uuid);
  if (!inst) return;
  if (inst.mixer) { inst.mixer.stopAllAction(); inst.mixer.uncacheRoot(inst.clone); }
  scene.remove(inst.clone);
  // Tidak dispose material/geometry GLB karena di-share antar instance
  // Hanya hapus referensi
  glbInstances.delete(zombieGroup.uuid);
}

// ─────────────────────────────────────────────────────
// SYNC posisi GLB instance ke zombie group (tiap frame)
// ─────────────────────────────────────────────────────
function syncGLBInstance(zombieGroup) {
  const inst = glbInstances.get(zombieGroup.uuid);
  if (!inst) return;
  const { clone } = inst;
  clone.position.copy(zombieGroup.position);
  clone.rotation.y = zombieGroup.rotation.y + Math.PI; // offset 180° — model GLB menghadap -Z
  clone.scale.copy(zombieGroup.scale);
  clone.visible = zombieGroup.visible;
}

// ─────────────────────────────────────────────────────
// UPGRADE zombie procedural yang sudah ada → GLB
// ─────────────────────────────────────────────────────
function upgradeExisting() {
  const all = [...new Set([...state.targets,
    ...zombiePool.filter(z => z.userData.alive)])];
  let n = 0;
  for (const z of all) {
    if (!z.userData.alive || z.userData.type === 'boss') continue;
    if (glbInstances.has(z.uuid)) continue; // sudah GLB

    // Hapus mesh procedural dari z
    while (z.children.length) z.remove(z.children[0]);

    // Buat GLB instance
    const { clone, mixer, action } = createGLBInstance(z);
    const noop = new THREE.Group();
    z.userData.isGLB     = true;
    z.userData.glbClone  = clone;
    z.userData.mixer     = mixer;
    z.userData.action    = action;
    z.userData.parts     = { leftArm:noop, rightArm:noop, leftLeg:noop, rightLeg:noop, head:noop };
    z.userData.materials = {};
    n++;
  }
  if (n > 0) console.log('[zombies] Upgraded ' + n + ' zombie(s) → GLB');
}

// ─────────────────────────────────────────────────────
// PROCEDURAL FALLBACK — box zombie
// ─────────────────────────────────────────────────────
function buildProcedural(z) {
  const skinMat = new THREE.MeshStandardMaterial({ color:0x5a7a4a, roughness:0.85 });
  const dkMat   = new THREE.MeshStandardMaterial({ color:0x3a5a3a, roughness:0.9  });
  const cthMat  = new THREE.MeshStandardMaterial({ color:0x2a3a2a, roughness:0.9  });
  const eyeMat  = new THREE.MeshBasicMaterial({ color:0xff2200 });

  function mk(geo, mat, px, py, pz, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.userData.zombieGroup = z;
    (parent || z).add(m);
    return m;
  }

  mk(new THREE.BoxGeometry(0.7, 0.7, 0.4),  cthMat,  0,    1.0,   0);
  const head = mk(new THREE.BoxGeometry(0.45,0.45,0.45), skinMat, 0, 1.6, 0);
  mk(new THREE.BoxGeometry(0.08,0.06,0.04), eyeMat, -0.14, 1.65, -0.24);
  mk(new THREE.BoxGeometry(0.08,0.06,0.04), eyeMat,  0.14, 1.65, -0.24);

  const laG = new THREE.Group(); laG.position.set(-0.45,1.35,0); laG.userData.zombieGroup=z;
  mk(new THREE.BoxGeometry(0.12,0.5,0.12), dkMat, 0,-0.25,0, laG); z.add(laG);
  const raG = new THREE.Group(); raG.position.set( 0.45,1.35,0); raG.userData.zombieGroup=z;
  mk(new THREE.BoxGeometry(0.12,0.5,0.12), dkMat, 0,-0.25,0, raG); z.add(raG);
  const llG = new THREE.Group(); llG.position.set(-0.18,0.65,0); llG.userData.zombieGroup=z;
  mk(new THREE.BoxGeometry(0.15,0.55,0.15), cthMat, 0,-0.275,0, llG); z.add(llG);
  const rlG = new THREE.Group(); rlG.position.set( 0.18,0.65,0); rlG.userData.zombieGroup=z;
  mk(new THREE.BoxGeometry(0.15,0.55,0.15), cthMat, 0,-0.275,0, rlG); z.add(rlG);

  z.userData.isGLB     = false;
  z.userData.glbClone  = null;
  z.userData.mixer     = null;
  z.userData.action    = null;
  z.userData.parts     = { leftArm:laG, rightArm:raG, leftLeg:llG, rightLeg:rlG, head };
  z.userData.materials = { skinMat, darkSkinMat:dkMat, clothMat:cthMat, eyeMat };
  z.userData.zombieGroup = z;
  z.traverse(o => { if (o!==z) o.userData.zombieGroup = z; });
}

// ─────────────────────────────────────────────────────
// BOSS — tetap procedural (identitas unik)
// ─────────────────────────────────────────────────────
function buildBoss(z) {
  const bodyMat  = new THREE.MeshStandardMaterial({ color:0x8b0000, roughness:0.8 });
  const headMat  = new THREE.MeshStandardMaterial({ color:0xcc3333, roughness:0.7 });
  const armMat   = new THREE.MeshStandardMaterial({ color:0x8b0000, roughness:0.8 });
  const legMat   = new THREE.MeshStandardMaterial({ color:0x660000, roughness:0.9 });
  const crownMat = new THREE.MeshStandardMaterial({ color:0xffd700, roughness:0.3, metalness:0.8 });
  const eyeMat   = new THREE.MeshBasicMaterial({ color:0xff0000 });

  function bk(geo,mat,px,py,pz,par) {
    const m=new THREE.Mesh(geo,mat); m.position.set(px,py,pz);
    m.castShadow=true; m.userData.zombieGroup=z; (par||z).add(m); return m;
  }

  bk(new THREE.BoxGeometry(0.6,0.6,0.4), bodyMat, 0,1.0,0);
  const head=bk(new THREE.BoxGeometry(0.4,0.4,0.4), headMat, 0,1.55,0);
  bk(new THREE.BoxGeometry(0.1,0.08,0.04),eyeMat,-0.14,1.6,-0.22);
  bk(new THREE.BoxGeometry(0.1,0.08,0.04),eyeMat, 0.14,1.6,-0.22);

  const laG=new THREE.Group(); laG.position.set(-0.4,1.3,0); laG.userData.zombieGroup=z;
  bk(new THREE.BoxGeometry(0.14,0.55,0.14),armMat,0,-0.275,0,laG); z.add(laG);
  const raG=new THREE.Group(); raG.position.set(0.4,1.3,0); raG.userData.zombieGroup=z;
  bk(new THREE.BoxGeometry(0.14,0.55,0.14),armMat,0,-0.275,0,raG); z.add(raG);
  const llG=new THREE.Group(); llG.position.set(-0.18,0.6,0); llG.userData.zombieGroup=z;
  bk(new THREE.BoxGeometry(0.16,0.5,0.16),legMat,0,-0.25,0,llG); z.add(llG);
  const rlG=new THREE.Group(); rlG.position.set(0.18,0.6,0); rlG.userData.zombieGroup=z;
  bk(new THREE.BoxGeometry(0.16,0.5,0.16),legMat,0,-0.25,0,rlG); z.add(rlG);

  const cb=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.06,0.28),crownMat);
  cb.position.y=1.78; z.add(cb);
  [-1,0,1].forEach(i=>{
    const sp=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.1,0.04),crownMat);
    sp.position.set(i*0.1,1.86,0); z.add(sp);
  });

  z.userData.isGLB     = false;
  z.userData.glbClone  = null;
  z.userData.mixer     = null;
  z.userData.action    = null;
  z.userData.parts     = {leftArm:laG, rightArm:raG, leftLeg:llG, rightLeg:rlG, head};
  z.userData.materials = {bodyMat,headMat,armMat,legMat,eyeMat,crownMat};
  z.userData.zombieGroup = z;
  z.traverse(o=>{ if(o!==z) o.userData.zombieGroup=z; });
}

// ─────────────────────────────────────────────────────
// POOL
// ─────────────────────────────────────────────────────
const POOL_SIZE  = 30;
const zombiePool = [];

function initZombiePool() {
  for (let i=0;i<POOL_SIZE;i++) {
    const z=new THREE.Group(); z.visible=false;
    z.userData.alive=false; z.userData.isPooled=true;
    zombiePool.push(z);
  }
}

// ─────────────────────────────────────────────────────
// ACTIVATE
// ─────────────────────────────────────────────────────
function activateZombie(z, type) {
  type = type || (Math.random()<0.2 ? 'tank' : 'normal');
  const isTank = type==='tank';

  // Bersihkan visual lama
  while (z.children.length) z.remove(z.children[0]);
  removeGLBInstance(z);
  z.userData.isGLB = false;

  // Spawn position
  const angle=Math.random()*PI2, dist=20+Math.random()*40;
  z.position.set(Math.cos(angle)*dist, 0, Math.sin(angle)*dist);
  z.rotation.set(0,0,0);
  z.visible = true;
  z.userData.isPooled = false;

  // Pasang visual
  if (glbReady) {
    const { clone, mixer, action } = createGLBInstance(z);
    const noop = new THREE.Group();
    z.userData.isGLB     = true;
    z.userData.glbClone  = clone;
    z.userData.mixer     = mixer;
    z.userData.action    = action;
    z.userData.parts     = { leftArm:noop, rightArm:noop, leftLeg:noop, rightLeg:noop, head:noop };
    z.userData.materials = {};

    // HITBOX INVISIBLE — dipasang ke z agar raycaster.intersectObjects(state.targets) bisa hit
    // z ada di state.targets, clone ada di scene terpisah
    const hitboxGeo = new THREE.BoxGeometry(0.7, 1.8, 0.7);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const hitbox    = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.position.y = 0.9; // tengah body
    hitbox.userData.zombieGroup = z;
    z.add(hitbox);
    z.userData.hitbox = hitbox;
  } else {
    buildProcedural(z);
  }

  // Stats
  if (isTank) {
    z.scale.set(1.8,1.8,1.8);
    z.userData.health=300; z.userData.maxHealth=300;
    z.userData.speed=0.8+Math.random()*0.6;
    z.userData.attackRange=2.4; z.userData.damage=15;
    z.userData.scoreValue=100; z.userData.killScore=200;
  } else {
    z.scale.set(1,1,1);
    z.userData.health=100; z.userData.maxHealth=100;
    z.userData.speed=1.5+Math.random()*2.5;
    z.userData.attackRange=1.6; z.userData.damage=10;
    z.userData.scoreValue=10; z.userData.killScore=50;
  }

  z.userData.type=type; z.userData.alive=true;
  z.userData.walkTime=Math.random()*PI2;
  z.userData.attackCooldown=0; z.userData.attackTimer=0;

  if (!z.userData.isGLB) {
    const p=z.userData.parts;
    p.leftArm.rotation.x=0; p.rightArm.rotation.x=0;
    p.leftLeg.rotation.x=0; p.rightLeg.rotation.x=0;
  }

  // Health bar — renderOrder tinggi agar tidak ter-occlude
  const bg=new THREE.Group();
  bg.renderOrder = 999;
  const bgMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6,0.09,0.02),
    new THREE.MeshBasicMaterial({color:0x111111, depthTest:false})
  );
  bgMesh.renderOrder = 999;
  bg.add(bgMesh);
  const bfg=new THREE.Mesh(
    new THREE.BoxGeometry(0.58,0.07,0.02),
    new THREE.MeshBasicMaterial({color:0x00ff44, depthTest:false})
  );
  bfg.position.z=0.01; bfg.renderOrder=1000;
  bg.add(bfg);
  z.userData.barGroup=bg; z.userData.barFg=bfg;

  scene.add(bg);
  scene.add(z);
  state.targets.push(z);
  createContactShadow(z);
}

function deactivateZombie(z) {
  z.visible = false;
  z.userData.alive = false;
  removeGLBInstance(z);
  if (z.userData.barGroup) scene.remove(z.userData.barGroup);
  scene.remove(z);
  const idx=state.targets.indexOf(z); if(idx!==-1) state.targets.splice(idx,1);
  if (z.userData.type==='boss') { state.boss.active=false; state.boss.obj=null; }
  removeContactShadow(z);
}

// ─────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────
export function initZombies(s, c) {
  scene=s; camera=c;
  loadZombieGLB();
}

export function createZombie(type, waveZombie) {
  for (const z of zombiePool) {
    if (!z.userData.alive) {
      activateZombie(z, type);
      z.userData.waveZombie=!!waveZombie;
      return z;
    }
  }
  // Pool habis — tambah slot baru
  const z=new THREE.Group();
  z.userData.alive=false; z.userData.isPooled=true;
  zombiePool.push(z);
  activateZombie(z,type);
  z.userData.waveZombie=!!waveZombie;
  return z;
}

export function spawnBoss(tier) {
  if (state.boss.active) return;
  const z=new THREE.Group();
  const s=2.0+tier*0.5; z.scale.set(s,s,s);
  z.position.set(0,0,0); z.visible=true;
  buildBoss(z);

  const hp=400+tier*300;
  z.userData.type='boss'; z.userData.alive=true; z.userData.tier=tier;
  z.userData.health=hp; z.userData.maxHealth=hp;
  z.userData.speed=Math.min(0.8+tier*0.2,2.5);
  z.userData.damage=10+tier*5; z.userData.attackRange=3;
  z.userData.attackCooldown=0; z.userData.attackTimer=0;
  z.userData.walkTime=0;
  z.userData.scoreValue=50+tier*50; z.userData.killScore=500+tier*200;
  z.userData.waveZombie=true;

  const bg=new THREE.Group();
  bg.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.9,0.08,0.06),
    new THREE.MeshBasicMaterial({color:0x333333})
  ));
  const bfg=new THREE.Mesh(
    new THREE.BoxGeometry(0.88,0.07,0.05),
    new THREE.MeshBasicMaterial({color:0xff00ff})
  );
  bfg.position.z=0.03; bg.add(bfg);
  z.userData.barGroup=bg; z.userData.barFg=bfg;

  scene.add(bg); scene.add(z); state.targets.push(z);
  state.boss.active=true; state.boss.obj=z;
  state.boss.health=hp; state.boss.maxHealth=hp; state.boss.tier=tier;
  state.waveZombiesSpawned++;
  updateHUD();
  showMessage('⚠️ KING ZOMBIE APPEARS!'); setTimeout(hideMessage,3000);
  createContactShadow(z);
}

// ─────────────────────────────────────────────────────
// DESTROY
// ─────────────────────────────────────────────────────
function destroyBoss(z) {
  const pos=z.position.clone(); const tier=z.userData.tier||1;
  createBigExplosion(pos,tier);
  deactivateZombie(z);
  state.kills++; state.score+=z.userData.killScore||500;
  if (z.userData.waveZombie) state.waveZombiesKilled++;
  state.shakeIntensity=Math.max(state.shakeIntensity, 0.3+tier*0.05);
  spawnDrop(pos); spawnDrop(pos);
  updateHUD();
  showMessage('💀 KING ZOMBIE DEFEATED!'); setTimeout(hideMessage,3000);
}

export function destroyZombie(z) {
  if (z.userData.type==='boss') { destroyBoss(z); return; }
  createExplosion(z.position.clone());
  deactivateZombie(z);
  state.kills++; state.score+=z.userData.killScore||50;
  if (z.userData.waveZombie) state.waveZombiesKilled++;
  updateHUD();
  if (Math.random()<0.6) spawnDrop(z.position.clone());
}

function respawnZombie(z) {
  const a=Math.random()*PI2, d=20+Math.random()*30;
  z.position.set(Math.cos(a)*d, 0, Math.sin(a)*d);
  z.userData.health=100;
}

function getZombieGroup(mesh) {
  let o=mesh;
  while(o) {
    if (o.userData && o.userData.zombieGroup) return o.userData.zombieGroup;
    o=o.parent;
  }
  return mesh;
}

// ─────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────
// Pre-alloc vectors — hindari new THREE.Vector3() tiap frame di dalam loop
const _toP     = new THREE.Vector3();
const _barLook = new THREE.Vector3();

export function updateTargets(dt) {
  const pp=camera.position;

  for (let i=state.targets.length-1; i>=0; i--) {
    const t=state.targets[i], data=t.userData;
    const dx=pp.x-t.position.x, dz=pp.z-t.position.z;
    const distXZ=Math.sqrt(dx*dx+dz*dz);
    _toP.set(dx,0,dz).normalize();
    const toP=_toP;

    // Rotasi menghadap player
    const ta=Math.atan2(toP.x,toP.z)+PI;
    let diff=ta-t.rotation.y;
    while(diff>PI)diff-=PI2; while(diff<-PI)diff+=PI2;
    t.rotation.y+=diff*dt*5;

    data.attackCooldown-=dt;
    if (distXZ<20) playZombieGrowl();

    if (data.type==='boss') {
      // ── Boss AI (procedural, limb animation) ──
      if (distXZ<data.attackRange) {
        if (data.attackTimer<=0&&data.attackCooldown<=0) {
          data.attackTimer=1.0; data.attackCooldown=2.0;
        }
        if (data.attackTimer>0) {
          data.attackTimer-=dt;
          const ph=1-data.attackTimer/1.0;
          if (ph<0.35) {
            const p=ph/0.35;
            data.parts.leftArm.rotation.x=-p*1.3; data.parts.rightArm.rotation.x=-p*1.3;
            t.rotation.x=p*0.3;
          } else if (ph<0.65) {
            const p=(ph-0.35)/0.3;
            data.parts.leftArm.rotation.x=(1-p)*-1.3; data.parts.rightArm.rotation.x=(1-p)*-1.3;
            t.rotation.x=(1-p)*0.3;
          } else {
            data.parts.leftArm.rotation.x*=0.95; data.parts.rightArm.rotation.x*=0.95;
            t.rotation.x*=0.95;
          }
        } else {
          data.parts.leftArm.rotation.x*=0.9; data.parts.rightArm.rotation.x*=0.9;
          t.rotation.x*=0.9;
        }
      } else {
        t.position.x+=toP.x*data.speed*dt; t.position.z+=toP.z*data.speed*dt;
        data.walkTime+=data.speed*dt*2;
        const sw=Math.sin(data.walkTime)*0.3;
        data.parts.leftLeg.rotation.x=-sw; data.parts.rightLeg.rotation.x=sw;
        data.parts.leftArm.rotation.x=-0.2+Math.sin(data.walkTime+PI)*0.15;
        data.parts.rightArm.rotation.x=-0.2-Math.sin(data.walkTime+PI)*0.15;
        t.position.y=Math.abs(Math.sin(data.walkTime*2))*0.08;
      }

    } else {
      // ── Regular zombie AI ──
      const isAttacking=distXZ<data.attackRange;

      if (isAttacking) {
        if (data.attackTimer<=0&&data.attackCooldown<=0) {
          data.attackTimer=0.6; data.attackCooldown=1.0;
          data.lungeOrigX=t.position.x; data.lungeOrigZ=t.position.z;
        }
        if (data.attackTimer>0) {
          data.attackTimer-=dt;
          const ph=1-data.attackTimer/0.6;
          if (ph<0.35) {
            const p=ph/0.35; t.rotation.x=p*0.4;
            if (!data.isGLB) { data.parts.leftArm.rotation.x=-p*0.6; data.parts.rightArm.rotation.x=-p*0.6; }
          } else if (ph<0.6) {
            const p=(ph-0.35)/0.25; t.rotation.x=(1-p)*0.4;
            t.position.x=data.lungeOrigX+toP.x*p*0.8;
            t.position.z=data.lungeOrigZ+toP.z*p*0.8;
            if (!data.isGLB) { data.parts.leftArm.rotation.x=p*1.0; data.parts.rightArm.rotation.x=p*1.0; }
            t.position.y=p*0.3;
          } else {
            const p=(ph-0.6)/0.4; t.rotation.x=(1-p)*-0.1;
            if (!data.isGLB) { data.parts.leftArm.rotation.x=(1-p)*1.0; data.parts.rightArm.rotation.x=(1-p)*1.0; }
            t.position.y=(1-p)*0.3;
          }
        } else {
          t.rotation.x*=0.9; t.position.y*=0.9;
          if (!data.isGLB) { data.parts.leftArm.rotation.x*=0.9; data.parts.rightArm.rotation.x*=0.9; }
        }
        // GLB: percepat animasi saat menyerang
        if (data.isGLB && data.action) data.action.timeScale=1.8;

      } else {
        // Bergerak ke player
        const spd=distXZ<10?data.speed:data.speed*0.7;
        t.position.x+=toP.x*spd*dt; t.position.z+=toP.z*spd*dt;
        data.walkTime+=spd*dt*3;
        t.position.y=Math.abs(Math.sin(data.walkTime*2))*0.05;
        t.rotation.x*=0.9;

        if (!data.isGLB) {
          const sw=Math.sin(data.walkTime)*0.5, asw=Math.sin(data.walkTime+PI)*0.4;
          data.parts.leftLeg.rotation.x=-sw; data.parts.rightLeg.rotation.x=sw;
          data.parts.leftArm.rotation.x=asw+(distXZ<5?-0.3:0);
          data.parts.rightArm.rotation.x=-asw+(distXZ<5?-0.3:0);
        }
        // GLB: kecepatan animasi mengikuti speed zombie
        if (data.isGLB && data.action) {
          data.action.timeScale=0.6+Math.min(data.speed/2.5,1.4)*0.8;
        }
      }
    }

    // Update AnimationMixer GLB
    if (data.isGLB && data.mixer) data.mixer.update(dt);

    // Sync posisi GLB instance ke zombie group
    if (data.isGLB) syncGLBInstance(t);

    updateContactShadow(t);

    // Health bar billboard
    const bg=data.barGroup;
    if (bg) {
      const pct=Math.max(0, data.health/data.maxHealth);
      data.barFg.scale.x=pct;
      data.barFg.position.x=-(1-pct)*0.24;
      data.barFg.material.color.setHex(
        data.type==='boss' ? 0xff00ff :
        pct>0.6 ? 0x00ff00 : pct>0.3 ? 0xffff00 : 0xff0000
      );
      bg.position.copy(t.position);
      // GLB model tinggi 1.8 unit → health bar di Y=2.2 (diatas kepala)
      // Procedural tinggi ~1.8 → sama
      const barHeight = data.type==='boss' ? 2.5*(t.scale.x||1) :
                        data.isGLB ? 2.2*(t.scale.y||1) : 2.0;
      bg.position.y += barHeight;
      _barLook.set(pp.x, bg.position.y, pp.z);
      bg.lookAt(_barLook);
    }

    if (data.type!=='boss' && distXZ>80) respawnZombie(t);
  }
}

// ─────────────────────────────────────────────────────
// HIT
// ─────────────────────────────────────────────────────
export function hitTarget(mesh, point, dir) {
  const z=getZombieGroup(mesh);
  if (!z||!z.userData) return;
  const data=z.userData;
  data.health -= state.weapon.damage;

  // Flash merah — pakai cachedMats (di-cache saat clone, bukan traverse setiap hit)
  const inst = glbInstances.get(z.uuid);
  if (data.isGLB && inst && inst.cachedMats) {
    inst.cachedMats.forEach(m=>{ if(m.color) m.color.setHex(0xff2222); });
    setTimeout(()=>{ if(inst.cachedMats) inst.cachedMats.forEach((m,i)=>{ if(m.color) m.color.setHex(inst.origColors[i]); }); }, 80);
  } else if (data.parts&&data.parts.head&&!data.isGLB) {
    const hd=data.parts.head;
    if (hd.material) {
      const h=hd.material.color.getHex();
      hd.material.color.setHex(0xff2222);
      setTimeout(()=>{ if(hd.material) hd.material.color.setHex(h); },70);
    }
  }

  if (dir) { z.position.x+=dir.x*0.05; z.position.z+=dir.z*0.05; }
  state.score+=data.scoreValue||10;
  updateHUD(); playHitSound(); showHitmarker();
  if (data.health<=0) destroyZombie(z);
}

// ─────────────────────────────────────────────────────
// DROPS
// ─────────────────────────────────────────────────────
function spawnDrop(pos) {
  const isH=Math.random()<0.5;
  const g=new THREE.Group(); g.position.copy(pos); g.position.y=0;
  if (isH) {
    const rm=new THREE.MeshStandardMaterial({color:0xff2222,emissive:0x660000,emissiveIntensity:0.3});
    const v=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.3,0.08),rm); v.position.y=0.15; g.add(v);
    const h=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.08,0.08),rm); h.position.y=0.15; g.add(h);
    g.userData.type='health'; g.userData.value=30;
  } else {
    const bm=new THREE.MeshStandardMaterial({color:0xcc8844,roughness:0.7});
    const b=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.15,0.15),bm); b.position.y=0.075; b.castShadow=true; g.add(b);
    g.userData.type='ammo'; g.userData.value=15;
  }
  g.userData.spawnTime=performance.now(); g.userData.floatOffset=Math.random()*PI2;
  scene.add(g); state.drops.push(g);
}

export function updateDrops(dt) {
  const pp=camera.position;
  for (let i=state.drops.length-1;i>=0;i--) {
    const d=state.drops[i];
    const age=(performance.now()-d.userData.spawnTime)/1000;
    if (age>20) {
      scene.remove(d);
      d.children.forEach(c=>{ if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); });
      state.drops.splice(i,1); continue;
    }
    d.position.y=Math.sin(age*2+d.userData.floatOffset)*0.1+0.2;
    d.rotation.y+=dt*1.5;
    if (age>17) {
      const f=1-(age-17)/3;
      d.children.forEach(c=>{ if(c.material){c.material.transparent=true;c.material.opacity=f;} });
    }
    const dx=pp.x-d.position.x, dz=pp.z-d.position.z;
    if (Math.sqrt(dx*dx+dz*dz)<1.2) {
      if (d.userData.type==='health') {
        state.player.health=Math.min(state.player.maxHealth,state.player.health+d.userData.value);
      } else {
        // Isi reserve SEMUA senjata (bukan hanya current weapon)
        const bonus = d.userData.value;
        const ws = state.weapons;
        if (ws.pistol.reserve < 120) ws.pistol.reserve = Math.min(120, ws.pistol.reserve + Math.floor(bonus * 0.5));
        if (ws.rifle.reserve  < 180) ws.rifle.reserve  = Math.min(180, ws.rifle.reserve  + bonus);
        if (ws.smg.reserve    < 210) ws.smg.reserve    = Math.min(210, ws.smg.reserve    + Math.floor(bonus * 1.5));
      }
      updateHUD();
      showDamageOverlay(d.userData.type==='health'?'rgba(0,255,0,0.3)':'rgba(255,170,0,0.3)');
      playPickup(d.userData.type);
      scene.remove(d); state.drops.splice(i,1);
    }
  }
}

// ─────────────────────────────────────────────────────
// PARTICLES
// ─────────────────────────────────────────────────────
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
const isLowEnd  = isMobile && (navigator.hardwareConcurrency||4) <= 4;
const MAX_PARTICLES = isLowEnd ? 20 : isMobile ? 40 : 80;

function mkParticle(pos, size, color, velScale, life) {
  if (state.particles.length >= MAX_PARTICLES) return; // throttle partikel
  const m=new THREE.Mesh(
    new THREE.BoxGeometry(size,size,size),
    new THREE.MeshBasicMaterial({color, transparent:true, opacity:1})
  );
  m.position.copy(pos);
  m.position.x+=(Math.random()-0.5)*0.5; m.position.z+=(Math.random()-0.5)*0.5;
  m.userData.vel=new THREE.Vector3(
    (Math.random()-0.5)*velScale, Math.random()*velScale*0.7, (Math.random()-0.5)*velScale
  );
  m.userData.life=life+Math.random()*0.4;
  scene.add(m); state.particles.push(m);
}

function createExplosion(pos) {
  const n = isLowEnd ? 2 : isMobile ? 3 : 5;
  [0x44aa00,0x66cc00,0x88ff00,0x226600].forEach(c=>{
    for(let j=0;j<n;j++) mkParticle(pos, 0.1+Math.random()*0.28, c, 8, 0.6);
  });
}

function createBigExplosion(pos, tier) {
  const n = isLowEnd ? 4 : isMobile ? 6 : 10+tier*2;
  [0xff4400,0xff8800,0xffcc00,0xff0000,0xcc00ff].forEach(c=>{
    for(let j=0;j<n;j++) mkParticle(pos, 0.15+Math.random()*0.5, c, 12, 0.8);
  });
}

export function updateParticles(dt) {
  for (let i=state.particles.length-1;i>=0;i--) {
    const p=state.particles[i];
    p.userData.life-=dt;
    if (p.userData.life<=0) {
      scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      state.particles.splice(i,1); continue;
    }
    if (p.userData.vel) { p.userData.vel.y-=9.8*dt; p.position.addScaledVector(p.userData.vel,dt); }
    if (p.material.transparent) p.material.opacity=p.userData.life;
    p.scale.setScalar(Math.max(0.01, p.userData.life));
  }
}

// ─────────────────────────────────────────────────────
// PLAYER DAMAGE
// ─────────────────────────────────────────────────────
export function enemyDamagePlayer(dt) {
  state.damageTimer-=dt;
  if (state.damageTimer>0) return;
  state.damageTimer=1;
  const pp=camera.position;
  for (const t of state.targets) {
    const dx=pp.x-t.position.x, dz=pp.z-t.position.z;
    if (Math.sqrt(dx*dx+dz*dz)<t.userData.attackRange+0.3) {
      state.player.health-=t.userData.damage||10;
      updateHUD();
      showDamageOverlay('rgba(255,0,0,0.5)');
      setTimeout(()=>showDamageOverlay(''),150);
      playZombieAttack(); playPlayerHurt();
      state.shakeIntensity=Math.max(state.shakeIntensity,0.06);
      if (state.player.health<=0) { gameOver(); return; }
    }
  }
}

export function clearAllZombies() {
  while (state.targets.length) deactivateZombie(state.targets[0]);
}

initZombiePool();