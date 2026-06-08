export const PI = Math.PI;
export const PI2 = PI * 2;

export const state = {
  player: {
    health: 100,
    maxHealth: 100,
    speed: 6,
    height: 1.7,
    velocityY: 0,
    isGrounded: true,
    isDead: false,
    x: 0,
    z: 0,
    isSprinting: false,
  },
  cameraHeightDefault: 1.7,
  cameraHeight: 1.7,
  cameraTilt: 0,
  cameraRoll: 0,
  // Mode kamera: 'FPP' atau 'TPP'
  cameraMode: 'FPP',
  weapons: {
    pistol: { ammo: 12, maxAmmo: 12, reserve: 60,  damage: 35, fireRate: 0.20, reloadTime: 1.2, isReloading: false },
    rifle:  { ammo: 30, maxAmmo: 30, reserve: 90,  damage: 25, fireRate: 0.10, reloadTime: 1.5, isReloading: false },
    smg:    { ammo: 35, maxAmmo: 35, reserve: 105, damage: 15, fireRate: 0.07, reloadTime: 1.8, isReloading: false },
    katana: { ammo:  0, maxAmmo:  0, reserve:   0, damage: 60, fireRate: 0,    reloadTime: 0,   isReloading: false },
  },
  currentWeapon: 'rifle',
  get weapon() { return this.weapons[this.currentWeapon]; },
  targets: [],
  drops: [],
  particles: [],
  tracers: [],
  shellCasings: [],
  impactDecals: [],
  score: 0,
  kills: 0,
  yaw: 0,
  pitch: 0,
  isLocked: false,
  isAiming: false,
  shakeIntensity: 0,
  damageTimer: 0,
  deathTimer: 0,
  spawnTimer: 0,
  footstepTimer: 0,
  wave: 1,
  waveBaseCount: 4,
  waveIncrement: 4,
  waveZombieCount: 8,
  waveZombiesKilled: 0,
  waveZombiesSpawned: 0,
  waveActive: true,
  intermission: 0,
  boss: {
    active: false,
    obj: null,
    health: 0,
    maxHealth: 0,
    tier: 0,
    speed: 0,
    damage: 0,
    attackRange: 3,
    attackCooldown: 0,
  },
  // Sistem hujan
  rain: {
    active: false,
    intensity: 0,    // 0–1, target intensitas
    current: 0,      // nilai saat ini (lerp)
  },
  // Musik background
  music: {
    mode: 'ambient', // 'ambient' | 'combat' | 'boss'
    volume: 0.4,
  },
  // Crosshair spread
  crosshairSpread: 0,
  // Joystick untuk pergerakan sentuh
  joystick: { x: 0, y: 0, active: false },
};
