// player.js — Model tubuh player TPP + walk cycle
// FIX: player body sekarang pakai layer 0 agar terlihat di TPP

import * as THREE from 'three';
import { state } from './state.js';

let scene;
export let playerBody;
export let bodyParts = {};

export function initPlayer(s) {
  scene = s;
  buildPlayerBody();
}

function buildPlayerBody() {
  playerBody = new THREE.Group();

  const matUniform = new THREE.MeshStandardMaterial({ color: 0x2d3d20, roughness: 0.85 }); // Olive drab
  const matSkin    = new THREE.MeshStandardMaterial({ color: 0xc8956c, roughness: 0.85 });
  const matBoots   = new THREE.MeshStandardMaterial({ color: 0x1a1209, roughness: 0.95 });
  const matHelmet  = new THREE.MeshStandardMaterial({ color: 0x252e18, roughness: 0.7 });
  const matVest    = new THREE.MeshStandardMaterial({ color: 0x3d4d25, roughness: 0.85, metalness: 0.05 });
  const matVestDark= new THREE.MeshStandardMaterial({ color: 0x2a3618, roughness: 0.9 });
  const matGun     = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.45, metalness: 0.85 });
  const matGunMet  = new THREE.MeshStandardMaterial({ color: 0x282828, roughness: 0.35, metalness: 0.95 });
  const matBelt    = new THREE.MeshStandardMaterial({ color: 0x1a1a0f, roughness: 0.9 });

  // ── KEPALA ──
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.30,0.28,0.28), matSkin);
  head.position.y = 1.64; head.castShadow = true;
  playerBody.add(head);

  // Helm PASGT — dengan lekukan depan
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.17,0.35), matHelmet);
  helmet.position.y = 1.72; helmet.castShadow = true;
  playerBody.add(helmet);

  const helmetBrim = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.04,0.10), matHelmet);
  helmetBrim.position.set(0,1.66,-0.19); playerBody.add(helmetBrim);
  // Nock belakang helm
  const helmetBack = new THREE.Mesh(new THREE.BoxGeometry(0.30,0.06,0.06), matHelmet);
  helmetBack.position.set(0,1.66,0.19); playerBody.add(helmetBack);

  // ── WAJAH — sedikit kulit ──
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.12,0.02), matSkin);
  face.position.set(0,1.60,-0.15); playerBody.add(face);

  // ── LEHER ──
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.10,0.10), matSkin);
  neck.position.y = 1.50; playerBody.add(neck);

  // ── TORSO ──
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.52,0.27), matUniform);
  torso.position.y = 1.11; torso.castShadow = true;
  playerBody.add(torso);

  // Tactical vest body armor
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.50,0.44,0.26), matVest);
  vest.position.y = 1.13; vest.castShadow = true;
  playerBody.add(vest);

  // Vest detail: garis horizontal
  for (let row = 0; row < 3; row++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.48,0.02,0.26), matVestDark);
    rib.position.set(0, 0.90+row*0.12, 0); playerBody.add(rib);
  }

  // Vest kantong (kiri)
  const pocketL = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.09,0.05), matVest);
  pocketL.position.set(-0.17,1.07,-0.155); playerBody.add(pocketL);
  const pocketLzip = new THREE.Mesh(new THREE.BoxGeometry(0.11,0.01,0.054), matBelt);
  pocketLzip.position.set(-0.17,1.115,-0.155); playerBody.add(pocketLzip);
  // Vest kantong (kanan)
  const pocketR = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.09,0.05), matVest);
  pocketR.position.set(0.17,1.07,-0.155); playerBody.add(pocketR);
  const pocketRzip = new THREE.Mesh(new THREE.BoxGeometry(0.11,0.01,0.054), matBelt);
  pocketRzip.position.set(0.17,1.115,-0.155); playerBody.add(pocketRzip);

  // Collar
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.30,0.06,0.24), matUniform);
  collar.position.y = 1.36; playerBody.add(collar);

  // Belt
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.055,0.25), matBelt);
  belt.position.y = 0.85; playerBody.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.055,0.028), matGunMet);
  buckle.position.set(0,0.85,-0.138); playerBody.add(buckle);

  // ── LENGAN KANAN (pegang senjata) ──
  const rightArmGrp = new THREE.Group();
  rightArmGrp.position.set(0.34, 1.32, 0);

  const rShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.13,0.15), matVest);
  rShoulder.position.y = 0.04; rightArmGrp.add(rShoulder);
  const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.28,0.12), matUniform);
  rUpper.position.y = -0.14; rUpper.castShadow = true; rightArmGrp.add(rUpper);
  const rFore  = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.26,0.10), matUniform);
  rFore.position.y = -0.41; rFore.castShadow = true; rightArmGrp.add(rFore);
  const rHand  = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,0.055), matSkin);
  rHand.position.y = -0.60; rightArmGrp.add(rHand);

  // Pose idle: lengan kanan maju + sedikit ke kiri (grip senjata)
  rightArmGrp.rotation.x = -0.60;
  rightArmGrp.rotation.z = -0.12;

  // ── Senjata di tangan kanan (TPP visible) ──
  // Group senjata di ujung tangan kanan (y=-0.60 = tangan)
  const gunTPP = new THREE.Group();
  // Posisi relatif dari ujung tangan kanan: maju ke depan, sejajar lengan
  gunTPP.position.set(0.05, -0.55, -0.12);
  // Rotasi: sejajarkan dengan arah lengan (lengan miring -0.6 di x)
  gunTPP.rotation.set(0, 0, 0);

  const matGunDark = new THREE.MeshStandardMaterial({ color:0x111118, roughness:0.5, metalness:0.8 });
  const matGunMet2 = new THREE.MeshStandardMaterial({ color:0x555566, roughness:0.3, metalness:0.95 });
  const matGunOD   = new THREE.MeshStandardMaterial({ color:0x2d3d20, roughness:0.85 });

  // AR — horizontal, barrel ke -Z (ke depan)
  const gBody  = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.030, 0.18), matGunDark);
  gBody.position.set(0, 0, -0.04); gunTPP.add(gBody);
  const gRail  = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.010, 0.15), matGunMet2);
  gRail.position.set(0, 0.020, -0.04); gunTPP.add(gRail);
  const gBarrel= new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.13), matGunMet2);
  gBarrel.position.set(0, 0.003, -0.175); gunTPP.add(gBarrel);
  const gMuzzle= new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.017, 0.018), matGunMet2);
  gMuzzle.position.set(0, 0.003, -0.248); gunTPP.add(gMuzzle);
  const gHG    = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.026, 0.095), matGunOD);
  gHG.position.set(0, -0.002, -0.115); gunTPP.add(gHG);
  const gMag   = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.068, 0.016), matGunDark);
  gMag.position.set(0, -0.049, -0.015); gunTPP.add(gMag);
  const gGrip  = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.062, 0.022), matGunDark);
  gGrip.position.set(0, -0.046, 0.038); gunTPP.add(gGrip);
  const gStock = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.024, 0.085), matGunDark);
  gStock.position.set(0, -0.001, 0.110); gunTPP.add(gStock);

  rightArmGrp.add(gunTPP);
  bodyParts.gunTPP = gunTPP;

  // ── Pistol TPP (tersembunyi, muncul saat pistol) ──
  const pistolTPP = new THREE.Group();
  pistolTPP.position.set(0.05, -0.55, -0.10);
  pistolTPP.rotation.set(0, 0, 0);

  // Pistol — horizontal
  const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.032,0.028,0.13), matGunMet2);
  pSlide.position.set(0, 0.007, -0.02); pistolTPP.add(pSlide);
  const pFrame = new THREE.Mesh(new THREE.BoxGeometry(0.030,0.024,0.11), matGunDark);
  pFrame.position.set(0,-0.004,-0.015); pistolTPP.add(pFrame);
  const pBarrel= new THREE.Mesh(new THREE.BoxGeometry(0.010,0.010,0.055), matGunMet2);
  pBarrel.position.set(0, 0.003,-0.105); pistolTPP.add(pBarrel);
  const pMag   = new THREE.Mesh(new THREE.BoxGeometry(0.024,0.062,0.016), matGunDark);
  pMag.position.set(0,-0.046, 0.008); pistolTPP.add(pMag);
  const pGrip  = new THREE.Mesh(new THREE.BoxGeometry(0.026,0.055,0.020), matGunDark);
  pGrip.position.set(0,-0.040, 0.028); pistolTPP.add(pGrip);

  pistolTPP.visible = false;
  rightArmGrp.add(pistolTPP);
  bodyParts.pistolTPP = pistolTPP;

  // ── SMG TPP ──
  const smgTPP = new THREE.Group();
  smgTPP.position.set(0.05, -0.55, -0.10);
  smgTPP.rotation.set(0, 0, 0);

  // SMG — horizontal
  const sBody  = new THREE.Mesh(new THREE.BoxGeometry(0.034,0.028,0.14), matGunDark);
  sBody.position.set(0, 0.001,-0.03); smgTPP.add(sBody);
  const sBarrel= new THREE.Mesh(new THREE.BoxGeometry(0.010,0.010,0.085), matGunMet2);
  sBarrel.position.set(0, 0.003,-0.148); smgTPP.add(sBarrel);
  const sMag   = new THREE.Mesh(new THREE.BoxGeometry(0.020,0.062,0.014), matGunDark);
  sMag.position.set(0,-0.045,-0.010); smgTPP.add(sMag);
  const sGrip  = new THREE.Mesh(new THREE.BoxGeometry(0.022,0.052,0.018), matGunDark);
  sGrip.position.set(0,-0.038, 0.036); smgTPP.add(sGrip);
  const sStock = new THREE.Mesh(new THREE.BoxGeometry(0.022,0.018,0.060), matGunDark);
  sStock.position.set(0, 0.001, 0.095); smgTPP.add(sStock);

  smgTPP.visible = false;
  rightArmGrp.add(smgTPP);
  bodyParts.smgTPP = smgTPP;

  // ── Katana di tangan kanan (TPP, tersembunyi default) ──
  const katanaTPP = new THREE.Group();
  katanaTPP.position.set(0.05, -0.50, -0.08);
  katanaTPP.rotation.set(0.3, 0.1, -0.15);

  const matBlade  = new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 0.15, metalness: 0.95 });
  const matHandle = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.9 });
  const matGuard  = new THREE.MeshStandardMaterial({ color: 0x8a7030, roughness: 0.4, metalness: 0.7 });

  // Blade (panjang ke atas = ke depan saat dibawa)
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.36, 0.010), matBlade);
  blade.position.y = 0.22; katanaTPP.add(blade);
  const tip2 = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.06, 0.006), matBlade);
  tip2.position.y = 0.42; katanaTPP.add(tip2);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.055), matGuard);
  guard.position.y = 0.03; katanaTPP.add(guard);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.14, 0.022), matHandle);
  handle.position.y = -0.08; katanaTPP.add(handle);
  const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.025, 0.028), matGuard);
  pommel.position.y = -0.165; katanaTPP.add(pommel);

  katanaTPP.visible = false;
  rightArmGrp.add(katanaTPP);
  bodyParts.katanaTPP = katanaTPP;

  playerBody.add(rightArmGrp);
  bodyParts.rightArm = rightArmGrp;

  // ── LENGAN KIRI — support / 2-hand grip ──
  const leftArmGrp = new THREE.Group();
  leftArmGrp.position.set(-0.34, 1.32, 0);

  const lShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.13,0.15), matVest);
  lShoulder.position.y = 0.04; leftArmGrp.add(lShoulder);
  const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.28,0.12), matUniform);
  lUpper.position.y = -0.14; leftArmGrp.add(lUpper);
  const lFore  = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.26,0.10), matUniform);
  lFore.position.y = -0.41; leftArmGrp.add(lFore);
  const lHand  = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,0.055), matSkin);
  lHand.position.y = -0.60; leftArmGrp.add(lHand);

  // Pose: maju ke depan pegang handguard (2-hand grip)
  leftArmGrp.rotation.x = -0.65;
  leftArmGrp.rotation.z =  0.10;

  playerBody.add(leftArmGrp);
  bodyParts.leftArm = leftArmGrp;

  // ── PINGGANG / UPPER LEG JOIN ──
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.46,0.12,0.24), matUniform);
  hips.position.y = 0.74; hips.castShadow = true;
  playerBody.add(hips);

  // ── KAKI KIRI ──
  const leftLegGrp = new THREE.Group();
  leftLegGrp.position.set(-0.14, 0.68, 0);

  const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.32,0.15), matUniform);
  lThigh.position.y = -0.16; lThigh.castShadow = true; leftLegGrp.add(lThigh);
  // Pocket paha
  const lPocket = new THREE.Mesh(new THREE.BoxGeometry(0.11,0.12,0.06), matVestDark);
  lPocket.position.set(-0.04,-0.09,-0.10); leftLegGrp.add(lPocket);

  const lKnee  = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.06,0.14), matUniform);
  lKnee.position.y = -0.34; leftLegGrp.add(lKnee);
  const lShin  = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.28,0.13), matUniform);
  lShin.position.y = -0.52; lShin.castShadow = true; leftLegGrp.add(lShin);
  const lAnkle = new THREE.Mesh(new THREE.BoxGeometry(0.11,0.06,0.12), matUniform);
  lAnkle.position.y = -0.69; leftLegGrp.add(lAnkle);
  const lBoot  = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.09,0.20), matBoots);
  lBoot.position.set(0,-0.78,-0.03); lBoot.castShadow = true; leftLegGrp.add(lBoot);
  // Sole boot
  const lSole  = new THREE.Mesh(new THREE.BoxGeometry(0.125,0.015,0.195), new THREE.MeshStandardMaterial({color:0x0a0a0a,roughness:1}));
  lSole.position.set(0,-0.830,-0.03); leftLegGrp.add(lSole);

  playerBody.add(leftLegGrp);
  bodyParts.leftLeg = leftLegGrp;

  // ── KAKI KANAN ──
  const rightLegGrp = new THREE.Group();
  rightLegGrp.position.set(0.14, 0.68, 0);

  const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.32,0.15), matUniform);
  rThigh.position.y = -0.16; rThigh.castShadow = true; rightLegGrp.add(rThigh);
  const rPocket = new THREE.Mesh(new THREE.BoxGeometry(0.11,0.12,0.06), matVestDark);
  rPocket.position.set(0.04,-0.09,-0.10); rightLegGrp.add(rPocket);

  const rKnee  = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.06,0.14), matUniform);
  rKnee.position.y = -0.34; rightLegGrp.add(rKnee);
  const rShin  = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.28,0.13), matUniform);
  rShin.position.y = -0.52; rShin.castShadow = true; rightLegGrp.add(rShin);
  const rAnkle = new THREE.Mesh(new THREE.BoxGeometry(0.11,0.06,0.12), matUniform);
  rAnkle.position.y = -0.69; rightLegGrp.add(rAnkle);
  const rBoot  = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.09,0.20), matBoots);
  rBoot.position.set(0,-0.78,-0.03); rBoot.castShadow = true; rightLegGrp.add(rBoot);
  const rSole  = new THREE.Mesh(new THREE.BoxGeometry(0.125,0.015,0.195), new THREE.MeshStandardMaterial({color:0x0a0a0a,roughness:1}));
  rSole.position.set(0,-0.830,-0.03); rightLegGrp.add(rSole);

  playerBody.add(rightLegGrp);
  bodyParts.rightLeg = rightLegGrp;

  // ── LAYER 0 (terlihat di kamera utama TPP) ──
  // PENTING: jangan set layer 1 — biarkan di default layer 0
  playerBody.traverse(c => {
    if (c.isMesh) {
      c.castShadow = true;
      c.userData.isPlayerBody = true; // exclude dari bullet raycast
    }
  });

  playerBody.visible = false; // default FPP, tampil saat TPP
  scene.add(playerBody);
}

let walkTime = 0;
let idleBreathTime = 0;

export function updatePlayer(dt, cameraPos, yaw, isMoving, isSprinting) {
  if (!playerBody) return;

  const isTPP = state.cameraMode === 'TPP';

  // ── Posisi body ──
  const fwdX = -Math.sin(yaw);
  const fwdZ = -Math.cos(yaw);
  // RE4: di TPP, player sedikit ke kiri kamera (bahu kiri player menghadap kamera)
  // Kiri dari arah hadap player = (fwdZ, 0, -fwdX)
  const leftX = fwdZ;
  const leftZ = -fwdX;
  const sideOffset = isTPP ? -0.5 : 0.0; // geser ke KANAN saat TPP (negatif = kanan karena rotasi 180°)

  playerBody.position.set(
    cameraPos.x + leftX * sideOffset,
    cameraPos.y - 1.7,
    cameraPos.z + leftZ * sideOffset
  );
  playerBody.rotation.y = yaw + Math.PI;

  // ── Walk cycle ──
  if (isMoving) {
    walkTime += dt * (isSprinting ? 13 : 8.5);
    const legSwing = Math.sin(walkTime) * (isSprinting ? 0.62 : 0.40);
    const armSwing = Math.sin(walkTime + Math.PI) * (isSprinting ? 0.28 : 0.18);
    const bobY     = Math.abs(Math.sin(walkTime * 2)) * (isSprinting ? 0.05 : 0.028);

    bodyParts.leftLeg.rotation.x  = -legSwing;
    bodyParts.rightLeg.rotation.x =  legSwing;
    // Di FPP, animasi lengan bebas; di TPP, lengan dikelola oleh weapon pose section di bawah
    if (!isTPP) {
      bodyParts.leftArm.rotation.x  = armSwing - 0.55;
      bodyParts.rightArm.rotation.x = -armSwing - 0.60;
    } else {
      // TPP: lengan berayun sedikit saat jalan tapi tetap hold weapon
      bodyParts.leftArm.rotation.x  += armSwing * 0.15;
      bodyParts.rightArm.rotation.x += -armSwing * 0.10;
    }
    playerBody.position.y -= bobY;
  } else {
    // Idle breathing
    idleBreathTime += dt * 1.1;
    const breath = Math.sin(idleBreathTime) * 0.006;

    bodyParts.leftLeg.rotation.x  *= 0.85;
    bodyParts.rightLeg.rotation.x *= 0.85;

    if (!isTPP) {
      bodyParts.leftArm.rotation.x  = THREE.MathUtils.lerp(bodyParts.leftArm.rotation.x, -0.55, dt * 6);
      bodyParts.rightArm.rotation.x = THREE.MathUtils.lerp(bodyParts.rightArm.rotation.x, -0.60, dt * 6);
    }
    playerBody.position.y += breath;
  }

  const isKatana = state.currentWeapon === 'katana';
  const isRifle  = state.currentWeapon === 'rifle';
  const isPistol = state.currentWeapon === 'pistol';
  const isSMG    = state.currentWeapon === 'smg';

  // ── Visibilitas: tampil hanya di TPP ──
  playerBody.visible = isTPP;

  // ── Ganti senjata TPP sesuai currentWeapon ──
  if (bodyParts.gunTPP)    bodyParts.gunTPP.visible    = isTPP && isRifle;
  if (bodyParts.pistolTPP) bodyParts.pistolTPP.visible = isTPP && isPistol;
  if (bodyParts.smgTPP)    bodyParts.smgTPP.visible    = isTPP && isSMG;
  if (bodyParts.katanaTPP) bodyParts.katanaTPP.visible = isTPP && isKatana;

  // ── Pose lengan sesuai senjata ──
  if (isTPP) {
    // rightArm (x=+0.34) = terlihat di KANAN layar karena rotasi 180° → weapon arm
    // leftArm  (x=-0.34) = terlihat di KIRI layar → support arm
    const wArm = bodyParts.rightArm;
    const sArm = bodyParts.leftArm;
    if (isKatana) {
      wArm.rotation.x = THREE.MathUtils.lerp(wArm.rotation.x, -0.55, dt * 8);
      wArm.rotation.z = THREE.MathUtils.lerp(wArm.rotation.z, -0.15, dt * 8);
      sArm.rotation.x = THREE.MathUtils.lerp(sArm.rotation.x, -0.15, dt * 8);
      sArm.rotation.z = THREE.MathUtils.lerp(sArm.rotation.z,  0.05, dt * 8);
    } else if (isPistol) {
      wArm.rotation.x = THREE.MathUtils.lerp(wArm.rotation.x, -0.65, dt * 8);
      wArm.rotation.z = THREE.MathUtils.lerp(wArm.rotation.z, -0.08, dt * 8);
      sArm.rotation.x = THREE.MathUtils.lerp(sArm.rotation.x, -0.30, dt * 8);
      sArm.rotation.z = THREE.MathUtils.lerp(sArm.rotation.z,  0.08, dt * 8);
    } else {
      wArm.rotation.x = THREE.MathUtils.lerp(wArm.rotation.x, -0.60, dt * 8);
      wArm.rotation.z = THREE.MathUtils.lerp(wArm.rotation.z, -0.12, dt * 8);
      sArm.rotation.x = THREE.MathUtils.lerp(sArm.rotation.x, -0.55, dt * 8);
      sArm.rotation.z = THREE.MathUtils.lerp(sArm.rotation.z,  0.10, dt * 8);
    }
  }
}
