// weapons.js — Sistem senjata: Pistol, Assault Rifle, SMG, Katana

import * as THREE from 'three';

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
const isLowEnd  = isMobile && (navigator.hardwareConcurrency||4) <= 4;

// Pre-alloc untuk weapons update loop
const _wVec3 = new THREE.Vector3();
const _wDir  = new THREE.Vector3();
import { state } from './state.js';
import { playGunshot, playReload as playReloadSound, playKnifeSwing, playKatanaWhoosh, playKatanaWindup, playKatanaHit, playKatanaMiss, playShellClink, playImpactWall } from './audio.js';
import { hitTarget } from './zombies.js';
import { updateHUD, showMessage, showWeaponMessage, hideMessage } from './ui.js';
import { createWallImpact, createBloodImpact, createSlashBlood, spawnMuzzleSmoke } from './effects.js';
import { bodyParts } from './player.js';

// ─── ASSET MODEL SYSTEM ───
// User taruh file GLB di folder /models/:
//   models/pistol.glb   models/rifle.glb   models/smg.glb   models/katana.glb
// Jika file tidak ada → fallback ke model procedural (bawaan)
const assetModels = {}; // { pistol: THREE.Group, rifle:..., smg:..., katana:... }

async function loadGLBAssets() {
  // Model GLB tidak dipakai — semua senjata pakai model procedural
  // yang sudah detail dengan tangan dan efek lengkap
  console.log('[weapons] Pakai model procedural (GLB dinonaktifkan)');
}

function applyAssetModels() {
  // Hanya pakai GLB untuk pistol & rifle
  // SMG & katana → tetap pakai model procedural (lebih bagus)
  const groupMap = {
    pistol: pistolGroup,
    rifle: gunGroup,
  };

  const configs = {
    pistol: {
      // Pistol GLB: dominant Z=35.8, barrel ke depan, center Z=4.5
      // Kita sembunyikan GLB pistol juga → tangan procedural lebih bagus
      useGLB: false,
    },
    rifle: {
      // Rifle GLB: Armature scale=100 inside, terlalu kompleks
      // Pakai procedural rifle yang sudah bagus
      useGLB: false,
    },
  };

  // Semua weapon pakai procedural — model GLB tidak dipakai
  // Ini keputusan final karena procedural sudah detail dan GLB bermasalah rotasi/ukuran
  console.log('[weapons] Menggunakan model procedural untuk semua senjata');
}


let scene;
let weaponCamera;
let mainCamera;
let tppCameraRef;

// ─── WEAPON GROUPS ───
let gunGroup;      // Assault Rifle body
let handsGroup;    // Tangan untuk AR
let pistolGroup;   // Pistol
let smgGroup;      // Sub Machine Gun
let katanaGroup;   // Katana

let muzzleLight;

// ─── SWORD TRAIL ───
let trailMesh = null;          // THREE.Mesh tipis mengikuti blade
let trailPositions = [];       // Array posisi tip blade tiap frame
const TRAIL_MAX = 18;       // jumlah titik history
const TRAIL_LIFE = 0.22;     // detik trail bertahan
let trailTimer = 0;
let trailActive = false;

// State animasi katana 4-phase
let katanaPhase = 0;       // 0=idle 1=windup 2=slash 3=followthru 4=recover
let katanaPhaseTime = 0;
let katanaComboCount = 0;      // hitung combo (berganti arah tiap slash)
// Durasi tiap phase (detik)
const KP_WINDUP = 0.12;
const KP_SLASH = 0.18;
const KP_FOLLOW = 0.10;
const KP_RECOVER = 0.14;
const KATANA_COOLDOWN = 0.55;  // jeda minimal antar slash
let barrelTipLocal;
let lastShotTime = 0;
let isKatanaAttacking = false;
let katanaSwingTimer = 0;
let katanaSlashDir = 1; // berganti tiap slash

const raycaster = new THREE.Raycaster();

let swayTime = 0;
let isShooting = false;

// ─── INIT ───
export function initWeapon(s, mainCam, tppCam) {
  scene = s;
  mainCamera = mainCam;
  tppCameraRef = tppCam;

  weaponCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 20);

  buildGunGroup();
  buildHandsGroup();
  buildPistolGroup();
  buildSMGGroup();
  buildKatanaGroup();
  buildMuzzleLight();
  buildSwordTrail();

  // Load asset GLB dari /models/ (non-blocking, fallback ke procedural)
  loadGLBAssets();
}

export function getWeaponCamera() { return weaponCamera; }

// ─── ASSAULT RIFLE MODEL (M4A1 style, detail tinggi) ───
function buildGunGroup() {
  gunGroup = new THREE.Group();

  const mDark = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.55, metalness: 0.88 });
  const mMetal = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.38, metalness: 0.95 });
  const mGrey = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.42, metalness: 0.90 });
  const mOD = new THREE.MeshStandardMaterial({ color: 0x3a4225, roughness: 0.85, metalness: 0.0 }); // Olive dark
  const mAccent = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.28, metalness: 1.0 });
  const mWood = new THREE.MeshStandardMaterial({ color: 0x4a2e10, roughness: 0.95, metalness: 0.0 });
  const mRed = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.6 }); // laser dot

  // ── Receiver lower ──
  const recvL = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.048, 0.20), mDark);
  recvL.position.set(0, 0, -0.02); gunGroup.add(recvL);

  // ── Receiver upper (flat top rail) ──
  const recvU = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.020, 0.22), mMetal);
  recvU.position.set(0, 0.034, -0.02); gunGroup.add(recvU);

  // Rail Picatinny (gigi-gigi kecil) di atas
  for (let t = 0; t < 9; t++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.006, 0.010), mAccent);
    tooth.position.set(0, 0.045, -0.090 + t * 0.024); gunGroup.add(tooth);
  }

  // ── Charging handle ──
  const chBody = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.010, 0.028), mDark);
  chBody.position.set(0.02, 0.038, 0.048); gunGroup.add(chBody);
  const chLatch = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.006, 0.010), mGrey);
  chLatch.position.set(0, 0.042, 0.055); gunGroup.add(chLatch);

  // ── Ejection port cover ──
  const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, 0.055), mMetal);
  ejPort.position.set(0.032, 0.018, -0.005); gunGroup.add(ejPort);

  // ── Barrel ──
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.22), mMetal);
  barrel.position.set(0, 0.005, -0.190); gunGroup.add(barrel);

  // Gas tube di atas barrel
  const gasTube = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.18), mMetal);
  gasTube.position.set(0, 0.020, -0.18); gunGroup.add(gasTube);

  // ── Muzzle brake (kompensator) ──
  const muzzleBase = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.045), mMetal);
  muzzleBase.position.set(0, 0.005, -0.295); gunGroup.add(muzzleBase);
  // Slots kompensator
  for (let s = 0; s < 3; s++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.010, 0.006), mDark);
    slot.position.set(0, 0.016, -0.282 + s * 0.012); gunGroup.add(slot);
  }
  const muzzleTip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.008), mAccent);
  muzzleTip.position.set(0, 0.005, -0.320); gunGroup.add(muzzleTip);

  // ── Handguard MOE (free float) ──
  const hg = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.040, 0.155), mOD);
  hg.position.set(0, -0.010, -0.120); gunGroup.add(hg);
  // Quad rail slots (4 sisi mini)
  const railSide = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.038, 0.130), mOD);
  railSide.position.set(0.030, -0.010, -0.120); gunGroup.add(railSide);
  const railSide2 = railSide.clone();
  railSide2.position.x = -0.030; gunGroup.add(railSide2);
  // Garis rail bawah handguard
  for (let t = 0; t < 5; t++) {
    const rt = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.005, 0.008), mAccent);
    rt.position.set(0, -0.031, -0.165 + t * 0.028); gunGroup.add(rt);
  }

  // ── Foregrip vertikal (bawah handguard) ──
  const fg = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.075, 0.022), mDark);
  fg.position.set(0, -0.068, -0.135); fg.rotation.x = 0.1; gunGroup.add(fg);
  const fgBot = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.010, 0.024), mGrey);
  fgBot.position.set(0, -0.110, -0.135); gunGroup.add(fgBot);

  // ── Pistol grip ──
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.095, 0.038), mOD);
  grip.position.set(0, -0.073, 0.058); grip.rotation.x = -0.22; gunGroup.add(grip);
  // Textur grip (horizontal ribs)
  for (let r = 0; r < 5; r++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.047, 0.004, 0.040), mDark);
    rib.position.set(0, -0.048 + r * 0.012, 0.057); rib.rotation.x = -0.22; gunGroup.add(rib);
  }

  // ── Trigger guard ──
  const tg = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.026, 0.018), mDark);
  tg.position.set(0, -0.020, 0.030); gunGroup.add(tg);
  // Trigger
  const trig = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, 0.010), mGrey);
  trig.position.set(0, -0.018, 0.030); gunGroup.add(trig);

  // ── Magazine (STANAG 30rd) ──
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.085, 0.024), mDark);
  mag.position.set(0, -0.092, -0.018); gunGroup.add(mag);
  // Mag curve detail
  const magCurve = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.010, 0.026), mGrey);
  magCurve.position.set(0, -0.052, -0.018); gunGroup.add(magCurve);
  const magFloor = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.008, 0.028), mAccent);
  magFloor.position.set(0, -0.140, -0.018); gunGroup.add(magFloor);

  // ── Stock (M4 collapsible) ──
  const stockBody = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.040, 0.095), mDark);
  stockBody.position.set(0, -0.004, 0.130); gunGroup.add(stockBody);
  // Adjustment positions
  for (let p = 0; p < 3; p++) {
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.038, 0.006), mGrey);
    notch.position.set(0.025, -0.004, 0.102 + p * 0.020); gunGroup.add(notch);
  }
  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.055, 0.012), mOD);
  stockPad.position.set(0, -0.002, 0.182); gunGroup.add(stockPad);
  const stockBuf = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.010, 0.090), mDark);
  stockBuf.position.set(0, 0.025, 0.130); gunGroup.add(stockBuf);

  // ── Iron sights ──
  const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.022, 0.005), mDark);
  sightF.position.set(0, 0.056, -0.300); gunGroup.add(sightF);
  const sightFBase = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.016), mDark);
  sightFBase.position.set(0, 0.046, -0.300); gunGroup.add(sightFBase);

  const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.014, 0.008), mDark);
  sightR.position.set(0, 0.050, 0.068); gunGroup.add(sightR);
  // Aperture hole (simulate)
  const aperture = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.007, 0.009), mAccent);
  aperture.position.set(0, 0.050, 0.068); gunGroup.add(aperture);

  // ── Laser/light attachment ──
  const laserBody = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.048), mDark);
  laserBody.position.set(-0.026, -0.015, -0.090); gunGroup.add(laserBody);
  const laserDot = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.004), mRed);
  laserDot.position.set(-0.026, -0.015, -0.117); gunGroup.add(laserDot);

  barrelTipLocal = new THREE.Vector3(0, 0.005, -0.325);

  gunGroup.userData.recoil = 0;
  gunGroup.userData.recoilY = 0;
  gunGroup.userData.reloadTimer = 0;
  gunGroup.userData.reloadOffset = 0;
  gunGroup.userData.basePos = new THREE.Vector3(0.28, -0.23, -0.45);
  gunGroup.userData.currentOffset = gunGroup.userData.basePos.clone();

  gunGroup.traverse(c => { if (c.isMesh) { c.layers.set(1); c.castShadow = false; c.userData.isWeapon = true; } });
  scene.add(gunGroup);
}

// ─── TANGAN FPP (Assault Rifle) ───
function buildHandsGroup() {
  handsGroup = new THREE.Group();

  const matSkin = new THREE.MeshStandardMaterial({ color: 0xc8956c, roughness: 0.85 });
  const matSleeve = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.9 });
  const matGlove = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

  const makeHand = (mirror) => {
    const h = new THREE.Group();
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.14), matSleeve);
    forearm.position.set(0, 0, 0.07); h.add(forearm);
    const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.03), matSkin);
    h.add(wrist);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.055, 0.045), matGlove);
    palm.position.set(0, -0.01, -0.022); h.add(palm);
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.025), matGlove);
      finger.position.set(-0.012 + f * 0.008, -0.03, -0.045); h.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.022, 0.01), matGlove);
    thumb.position.set(mirror * 0.024, -0.008, -0.01);
    thumb.rotation.z = -mirror * 0.5; h.add(thumb);
    return h;
  };

  const right = makeHand(1);
  right.position.set(0.0, -0.085, 0.06); right.rotation.x = -0.25;
  handsGroup.add(right);

  const left = makeHand(-1);
  left.position.set(-0.02, -0.025, -0.12); left.rotation.set(0.1, 0.15, 0.3);
  handsGroup.add(left);

  handsGroup.traverse(c => { if (c.isMesh) { c.layers.set(1); c.castShadow = false; c.userData.isWeapon = true; } });
  scene.add(handsGroup);
}

// ─── PISTOL MODEL (Desert Eagle / Glock hybrid style) ───
function buildPistolGroup() {
  pistolGroup = new THREE.Group();

  const mFrame = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.65, metalness: 0.75 });
  const mSlide = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.35, metalness: 0.95 });
  const mAccent = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.25, metalness: 1.00 });
  const mGrip = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.90, metalness: 0.0 });
  const mSkin = new THREE.MeshStandardMaterial({ color: 0xc8956c, roughness: 0.85 });
  const mSleeve = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.90 });
  const mGlove = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.70 });

  // ── Slide ──
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.040, 0.175), mSlide);
  slide.position.set(0, 0.012, -0.048); pistolGroup.add(slide);

  // Slide serrations (belakang)
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.006, 0.006), mFrame);
    s.position.set(0, 0.030, 0.022 + i * 0.010); pistolGroup.add(s);
  }
  // Slide serrations (depan)
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.006, 0.006), mFrame);
    s.position.set(0, 0.030, -0.110 + i * 0.010); pistolGroup.add(s);
  }

  // Ejection port
  const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, 0.040), mAccent);
  ejPort.position.set(0.026, 0.012, -0.035); pistolGroup.add(ejPort);

  // ── Frame (lower) ──
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.034, 0.148), mFrame);
  frame.position.set(0, -0.005, -0.038); pistolGroup.add(frame);

  // Rail bawah frame (untuk attachment)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.008, 0.060), mAccent);
  rail.position.set(0, -0.024, -0.080); pistolGroup.add(rail);
  for (let t = 0; t < 4; t++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.005, 0.007), mSlide);
    tooth.position.set(0, -0.020, -0.062 + t * 0.016); pistolGroup.add(tooth);
  }

  // ── Barrel (exposed tip) ──
  const barrelExp = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.020), mSlide);
  barrelExp.position.set(0, 0.006, -0.148); pistolGroup.add(barrelExp);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.020, 0.007), mAccent);
  muzzle.position.set(0, 0.006, -0.160); pistolGroup.add(muzzle);
  // Barrel rifling hint
  const boreOuter = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.022), mSlide);
  boreOuter.position.set(0, 0.006, -0.148); pistolGroup.add(boreOuter);

  // ── Grip / Handle ──
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.100, 0.036), mGrip);
  grip.position.set(0, -0.070, 0.032); grip.rotation.x = -0.08; pistolGroup.add(grip);

  // Grip texture
  for (let r = 0; r < 7; r++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.003, 0.038), mFrame);
    rib.position.set(0, -0.028 + r * 0.012, 0.032); rib.rotation.x = -0.08; pistolGroup.add(rib);
  }

  // ── Magazine ──
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.078, 0.022), mFrame);
  mag.position.set(0, -0.074, 0.020); pistolGroup.add(mag);
  const magFloor = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.007, 0.026), mAccent);
  magFloor.position.set(0, -0.118, 0.020); pistolGroup.add(magFloor);
  // Mag basepad
  const basepad = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.010, 0.024), mGrip);
  basepad.position.set(0, -0.126, 0.020); pistolGroup.add(basepad);

  // ── Trigger guard ──
  const tg = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.022), mFrame);
  tg.position.set(0, -0.025, 0.022); pistolGroup.add(tg);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.020, 0.010), mAccent);
  trigger.position.set(0, -0.025, 0.018); pistolGroup.add(trigger);

  // ── Iron sights ──
  const sF = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.012, 0.005), mAccent);
  sF.position.set(0, 0.034, -0.148); pistolGroup.add(sF);
  const sR = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.010, 0.006), mFrame);
  sR.position.set(0, 0.034, 0.042); pistolGroup.add(sR);
  // Tritium dot (putih terang)
  for (const dx of [-0.006, 0.006]) {
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.007), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x88ff88, emissiveIntensity: 0.8 }));
    dot.position.set(dx, 0.034, 0.042); pistolGroup.add(dot);
  }
  const dotF = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.007), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x88ff88, emissiveIntensity: 0.8 }));
  dotF.position.set(0, 0.034, -0.148); pistolGroup.add(dotF);

  // ── Hammer ──
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.016, 0.010), mSlide);
  hammer.position.set(0, 0.024, 0.065); gunGroup; pistolGroup.add(hammer);

  // ── Tangan (one-hand hold) ──
  const hand = new THREE.Group();
  hand.position.set(0.004, -0.056, 0.045); hand.rotation.x = -0.08;
  const fa = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, 0.130), mSleeve);
  fa.position.set(0, 0, 0.090); hand.add(fa);
  // Forearm tambahan (lebih panjang biar keliatan)
  const fa2 = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.040, 0.080), mSleeve);
  fa2.position.set(0, 0, 0.190); hand.add(fa2);
  const wr = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.028), mSkin);
  hand.add(wr);
  const pa = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.056, 0.040), mGlove);
  pa.position.set(0, -0.008, -0.018); hand.add(pa);
  for (let f = 0; f < 4; f++) {
    const fi = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.022), mGlove);
    fi.position.set(-0.012 + f * 0.008, -0.028, -0.038); hand.add(fi);
  }
  const th = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.024, 0.011), mGlove);
  th.position.set(0.026, -0.006, -0.004); th.rotation.z = -0.5; hand.add(th);
  pistolGroup.add(hand);

  pistolGroup.userData.recoil = 0;
  pistolGroup.userData.recoilY = 0;
  pistolGroup.userData.reloadTimer = 0;
  pistolGroup.userData.reloadOffset = 0;
  pistolGroup.userData.basePos = new THREE.Vector3(0.16, -0.18, -0.32);
  pistolGroup.userData.currentOffset = pistolGroup.userData.basePos.clone();
  pistolGroup.visible = false;

  pistolGroup.traverse(c => { if (c.isMesh) { c.layers.set(1); c.castShadow = false; c.userData.isWeapon = true; } });
  scene.add(pistolGroup);
}

// ─── SMG MODEL ───
function buildSMGGroup() {
  smgGroup = new THREE.Group();

  const matDark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5, metalness: 0.85 });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x303030, roughness: 0.4, metalness: 0.9 });
  const matOD = new THREE.MeshStandardMaterial({ color: 0x3a4a25, roughness: 0.85 }); // OD green
  const matAccent = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 1.0 });
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xc8956c, roughness: 0.85 });
  const matSleeve = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.9 });
  const matGlove = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.046, 0.19), matDark);
  body.position.set(0, 0, -0.015); smgGroup.add(body);
  // Upper receiver
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.02, 0.16), matMetal);
  upper.position.set(0, 0.033, -0.02); smgGroup.add(upper);
  // Top rail
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.007, 0.13), matAccent);
  rail.position.set(0, 0.025, -0.025); smgGroup.add(rail);
  // Barrel
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.13), matMetal);
  barrel.position.set(0, 0.004, -0.155); smgGroup.add(barrel);
  // Muzzle brake
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.04), matMetal);
  muzzle.position.set(0, 0.004, -0.24); smgGroup.add(muzzle);
  for (let s of [-1, 1]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.01, 0.012), matDark);
    vent.position.set(0, s * 0.015, -0.24); smgGroup.add(vent);
  }
  // Handguard OD green
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.036, 0.11), matOD);
  handguard.position.set(0, -0.009, -0.105); smgGroup.add(handguard);
  // Charging handle
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.018), matDark);
  ch.position.set(0.027, 0.028, 0.035); smgGroup.add(ch);
  // Pistol grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.088, 0.036), matOD);
  grip.position.set(0, -0.064, 0.058); grip.rotation.x = -0.18; smgGroup.add(grip);
  // Magazine (high-cap)
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.1, 0.022), matDark);
  mag.position.set(0, -0.072, 0.0); smgGroup.add(mag);
  const magFloor = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.008, 0.026), matMetal);
  magFloor.position.set(0, -0.125, 0.0); smgGroup.add(magFloor);
  // Trigger guard
  const tguard = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.024, 0.018), matDark);
  tguard.position.set(0, -0.022, 0.03); smgGroup.add(tguard);
  // Folded stock
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.028, 0.075), matDark);
  stock.position.set(0, 0.0, 0.135); smgGroup.add(stock);
  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.038, 0.01), matMetal);
  stockPad.position.set(0, 0.002, 0.175); smgGroup.add(stockPad);

  // Right hand (trigger)
  const rightHand = new THREE.Group();
  rightHand.position.set(0, -0.064, 0.058); rightHand.rotation.x = -0.18;
  const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.11), matSleeve);
  rForearm.position.set(0, 0, 0.062); rightHand.add(rForearm);
  const rPalm = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.048, 0.038), matGlove);
  rPalm.position.set(0, -0.008, -0.018); rightHand.add(rPalm);
  for (let f = 0; f < 4; f++) {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.01, 0.02), matGlove);
    finger.position.set(-0.01 + f * 0.007, -0.026, -0.036); rightHand.add(finger);
  }
  smgGroup.add(rightHand);

  // Left hand (support)
  const leftHand = new THREE.Group();
  leftHand.position.set(-0.018, -0.02, -0.09); leftHand.rotation.set(0.12, 0.14, 0.28);
  const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.1), matSleeve);
  lForearm.position.set(0, 0, 0.058); leftHand.add(lForearm);
  const lPalm = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.046, 0.036), matGlove);
  lPalm.position.set(0, -0.007, -0.016); leftHand.add(lPalm);
  for (let f = 0; f < 4; f++) {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.01, 0.02), matGlove);
    finger.position.set(-0.01 + f * 0.007, -0.024, -0.034); leftHand.add(finger);
  }
  smgGroup.add(leftHand);

  smgGroup.userData.recoil = 0;
  smgGroup.userData.recoilY = 0;
  smgGroup.userData.reloadTimer = 0;
  smgGroup.userData.reloadOffset = 0;
  smgGroup.userData.basePos = new THREE.Vector3(0.18, -0.20, -0.38);
  smgGroup.userData.currentOffset = smgGroup.userData.basePos.clone();
  smgGroup.visible = false;

  smgGroup.traverse(c => { if (c.isMesh) { c.layers.set(1); c.castShadow = false; c.userData.isWeapon = true; } });
  scene.add(smgGroup);
}

// ─── KATANA MODEL (detail tinggi, blade elegant) ───
function buildKatanaGroup() {
  katanaGroup = new THREE.Group();

  // Material blade premium
  const mBlade = new THREE.MeshStandardMaterial({ color: 0xccd0e0, roughness: 0.06, metalness: 0.98 });
  const mEdge = new THREE.MeshStandardMaterial({ color: 0xf0f4ff, roughness: 0.02, metalness: 1.0, emissive: 0x202240, emissiveIntensity: 0.25 });
  const mSpine = new THREE.MeshStandardMaterial({ color: 0xa8aac0, roughness: 0.12, metalness: 0.95 });
  const mBlood = new THREE.MeshStandardMaterial({ color: 0x7a0808, roughness: 0.5 }); // blood groove
  const mTsuba = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.40, metalness: 0.90 });
  const mGold = new THREE.MeshStandardMaterial({ color: 0xc8961e, roughness: 0.28, metalness: 0.92 });
  const mSilver = new THREE.MeshStandardMaterial({ color: 0x9a9ab0, roughness: 0.20, metalness: 0.98 });
  const mHandle = new THREE.MeshStandardMaterial({ color: 0x0a0609, roughness: 0.94, metalness: 0.0 });
  const mWrap = new THREE.MeshStandardMaterial({ color: 0x0f0a18, roughness: 0.98, metalness: 0.0 }); // ito wrap dark purple/black
  const mWrapAlt = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.96, metalness: 0.0 });
  const mSkin = new THREE.MeshStandardMaterial({ color: 0xc8956c, roughness: 0.85 });
  const mSleeve = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.90 });
  const mGlove = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.70 });

  // ── Nagasa (blade) ──
  // Shape: sedikit lebih lebar di dekat tsuba, menipis ke ujung
  const bladeMain = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.006, 0.44), mBlade);
  bladeMain.position.set(0, 0.001, -0.22); katanaGroup.add(bladeMain);

  // Sharp edge (ha) — tipis bersinar
  const ha = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.004, 0.42), mEdge);
  ha.position.set(0.008, -0.001, -0.21); katanaGroup.add(ha);

  // Spine (mune)
  const mune = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.005, 0.44), mSpine);
  mune.position.set(-0.007, 0.003, -0.22); katanaGroup.add(mune);

  // Blood groove (hi) — sepanjang blade
  const hi = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.0025, 0.32), mBlood);
  hi.position.set(-0.002, 0.002, -0.18); katanaGroup.add(hi);

  // ── Kissaki (tip) ──
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.004, 0.048), mEdge);
  tip.position.set(0.003, 0, -0.416); tip.rotation.z = 0.05; katanaGroup.add(tip);
  const tipEdge = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.003, 0.044), mEdge);
  tipEdge.position.set(0.009, -0.001, -0.414); tipEdge.rotation.z = 0.08; katanaGroup.add(tipEdge);

  // ── Habaki (blade collar) ──
  const habaki = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.014, 0.028), mSilver);
  habaki.position.set(0, 0.001, 0.014); katanaGroup.add(habaki);
  const habakiRing = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.004), mGold);
  habakiRing.position.set(0, 0.001, 0.028); katanaGroup.add(habakiRing);

  // ── Tsuba (guard) — octagonal style ──
  const tsuba = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.070, 0.020), mTsuba);
  katanaGroup.add(tsuba);
  // Decorative inner ring
  const tsubaInner = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.048, 0.022), mGold);
  katanaGroup.add(tsubaInner);
  // Oval hole (simulated)
  const tsubaHole = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.010, 0.024), mTsuba);
  katanaGroup.add(tsubaHole);
  // Corner cuts (diagonal feel)
  for (const [x, y] of [[-0.045, 0.030], [-0.045, -0.030], [0.045, 0.030], [0.045, -0.030]]) {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.010, 0.022), mGold);
    corner.position.set(x, y, 0); katanaGroup.add(corner);
  }

  // ── Tsuka (handle) ──
  const tsukaCore = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.185), mHandle);
  tsukaCore.position.set(0, 0, 0.103); katanaGroup.add(tsukaCore);

  // Ito (wrap) — diamond pattern interleaved
  for (let i = 0; i < 9; i++) {
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.013), i % 2 === 0 ? mWrap : mWrapAlt);
    wrap.position.set(0, 0, 0.022 + i * 0.022); katanaGroup.add(wrap);
  }

  // Samekawa (ray skin) — peeks between wraps
  for (let i = 0; i < 8; i++) {
    const same = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.008), mHandle);
    same.position.set(0, 0, 0.030 + i * 0.022); katanaGroup.add(same);
  }

  // Menuki (ornament clips, both sides)
  for (const sx of [-1, 1]) {
    const menuki = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.020, 0.038), mGold);
    menuki.position.set(sx * 0.017, 0, 0.075); katanaGroup.add(menuki);
    // menuki detail
    const mDet = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.010, 0.018), mTsuba);
    mDet.position.set(sx * 0.017, 0, 0.075); katanaGroup.add(mDet);
  }

  // ── Kashira (pommel) ──
  const kashira = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.033, 0.022), mTsuba);
  kashira.position.set(0, 0, 0.200); katanaGroup.add(kashira);
  const kashiraGold = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.014), mGold);
  kashiraGold.position.set(0, 0, 0.200); katanaGroup.add(kashiraGold);
  const kashiraCap = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.007), mSilver);
  kashiraCap.position.set(0, 0, 0.210); katanaGroup.add(kashiraCap);

  // ── Tangan (dua tangan grip) ──
  // Tangan depan (kiri)
  const frontHand = new THREE.Group();
  frontHand.position.set(-0.008, 0, 0.060);
  const fhFa = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.110), mSleeve);
  fhFa.position.set(0, 0, 0.068); frontHand.add(fhFa);
  const fhWr = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.034, 0.024), mSkin);
  frontHand.add(fhWr);
  const fhPa = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.048, 0.040), mGlove);
  fhPa.position.set(0, -0.008, -0.018); frontHand.add(fhPa);
  for (let f = 0; f < 4; f++) {
    const fi = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.010, 0.022), mGlove);
    fi.position.set(-0.010 + f * 0.007, -0.026, -0.038); frontHand.add(fi);
  }
  katanaGroup.add(frontHand);

  // Tangan belakang (kanan, di kashira)
  const backHand = new THREE.Group();
  backHand.position.set(0.006, 0, 0.155);
  const bhFa = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.125), mSleeve);
  bhFa.position.set(0, 0, 0.075); backHand.add(bhFa);
  const bhWr = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.034, 0.024), mSkin);
  backHand.add(bhWr);
  const bhPa = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.048, 0.040), mGlove);
  bhPa.position.set(0, -0.008, -0.018); backHand.add(bhPa);
  for (let f = 0; f < 4; f++) {
    const fi = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.010, 0.022), mGlove);
    fi.position.set(-0.010 + f * 0.007, -0.026, -0.038); backHand.add(fi);
  }
  katanaGroup.add(backHand);

  katanaGroup.userData.basePos = new THREE.Vector3(0.20, -0.19, -0.42);
  katanaGroup.userData.offsetX = 0;
  katanaGroup.userData.offsetY = 0;
  katanaGroup.userData.offsetZ = 0;
  katanaGroup.userData.rotX = 0;
  katanaGroup.userData.rotY = 0;
  katanaGroup.userData.rotZ = 0;
  katanaGroup.visible = false;

  katanaGroup.traverse(c => { if (c.isMesh) { c.layers.set(1); c.castShadow = false; c.userData.isWeapon = true; } });
  scene.add(katanaGroup);
}

// ─── MUZZLE FLASH LIGHT ───
function buildMuzzleLight() {
  muzzleLight = new THREE.PointLight(0xffdd44, 0, 8);
  muzzleLight.castShadow = false;
  scene.add(muzzleLight);
}

// ─── SWORD TRAIL MESH ───
function buildSwordTrail() {
  // Trail: pakai PlaneGeometry kecil yang di-spawn saat slash, bukan LineSegments
  // Ini menghindari vertex garbage yang membentuk mesh hitam besar
  trailMesh = null; // tidak pakai persistent mesh — spawn temporary saat slash
}

// Spawn trail flash saat katana swing — aman, tidak persistent
export function spawnKatanaSlashEffect(position, direction, camera) {
  if (!scene) return;
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xaaddff, transparent: true, opacity: 0.6 - i * 0.15,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const size = 0.18 - i * 0.04;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 3, size), mat);
    m.position.copy(position).addScaledVector(direction, 0.3 + i * 0.1);
    if (camera) m.quaternion.copy(camera.quaternion);
    m.rotateZ(Math.random() * Math.PI);
    m.layers.set(1); // layer 1 = weapon pass, tidak bocor ke dunia
    scene.add(m);
    setTimeout(() => scene.remove(m), 60 + i * 20);
  }
}

// ─── HELPER: active gun group ───
function getActiveGunGroup() {
  switch (state.currentWeapon) {
    case 'pistol': return pistolGroup;
    case 'rifle': return gunGroup;
    case 'smg': return smgGroup;
    default: return null;
  }
}

// ─── MUZZLE FLASH VISUAL ───
function createMuzzleFlash(barrelWorldPos, dir) {
  muzzleLight.position.copy(barrelWorldPos);
  muzzleLight.intensity = 6;
  setTimeout(() => { muzzleLight.intensity = 0; }, 45);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffee88, transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const makeFlash = (rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), flashMat.clone());
    m.position.copy(barrelWorldPos).addScaledVector(dir, 0.05);
    m.quaternion.copy(mainCamera.quaternion); m.rotateZ(rot);
    scene.add(m); setTimeout(() => scene.remove(m), 50);
  };
  makeFlash(0); makeFlash(Math.PI / 4);

  for (let i = 0; i < 4; i++) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 1 })
    );
    spark.position.copy(barrelWorldPos);
    const vel = new THREE.Vector3(
      dir.x + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8,
      dir.z + (Math.random() - 0.5) * 0.8
    ).normalize().multiplyScalar(1.5 + Math.random());
    spark.userData.vel = vel;
    spark.userData.life = 0.08 + Math.random() * 0.06;
    spark.userData.maxLife = spark.userData.life;
    scene.add(spark); state.particles.push(spark);
  }
}

// ─── TRACER ───
function createTracer(from, to) {
  const tracerGroup = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(to, from).normalize();
  const length = 0.7;

  const coreGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, length)]);
  const coreMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  tracerGroup.add(new THREE.Line(coreGeo, coreMat));

  const glowGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, length)]);
  const glowMat = new THREE.LineBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Line(glowGeo, glowMat);
  glow.scale.set(1.5, 1.5, 1); tracerGroup.add(glow);

  tracerGroup.position.copy(from);
  tracerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  scene.add(tracerGroup);

  tracerGroup.userData = {
    dir, speed: 160, traveled: 0, maxDist: from.distanceTo(to),
    from: from.clone(), to: to.clone(), core: coreMat, glow: glowMat,
  };
  state.tracers.push(tracerGroup);
}

export function updateTracers(dt) {
  for (let i = state.tracers.length - 1; i >= 0; i--) {
    const t = state.tracers[i];
    const d = t.userData;
    d.traveled += d.speed * dt;
    t.position.copy(d.from).addScaledVector(d.dir, d.traveled);
    const alpha = Math.max(0, 1 - d.traveled / d.maxDist);
    d.core.opacity = alpha; d.glow.opacity = alpha * 0.6;
    if (d.traveled >= d.maxDist || alpha <= 0) {
      scene.remove(t);
      t.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
      state.tracers.splice(i, 1);
    }
  }
}

// ─── SHELL CASING ───
function spawnShellCasing(barrelPos, camQuat) {
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.012, 0.035),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.9 })
  );
  shell.position.copy(barrelPos);
  shell.position.x += 0.1; shell.position.y += 0.02;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camQuat);
  const vel = right.clone().multiplyScalar(2.5 + Math.random());
  vel.y += 2 + Math.random();
  vel.x += (Math.random() - 0.5) * 0.5; vel.z += (Math.random() - 0.5) * 0.5;
  shell.userData.vel = vel;
  shell.userData.life = 5;
  shell.userData.bounced = false;
  shell.userData.rotVel = new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
  // Batasi jumlah shell: hapus yang terlama jika sudah penuh
  const MAX_SH = isLowEnd ? 3 : isMobile ? 5 : 12;
  if (state.shellCasings.length >= MAX_SH) {
    const old = state.shellCasings.shift();
    scene.remove(old); old.geometry.dispose(); old.material.dispose();
  }
  scene.add(shell); state.shellCasings.push(shell);
}

export function updateShellCasings(dt) {
  const GRAVITY = -12;
  for (let i = state.shellCasings.length - 1; i >= 0; i--) {
    const s = state.shellCasings[i];
    s.userData.life -= dt;
    if (s.userData.life <= 0) {
      scene.remove(s); s.geometry.dispose(); s.material.dispose();
      state.shellCasings.splice(i, 1); continue;
    }
    const vel = s.userData.vel;
    vel.y += GRAVITY * dt;
    s.position.addScaledVector(vel, dt);
    const rot = s.userData.rotVel;
    s.rotation.x += rot.x * dt; s.rotation.y += rot.y * dt; s.rotation.z += rot.z * dt;
    if (s.position.y <= 0.01 && !s.userData.bounced) {
      s.position.y = 0.01; vel.y = Math.abs(vel.y) * 0.35;
      vel.x *= 0.7; vel.z *= 0.7; s.userData.rotVel.multiplyScalar(0.4);
      s.userData.bounced = true;
      import('./audio.js').then(a => a.playShellClink());
    }
    if (s.userData.bounced && s.position.y <= 0.01) {
      s.position.y = 0.01; vel.y = 0; vel.x *= 0.92; vel.z *= 0.92;
    }
    if (s.userData.life < 1) {
      if (!s.material.transparent) s.material.transparent = true;
      s.material.opacity = s.userData.life;
    }
  }
}

// ─── TEMBAK ───
export function shoot() {
  if (!state.isLocked && !('ontouchstart' in window)) return;
  if (state.currentWeapon === 'katana') {
    if (state.cameraMode === 'TPP') { startKatanaTPPSwing(); return; }
    katanaAttack();
    return;
  }

  const w = state.weapon;
  if (w.isReloading) return;
  if (w.ammo <= 0) { reload(); return; }

  const now = performance.now();
  if (now - lastShotTime < w.fireRate * 1000) return;
  lastShotTime = now;

  w.ammo--;
  updateHUD();

  // Recoil per senjata
  const recoilMap = { pistol: 0.10, rifle: 0.07, smg: 0.04 };
  const activeGrp = getActiveGunGroup();
  if (activeGrp) {
    const r = recoilMap[state.currentWeapon] || 0.07;
    activeGrp.userData.recoil = r;
    activeGrp.userData.recoilY = r * 0.4;
  }
  isShooting = true;

  // Screen shake
  const shakeMap = { pistol: 0.05, rifle: 0.035, smg: 0.02 };
  state.shakeIntensity = Math.max(state.shakeIntensity, shakeMap[state.currentWeapon] || 0.035);

  // Crosshair spread
  const spreadMap = { pistol: 12, rifle: 8, smg: 4 };
  state.crosshairSpread = Math.min(30, state.crosshairSpread + (spreadMap[state.currentWeapon] || 8));

  playGunshot(state.currentWeapon);

  const dir3D = new THREE.Vector3(0, 0, -1).applyQuaternion(mainCamera.quaternion);

  let barrelPos;
  if (state.cameraMode === 'TPP' && tppCameraRef) {
    // TPP: ambil world position dari mesh senjata di tangan karakter
    const gunKey = state.currentWeapon === 'smg' ? 'smgTPP'
      : state.currentWeapon === 'pistol' ? 'pistolTPP'
        : state.currentWeapon === 'rifle' ? 'gunTPP' : null;
    const gunMesh = gunKey ? bodyParts[gunKey] : null;
    if (gunMesh && gunMesh.visible) {
      barrelPos = new THREE.Vector3();
      gunMesh.getWorldPosition(barrelPos);
      barrelPos.addScaledVector(dir3D, 0.20); // sedikit ke depan dari center mesh
    } else {
      barrelPos = mainCamera.position.clone().add(dir3D.clone().multiplyScalar(0.8));
    }
  } else {
    // FPP: barrel dari kamera ke depan
    barrelPos = mainCamera.position.clone().add(dir3D.clone().multiplyScalar(1.2));
    barrelPos.y -= 0.08;
  }

  createMuzzleFlash(barrelPos, dir3D);
  spawnMuzzleSmoke(barrelPos, dir3D);
  spawnShellCasing(barrelPos, mainCamera.quaternion);

  const activeCam = (state.cameraMode === 'TPP' && tppCameraRef) ? tppCameraRef : mainCamera;
  raycaster.setFromCamera({ x: 0, y: 0 }, activeCam);
  raycaster.far = 120;

  let hitPoint = null;
  let hitNormal = new THREE.Vector3(0, 1, 0);
  let hitZombie = false;

  const intersects = raycaster.intersectObjects(state.targets, true);
  if (intersects.length > 0) {
    const hit = intersects[0];
    hitTarget(hit.object, hit.point, dir3D);
    hitPoint = hit.point.clone();
    hitNormal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
    hitZombie = true;
    createBloodImpact(hitPoint, dir3D);
  }

  if (!hitZombie) {
    // Kumpulkan hanya object world yang valid untuk bullet impact
    // Exclude: player body parts, FPP weapons (layer 1), object terlalu dekat
    const minHitDist = 1.5; // jangan hit object dalam radius 1.5 unit dari kamera
    const camPos = mainCamera.position;

    const sceneObjects = [];
    scene.traverse(obj => {
      if (!obj.isMesh) return;
      if (state.targets.includes(obj)) return;          // zombie — sudah di-handle
      if (obj.layers.mask !== 1) return;                // bukan layer 0 = skip
      if (obj.userData.isPlayerBody) return;            // player body parts
      if (obj.userData.isWeapon) return;                // FPP weapon meshes
      // Skip object yang terlalu dekat (player body, shell casings, dll)
      const objDist = obj.getWorldPosition(new THREE.Vector3()).distanceTo(camPos);
      if (objDist < minHitDist) return;
      sceneObjects.push(obj);
    });

    const wallHits = raycaster.intersectObjects(sceneObjects, false);
    // Ambil hit pertama yang jaraknya > minHitDist dari kamera
    const validHit = wallHits.find(h => h.distance > minHitDist);
    if (validHit) {
      hitPoint = validHit.point.clone();
      hitNormal = validHit.face ? validHit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
      createWallImpact(hitPoint, hitNormal);
      playImpactWall();
    }
  }

  const endPoint = hitPoint || barrelPos.clone().addScaledVector(dir3D, 100);
  createTracer(barrelPos, endPoint);
}

// ─── KATANA ATTACK ───
function katanaAttack() {
  const now = performance.now();
  // Cooldown: tidak boleh slash lagi sebelum cooldown habis
  if (now - lastShotTime < KATANA_COOLDOWN * 1000) return;
  // Boleh mulai swing baru saat phase recover atau idle
  if (katanaPhase > 0 && katanaPhase < 3) return;

  lastShotTime = now;
  katanaPhase = 1;       // mulai WINDUP
  katanaPhaseTime = 0;
  katanaComboCount++;     // increment combo, berganti arah tiap slash
  isKatanaAttacking = true;

  // Suara windup
  playKatanaWindup();
  state.crosshairSpread = Math.min(25, state.crosshairSpread + 8);

  // Aktifkan trail
  trailActive = true;
  trailPositions = [];
  trailTimer = 0;
}

// ─── HELPER: Hitung posisi tip blade di world space ───
function getKatanaTipWorld() {
  // Tip blade ada di ujung depan katanaGroup (Z = -0.42 di local space)
  const tipLocal = new THREE.Vector3(0, 0, -0.42);
  return tipLocal.applyMatrix4(katanaGroup.matrixWorld);
}

// ─── HELPER: Hitung posisi base blade (tsuba) di world space ───
function getKatanaBaseWorld() {
  const baseLocal = new THREE.Vector3(0, 0, 0);
  return baseLocal.applyMatrix4(katanaGroup.matrixWorld);
}

// ─── UPDATE SWORD TRAIL (no-op — trail diganti dengan spawnKatanaSlashEffect) ───
function updateSwordTrail(dt) {
  // Trail persistent dihapus karena menyebabkan mesh hitam besar
  // Efek slash di-spawn saat attack di katanaAttack() dan updateKatanaTPP()
}

// ─── SWITCH WEAPON ───
export function switchWeapon(type) {
  if (type === state.currentWeapon) return;
  if (state.weapon.isReloading) return;
  state.currentWeapon = type;

  // Visibilitas
  gunGroup.visible = (type === 'rifle');
  handsGroup.visible = (type === 'rifle');
  pistolGroup.visible = (type === 'pistol');
  smgGroup.visible = (type === 'smg');
  katanaGroup.visible = (type === 'katana');

  // Reset state melee
  isKatanaAttacking = false;
  katanaPhase = 0;
  katanaPhaseTime = 0;
  trailActive = false;
  trailPositions = [];
  if (katanaGroup && katanaGroup.userData) {
    katanaGroup.userData.offsetX = 0;
    katanaGroup.userData.offsetY = 0;
    katanaGroup.userData.offsetZ = 0;
    katanaGroup.userData.rotX = 0;
    katanaGroup.userData.rotY = 0;
    katanaGroup.userData.rotZ = 0;
  }

  // Tampilkan nama senjata
  showWeaponMessage(type);
  setTimeout(hideMessage, 1200);

  updateHUD();
}

// ─── RELOAD ───
export function reload() {
  if (state.currentWeapon === 'katana') return;
  const w = state.weapon;
  if (w.isReloading || w.ammo === w.maxAmmo || w.reserve <= 0) return;
  w.isReloading = true;

  const activeGrp = getActiveGunGroup();
  if (activeGrp) { activeGrp.userData.reloadTimer = w.reloadTime; activeGrp.userData.reloadOffset = 0; }

  playReloadSound();
  showMessage('Reload...');
  setTimeout(() => {
    const needed = w.maxAmmo - w.ammo;
    const available = Math.min(needed, w.reserve);
    w.ammo += available;
    w.reserve -= available;
    w.isReloading = false;
    hideMessage();
    updateHUD();
  }, w.reloadTime * 1000);
}

// ─── UPDATE WEAPON (dipanggil tiap frame) ───
export function updateWeapon(dt, keys) {
  state.crosshairSpread = Math.max(0, state.crosshairSpread - dt * 25);

  if (keys && keys['mouse0']) {
    if (state.currentWeapon === 'rifle' || state.currentWeapon === 'smg') {
      shoot();
    }
  }

  weaponCamera.quaternion.copy(mainCamera.quaternion);
  weaponCamera.position.copy(mainCamera.position);
  weaponCamera.aspect = mainCamera.aspect;
  weaponCamera.updateProjectionMatrix();

  if (state.cameraMode === 'FPP') {
    gunGroup.visible = (state.currentWeapon === 'rifle');
    handsGroup.visible = (state.currentWeapon === 'rifle');
    pistolGroup.visible = (state.currentWeapon === 'pistol');
    smgGroup.visible = (state.currentWeapon === 'smg');
    katanaGroup.visible = (state.currentWeapon === 'katana');

    switch (state.currentWeapon) {
      case 'rifle': updateRifle(dt, keys); break;
      case 'pistol': updatePistol(dt, keys); break;
      case 'smg': updateSMG(dt, keys); break;
      case 'katana': updateKatana(dt); break;
    }
  } else {
    // TPP — sembunyikan semua FPP weapon model
    gunGroup.visible = handsGroup.visible = pistolGroup.visible = smgGroup.visible = katanaGroup.visible = false;
    // Tetap update katana logic (hitbox, cooldown, animasi lengan TPP)
    if (state.currentWeapon === 'katana') updateKatanaTPP(dt);
  }

  isShooting = false;
}

// ─── Helper: reloadAnimation ───
function applyReloadAnim(group, dt, reloadTime) {
  if (group.userData.reloadTimer > 0) {
    group.userData.reloadTimer -= dt;
    const phase = 1 - group.userData.reloadTimer / reloadTime;
    if (phase < 0.3) group.userData.reloadOffset = phase / 0.3;
    else if (phase > 0.7) group.userData.reloadOffset = (1 - (phase - 0.7) / 0.3);
    else group.userData.reloadOffset = 1;
    if (group.userData.reloadTimer <= 0) { group.userData.reloadTimer = 0; group.userData.reloadOffset = 0; }
  }
}

// ─── UPDATE RIFLE ───
function updateRifle(dt, keys) {
  const w = state.weapons.rifle;
  const isMoving = keys && (keys['w'] || keys['s'] || keys['a'] || keys['d']);
  const isSprinting = keys && keys['shift'];

  applyReloadAnim(gunGroup, dt, w.reloadTime);

  let targetPos;
  if (state.isAiming) targetPos = new THREE.Vector3(0.06, -0.1, -0.32);
  else if (isSprinting) targetPos = new THREE.Vector3(0.35, -0.18, -0.42);
  else targetPos = gunGroup.userData.basePos.clone();

  const ra = gunGroup.userData.reloadOffset || 0;
  targetPos.y -= ra * 0.18; targetPos.z -= ra * 0.08;

  if (isMoving && !state.isAiming) {
    swayTime += dt * (isSprinting ? 14 : 9);
    targetPos.x += Math.sin(swayTime) * (isSprinting ? 0.018 : 0.01);
    targetPos.y -= Math.abs(Math.sin(swayTime * 0.5)) * (isSprinting ? 0.014 : 0.007);
  }

  const curr = gunGroup.userData.currentOffset;
  curr.lerp(targetPos, dt * 14);
  gunGroup.userData.currentOffset = curr;
  const offset = curr.clone();

  if (gunGroup.userData.recoil > 0) {
    offset.z += gunGroup.userData.recoil * 0.5;
    offset.y += gunGroup.userData.recoilY * 0.5;
    gunGroup.userData.recoil -= dt * 4; gunGroup.userData.recoilY -= dt * 3;
    if (gunGroup.userData.recoil < 0) gunGroup.userData.recoil = 0;
    if (gunGroup.userData.recoilY < 0) gunGroup.userData.recoilY = 0;
  }

  const worldPos = offset.clone().applyQuaternion(mainCamera.quaternion).add(mainCamera.position);
  gunGroup.position.copy(worldPos); gunGroup.quaternion.copy(mainCamera.quaternion);
  handsGroup.position.copy(worldPos); handsGroup.quaternion.copy(mainCamera.quaternion);
  if (gunGroup.userData.recoil > 0) handsGroup.rotation.x -= gunGroup.userData.recoil * 0.3;
}

// ─── UPDATE PISTOL ───
function updatePistol(dt, keys) {
  const w = state.weapons.pistol;
  const isMoving = keys && (keys['w'] || keys['s'] || keys['a'] || keys['d']);
  const isSprinting = keys && keys['shift'];

  applyReloadAnim(pistolGroup, dt, w.reloadTime);

  let targetPos;
  if (state.isAiming) targetPos = new THREE.Vector3(0.03, -0.11, -0.28);
  else if (isSprinting) targetPos = new THREE.Vector3(0.28, -0.18, -0.34);
  else targetPos = pistolGroup.userData.basePos.clone();

  targetPos.y -= (pistolGroup.userData.reloadOffset || 0) * 0.16;

  if (isMoving && !state.isAiming) {
    swayTime += dt * (isSprinting ? 14 : 9);
    targetPos.x += Math.sin(swayTime) * (isSprinting ? 0.022 : 0.013); // lebih banyak sway (satu tangan)
    targetPos.y -= Math.abs(Math.sin(swayTime * 0.5)) * (isSprinting ? 0.018 : 0.009);
  }

  const curr = pistolGroup.userData.currentOffset;
  curr.lerp(targetPos, dt * 14);
  pistolGroup.userData.currentOffset = curr;
  const offset = curr.clone();

  if (pistolGroup.userData.recoil > 0) {
    offset.z += pistolGroup.userData.recoil * 0.7;
    offset.y += pistolGroup.userData.recoilY * 0.7;
    pistolGroup.userData.recoil -= dt * 5; pistolGroup.userData.recoilY -= dt * 4;
    if (pistolGroup.userData.recoil < 0) pistolGroup.userData.recoil = 0;
    if (pistolGroup.userData.recoilY < 0) pistolGroup.userData.recoilY = 0;
  }

  const worldPos = offset.clone().applyQuaternion(mainCamera.quaternion).add(mainCamera.position);
  pistolGroup.position.copy(worldPos); pistolGroup.quaternion.copy(mainCamera.quaternion);
}

// ─── UPDATE SMG ───
function updateSMG(dt, keys) {
  const w = state.weapons.smg;
  const isMoving = keys && (keys['w'] || keys['s'] || keys['a'] || keys['d']);
  const isSprinting = keys && keys['shift'];

  applyReloadAnim(smgGroup, dt, w.reloadTime);

  let targetPos;
  if (state.isAiming) targetPos = new THREE.Vector3(0.05, -0.10, -0.30);
  else if (isSprinting) targetPos = new THREE.Vector3(0.33, -0.17, -0.38);
  else targetPos = smgGroup.userData.basePos.clone();

  const ra = smgGroup.userData.reloadOffset || 0;
  targetPos.y -= ra * 0.18; targetPos.z -= ra * 0.07;

  if (isMoving && !state.isAiming) {
    swayTime += dt * (isSprinting ? 14 : 9);
    targetPos.x += Math.sin(swayTime) * (isSprinting ? 0.016 : 0.009);
    targetPos.y -= Math.abs(Math.sin(swayTime * 0.5)) * (isSprinting ? 0.012 : 0.006);
  }

  const curr = smgGroup.userData.currentOffset;
  curr.lerp(targetPos, dt * 14);
  smgGroup.userData.currentOffset = curr;
  const offset = curr.clone();

  if (smgGroup.userData.recoil > 0) {
    offset.z += smgGroup.userData.recoil * 0.4;
    offset.y += smgGroup.userData.recoilY * 0.4;
    smgGroup.userData.recoil -= dt * 6; smgGroup.userData.recoilY -= dt * 5; // recovery lebih cepat
    if (smgGroup.userData.recoil < 0) smgGroup.userData.recoil = 0;
    if (smgGroup.userData.recoilY < 0) smgGroup.userData.recoilY = 0;
  }

  const worldPos = offset.clone().applyQuaternion(mainCamera.quaternion).add(mainCamera.position);
  smgGroup.position.copy(worldPos); smgGroup.quaternion.copy(mainCamera.quaternion);
}

// ─── UPDATE KATANA ───
function updateKatana(dt) {
  if (!katanaGroup) return;

  // ── Update sword trail setiap frame ──
  updateSwordTrail(dt);

  // ── State machine 4-phase ──
  // Phase 0 = idle
  // Phase 1 = windup  (KP_WINDUP detik)
  // Phase 2 = slash   (KP_SLASH  detik) ← frame paling cepat
  // Phase 3 = followthrough (KP_FOLLOW detik)
  // Phase 4 = recover (KP_RECOVER detik)

  const slashDir = (katanaComboCount % 2 === 0) ? 1 : -1; // berganti kiri/kanan

  if (katanaPhase > 0) {
    katanaPhaseTime += dt;

    // ── Phase 1: WINDUP ──
    if (katanaPhase === 1) {
      const t = Math.min(katanaPhaseTime / KP_WINDUP, 1);
      const ease = t * t; // ease-in

      // Tarik senjata ke belakang & miring ke samping
      katanaGroup.userData.offsetX = slashDir * 0.18 * ease;
      katanaGroup.userData.offsetY = 0.08 * ease;
      katanaGroup.userData.offsetZ = 0.10 * ease;  // mundur
      katanaGroup.userData.rotX = -0.6 * ease;  // miring ke atas
      katanaGroup.userData.rotY = slashDir * 0.5 * ease;
      katanaGroup.userData.rotZ = -slashDir * 0.4 * ease;

      if (katanaPhaseTime >= KP_WINDUP) {
        katanaPhase = 2;
        katanaPhaseTime = 0;
        // Mulai suara whoosh tepat saat slash
        playKatanaWhoosh();
        // Hit detection saat slash dimulai
        doKatanaHitCheck(slashDir);
      }
    }

    // ── Phase 2: SLASH (sapuan utama) ──
    else if (katanaPhase === 2) {
      const t = Math.min(katanaPhaseTime / KP_SLASH, 1);
      // ease-out: cepat di awal, melambat di akhir
      const ease = 1 - Math.pow(1 - t, 3);

      // Sapuan diagonal: dari atas-samping → bawah-tengah-depan
      katanaGroup.userData.offsetX = slashDir * (0.18 - 0.36 * ease);
      katanaGroup.userData.offsetY = 0.08 - 0.22 * ease;
      katanaGroup.userData.offsetZ = 0.10 - 0.22 * ease;  // maju ke depan
      katanaGroup.userData.rotX = -0.6 + 1.1 * ease;  // sapuan ke bawah
      katanaGroup.userData.rotY = slashDir * (0.5 - 1.2 * ease);
      katanaGroup.userData.rotZ = -slashDir * (0.4 - 0.9 * ease);

      // Camera shake saat apex slash (t ~ 0.4)
      if (t > 0.35 && t < 0.55) {
        state.shakeIntensity = Math.max(state.shakeIntensity, 0.032);
      }

      if (katanaPhaseTime >= KP_SLASH) {
        katanaPhase = 3;
        katanaPhaseTime = 0;
        trailActive = false; // trail mulai fade
      }
    }

    // ── Phase 3: FOLLOW-THROUGH ──
    else if (katanaPhase === 3) {
      const t = Math.min(katanaPhaseTime / KP_FOLLOW, 1);
      const ease = t;

      // Lanjutkan gerak ke bawah-depan, blade "melewati" target
      katanaGroup.userData.offsetX = -slashDir * 0.18 * ease;
      katanaGroup.userData.offsetY = -0.14 - 0.06 * ease;
      katanaGroup.userData.offsetZ = -0.12 + 0.05 * ease;
      katanaGroup.userData.rotX = 0.50 + 0.20 * ease;
      katanaGroup.userData.rotY = -slashDir * 0.7 * ease;
      katanaGroup.userData.rotZ = slashDir * 0.5 * ease;

      if (katanaPhaseTime >= KP_FOLLOW) {
        katanaPhase = 4;
        katanaPhaseTime = 0;
        isKatanaAttacking = false;
      }
    }

    // ── Phase 4: RECOVER ──
    else if (katanaPhase === 4) {
      const t = Math.min(katanaPhaseTime / KP_RECOVER, 1);
      // Lerp semua offset kembali ke 0
      const inv = 1 - t * t;

      katanaGroup.userData.offsetX *= inv * 0.82;
      katanaGroup.userData.offsetY *= inv * 0.82;
      katanaGroup.userData.offsetZ *= inv * 0.82;
      katanaGroup.userData.rotX *= inv * 0.82;
      katanaGroup.userData.rotY *= inv * 0.82;
      katanaGroup.userData.rotZ *= inv * 0.82;

      if (katanaPhaseTime >= KP_RECOVER) {
        katanaPhase = 0;
        katanaPhaseTime = 0;
        katanaGroup.userData.offsetX = 0;
        katanaGroup.userData.offsetY = 0;
        katanaGroup.userData.offsetZ = 0;
        katanaGroup.userData.rotX = 0;
        katanaGroup.userData.rotY = 0;
        katanaGroup.userData.rotZ = 0;
      }
    }
  } else {
    // ── Idle: breathing / ready stance ──
    const breathe = Math.sin(Date.now() * 0.0018) * 0.005;
    const sway = Math.sin(Date.now() * 0.0008) * 0.003;
    katanaGroup.userData.offsetX = sway;
    katanaGroup.userData.offsetY = breathe;
    katanaGroup.userData.offsetZ = 0;
    katanaGroup.userData.rotX = 0;
    katanaGroup.userData.rotY = 0;
    katanaGroup.userData.rotZ = 0;
  }

  // ── Posisikan katanaGroup di world space ──
  const basePos = katanaGroup.userData.basePos.clone();
  basePos.x += katanaGroup.userData.offsetX || 0;
  basePos.y += katanaGroup.userData.offsetY || 0;
  basePos.z += katanaGroup.userData.offsetZ || 0;

  const worldPos = basePos.applyQuaternion(mainCamera.quaternion).add(mainCamera.position);
  katanaGroup.position.copy(worldPos);

  // Rotasi: ikut kamera + tambah rotasi animasi
  const camEuler = new THREE.Euler().setFromQuaternion(mainCamera.quaternion, 'YXZ');
  katanaGroup.rotation.set(
    camEuler.x + (katanaGroup.userData.rotX || 0),
    camEuler.y + (katanaGroup.userData.rotY || 0),
    camEuler.z + (katanaGroup.userData.rotZ || 0),
    'YXZ'
  );

  // Update matrixWorld agar getKatanaTipWorld() akurat
  katanaGroup.updateMatrixWorld(true);
}

// ─── UPDATE KATANA TPP — animasi lengan karakter ───
function updateKatanaTPP(dt) {
  // Reuse phase state yang sama dengan FPP katana
  katanaPhaseTime -= dt;

  const rArm = bodyParts && bodyParts.rightArm;
  const lArm = bodyParts && bodyParts.leftArm;
  if (!rArm) return;

  const slashDir = katanaSlashDir;

  if (katanaPhase === 0) {
    // Idle: lengan siap pegang katana (sedikit ke depan)
    rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, -0.55, dt * 8);
    rArm.rotation.z = THREE.MathUtils.lerp(rArm.rotation.z, -0.1, dt * 8);
    if (lArm) lArm.rotation.x = THREE.MathUtils.lerp(lArm.rotation.x, -0.2, dt * 6);

  } else if (katanaPhase === 1) {
    // Windup: angkat lengan ke atas/samping
    const ease = 1 - Math.max(0, katanaPhaseTime) / 0.18;
    rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, -1.2 - ease * 0.5, dt * 18);
    rArm.rotation.z = THREE.MathUtils.lerp(rArm.rotation.z, slashDir * 0.5 * ease, dt * 18);

  } else if (katanaPhase === 2) {
    // Slash: sapuan cepat ke arah berlawanan
    const ease = 1 - Math.max(0, katanaPhaseTime) / 0.22;
    rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, -0.3 + ease * 0.8, dt * 22);
    rArm.rotation.z = THREE.MathUtils.lerp(rArm.rotation.z, -slashDir * 0.9 * ease, dt * 22);
    // Hit check di tengah swing
    if (ease > 0.45 && ease < 0.55 && katanaSwingTimer > 0) {
      katanaSwingTimer = 0;
      doKatanaHitCheck(slashDir);
    }

  } else if (katanaPhase === 3) {
    // Follow through
    rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, 0.3, dt * 14);
    rArm.rotation.z = THREE.MathUtils.lerp(rArm.rotation.z, -slashDir * 0.4, dt * 14);

  } else {
    // Recover
    rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, -0.55, dt * 10);
    rArm.rotation.z = THREE.MathUtils.lerp(rArm.rotation.z, -0.1, dt * 10);
  }

  // Phase transition
  if (katanaPhase > 0 && katanaPhaseTime <= 0) {
    const phaseDurs = [0, 0.18, 0.22, 0.18, 0.25];
    katanaPhase++;
    if (katanaPhase >= 5) {
      katanaPhase = 0;
      state.weapons.katana.isReloading = false;
    } else {
      katanaPhaseTime = phaseDurs[katanaPhase];
    }
  }
}

// Trigger TPP katana swing dari shoot()
function startKatanaTPPSwing() {
  if (state.weapons.katana.isReloading) return;
  state.weapons.katana.isReloading = true;
  katanaPhase = 1;
  katanaPhaseTime = 0.18;
  katanaSwingTimer = 1; // flag belum hit check
  katanaSlashDir = -katanaSlashDir; // berganti arah
  playKatanaWhoosh();
}

// ─── HIT CHECK saat slash phase dimulai ───
function doKatanaHitCheck(slashDir) {
  // Raycast lebar: 3 arah (tengah + sedikit kiri/kanan sesuai arah slash)
  const offsets = [
    { x: 0, y: 0 },
    { x: slashDir * 0.15, y: 0.05 },
    { x: slashDir * 0.15, y: -0.10 },
  ];

  let didHit = false;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(mainCamera.quaternion);

  for (const off of offsets) {
    const dir = new THREE.Vector3(off.x, off.y, -1).normalize().applyQuaternion(mainCamera.quaternion);
    raycaster.set(mainCamera.position, dir);
    raycaster.far = 2.8;
    const hits = raycaster.intersectObjects(state.targets, true);
    if (hits.length > 0) {
      hitTarget(hits[0].object, hits[0].point, fwd);
      didHit = true;
      // Blood spray mengikuti arah slash
      createSlashBlood(hits[0].point, fwd, slashDir);
      playKatanaHit();
      break;
    }
  }

  if (!didHit) playKatanaMiss();
}

// ─── GENERIC PARTICLES ───
export function updateGenericParticles(dt) {
  const GRAVITY = -9.8;
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.userData.life -= dt;
    if (p.userData.life <= 0) {
      scene.remove(p);
      if (p.geometry) p.geometry.dispose();
      if (p.material) p.material.dispose();
      state.particles.splice(i, 1);
      continue;
    }
    const vel = p.userData.vel;
    if (vel) { vel.y += GRAVITY * dt; p.position.addScaledVector(vel, dt); }
    const t = p.userData.life / (p.userData.maxLife || 0.2);
    if (p.material.transparent) p.material.opacity = Math.min(1, t);
    p.scale.setScalar(Math.max(0.01, t));
  }
}
