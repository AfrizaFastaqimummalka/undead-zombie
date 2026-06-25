// world.js — Map GLB loader
// Logika: versi lama yang WORKING + optimasi performa selektif

import * as THREE from 'three';
import { state } from './state.js';

let scene;
export let mapLoaded = false;
let maxAnisotropy = 1;

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
const isLowEnd  = isMobile && (navigator.hardwareConcurrency || 4) <= 4;

export const colliders    = [];
export const PLAYER_SPAWN = { x: 0, y: 1.7, z: 0 };
export const ZOMBIE_SPAWNS = [];
export let groundMesh = null;
export let mapFloorY  = 0;

// Material jalan/trotoar — dari analisa GLB (versi lama, sudah terbukti benar)
const GROUND_MATERIAL_KEYWORDS = [
  'route', 'trottoir', 'paves-trottoir', 'monticule', 'gravas',
];

const _tempBox = new THREE.Box3();

function getMaterialName(mesh) {
  if (!mesh.material) return '';
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats[0]?.name || '';
}

// Bbox hanya mesh visible — setFromObject(root) ikut Landscape/Sphere yang di-skip
function getMeshBounds(root, filter = null) {
  const box = new THREE.Box3();
  root.traverse(obj => {
    if (!obj.isMesh || !obj.visible) return;
    if (filter && !filter(obj)) return;
    _tempBox.setFromObject(obj);
    if (!_tempBox.isEmpty()) box.union(_tempBox);
  });
  return box;
}

// Versi lama — terbukti benar untuk GLB ini
function isGroundMesh(obj) {
  if (obj.name.startsWith('Plane')) return true;
  const matName = getMaterialName(obj);
  return GROUND_MATERIAL_KEYWORDS.some(k => matName.includes(k));
}

// Cache material — optimasi: hindari proses ulang material yang sama
const _matCache = new Map();

function fixGltfMaterial(mat) {
  if (_matCache.has(mat.uuid)) return;
  _matCache.set(mat.uuid, true);

  const aniso = isMobile ? Math.min(maxAnisotropy, 2) : Math.min(maxAnisotropy, 4);
  const colorTex = ['map', 'emissiveMap'];
  const dataTex  = ['normalMap','alphaMap','roughnessMap','metalnessMap','aoMap','bumpMap'];
  for (const p of colorTex) {
    const t = mat[p];
    if (t?.isTexture) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; }
  }
  for (const p of dataTex) {
    const t = mat[p];
    if (t?.isTexture) { t.colorSpace = THREE.LinearSRGBColorSpace; t.anisotropy = aniso; }
  }

  const isPlant = mat.name?.includes('NaturePlants');
  const isFence = mat.name?.includes('MetalFences');
  if (mat.transparent || mat.alphaTest > 0 || isPlant || isFence) {
    mat.transparent = true;
    mat.alphaTest   = mat.alphaTest || 0.1;
    mat.side        = THREE.DoubleSide;
    if (isPlant) mat.depthWrite = false;
  }

  mat.name = mat.name || '';
  mat.needsUpdate = true;

  if (!mat.map) {
    const n = mat.name || '';
    if (n.includes('route')) mat.color.setHex(0x3d3d38);
    else if (n.includes('trottoir') || n.includes('paves')) mat.color.setHex(0x6a6a62);
    else if (n.includes('Buildings') || n.includes('Shops') || n.includes('42526024')) mat.color.setHex(0x8a8278);
    else if (n.includes('monticule') || n.includes('gravas')) mat.color.setHex(0x5a6a48);
    else if (n.includes('voiture')) mat.color.setHex(0x444444);
    else if (mat.color.getHex() === 0xffffff) mat.color.setHex(0x909090);
  }

  // Fix dark: metalness tinggi tanpa envMap = hitam
  if (mat.metalness !== undefined) mat.metalness = 0.1;
  if (mat.roughness !== undefined) mat.roughness = 0.9;
}

// ─────────────────────────────────────────
// LIGHTING — shadow map lebih kecil (optimasi)
// ─────────────────────────────────────────
function setupLighting() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  const sun = new THREE.DirectionalLight(0xfff4e0, 0.4);
  sun.position.set(80, 120, 60);
  sun.name = 'worldSun';

  if (!isLowEnd) {
    sun.castShadow = true;
    const sm = isMobile ? 512 : 1024; // optimasi: 2048→1024
    sun.shadow.mapSize.set(sm, sm);
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = 300;
    sun.shadow.camera.left   = -100;
    sun.shadow.camera.right  =  100;
    sun.shadow.camera.top    =  100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.bias          = -0.001;
  }
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x6a7a55, 0.15);
  hemi.name = 'worldHemi'; scene.add(hemi);

  const rainAmb = new THREE.AmbientLight(0x2a3a55, 0);
  rainAmb.name = 'rainAmbient'; scene.add(rainAmb);
}

// ─────────────────────────────────────────
// SKY
// ─────────────────────────────────────────
function setupSky() {
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

  // HDR sky — load di semua device
  import('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/RGBELoader.js')
    .then(({ RGBELoader }) => new RGBELoader().loadAsync('https://ffnqefdbc21kaq5a.public.blob.vercel-storage.com/sky.hdr'))
    .then(tex => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = tex;
      scene.environment = tex;
      scene.backgroundBlurriness = 0.04;
      // Mobile: kurangi intensity agar tidak terlalu terang
      scene.backgroundIntensity  = isMobile ? 0.3 : 0.4;
      scene.environmentIntensity = isMobile ? 0.3 : 0.4;
      console.log('[world] sky.hdr loaded ✓');
    })
    .catch(() => console.log('[world] sky.hdr not found'));
}

// ─────────────────────────────────────────
// LOAD GLB MAP — logika versi lama (terbukti)
// ─────────────────────────────────────────
const SKIP_NAMES = [
  'Sphere','Icosphere','IVY_Curve','IVY_leaf',
  'Landscape','grass','Sky','SkyBox','skybox',
];

async function tryLoadGLBMap() {
  try {
    const res = await fetch('https://ffnqefdbc21kaq5a.public.blob.vercel-storage.com/map.glb', { method: 'HEAD' });
    if (!res.ok) return false;

    const { GLTFLoader } = await import(
      'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js'
    );

    const gltf     = await new GLTFLoader().loadAsync('https://ffnqefdbc21kaq5a.public.blob.vercel-storage.com/map.glb');
    const mapScene = gltf.scene;

    // Pass 1: fix material + skip mesh tidak perlu
    let meshCount = 0, skippedCount = 0, texCount = 0;
    mapScene.traverse(obj => {
      if (!obj.isMesh) return;
      meshCount++;

      const shouldSkip = SKIP_NAMES.some(n => obj.name.startsWith(n));
      // Mobile: skip tanaman berat
      const skipMobile = isMobile && (
        (obj.material?.name||'').includes('NaturePlants') ||
        (obj.material?.name||'').includes('grass')
      );
      if (shouldSkip || skipMobile) { obj.visible = false; skippedCount++; return; }

      obj.receiveShadow = !isLowEnd;
      obj.castShadow    = !isLowEnd;

      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) { if (mat) fixGltfMaterial(mat); }
      if (mats[0]?.map) texCount++;
    });
    console.log(`[world] GLB pass1: ${meshCount} meshes, ${skippedCount} skipped, ${texCount} textured`);

    // Tambah ke scene
    scene.add(mapScene);
    mapScene.updateMatrixWorld(true);

    // Orientasi: Y-up native, tidak perlu rotasi
    mapScene.rotation.set(0, 0, 0);
    mapScene.updateMatrixWorld(true);

    // Bbox hanya mesh visible
    let contentBox = getMeshBounds(mapScene);
    if (contentBox.isEmpty()) { console.warn('[world] No visible mesh'); return false; }

    const rawSize = contentBox.getSize(new THREE.Vector3());
    console.log(`[world] Raw bbox: X=${rawSize.x.toFixed(1)} Y=${rawSize.y.toFixed(1)} Z=${rawSize.z.toFixed(1)}`);
    console.log(`[world] Raw min: X=${contentBox.min.x.toFixed(1)} Y=${contentBox.min.y.toFixed(1)} Z=${contentBox.min.z.toFixed(1)}`);

    // Scale → 200 unit horizontal
    const MAP_TARGET = 200;
    const MAP_SCALE  = MAP_TARGET / Math.max(rawSize.x, rawSize.z);
    mapScene.scale.setScalar(MAP_SCALE);
    mapScene.updateMatrixWorld(true);

    // Posisi: lantai jalan di Y=0, center X/Z
    contentBox = getMeshBounds(mapScene);
    const groundBox = getMeshBounds(mapScene, isGroundMesh);
    const floorY    = groundBox.isEmpty() ? contentBox.min.y : groundBox.min.y;

    mapScene.position.set(
      -(contentBox.min.x + contentBox.max.x) / 2,
      -floorY,
      -(contentBox.min.z + contentBox.max.z) / 2
    );
    mapScene.updateMatrixWorld(true);
    mapFloorY = 0;

    const finalBox  = getMeshBounds(mapScene);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    console.log(`[world] Final bbox: X(${finalBox.min.x.toFixed(1)}~${finalBox.max.x.toFixed(1)}) Y(${finalBox.min.y.toFixed(1)}~${finalBox.max.y.toFixed(1)}) Z(${finalBox.min.z.toFixed(1)}~${finalBox.max.z.toFixed(1)})`);
    console.log(`[world] Scale: ${MAP_SCALE.toFixed(4)}, Size: ${finalSize.x.toFixed(1)} x ${finalSize.y.toFixed(1)} x ${finalSize.z.toFixed(1)}`);
    console.log(`[world] Ground floor aligned at Y=0 (floorY source=${groundBox.isEmpty() ? 'content' : 'road/plane'})`);

    // Colliders — sama persis dengan versi lama
    let colliderCount = 0;
    mapScene.traverse(obj => {
      if (!obj.isMesh || !obj.visible) return;
      const matName    = getMaterialName(obj);
      const isGroundMat= GROUND_MATERIAL_KEYWORDS.some(k => matName.includes(k));
      if (isGroundMat) return;
      if (matName.includes('NaturePlants') || matName.includes('ivy') || matName.includes('grass')) return;

      const mb = new THREE.Box3().setFromObject(obj);
      const sx = mb.max.x - mb.min.x;
      const sz = mb.max.z - mb.min.z;
      const sy = mb.max.y - mb.min.y;
      if (sx > 90 || sz > 90) return;
      if (sy < 0.05) return;
      if (sx < 0.2 && sz < 0.2) return;

      colliders.push({
        minX: mb.min.x, maxX: mb.max.x,
        minZ: mb.min.z, maxZ: mb.max.z,
        minY: mb.min.y, maxY: mb.max.y,
      });
      colliderCount++;
    });

    // Ground plane fallback
    if (groundBox.isEmpty()) {
      const gMat  = new THREE.MeshLambertMaterial({ color: 0x3a3a35 });
      const gMesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), gMat);
      gMesh.rotation.x = -Math.PI / 2;
      gMesh.position.y = -0.05;
      gMesh.receiveShadow = !isLowEnd;
      gMesh.name = 'worldGround';
      scene.add(gMesh);
      groundMesh = gMesh;
    }

    mapLoaded = true;
    scene.fog = new THREE.FogExp2(0x87ceeb, isLowEnd ? 0.018 : isMobile ? 0.012 : 0.005);

    PLAYER_SPAWN.x = 0;
    PLAYER_SPAWN.y = mapFloorY + 1.7;
    PLAYER_SPAWN.z = 0;

    console.log(`[world] GLB map loaded ✓ (${colliderCount} colliders, scale=${MAP_SCALE.toFixed(4)})`);
    return true;

  } catch(e) {
    console.warn('[world] GLB map gagal:', e.message, '→ procedural');
    return false;
  }
}

// ─────────────────────────────────────────
// PROCEDURAL FALLBACK
// ─────────────────────────────────────────
function buildProceduralMap() {
  const matGround   = new THREE.MeshLambertMaterial({ color: 0x4a5240 });
  const matRoad     = new THREE.MeshLambertMaterial({ color: 0x353535 });
  const matConcrete = new THREE.MeshLambertMaterial({ color: 0x7a8080 });
  const matBrick    = new THREE.MeshLambertMaterial({ color: 0x8b5e3c });
  const matMetal    = new THREE.MeshLambertMaterial({ color: 0x556677 });

  const gMesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), matGround);
  gMesh.rotation.x = -Math.PI / 2;
  gMesh.receiveShadow = !isLowEnd;
  gMesh.name = 'worldGround'; scene.add(gMesh); groundMesh = gMesh;

  function addBox(x,y,z,w,h,d,mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x, y+h/2, z); m.castShadow=!isLowEnd; m.receiveShadow=!isLowEnd;
    scene.add(m);
    colliders.push({ minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:y,maxY:y+h });
  }
  function bRuined(x,y,z,w,h,d,mat) {
    addBox(x,y,z,w,h,d,mat);
    const dMat = new THREE.MeshLambertMaterial({ color:0x555555 });
    addBox(x+w*0.3,y+h*0.7,z+d*0.3,w*0.3,h*0.3,d*0.3,dMat);
  }
  function bTall(x,y,z,w,h,d,mat) {
    addBox(x,y,z,w,h,d,mat);
    addBox(x,y+h,z,w*0.6,1.5,d*0.6,new THREE.MeshLambertMaterial({color:0x444444}));
  }

  addBox(0,0.01,0,300,0.02,16,matRoad); addBox(0,0.01,0,16,0.02,300,matRoad);
  bRuined(-60,0,-35,22,18,14,matBrick); bRuined(-90,0,-50,18,24,16,matConcrete);
  bTall(60,0,-40,18,36,16,matConcrete); bTall(90,0,-55,14,42,14,matMetal);
  bRuined(-80,0,30,20,16,15,matConcrete); bTall(70,0,35,20,28,18,matConcrete);
  bTall(0,0,-110,24,30,20,matConcrete);
  const WH=6, WD=145;
  addBox(0,WH/2,-WD,300,WH,2,matConcrete); addBox(0,WH/2,WD,300,WH,2,matConcrete);
  addBox(-WD,WH/2,0,2,WH,300,matConcrete); addBox(WD,WH/2,0,2,WH,300,matConcrete);
  mapLoaded = true;
}

// ─────────────────────────────────────────
// SPAWN SETUP
// ─────────────────────────────────────────
function setupDefaultSpawns() {
  ZOMBIE_SPAWNS.length = 0;
  [[-80,0,-80],[80,0,-80],[-80,0,80],[80,0,80],
   [-95,0,0],[95,0,0],[0,0,-95],[0,0,95],
   [-50,0,-50],[50,0,-50],[-50,0,50],[50,0,50],
   [-40,0,0],[40,0,0],[0,0,-40],[0,0,40],
   [-70,0,20],[70,0,-20],[-20,0,70],[20,0,-70],
  ].forEach(([x,,z]) => ZOMBIE_SPAWNS.push({ x, y:mapFloorY, z }));
  PLAYER_SPAWN.x = 0;
  PLAYER_SPAWN.y = mapFloorY + 1.7;
  PLAYER_SPAWN.z = 0;
}

export function snapToPlayerSpawn(camera) {
  if (!camera) return;
  camera.position.set(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z);
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
export async function initWorld(s, anisotropy = 1) {
  scene = s; maxAnisotropy = anisotropy;
  setupLighting(); setupSky();
  const ok = await tryLoadGLBMap();
  if (!ok) buildProceduralMap();
  setupDefaultSpawns();
}

// ─────────────────────────────────────────
// COLLISION
// ─────────────────────────────────────────
export function checkCollision(pos, radius = 0.5) {
  for (const c of colliders) {
    if (pos.y + 1.8 < c.minY || pos.y > c.maxY + 0.3) continue;
    if (pos.x + radius > c.minX && pos.x - radius < c.maxX &&
        pos.z + radius > c.minZ && pos.z - radius < c.maxZ) {
      const ox = Math.min(pos.x+radius-c.minX, c.maxX-(pos.x-radius));
      const oz = Math.min(pos.z+radius-c.minZ, c.maxZ-(pos.z-radius));
      if (ox < oz) pos.x += pos.x < (c.minX+c.maxX)/2 ? -ox : ox;
      else         pos.z += pos.z < (c.minZ+c.maxZ)/2 ? -oz : oz;
    }
  }
  return pos;
}

export function setRainVisual(active) {
  const rainAmb = scene.getObjectByName('rainAmbient');
  if (rainAmb) rainAmb.intensity = active ? 0.6 : 0;
  scene.fog = new THREE.FogExp2(
    active ? 0x556677 : 0x87ceeb,
    active ? 0.018 : (mapLoaded ? (isMobile ? 0.012 : 0.005) : 0.008)
  );
  scene.background = new THREE.Color(active ? 0x556677 : 0x87ceeb);
}

export function updateWorld(dt) {}
export const buildings = [];