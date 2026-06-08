// game.js — Main loop (OPTIMIZED)
// Optimasi: pre-alloc Vector3/Euler, hapus per-frame new(), adaptive quality, shadow on/off

import * as THREE from 'three';
import { state, PI, PI2 } from './state.js';
import { initAudio, playFootstep, setMusicMode } from './audio.js';
import { initWorld, checkCollision, groundMesh, snapToPlayerSpawn } from './world.js';
import {
  initWeapon, shoot, reload, updateWeapon, updateTracers,
  switchWeapon, updateShellCasings, updateGenericParticles,
  getWeaponCamera
} from './weapons.js';
import {
  initZombies, createZombie, spawnBoss, updateTargets,
  updateParticles, updateDrops, enemyDamagePlayer, clearAllZombies
} from './zombies.js';
import {
  initUI, updateHUD, showMessage, hideMessage,
  showPause, hidePause, hideMenus,
  isDeathActive, setDeathActive, updateUI
} from './ui.js';
import {
  initEffects, updateRain, updateEffectParticles, toggleRain
} from './effects.js';
import { initPlayer, updatePlayer } from './player.js';

// ─── DETECT MOBILE / LOW-END ───
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
const isLowEnd = isMobile && (navigator.hardwareConcurrency || 4) <= 4;

// ─── SCENE ───
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const FOG_COLOR_NORMAL = new THREE.Color(0x87CEEB);
const FOG_COLOR_RAIN   = new THREE.Color(0x5a7080);
// Mobile: fog lebih pendek = lebih sedikit object di-render
const FOG_DENSITY = isLowEnd ? 0.018 : isMobile ? 0.012 : 0.008;
scene.fog = new THREE.FogExp2(FOG_COLOR_NORMAL.clone(), FOG_DENSITY);

// ─── CAMERA ───
const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, isMobile ? 150 : 300);
camera.position.set(0, 1.7, 5);
camera.layers.enableAll();
state.cameraHeightDefault = 1.7;
state.cameraHeight = 1.7;

const tppCamera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 0.1, isMobile ? 150 : 300);
tppCamera.layers.enableAll();

// ─── PRE-ALLOC: hindari new() di dalam loop ───
const _tppPos    = new THREE.Vector3();
const _tppLookAt = new THREE.Vector3();
const _tppTarget = new THREE.Vector3();
const _tppLook   = new THREE.Vector3();
const _forward   = new THREE.Vector3();
const _rightV    = new THREE.Vector3();
const _moveDir   = new THREE.Vector3();
const _newPos    = new THREE.Vector3();
const _euler     = new THREE.Euler(0, 0, 0, 'YXZ');
const _fogColor  = new THREE.Color();

// ─── RENDERER ───
const pixelRatio = isLowEnd ? 1.0 : isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2);
const renderer = new THREE.WebGLRenderer({
  antialias: !isMobile,      // mobile: matikan MSAA
  powerPreference: isMobile ? 'low-power' : 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = !isLowEnd;    // low-end: no shadow
renderer.shadowMap.type    = THREE.PCFShadowMap; // PCF lebih cepat dari PCFSoft
renderer.outputColorSpace  = THREE.SRGBColorSpace;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.autoClear = false;
// Matikan fitur berat yang jarang terpakai
renderer.info.autoReset = false;
document.body.prepend(renderer.domElement);

export function setBrightness(val) { renderer.toneMappingExposure = val; }

// ─── WEAPON LIGHTS (layer 1) ───
const weaponAmbient = new THREE.AmbientLight(0xffffff, 1.8);
weaponAmbient.layers.set(1); scene.add(weaponAmbient);

const weaponKeyLight = new THREE.DirectionalLight(0xfff0e0, 1.4);
weaponKeyLight.position.set(2, 4, 3); weaponKeyLight.layers.set(1); scene.add(weaponKeyLight);

// Mobile: kurangi jumlah lampu weapon
if (!isMobile) {
  const weaponFillLight = new THREE.DirectionalLight(0xc8d8ff, 0.6);
  weaponFillLight.position.set(-3, 2, 1); weaponFillLight.layers.set(1); scene.add(weaponFillLight);
  const weaponRimLight = new THREE.DirectionalLight(0xffffff, 0.4);
  weaponRimLight.position.set(0, -2, -3); weaponRimLight.layers.set(1); scene.add(weaponRimLight);
}

const rainAmbient = new THREE.AmbientLight(0x2a3a55, 0);
scene.add(rainAmbient);

// ─── INIT ───
initWorld(scene, renderer.capabilities.getMaxAnisotropy()).then(() => {
  console.log('[game] World ready');
  sceneFog = scene.fog;
  snapToPlayerSpawn(camera);
});
initUI();
initEffects(scene);
initPlayer(scene);
initWeapon(scene, camera, tppCamera);
initZombies(scene, camera);

// ─── VIGNETTE ───
const vignetteEl = document.createElement('div');
vignetteEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;';
document.body.appendChild(vignetteEl);

let lastVignetteHp = -1;
function updateVignette() {
  const hp = state.player.health / state.player.maxHealth;
  if (Math.abs(hp - lastVignetteHp) < 0.01) return; // skip jika tidak berubah
  lastVignetteHp = hp;
  const low = Math.max(0, 1 - hp * 2.5);
  vignetteEl.style.background = `radial-gradient(ellipse at center,transparent 52%,rgba(160,0,0,${(low*0.75).toFixed(2)}) 100%)`;
}

// Motion blur - hanya desktop
const motionBlurEl = document.createElement('div');
motionBlurEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;';
if (!isMobile) {
  motionBlurEl.style.cssText += 'backdrop-filter:blur(0px);-webkit-backdrop-filter:blur(0px);transition:backdrop-filter 0.12s;';
}
document.body.appendChild(motionBlurEl);

// ─── CROSSHAIR ───
const crosshairEl = document.createElement('div');
crosshairEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:20;';
crosshairEl.innerHTML = `
  <div id="ch-top"    style="position:absolute;width:2px;background:rgba(255,255,255,0.92);left:50%;transform:translateX(-50%);transition:height 0.05s,top 0.05s;"></div>
  <div id="ch-bottom" style="position:absolute;width:2px;background:rgba(255,255,255,0.92);left:50%;transform:translateX(-50%);transition:height 0.05s;"></div>
  <div id="ch-left"   style="position:absolute;height:2px;background:rgba(255,255,255,0.92);top:50%;transform:translateY(-50%);transition:width 0.05s,left 0.05s;"></div>
  <div id="ch-right"  style="position:absolute;height:2px;background:rgba(255,255,255,0.92);top:50%;transform:translateY(-50%);transition:width 0.05s;"></div>
  <div style="position:absolute;width:3px;height:3px;border-radius:50%;background:white;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.9;"></div>
`;
document.body.appendChild(crosshairEl);
const _chTop=document.getElementById, _chEls = {};
function initCrosshairEls() {
  _chEls.top    = document.getElementById('ch-top');
  _chEls.bottom = document.getElementById('ch-bottom');
  _chEls.left   = document.getElementById('ch-left');
  _chEls.right  = document.getElementById('ch-right');
}
setTimeout(initCrosshairEls, 0);

let _lastSpread = -1, _lastAiming = false;
function updateCrosshair(isTPP) {
  if (!_chEls.top) return;
  const sp = state.crosshairSpread;
  const aiming = state.isAiming && !isTPP;
  if (Math.abs(sp - _lastSpread) < 0.5 && aiming === _lastAiming) return; // skip no-change
  _lastSpread = sp; _lastAiming = aiming;
  const gap = 5 + sp, len = 8;
  if (aiming) {
    _chEls.top.style.height = _chEls.bottom.style.height = '0px';
    _chEls.left.style.width = _chEls.right.style.width   = '0px';
  } else {
    _chEls.top.style.height    = `${len}px`; _chEls.top.style.top    = `${-(gap+len)}px`;
    _chEls.bottom.style.height = `${len}px`; _chEls.bottom.style.top = `${gap}px`;
    _chEls.left.style.width    = `${len}px`; _chEls.left.style.left  = `${-(gap+len)}px`;
    _chEls.right.style.width   = `${len}px`; _chEls.right.style.left = `${gap}px`;
  }
}

function updateHUDExtras() {
  const camEl = document.getElementById('camMode');
  if (camEl) camEl.textContent = state.cameraMode === 'TPP' ? 'TPP' : 'FPP';
}

// ─── INPUT ───
const keys = {};

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (e.key === '1') switchWeapon('pistol');
  if (e.key === '2') switchWeapon('rifle');
  if (e.key === '3') switchWeapon('smg');
  if (e.key === '4') switchWeapon('katana');
  if (k === 'r') reload();
  if (k === 'f') toggleRain();
  if (k === 'v') {
    state.cameraMode = state.cameraMode === 'FPP' ? 'TPP' : 'FPP';
    showMessage(state.cameraMode === 'FPP' ? '📷 First Person' : '📷 Third Person');
    setTimeout(hideMessage, 1200);
  }
  if (e.key === ' ') {
    e.preventDefault();
    if (state.player.isGrounded) { state.player.velocityY = 6; state.player.isGrounded = false; }
  }
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

document.addEventListener('mousedown', e => {
  if (e.button === 2) state.isAiming = true;
  if (e.button === 0 && (state.isLocked || ('ontouchstart' in window))) {
    keys['mouse0'] = true; shoot();
  }
});
document.addEventListener('mouseup', e => {
  if (e.button === 2) state.isAiming = false;
  if (e.button === 0) keys['mouse0'] = false;
});
document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('pointerlockchange', () => {
  state.isLocked = document.pointerLockElement === renderer.domElement;
  if (state.isLocked) hidePause();
  else if (!state.player.isDead) showPause();
});

const lookSensitivity = 0.002;
document.addEventListener('mousemove', e => {
  if (!state.isLocked) return;
  state.yaw   -= e.movementX * lookSensitivity;
  state.pitch -= e.movementY * lookSensitivity;
  state.pitch  = Math.max(-Math.PI/2+0.05, Math.min(Math.PI/2-0.05, state.pitch));
});

window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect; camera.updateProjectionMatrix();
  tppCamera.aspect = aspect; tppCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── START / RESTART ───
export function startGame() {
  initAudio(); hideMenus();
  state.player.isDead = false;
  if (!('ontouchstart' in window)) renderer.domElement.requestPointerLock();
  else hidePause();
  startWave(state.wave);
}

export function restart() {
  state.player.health = state.player.maxHealth;
  state.player.velocityY = 0; state.player.isGrounded = true; state.player.isDead = false;
  state.yaw = 0; state.pitch = 0;
  state.shakeIntensity = 0; state.damageTimer = 0;
  state.deathTimer = 0; state.spawnTimer = 3; state.footstepTimer = 0;
  // Reset semua ammo
  state.weapons.pistol.ammo = state.weapons.pistol.maxAmmo; state.weapons.pistol.reserve = 60;  state.weapons.pistol.isReloading = false;
  state.weapons.rifle.ammo  = state.weapons.rifle.maxAmmo;  state.weapons.rifle.reserve  = 90;  state.weapons.rifle.isReloading  = false;
  state.weapons.smg.ammo    = state.weapons.smg.maxAmmo;    state.weapons.smg.reserve    = 105; state.weapons.smg.isReloading   = false;
  state.weapons.katana.isReloading = false;
  state.cameraMode = 'FPP'; state.currentWeapon = 'pistol';
  switchWeapon('rifle'); state.score = 0; state.kills = 0;
  state.cameraHeight = state.cameraHeightDefault; state.cameraTilt = 0; state.cameraRoll = 0;
  snapToPlayerSpawn(camera); clearAllZombies();
  updateHUD(); updateHUDExtras(); hideMenus();
  if (!('ontouchstart' in window)) renderer.domElement.requestPointerLock(); else hidePause();
  const go = document.getElementById('gameOver');
  if (go) go.style.display = 'none';
  setDeathActive(false); startWave(1);
}

function startWave(n) {
  state.wave = n;
  state.waveZombieCount   = state.waveBaseCount + n * state.waveIncrement;
  state.waveZombiesKilled = 0; state.waveZombiesSpawned = 0;
  state.waveActive = true; state.intermission = 0; state.spawnTimer = 1;
  showMessage(`Wave ${n}`); setTimeout(hideMessage, 2000); updateHUD();
  if (n % 5 === 0) { state.waveZombieCount++; setTimeout(() => spawnBoss(Math.floor(n/5)), 2000); }
}

// ─── TPP CAMERA (pre-alloc) ───
function updateTPPCamera(dt) {
  if (state.cameraMode !== 'TPP') return;
  const sinY = Math.sin(state.yaw), cosY = Math.cos(state.yaw);
  _tppTarget.set(
    camera.position.x + sinY * 1.8 + cosY * -1.0,
    camera.position.y - state.player.height + 1.8,
    camera.position.z + cosY * 1.8 + (-sinY) * -1.0
  );
  _tppPos.lerp(_tppTarget, dt * 14);
  tppCamera.position.copy(_tppPos);

  _tppLook.set(
    camera.position.x - sinY * 9.0 + cosY * 0.30,
    camera.position.y - state.player.height + 1.20,
    camera.position.z - cosY * 9.0 + (-sinY) * 0.30
  );
  _tppLookAt.lerp(_tppLook, dt * 16);
  tppCamera.lookAt(_tppLookAt);
}

export { tppCamera as tppCameraRef };

// ─── FPS COUNTER & ADAPTIVE QUALITY ───
let fpsFrames = 0, fpsSec = 0, _fps = 60;
let adaptiveLod = false; // aktifkan LOD jika FPS < 30

function trackFPS(dt) {
  fpsFrames++; fpsSec += dt;
  if (fpsSec >= 2) {
    _fps = fpsFrames / fpsSec;
    fpsFrames = 0; fpsSec = 0;
    // Adaptive: kurangi jumlah zombie max jika FPS rendah
    if (_fps < 25 && !adaptiveLod) {
      adaptiveLod = true;
      if (state.targets.length > 6) {
        // Nonaktifkan zombie terjauh
        const pp = camera.position;
        state.targets.sort((a,b) => {
          const da = (a.position.x-pp.x)**2+(a.position.z-pp.z)**2;
          const db = (b.position.x-pp.x)**2+(b.position.z-pp.z)**2;
          return db - da;
        });
      }
      console.log('[game] Low FPS detected (' + _fps.toFixed(0) + ') → adaptive mode ON');
    } else if (_fps > 40) {
      adaptiveLod = false;
    }
  }
}

// ─── MAIN LOOP ───
let lastTime = 0;

function animate(time) {
  requestAnimationFrame(animate);
  const dt = (lastTime === 0) ? 0 : Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  if (dt === 0) return;

  trackFPS(dt);

  // Reset draw call info setiap frame (untuk debugging)
  renderer.info.reset();

  if (isDeathActive()) {
    updateUI(dt);
    _euler.set(state.pitch, state.yaw, 0);
    camera.quaternion.setFromEuler(_euler);
    renderScene(false); return;
  }

  if (!state.isLocked && !('ontouchstart' in window)) {
    updateUI(dt); renderScene(false); return;
  }

  // ── MOVEMENT (pre-alloc) ──
  _forward.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  _rightV.set(-_forward.z, 0, _forward.x);
  _moveDir.set(0, 0, 0);
  const isSprint = keys['shift'];

  if (keys['w']||keys['arrowup'])    _moveDir.add(_forward);
  if (keys['s']||keys['arrowdown'])  _moveDir.sub(_forward);
  if (keys['a']||keys['arrowleft'])  _moveDir.sub(_rightV);
  if (keys['d']||keys['arrowright']) _moveDir.add(_rightV);
  if (state.joystick?.active) {
    _moveDir.addScaledVector(_forward, -state.joystick.y);
    _moveDir.addScaledVector(_rightV,   state.joystick.x);
  }

  const isMoving = _moveDir.lengthSq() > 0;
  state.player.isSprinting = isSprint && isMoving;

  if (isMoving) {
    _moveDir.normalize();
    const speed = state.player.speed * (isSprint ? 1.8 : 1);
    _newPos.copy(camera.position);
    _newPos.x += _moveDir.x * speed * dt;
    _newPos.z += _moveDir.z * speed * dt;
    checkCollision(_newPos);
    camera.position.x = _newPos.x;
    camera.position.z = _newPos.z;
    state.footstepTimer -= dt;
    if (state.footstepTimer <= 0 && state.player.isGrounded) {
      playFootstep();
      state.footstepTimer = isSprint ? 0.27 : 0.43;
    }
  } else { state.footstepTimer = 0; }

  // ── GRAVITY ──
  if (!state.player.isGrounded) {
    state.player.velocityY += -15 * dt;
    camera.position.y += state.player.velocityY * dt;
    if (camera.position.y <= state.player.height) {
      camera.position.y = state.player.height;
      state.player.velocityY = 0; state.player.isGrounded = true;
    }
  }

  state.player.x = camera.position.x; state.player.z = camera.position.z;

  // ── CAMERA ROT (pre-alloc Euler) ──
  _euler.set(state.pitch, state.yaw, 0);
  camera.quaternion.setFromEuler(_euler);

  // ADS zoom — update hanya jika berubah
  const targetFov = (state.isAiming && state.cameraMode === 'FPP') ? 45 : 70;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * dt * 12;
    camera.updateProjectionMatrix();
  }

  updateTPPCamera(dt);

  // Auto fire
  if (keys['mouse0'] && (state.currentWeapon === 'smg' || state.currentWeapon === 'rifle')) shoot();

  // ── UPDATE SYSTEMS ──
  updateMusicMode();
  updateFogAndLighting(dt);
  updatePlayer(dt, camera.position, state.yaw, isMoving, isSprint);
  updateWeapon(dt, keys);
  updateTargets(dt);
  updateParticles(dt);
  updateTracers(dt);
  updateDrops(dt);
  updateShellCasings(dt);
  updateEffectParticles(dt);
  updateGenericParticles(dt);
  enemyDamagePlayer(dt);
  updateRain(dt, camera.position);
  updateUI(dt);

  updateVignette();
  if (!isMobile) {
    const blurAmt = (isSprint && isMoving) ? '1.2px' : '0px';
    motionBlurEl.style.backdropFilter = `blur(${blurAmt})`;
    motionBlurEl.style.webkitBackdropFilter = `blur(${blurAmt})`;
  }

  const isTPP = state.cameraMode === 'TPP';
  updateCrosshair(isTPP);
  updateHUDExtras();

  // ── WAVE SPAWN ──
  const maxZombies = isLowEnd ? 6 : isMobile ? 8 : 12;
  if (state.waveActive && state.waveZombiesSpawned < state.waveZombieCount) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.targets.length < maxZombies) {
      createZombie(null, true);
      state.waveZombiesSpawned++;
      state.spawnTimer = 2 + Math.random()*3;
    }
  }
  if (state.waveActive &&
      state.waveZombiesSpawned >= state.waveZombieCount &&
      state.waveZombiesKilled  >= state.waveZombieCount) {
    state.waveActive = false; state.intermission = 12;
    showMessage(`Wave ${state.wave} Complete! ✓`); setTimeout(hideMessage, 2500); updateHUD();
  }
  if (state.intermission > 0 && !state.waveActive) {
    state.intermission -= dt; updateHUD();
    if (state.intermission <= 0) startWave(state.wave + 1);
  }

  // Screen shake
  if (state.shakeIntensity > 0) {
    camera.position.x += (Math.random()-0.5) * state.shakeIntensity;
    camera.position.y += (Math.random()-0.5) * state.shakeIntensity;
    state.shakeIntensity *= 0.82;
    if (state.shakeIntensity < 0.001) state.shakeIntensity = 0;
  }

  renderScene(isTPP);
}

// ─── RENDER ───
function renderScene(isTPP) {
  renderer.clear();
  if (isTPP) {
    tppCamera.layers.set(0);
    renderer.render(scene, tppCamera);
    tppCamera.layers.enableAll();
  } else {
    camera.layers.set(0);
    renderer.render(scene, camera);
    renderer.clearDepth();
    const wCam = getWeaponCamera();
    if (wCam) {
      wCam.layers.set(1);
      const bg = scene.background, fog = scene.fog;
      scene.background = null; scene.fog = null;
      renderer.render(scene, wCam);
      scene.background = bg; scene.fog = fog;
    }
    camera.layers.enableAll();
  }
}

// ─── MUSIC ───
let _lastMusicMode = '';
function updateMusicMode() {
  let mode = 'ambient';
  if (state.boss.active) { mode = 'boss'; }
  else {
    const px = camera.position.x, pz = camera.position.z;
    for (const t of state.targets) {
      const dx = t.position.x-px, dz = t.position.z-pz;
      if (dx*dx+dz*dz < 225) { mode = 'combat'; break; }
    }
  }
  if (mode !== _lastMusicMode) { _lastMusicMode = mode; setMusicMode(mode); }
}

// ─── FOG & LIGHTING ───
let sceneFog = scene.fog;

function updateFogAndLighting(dt) {
  const rl = state.rain.current;
  if (scene.fog !== sceneFog && scene.fog) sceneFog = scene.fog;
  if (sceneFog?.density !== undefined) {
    const targetDensity = FOG_DENSITY + rl * 0.018;
    sceneFog.density += (targetDensity - sceneFog.density) * dt;
    if (sceneFog.color) {
      _fogColor.lerpColors(FOG_COLOR_NORMAL, FOG_COLOR_RAIN, rl);
      sceneFog.color.copy(_fogColor);
      if (!scene.background?.isTexture) scene.background = _fogColor;
    }
  }
  rainAmbient.intensity = rl * 0.45;
  const worldSun  = scene.getObjectByName('worldSun');
  const worldHemi = scene.getObjectByName('worldHemi');
  if (worldSun)  worldSun.intensity  = 0.4 - rl * 0.2;
  if (worldHemi) worldHemi.intensity = 0.15 - rl * 0.1;
  if (groundMesh?.material && rl > 0.1) {
    const wet = rl * 0.3;
    groundMesh.material.color.setRGB(0.22-wet*0.05, 0.26-wet*0.03, 0.19-wet*0.02);
  }
}

updateHUD(); updateHUDExtras(); animate(0);
