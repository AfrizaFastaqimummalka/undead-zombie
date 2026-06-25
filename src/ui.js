import { state } from './state.js';

// ─── Ikon senjata (ganti emoji pistol air) ───
export const WEAPON_ICONS = {
  pistol: '/public/icons/pistol.png',
  rifle:  '/public/icons/rifle.png',
  smg:    '/public/icons/smg.png',
  katana: '/public/icons/katana.png',
};

export const WEAPON_LABELS = {
  pistol: 'Pistol',
  rifle:  'Assault Rifle',
  smg:    'SMG',
  katana: 'Katana',
};

// ─── INJECT GLOBAL CSS ───
function injectCSS() {
  if (document.getElementById('hud-css')) return;
  const style = document.createElement('style');
  style.id = 'hud-css';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap');

    :root {
      --hud-font: 'Rajdhani', monospace;
      --hud-accent: #00d4ff;
      --hud-red: #ff3a3a;
      --hud-yellow: #ffd000;
      --hud-green: #00ff88;
      --hud-bg: rgba(0,0,0,0.45);
      --hud-border: rgba(255,255,255,0.08);
    }

    /* ── TOP LEFT: Score + Kills ── */
    #hud-stats {
      position: fixed; top: 16px; left: 20px;
      z-index: 20; pointer-events: none;
      display: flex; flex-direction: column; gap: 6px;
    }

    /* ── BOTTOM LEFT: Minimap + Health ── */
    #hud-bottom-left {
      position: fixed; bottom: 28px; left: 28px;
      z-index: 20; pointer-events: none;
      display: flex; align-items: flex-end; gap: 14px;
    }
    #minimap {
      flex-shrink: 0;
      border-radius: 50%;
      border: 1px solid rgba(0,212,255,0.25);
      background: rgba(0,0,0,0.45);
    }
    #hud-health {
      position: relative; bottom: auto; left: auto;
    }
    #hud-health .label {
      font-family: var(--hud-font); font-size: 11px; font-weight: 600;
      color: rgba(255,255,255,0.5); letter-spacing: 2px; text-transform: uppercase;
      display: flex; align-items: center; gap: 6px;
    }
    #hud-health .label svg { width:12px; height:12px; }
    #hud-health .bar-wrap {
      width: 180px; height: 6px;
      background: rgba(255,255,255,0.1);
      border-radius: 3px; overflow: hidden;
      position: relative;
    }
    #hud-health .bar-fill {
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, #ff3a3a, #ff6b6b);
      transition: width 0.3s ease, background 0.3s;
      box-shadow: 0 0 8px rgba(255,58,58,0.6);
    }
    #hud-health .bar-fill.high {
      background: linear-gradient(90deg, #00ff88, #00d4ff);
      box-shadow: 0 0 8px rgba(0,255,136,0.5);
    }
    #hud-health .bar-fill.mid {
      background: linear-gradient(90deg, #ffd000, #ff9900);
      box-shadow: 0 0 8px rgba(255,208,0,0.5);
    }
    #hud-health .value {
      font-family: var(--hud-font); font-size: 28px; font-weight: 700;
      color: #fff; line-height: 1; letter-spacing: -1px;
    }
    #hud-health .value span { font-size: 14px; color: rgba(255,255,255,0.4); font-weight: 400; }

    /* ── AMMO ── */
    #hud-ammo {
      position: fixed; bottom: 28px; right: 28px;
      z-index: 20; pointer-events: none;
      display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
    }
    #hud-ammo .weapon-row {
      display: flex; align-items: center; gap: 8px; justify-content: flex-end;
    }
    #hud-ammo .weapon-icon {
      width: 28px; height: 28px; object-fit: contain;
      filter: drop-shadow(0 1px 3px rgba(0,0,0,0.8));
    }
    #hud-ammo .weapon-name {
      font-family: var(--hud-font); font-size: 11px; font-weight: 600;
      color: rgba(255,255,255,0.45); letter-spacing: 3px; text-transform: uppercase;
    }
    #hud-ammo .ammo-row {
      display: flex; align-items: baseline; gap: 4px;
    }
    #hud-ammo .ammo-cur {
      font-family: var(--hud-font); font-size: 48px; font-weight: 700;
      color: #fff; line-height: 1; letter-spacing: -2px;
    }
    #hud-ammo .ammo-cur.low { color: var(--hud-red); text-shadow: 0 0 12px rgba(255,58,58,0.7); }
    #hud-ammo .ammo-cur.mid { color: var(--hud-yellow); }
    #hud-ammo .ammo-sep { font-family: var(--hud-font); font-size: 20px; color: rgba(255,255,255,0.25); }
    #hud-ammo .ammo-res { font-family: var(--hud-font); font-size: 20px; color: rgba(255,255,255,0.4); font-weight: 500; }
    #hud-ammo .ammo-pips {
      display: flex; gap: 2px; margin-top: 4px; justify-content: flex-end;
    }
    #hud-ammo .pip {
      width: 4px; height: 12px; border-radius: 2px;
      background: rgba(0,212,255,0.7);
      transition: background 0.1s;
    }
    #hud-ammo .pip.empty { background: rgba(255,255,255,0.12); }

    /* ── WAVE / STATUS TOP CENTER ── */
    #hud-wave {
      position: fixed; top: 0; left: 50%; transform: translateX(-50%);
      z-index: 20; pointer-events: none;
      display: flex; flex-direction: column; align-items: center;
    }
    #hud-wave .wave-badge {
      background: rgba(0,0,0,0.6);
      border-bottom: 1px solid rgba(0,212,255,0.25);
      padding: 6px 28px 8px;
      display: flex; align-items: center; gap: 12px;
      clip-path: polygon(0 0, 100% 0, 92% 100%, 8% 100%);
      min-width: 240px; justify-content: center;
    }
    #hud-wave .wave-label {
      font-family: var(--hud-font); font-size: 11px; font-weight: 600;
      color: rgba(0,212,255,0.7); letter-spacing: 3px; text-transform: uppercase;
    }
    #hud-wave .wave-num {
      font-family: var(--hud-font); font-size: 20px; font-weight: 700;
      color: #fff;
    }
    #hud-wave .wave-kills {
      font-family: var(--hud-font); font-size: 12px; color: rgba(255,255,255,0.5);
      letter-spacing: 1px; margin-top: 2px;
    }

    .stat-row {
      display: flex; align-items: center; gap: 8px;
    }
    .stat-icon {
      font-size: 13px; width: 18px; text-align: center;
    }
    .stat-val {
      font-family: var(--hud-font); font-size: 16px; font-weight: 600;
      color: #fff; letter-spacing: 0.5px;
    }
    .stat-lbl {
      font-family: var(--hud-font); font-size: 10px; font-weight: 400;
      color: rgba(255,255,255,0.35); letter-spacing: 2px; text-transform: uppercase;
    }

    /* ── WEAPON SELECTOR ── */
    #hud-weapons {
      position: fixed; bottom: 36px; right: 28px;
      z-index: 19; pointer-events: none;
      display: none; /* hidden — ammo sudah cukup */
    }

    /* ── BOSS HEALTH ── */
    #hud-boss {
      position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
      z-index: 21; pointer-events: none; display: none;
      flex-direction: column; align-items: center; gap: 4px;
      margin-top: 44px;
    }
    #hud-boss .boss-name {
      font-family: var(--hud-font); font-size: 12px; font-weight: 600;
      color: #cc00ff; letter-spacing: 3px; text-transform: uppercase;
    }
    #hud-boss .boss-bar-wrap {
      width: 300px; height: 6px;
      background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;
    }
    #hud-boss .boss-bar-fill {
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, #cc00ff, #ff00aa);
      box-shadow: 0 0 10px rgba(204,0,255,0.6);
      transition: width 0.2s;
    }

    /* ── RELOAD INDICATOR ── */
    #hud-reload {
      position: fixed; bottom: 108px; right: 28px;
      z-index: 20; pointer-events: none;
      font-family: var(--hud-font); font-size: 12px; font-weight: 600;
      color: var(--hud-yellow); letter-spacing: 3px; text-transform: uppercase;
      opacity: 0; transition: opacity 0.2s;
    }
    #hud-reload.visible { opacity: 1; }

    /* ── CROSSHAIR override (lebih bersih) ── */
    #hud-crosshair {
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      z-index:18;pointer-events:none;
    }

    #message {
      position: fixed; top: 38%; left: 50%; transform: translate(-50%, -50%);
      z-index: 30; pointer-events: none; display: none;
      color: white; font-family: var(--hud-font); font-weight: 600;
      letter-spacing: 2px; text-shadow: 0 0 20px rgba(0,212,255,0.6);
    }
    #message.weapon-msg {
      display: flex; align-items: center; gap: 12px;
      background: rgba(0,0,0,0.55);
      padding: 10px 22px; border-radius: 8px;
      border: 1px solid rgba(0,212,255,0.2);
      text-shadow: none;
    }
    #message .weapon-msg-icon {
      width: 36px; height: 36px; object-fit: contain;
    }
    #message .weapon-msg-label {
      font-family: var(--hud-font); font-size: 22px; font-weight: 700;
      letter-spacing: 2px; color: #fff;
    }
    #damageOverlay {
      position:fixed;inset:0;pointer-events:none;z-index:10;opacity:0;
      transition:opacity 0.1s;
    }

    /* ── MOBILE TOUCH CONTROLS ── */
    #touch-controls {
      display: none; /* Only show on mobile */
      position: fixed; inset: 0; z-index: 15; pointer-events: none;
    }
    #joystick-zone {
      position: absolute; bottom: 60px; left: 60px; width: 140px; height: 140px;
      border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      pointer-events: auto; touch-action: none;
    }
    #joystick-knob {
      position: absolute; top: 50%; left: 50%; width: 50px; height: 50px;
      margin-top: -25px; margin-left: -25px; border-radius: 50%; background: rgba(255,255,255,0.3);
      pointer-events: none;
    }
    #look-zone {
      position: absolute; top: 0; right: 0; width: 50%; height: 100%;
      pointer-events: auto; touch-action: none;
    }
    .touch-btn {
      position: absolute; border-radius: 50%; background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2); color: white; font-family: var(--hud-font);
      font-weight: bold; display: flex; align-items: center; justify-content: center;
      pointer-events: auto; touch-action: none; user-select: none; font-size: 24px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    }
    .touch-btn:active { background: rgba(255,255,255,0.3); }
    #btn-shoot { bottom: 130px; right: 100px; width: 80px; height: 80px; background: rgba(255,50,50,0.2); border-color: rgba(255,50,50,0.5); font-size: 32px; }
    #btn-aim { bottom: 230px; right: 50px; width: 60px; height: 60px; }
    #btn-jump { bottom: 60px; right: 230px; width: 65px; height: 65px; }
    #btn-reload { bottom: 250px; right: 130px; width: 55px; height: 55px; }
    #btn-sprint { bottom: 220px; left: 100px; width: 60px; height: 60px; }
    #btn-cam { top: 30px; right: 40px; width: 50px; height: 50px; }
    #weapon-bar {
      position: fixed;
      bottom: 18px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      z-index: 30;
      pointer-events: auto;
    }
    .btn-weapon {
      width: 56px; height: 56px;
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,0.3);
      background: rgba(0,0,0,0.5);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      touch-action: none; user-select: none;
      transition: border-color 0.15s, background 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-weapon img { width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.8)); }
    .btn-weapon.active {
      border-color: rgba(0,220,255,0.9);
      background: rgba(0,180,255,0.25);
    }
    .btn-weapon:active { background: rgba(255,255,255,0.2); }
  `;
  document.head.appendChild(style);
}

// ─── BUILD HUD ELEMENTS ───
function buildHUD() {
  injectCSS();

  // Remove old HUD elements
  ['hudInfo','ammoDisplay','hud-left'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  const legacyMinimap = document.getElementById('minimap');
  if (legacyMinimap && !legacyMinimap.closest('#hud-bottom-left')) legacyMinimap.remove();

  // Stats — kiri atas
  if (!document.getElementById('hud-stats')) {
    const s = document.createElement('div');
    s.id = 'hud-stats';
    s.innerHTML = `
      <div class="stat-row">
        <span class="stat-icon">🎯</span>
        <span class="stat-val" id="stat-score">0</span>
        <span class="stat-lbl">Score</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">💀</span>
        <span class="stat-val" id="stat-kills">0</span>
        <span class="stat-lbl">Kills</span>
      </div>
    `;
    document.body.appendChild(s);
  }

  // Minimap + health — kiri bawah (sejajar)
  if (!document.getElementById('hud-bottom-left')) {
    const bl = document.createElement('div');
    bl.id = 'hud-bottom-left';
    bl.innerHTML = `
      <canvas id="minimap" width="120" height="120"></canvas>
      <div id="hud-health">
        <div class="label">
          <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 10.5S1 7 1 3.5A2.5 2.5 0 016 2a2.5 2.5 0 015 1.5C11 7 6 10.5 6 10.5z" fill="#ff3a3a"/>
          </svg>
          HEALTH
        </div>
        <div class="value"><span id="hp-val">100</span><span>/100</span></div>
        <div class="bar-wrap"><div class="bar-fill high" id="hp-bar" style="width:100%"></div></div>
      </div>
    `;
    document.body.appendChild(bl);
  }

  // Wave top-center
  if (!document.getElementById('hud-wave')) {
    const w = document.createElement('div');
    w.id = 'hud-wave';
    w.innerHTML = `
      <div class="wave-badge">
        <span class="wave-label">Wave</span>
        <span class="wave-num" id="wave-num">1</span>
        <span class="wave-label" id="wave-sub">0 / 0</span>
      </div>
    `;
    document.body.appendChild(w);
  }

  // Ammo bottom-right
  if (!document.getElementById('hud-ammo')) {
    const a = document.createElement('div');
    a.id = 'hud-ammo';
    a.innerHTML = `
      <div class="weapon-row">
        <img class="weapon-icon" id="ammo-wicon" src="/public/icons/rifle.png" alt="" />
        <div class="weapon-name" id="ammo-wname">ASSAULT RIFLE</div>
      </div>
      <div class="ammo-row">
        <span class="ammo-cur" id="ammo-cur">30</span>
        <span class="ammo-sep">/</span>
        <span class="ammo-res" id="ammo-res">90</span>
      </div>
      <div class="ammo-pips" id="ammo-pips"></div>
    `;
    document.body.appendChild(a);
  }

  // Reload indicator
  if (!document.getElementById('hud-reload')) {
    const r = document.createElement('div');
    r.id = 'hud-reload';
    r.textContent = '⟳  RELOADING';
    document.body.appendChild(r);
  }

  // Boss bar
  if (!document.getElementById('hud-boss')) {
    const b = document.createElement('div');
    b.id = 'hud-boss';
    b.innerHTML = `
      <div class="boss-name" id="boss-name">👑 BOSS</div>
      <div class="boss-bar-wrap"><div class="boss-bar-fill" id="boss-bar" style="width:100%"></div></div>
    `;
    document.body.appendChild(b);
  }

  // Damage overlay
  if (!document.getElementById('damageOverlay')) {
    const d = document.createElement('div');
    d.id = 'damageOverlay';
    document.body.appendChild(d);
  }

  // Hitmarker
  if (!document.getElementById('hitmarker')) {
    const hm = document.createElement('div');
    hm.id = 'hitmarker';
    hm.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      z-index:20;pointer-events:none;color:white;font-size:20px;
      font-weight:bold;font-family:monospace;opacity:0;transition:opacity 0.05s;
    `;
    hm.textContent = '✕';
    document.body.appendChild(hm);
  }

  // Message
  if (!document.getElementById('message')) {
    const msg = document.createElement('div');
    msg.id = 'message';
    document.body.appendChild(msg);
  }
}

// ─── UPDATE HUD ───
export function updateHUD() {
  // Health
  const hp = Math.max(0, state.player.health);
  const hpEl = document.getElementById('hp-val');
  const hpBar = document.getElementById('hp-bar');
  if (hpEl) hpEl.textContent = Math.ceil(hp);
  if (hpBar) {
    hpBar.style.width = hp + '%';
    hpBar.className = 'bar-fill ' + (hp > 60 ? 'high' : hp > 30 ? 'mid' : '');
  }

  // Stats
  const scoreEl = document.getElementById('stat-score');
  const killsEl = document.getElementById('stat-kills');
  if (scoreEl) scoreEl.textContent = state.score.toLocaleString();
  if (killsEl) killsEl.textContent = state.kills;

  // Wave
  const waveNum = document.getElementById('wave-num');
  const waveSub = document.getElementById('wave-sub');
  if (waveNum) waveNum.textContent = state.wave;
  if (waveSub) {
    if (state.boss.active) {
      waveSub.textContent = '👑 BOSS';
      waveSub.style.color = '#cc00ff';
    } else if (state.waveActive) {
      waveSub.textContent = `${state.waveZombiesKilled} / ${state.waveZombieCount}`;
      waveSub.style.color = 'rgba(0,212,255,0.7)';
    } else if (state.intermission > 0) {
      waveSub.textContent = `✓  NEXT IN ${Math.ceil(state.intermission)}s`;
      waveSub.style.color = 'rgba(0,255,136,0.8)';
    }
  }

  // Ammo
  const wnameEl = document.getElementById('ammo-wname');
  const wiconEl = document.getElementById('ammo-wicon');
  const curEl   = document.getElementById('ammo-cur');
  const resEl   = document.getElementById('ammo-res');
  const pipsEl  = document.getElementById('ammo-pips');
  const reloadEl = document.getElementById('hud-reload');

  const weaponNames = { pistol: 'PISTOL', rifle: 'ASSAULT RIFLE', smg: 'SMG', katana: 'KATANA' };
  // Update weapon bar active state di mobile
  if (window._updateWeaponBar) window._updateWeaponBar(state.currentWeapon);
  if (wnameEl) wnameEl.textContent = weaponNames[state.currentWeapon] || state.currentWeapon.toUpperCase();
  if (wiconEl && WEAPON_ICONS[state.currentWeapon]) {
    wiconEl.src = WEAPON_ICONS[state.currentWeapon];
    wiconEl.alt = WEAPON_LABELS[state.currentWeapon] || state.currentWeapon;
  }

  if (state.currentWeapon === 'katana') {
    if (curEl) { curEl.textContent = '∞'; curEl.className = 'ammo-cur'; }
    if (resEl) resEl.textContent = '';
    if (pipsEl) pipsEl.innerHTML = '';
    if (reloadEl) reloadEl.classList.remove('visible');
  } else {
    const w = state.weapon;
    const ratio = w.maxAmmo > 0 ? w.ammo / w.maxAmmo : 0;
    if (curEl) {
      curEl.textContent = w.ammo;
      curEl.className = 'ammo-cur' + (ratio < 0.25 ? ' low' : ratio < 0.5 ? ' mid' : '');
    }
    if (resEl) resEl.textContent = w.reserve;

    // Ammo pips (max 30)
    if (pipsEl) {
      const total = Math.min(w.maxAmmo, 30);
      const filled = Math.round(ratio * total);
      pipsEl.innerHTML = Array.from({length: total}, (_, i) =>
        `<div class="pip${i >= filled ? ' empty' : ''}"></div>`
      ).join('');
    }

    // Reload indicator
    if (reloadEl) reloadEl.classList.toggle('visible', !!w.isReloading);
  }

  // Boss bar
  const bossEl = document.getElementById('hud-boss');
  const bossBar = document.getElementById('boss-bar');
  if (bossEl) {
    if (state.boss.active && state.boss.maxHealth > 0) {
      bossEl.style.display = 'flex';
      if (bossBar) bossBar.style.width = (state.boss.health / state.boss.maxHealth * 100) + '%';
    } else {
      bossEl.style.display = 'none';
    }
  }
}

// ─── INIT UI ───
export function initUI() {
  buildHUD();
  initMenu();
  updateHUD();
  initTouchControls();
}

// ─── TOUCH CONTROLS ───
function initTouchControls() {
  if (!('ontouchstart' in window)) return; // Hanya jalankan di perangkat sentuh

  // Inject Mobile Layout Override (Pindah UI PC ke atas supaya bawahnya lega)
  if (!document.getElementById('mobile-hud-override')) {
    const s = document.createElement('style');
    s.id = 'mobile-hud-override';
    s.textContent = `
      #minimap { display: none !important; }
      #hud-bottom-left { bottom: auto !important; top: 90px !important; left: 20px !important; }
      #hud-ammo { bottom: auto !important; top: 90px !important; right: 20px !important; }
      
      /* Kembalikan touch buttons ke posisi ideal di pojok bawah karena sudah tidak ada halangan */
      #joystick-zone { bottom: 50px !important; left: 50px !important; width: 150px !important; height: 150px !important; }
      #btn-sprint { bottom: 220px !important; left: 95px !important; }
      
      #btn-shoot { bottom: 60px !important; right: 60px !important; width: 85px !important; height: 85px !important; }
      #btn-aim { bottom: 160px !important; right: 30px !important; }
      #btn-jump { bottom: 40px !important; right: 160px !important; }
      #btn-reload { bottom: 175px !important; right: 110px !important; }
      #btn-cam { top: 20px !important; right: 20px !important; }
    `;
    document.head.appendChild(s);
  }

  if (!document.getElementById('touch-controls')) {
    const tc = document.createElement('div');
    tc.id = 'touch-controls';
    tc.innerHTML = `
      <div id="joystick-zone"><div id="joystick-knob"></div></div>
      <div id="look-zone"></div>
      <div class="touch-btn" id="btn-shoot"><img src="/public/icons/pistol.png" style="width:36px;height:36px;object-fit:contain;filter:brightness(0) invert(1);"></div>
      <div class="touch-btn" id="btn-aim">🎯</div>
      <div class="touch-btn" id="btn-jump">⬆️</div>
      <div class="touch-btn" id="btn-reload">🔄</div>
      <div class="touch-btn" id="btn-sprint">🏃</div>
      <div class="touch-btn" id="btn-cam">📷</div>
      <div id="weapon-bar">
        <div class="btn-weapon active" id="bw-pistol" data-label="PISTOL">
          <img src="/public/icons/pistol.png" alt="pistol">
        </div>
        <div class="btn-weapon" id="bw-rifle" data-label="RIFLE">
          <img src="/public/icons/rifle.png" alt="rifle">
        </div>
        <div class="btn-weapon" id="bw-smg" data-label="SMG">
          <img src="/public/icons/smg.png" alt="smg">
        </div>
        <div class="btn-weapon" id="bw-katana" data-label="KATANA">
          <img src="/public/icons/katana.png" alt="katana">
        </div>
      </div>
    `;
    document.body.appendChild(tc);
  }

  const tc = document.getElementById('touch-controls');
  tc.style.display = 'block';

  // Joystick Logic
  const zone = document.getElementById('joystick-zone');
  const knob = document.getElementById('joystick-knob');
  let joystickCenter = { x: 0, y: 0 };
  const maxRadius = 50;

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    state.joystick.active = true;
    const touch = e.changedTouches[0];
    const rect = zone.getBoundingClientRect();
    joystickCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    updateJoystick(touch);
  }, { passive: false });

  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!state.joystick.active) return;
    updateJoystick(e.changedTouches[0]);
  }, { passive: false });

  const endJoystick = (e) => {
    e.preventDefault();
    state.joystick.active = false;
    state.joystick.x = 0;
    state.joystick.y = 0;
    knob.style.transform = `translate(0px, 0px)`;
  };
  zone.addEventListener('touchend', endJoystick);
  zone.addEventListener('touchcancel', endJoystick);

  function updateJoystick(touch) {
    let dx = touch.clientX - joystickCenter.x;
    let dy = touch.clientY - joystickCenter.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    state.joystick.x = dx / maxRadius;
    state.joystick.y = dy / maxRadius;
  }

  // Look Logic
  const lookZone = document.getElementById('look-zone');
  let lastTouch = null;
  const lookSens = 0.005;

  lookZone.addEventListener('touchstart', e => {
    e.preventDefault();
    lastTouch = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }, { passive: false });

  lookZone.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!lastTouch) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - lastTouch.x;
    const dy = touch.clientY - lastTouch.y;
    lastTouch = { x: touch.clientX, y: touch.clientY };

    state.yaw -= dx * lookSens;
    state.pitch -= dy * lookSens;
    state.pitch = Math.max(-Math.PI/2+0.05, Math.min(Math.PI/2-0.05, state.pitch));
  }, { passive: false });

  lookZone.addEventListener('touchend', () => lastTouch = null);
  lookZone.addEventListener('touchcancel', () => lastTouch = null);

  // Helper to dispatch keyboard events
  const dispatchKey = (key, type) => document.dispatchEvent(new KeyboardEvent(type, { key: key }));

  // Buttons Logic
  const btnShoot = document.getElementById('btn-shoot');
  btnShoot.addEventListener('touchstart', e => { e.preventDefault(); document.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); });
  btnShoot.addEventListener('touchend', e => { e.preventDefault(); document.dispatchEvent(new MouseEvent('mouseup', { button: 0 })); });

  const btnAim = document.getElementById('btn-aim');
  btnAim.addEventListener('touchstart', e => { e.preventDefault(); document.dispatchEvent(new MouseEvent('mousedown', { button: 2 })); });
  btnAim.addEventListener('touchend', e => { e.preventDefault(); document.dispatchEvent(new MouseEvent('mouseup', { button: 2 })); });

  const btnJump = document.getElementById('btn-jump');
  btnJump.addEventListener('touchstart', e => { e.preventDefault(); dispatchKey(' ', 'keydown'); });
  btnJump.addEventListener('touchend', e => { e.preventDefault(); dispatchKey(' ', 'keyup'); });

  const btnReload = document.getElementById('btn-reload');
  btnReload.addEventListener('touchstart', e => { e.preventDefault(); dispatchKey('r', 'keydown'); });

  const btnSprint = document.getElementById('btn-sprint');
  btnSprint.addEventListener('touchstart', e => { e.preventDefault(); dispatchKey('Shift', 'keydown'); });
  btnSprint.addEventListener('touchend', e => { e.preventDefault(); dispatchKey('Shift', 'keyup'); });

  const btnCam = document.getElementById('btn-cam');
  btnCam.addEventListener('touchstart', e => { e.preventDefault(); dispatchKey('v', 'keydown'); });

  // ── Weapon selector buttons ──
  const weaponBtnMap = {
    'bw-pistol': '1', 'bw-rifle': '2', 'bw-smg': '3', 'bw-katana': '4'
  };
  Object.entries(weaponBtnMap).forEach(([id, key]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', e => {
      e.preventDefault();
      dispatchKey(key, 'keydown');
      setTimeout(() => dispatchKey(key, 'keyup'), 50);
    });
  });

  // Update visual active state weapon bar
  const WEAPON_ICONS = {
    pistol: '/public/icons/pistol.png',
    rifle:  '/public/icons/rifle.png',
    smg:    '/public/icons/smg.png',
    katana: '/public/icons/katana.png',
  };

  function updateWeaponBar(weaponName) {
    const map = { pistol:'bw-pistol', rifle:'bw-rifle', smg:'bw-smg', katana:'bw-katana' };
    Object.values(map).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    const activeId = map[weaponName];
    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) el.classList.add('active');
    }
    // Update ikon di tombol fire sesuai senjata aktif
    const shootBtn = document.getElementById('btn-shoot');
    if (shootBtn) {
      const img = shootBtn.querySelector('img');
      if (img && WEAPON_ICONS[weaponName]) {
        img.src = WEAPON_ICONS[weaponName];
      }
    }
  }
  // Expose ke global agar updateHUD bisa panggil
  window._updateWeaponBar = updateWeaponBar;
}

// ─── MENUS ───
function showControls() {
  const ts = document.getElementById('titleScreen');
  const cs = document.getElementById('controlsScreen');
  const vid = document.getElementById('menuBgVideo');
  if (vid) { vid.muted = true; vid.pause(); }
  if (ts) ts.style.display = 'none';
  if (cs) cs.style.display = 'flex';
}

function menuBtn(label, onclick) {
  const btn = document.createElement('button');
  btn.style.cssText = `
    font-size:20px;padding:12px 50px;background:#cc3333;color:white;
    border:2px solid #ff6666;font-family:'Rajdhani',monospace;cursor:pointer;
    border-radius:4px;letter-spacing:2px;font-weight:600;
  `;
  btn.textContent = label;
  btn.onmouseover = () => btn.style.background = '#ee4444';
  btn.onmouseout  = () => btn.style.background = '#cc3333';
  btn.onclick = onclick;
  return btn;
}

function initMenu() {
  if (!document.getElementById('titleScreen')) {
    const ts = document.createElement('div');
    ts.id = 'titleScreen';
    ts.style.cssText = `position:fixed;inset:0;z-index:50;display:flex;
      align-items:center;justify-content:center;flex-direction:column;
      background:rgba(0,0,0,0.82);cursor:default;overflow:hidden;`;
    ts.innerHTML = `
      <video id="menuBgVideo" autoplay loop muted playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:-1;opacity:0.6;">
        <source src="/public/menu_bg.mp4" type="video/mp4">
      </video>
      <div style="font-size:62px;font-weight:700;font-family:'Rajdhani',monospace;
        color:#ff4444;text-shadow:0 0 40px rgba(255,0,0,0.5);margin-bottom:6px;letter-spacing:8px;z-index:1;">
        UNDEAD ZOMBIE
      </div>
      <div style="font-size:16px;font-family:'Rajdhani',monospace;color:#ccc;
        margin-bottom:12px;letter-spacing:6px;z-index:1;text-shadow:0 0 10px rgba(0,0,0,1);">ZOMBIE SURVIVAL</div>
      <div id="highScoreDisplay" style="font-size:16px;font-family:'Rajdhani',monospace;
        color:#ffd000;margin-bottom:48px;letter-spacing:2px;z-index:1;"></div>
      
      <div id="menuButtons" style="display:flex;flex-direction:column;gap:16px;z-index:1;min-width:260px;"></div>
      <div id="unmuteText" style="position:absolute;bottom:20px;color:rgba(255,255,255,0.5);font-size:12px;font-family:monospace;z-index:1;pointer-events:none;">(Click anywhere to enable sound)</div>
    `;
    
    document.body.appendChild(ts);

    // Unmute video on first interaction (Browser policy requires interaction to play audio)
    const unmuteHandler = () => {
      const vid = document.getElementById('menuBgVideo');
      if (vid && ts.style.display !== 'none') {
        vid.muted = false;
      }
      const uText = document.getElementById('unmuteText');
      if (uText) uText.style.display = 'none';
      document.removeEventListener('click', unmuteHandler);
      document.removeEventListener('touchstart', unmuteHandler);
    };
    document.addEventListener('click', unmuteHandler);
    document.addEventListener('touchstart', unmuteHandler);

    const btnContainer = document.getElementById('menuButtons');
    
    // START GAME button
    const startBtn = menuBtn('START GAME', showControls);
    startBtn.style.width = '100%';
    btnContainer.appendChild(startBtn);

    // OPTIONS button
    const optionsBtn = menuBtn('OPTIONS', () => {
      document.getElementById('titleScreen').style.display = 'none';
      document.getElementById('optionsScreen').style.display = 'flex';
    });
    optionsBtn.style.width = '100%';
    optionsBtn.style.background = 'rgba(0, 0, 0, 0.7)';
    optionsBtn.style.border = '2px solid #888';
    optionsBtn.style.color = '#ccc';
    optionsBtn.onmouseover = () => optionsBtn.style.background = 'rgba(50, 50, 50, 0.9)';
    optionsBtn.onmouseout  = () => optionsBtn.style.background = 'rgba(0, 0, 0, 0.7)';
    btnContainer.appendChild(optionsBtn);

    // EXIT button
    const exitBtn = menuBtn('EXIT', () => {
      if (confirm("Keluar dari game?")) {
        window.close(); // Hanya berfungsi jika dibuka via window.open, tapi setidaknya memberi efek keluar
        ts.innerHTML = `<div style="color:white;font-family:monospace;font-size:24px;">Game Ditutup. Anda bisa menutup tab browser ini.</div>`;
      }
    });
    exitBtn.style.width = '100%';
    exitBtn.style.background = 'rgba(0, 0, 0, 0.7)';
    exitBtn.style.border = '2px solid #555';
    exitBtn.style.color = '#888';
    exitBtn.onmouseover = () => exitBtn.style.background = '#442222';
    exitBtn.onmouseout  = () => exitBtn.style.background = 'rgba(0, 0, 0, 0.7)';
    btnContainer.appendChild(exitBtn);

    const hs = getHighScore();
    const hsd = document.getElementById('highScoreDisplay');
    if (hsd && hs > 0) hsd.textContent = `🏆  HIGH SCORE: ${hs.toLocaleString()}`;
  }

  if (!document.getElementById('optionsScreen')) {
    const os = document.createElement('div');
    os.id = 'optionsScreen';
    os.style.cssText = `position:fixed;inset:0;z-index:55;display:none;
      align-items:center;justify-content:center;flex-direction:column;
      background:rgba(0,0,0,0.9);cursor:default;`;
    os.innerHTML = `
      <div style="font-size:36px;font-weight:700;font-family:'Rajdhani',monospace;
        color:#eee;margin-bottom:40px;letter-spacing:4px;">OPTIONS</div>
      
      <div style="display:flex;flex-direction:column;gap:30px;width:300px;margin-bottom:50px;">
        <!-- Brightness -->
        <div style="display:flex;flex-direction:column;gap:10px;">
          <label style="color:#aaa;font-family:'Rajdhani',monospace;font-size:18px;letter-spacing:2px;">BRIGHTNESS</label>
          <input type="range" id="optBrightness" min="0.1" max="2.0" step="0.05" value="0.85" style="accent-color:#00d4ff;cursor:pointer;">
        </div>
        
        <!-- Volume -->
        <div style="display:flex;flex-direction:column;gap:10px;">
          <label style="color:#aaa;font-family:'Rajdhani',monospace;font-size:18px;letter-spacing:2px;">VOLUME</label>
          <input type="range" id="optVolume" min="0" max="100" value="35" style="accent-color:#00d4ff;cursor:pointer;">
        </div>
      </div>
    `;
    
    const backBtn = menuBtn('BACK', () => {
      os.style.display = 'none';
      document.getElementById('titleScreen').style.display = 'flex';
    });
    os.appendChild(backBtn);
    document.body.appendChild(os);

    // Event listeners
    document.getElementById('optBrightness').addEventListener('input', (e) => {
      if (window.setBrightness) window.setBrightness(parseFloat(e.target.value));
    });
    
    document.getElementById('optVolume').addEventListener('input', (e) => {
      if (window.setMusicVolume) window.setMusicVolume(parseInt(e.target.value) / 100);
      const topVol = document.getElementById('musicVol');
      if (topVol) topVol.value = e.target.value;
    });
  }

  if (!document.getElementById('controlsScreen')) {
    const cs = document.createElement('div');
    cs.id = 'controlsScreen';
    cs.style.cssText = `position:fixed;inset:0;z-index:50;display:none;
      align-items:center;justify-content:center;flex-direction:column;
      background:rgba(0,0,0,0.82);cursor:default;`;
    cs.innerHTML = `
      <div style="font-size:28px;font-weight:700;font-family:'Rajdhani',monospace;
        color:#eee;margin-bottom:24px;letter-spacing:3px;">KONTROL</div>
      <div style="font-family:'Rajdhani',monospace;color:#bbb;font-size:16px;
        line-height:2.2;margin-bottom:36px;text-align:left;letter-spacing:1px;">
        <span style="color:#00d4ff;font-weight:600">W A S D</span> &nbsp; Bergerak<br>
        <span style="color:#00d4ff;font-weight:600">Mouse</span> &nbsp; Lihat<br>
        <span style="color:#00d4ff;font-weight:600">Klik Kiri</span> &nbsp; Tembak<br>
        <span style="color:#00d4ff;font-weight:600">Klik Kanan</span> &nbsp; ADS<br>
        <span style="color:#00d4ff;font-weight:600">R</span> &nbsp; Reload &nbsp;&nbsp;
        <span style="color:#00d4ff;font-weight:600">Spasi</span> &nbsp; Lompat<br>
        <span style="color:#00d4ff;font-weight:600">Shift</span> &nbsp; Sprint &nbsp;&nbsp;
        <span style="color:#00d4ff;font-weight:600">V</span> &nbsp; FPP/TPP<br>
        <span style="color:#00d4ff;font-weight:600">1-4</span> &nbsp; Ganti Senjata &nbsp;&nbsp;
        <span style="color:#00d4ff;font-weight:600">F</span> &nbsp; Rain
      </div>
    `;
    const btn = menuBtn('MULAI GAME', () => import('./game.js').then(m => m.startGame()));
    cs.appendChild(btn);
    document.body.appendChild(cs);
  }

  if (!document.getElementById('pauseScreen')) {
    const ps = document.createElement('div');
    ps.id = 'pauseScreen';
    ps.style.cssText = `position:fixed;inset:0;z-index:50;display:none;
      align-items:center;justify-content:center;flex-direction:column;
      background:rgba(0,0,0,0.7);cursor:default;`;
    ps.innerHTML = `<div style="font-size:42px;font-weight:700;font-family:'Rajdhani',monospace;
      color:#eee;margin-bottom:40px;letter-spacing:4px;">⏸ PAUSE</div>`;
    const btn = menuBtn('LANJUTKAN', () => {
      document.querySelector('canvas')?.requestPointerLock();
    });
    ps.appendChild(btn);
    document.body.appendChild(ps);
  }

  if (!document.getElementById('gameOver')) {
    const go = document.createElement('div');
    go.id = 'gameOver';
    go.style.cssText = `position:fixed;inset:0;z-index:100;display:none;
      align-items:center;justify-content:center;background:rgba(0,0,0,0.7);
      flex-direction:column;cursor:default;`;
    go.innerHTML = `
      <div style="color:#ff4444;font-size:60px;font-weight:700;
        font-family:'Rajdhani',monospace;margin-bottom:20px;letter-spacing:6px;
        text-shadow:0 0 30px rgba(255,0,0,0.4);">GAME OVER</div>
      <div id="stats" style="color:white;font-size:18px;font-family:'Rajdhani',monospace;
        margin-bottom:30px;line-height:2;text-align:center;letter-spacing:1px;"></div>
    `;
    const btn = menuBtn('MAIN LAGI', () => import('./game.js').then(m => m.restart()));
    btn.id = 'restartBtn';
    go.appendChild(btn);
    document.body.appendChild(go);
  }
}

export function showPause() {
  document.getElementById('pauseScreen')?.style.setProperty('display','flex');
  document.getElementById('hud-bottom-left')?.style.setProperty('display','none');
  document.getElementById('hud-ammo')?.style.setProperty('display','none');
  document.getElementById('hud-stats')?.style.setProperty('display','none');
  document.getElementById('hud-wave')?.style.setProperty('display','none');
}

export function hidePause() {
  document.getElementById('pauseScreen')?.style.setProperty('display','none');
  document.getElementById('hud-bottom-left')?.style.setProperty('display','flex');
  document.getElementById('hud-ammo')?.style.setProperty('display','flex');
  document.getElementById('hud-stats')?.style.setProperty('display','flex');
  document.getElementById('hud-wave')?.style.setProperty('display','flex');
}

export function hideMenus() {
  ['titleScreen','optionsScreen','controlsScreen','pauseScreen'].forEach(id => {
    document.getElementById(id)?.style.setProperty('display','none');
  });
  const vid = document.getElementById('menuBgVideo');
  if (vid) { vid.muted = true; vid.pause(); }
  document.getElementById('hud-bottom-left')?.style.setProperty('display','flex');
  document.getElementById('hud-ammo')?.style.setProperty('display','flex');
  document.getElementById('hud-stats')?.style.setProperty('display','flex');
  document.getElementById('hud-wave')?.style.setProperty('display','flex');
}

export function showMessage(text) {
  const m = document.getElementById('message');
  if (!m) return;
  m.className = '';
  m.innerHTML = '';
  m.textContent = text;
  m.style.display = 'block';
  m.style.fontSize = '22px';
}

export function showWeaponMessage(weaponType) {
  const m = document.getElementById('message');
  if (!m) return;
  const icon = WEAPON_ICONS[weaponType];
  const label = WEAPON_LABELS[weaponType] || weaponType;
  m.className = 'weapon-msg';
  m.style.display = 'flex';
  m.innerHTML = icon
    ? `<img class="weapon-msg-icon" src="${icon}" alt="${label}" /><span class="weapon-msg-label">${label}</span>`
    : `<span class="weapon-msg-label">${label}</span>`;
}
export function hideMessage() {
  const m = document.getElementById('message');
  if (!m) return;
  m.style.display = 'none';
  m.className = '';
  m.innerHTML = '';
}

export function showDamageOverlay(color) {
  const d = document.getElementById('damageOverlay');
  if (!d) return;
  if (!color || color === '') { d.style.opacity = '0'; return; }
  d.style.backgroundColor = color; d.style.opacity = '1';
  if (color.includes('255,0,0') || color.includes('0,255,0') || color.includes('255,170')) {
    setTimeout(() => d.style.opacity = '0', 50);
  }
}

let hitmarkerTimeout = null;
export function showHitmarker() {
  const hm = document.getElementById('hitmarker');
  if (!hm) return;
  hm.style.opacity = '1';
  if (hitmarkerTimeout) clearTimeout(hitmarkerTimeout);
  hitmarkerTimeout = setTimeout(() => hm.style.opacity = '0', 100);
}

function getHighScore() { return parseInt(localStorage.getItem('highScore') || '0'); }
function setHighScore(s) { if (s > getHighScore()) localStorage.setItem('highScore', s); }

export function showGameOver() {
  const go = document.getElementById('gameOver');
  if (!go) return;
  setHighScore(state.score);
  const hs = getHighScore();
  const stats = document.getElementById('stats');
  if (stats) stats.innerHTML = `Score: ${state.score.toLocaleString()}<br>Kills: ${state.kills}<br><br>🏆 High Score: ${hs.toLocaleString()}`;
  go.style.display = 'flex';
}

let deathTimer = 0, deathActive = false;
export function gameOver() {
  if (deathActive) return;
  deathActive = true; state.player.isDead = true;
  state.isLocked = false; deathTimer = 0;
  document.exitPointerLock();
  document.getElementById('restartBtn').style.display = 'none';
}
export function isDeathActive() { return deathActive; }
export function setDeathActive(v) { deathActive = v; }

export function updateDeathAnimation(dt) {
  if (!deathActive) return;
  deathTimer += dt;
  const t = Math.min(deathTimer / 0.6, 1);
  const ease = t * t * (3 - 2 * t);
  state.cameraHeight = 0.3 + (1 - ease) * (state.cameraHeightDefault - 0.3);
  state.cameraTilt = -30 * ease; state.cameraRoll = -45 * ease;
  if (t >= 1) { deathActive = false; showGameOver(); }
}

const MINIMAP_SIZE = 120;
export function updateMinimap() {
  const canvas = document.getElementById('minimap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = MINIMAP_SIZE / 2, cy = MINIMAP_SIZE / 2;
  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, MINIMAP_SIZE/2, 0, Math.PI*2); ctx.clip();
  ctx.fillStyle = 'rgba(0,20,10,0.7)'; ctx.fillRect(0,0,MINIMAP_SIZE,MINIMAP_SIZE);
  const SCALE = 1.0;
  if (state.buildings) {
    for (const b of state.buildings) {
      const bx = cx + (b.position.x - state.player.x) / SCALE;
      const bz = cy + (b.position.z - state.player.z) / SCALE;
      const bs = (b.geometry?.parameters?.width || 1.5) / SCALE;
      const bd = (b.geometry?.parameters?.depth || 1.5) / SCALE;
      ctx.fillStyle = 'rgba(0,80,80,0.6)'; ctx.fillRect(bx-bs/2,bz-bd/2,bs,bd);
    }
  }
  for (const t of state.targets) {
    if (!t.visible) continue;
    const dx = t.position.x - state.player.x, dz = t.position.z - state.player.z;
    const sx = cx + dx/SCALE, sz = cy + dz/SCALE;
    ctx.fillStyle = t.userData?.type === 'boss' ? '#cc00ff' : t.userData?.type === 'tank' ? '#ff8800' : '#ff3a3a';
    ctx.beginPath(); ctx.arc(sx,sz,2.5,0,Math.PI*2); ctx.fill();
  }
  if (state.drops) {
    for (const d of state.drops) {
      const sx = cx + (d.position.x - state.player.x)/SCALE;
      const sz = cy + (d.position.z - state.player.z)/SCALE;
      ctx.fillStyle = d.userData?.type === 'health' ? '#00ff88' : '#ffd000';
      ctx.beginPath(); ctx.arc(sx,sz,2,0,Math.PI*2); ctx.fill();
    }
  }
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(-state.yaw);
  ctx.fillStyle = '#00d4ff';
  ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(-3,4); ctx.lineTo(3,4); ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.restore();
  ctx.strokeStyle = 'rgba(0,212,255,0.2)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx,cy,MINIMAP_SIZE/2-1,0,Math.PI*2); ctx.stroke();
}

export function updateUI(dt) {
  updateDeathAnimation(dt);
  updateMinimap();
}