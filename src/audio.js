// audio.js — Sistem audio dengan musik procedural dan suara hujan

let audioCtx;

// Audio file buffers (opsional — fallback ke procedural jika tidak ada)
const audioBuffers = {};

export async function loadAudioFiles() {
  if (!audioCtx) return;
  const files = {
    pistol:        '../public/sounds/pistol.mp3',
    rifle:         '../public/sounds/rifle.mp3',
    smg:           '../public/sounds/smg.mp3',
    katana_whoosh: '../public/sounds/katana_whoosh.mp3',
    katana_hit:    '../public/sounds/katana_hit.mp3',
  };
  for (const [key, path] of Object.entries(files)) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue; // file tidak ada → pakai procedural
      const arr = await res.arrayBuffer();
      audioBuffers[key] = await audioCtx.decodeAudioData(arr);
    } catch(e) {
      console.warn(`Audio file ${path} tidak ditemukan, pakai procedural`);
    }
  }
}

// Helper: play buffer dengan volume dan pitch opsional
function playBuffer(key, vol = 1.0, pitch = 1.0) {
  if (!audioCtx || !audioBuffers[key]) return false;
  const src  = audioCtx.createBufferSource();
  src.buffer = audioBuffers[key];
  src.playbackRate.value = pitch;
  const gain = audioCtx.createGain();
  gain.gain.value = vol;
  src.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
  return true;
}

// Node musik
let musicMaster;
let ambientGain, combatGain, bossGain;
let ambientNodes = [], combatNodes = [], bossNodes = [];
let rainGain, rainSource;
let currentMusicMode = 'ambient';

export function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  musicMaster = audioCtx.createGain();
  musicMaster.gain.value = 0.35;
  musicMaster.connect(audioCtx.destination);

  // Buat 3 jalur musik
  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = 1;
  ambientGain.connect(musicMaster);

  combatGain = audioCtx.createGain();
  combatGain.gain.value = 0;
  combatGain.connect(musicMaster);

  bossGain = audioCtx.createGain();
  bossGain.gain.value = 0;
  bossGain.connect(musicMaster);

  // Mulai semua track sekaligus, volume diatur via gain
  startAmbientTrack();
  startCombatTrack();
  startBossTrack();

  // Rain audio (mati dulu)
  rainGain = audioCtx.createGain();
  rainGain.gain.value = 0;
  rainGain.connect(audioCtx.destination);
  createRainSound();
  loadAudioFiles(); // non-blocking: load MP3 jika tersedia
}

// ── AMBIENT TRACK ──
// Pad harmonis gelap, dua nada, bergerak lambat
function startAmbientTrack() {
  const notes = [55, 82.4, 110, 138.6]; // A2, E3, A3, C#4
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
    osc.frequency.value = freq;

    // LFO volume perlahan
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.frequency.value = 0.07 + i * 0.03;
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    filter.type = 'lowpass';
    filter.frequency.value = 300 + i * 100;
    filter.Q.value = 2;

    gain.gain.value = 0.07;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ambientGain);
    osc.start();

    // Tambah delay untuk efek ruang
    if (i === 0) {
      const delay = audioCtx.createDelay(1);
      delay.delayTime.value = 0.4;
      const delayGain = audioCtx.createGain();
      delayGain.gain.value = 0.3;
      gain.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(ambientGain);
    }

    ambientNodes.push(osc);
  });
}

// ── COMBAT TRACK ──
// Rhythm lebih cepat, disonant
function startCombatTrack() {
  // Bass pulsing
  const bassFreqs = [55, 110, 82.4, 73.4]; // A2, A3, E3, D3
  bassFreqs.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    const lfo = audioCtx.createOscillator();
    const lfoG = audioCtx.createGain();
    lfo.frequency.value = 1.5 + i * 0.5; // pulse cepat
    lfoG.gain.value = 0.06;
    lfo.connect(lfoG);
    lfoG.connect(gain.gain);
    lfo.start();

    gain.gain.value = 0.08;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq * 2;
    filter.Q.value = 3;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(combatGain);
    osc.start();
    combatNodes.push(osc);
  });

  // High tension strings
  const strNote = audioCtx.createOscillator();
  strNote.type = 'sawtooth';
  strNote.frequency.value = 220;
  const strGain = audioCtx.createGain();
  strGain.gain.value = 0.04;
  const strFilter = audioCtx.createBiquadFilter();
  strFilter.type = 'lowpass';
  strFilter.frequency.value = 800;
  strNote.connect(strFilter);
  strFilter.connect(strGain);
  strGain.connect(combatGain);
  strNote.start();
  combatNodes.push(strNote);
}

// ── BOSS TRACK ──
// Epik, berat, disonant
function startBossTrack() {
  const epicFreqs = [27.5, 36.7, 41.2, 55]; // A1, D2, E2, A2
  epicFreqs.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = i % 2 === 0 ? 'square' : 'sawtooth';
    osc.frequency.value = freq;

    const lfo = audioCtx.createOscillator();
    const lfoG = audioCtx.createGain();
    lfo.frequency.value = 2.0 + i * 0.7;
    lfoG.gain.value = 0.09;
    lfo.connect(lfoG);
    lfoG.connect(gain.gain);
    lfo.start();

    const dist = audioCtx.createWaveShaper();
    dist.curve = makeDistortionCurve(50);

    gain.gain.value = 0.06;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 5;

    osc.connect(dist);
    dist.connect(filter);
    filter.connect(gain);
    gain.connect(bossGain);
    osc.start();
    bossNodes.push(osc);
  });
}

function makeDistortionCurve(amount) {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = (Math.PI + amount) * x / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// ── RAIN SOUND ──
function createRainSound() {
  const bufferSize = audioCtx.sampleRate * 3;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  rainSource = audioCtx.createBufferSource();
  rainSource.buffer = buffer;
  rainSource.loop = true;

  // Filter noise menjadi suara hujan
  const hiShelf = audioCtx.createBiquadFilter();
  hiShelf.type = 'highshelf';
  hiShelf.frequency.value = 3000;
  hiShelf.gain.value = 8;

  const loPass = audioCtx.createBiquadFilter();
  loPass.type = 'lowpass';
  loPass.frequency.value = 8000;

  const loPass2 = audioCtx.createBiquadFilter();
  loPass2.type = 'highpass';
  loPass2.frequency.value = 1000;

  rainSource.connect(hiShelf);
  hiShelf.connect(loPass);
  loPass.connect(loPass2);
  loPass2.connect(rainGain);
  rainSource.start();
}

// ── CROSSFADE MUSIK ──
export function setMusicMode(mode) {
  if (!audioCtx || mode === currentMusicMode) return;
  const t = audioCtx.currentTime + 0.1;
  const fade = 2; // detik

  if (mode === 'ambient') {
    ambientGain.gain.linearRampToValueAtTime(1, t + fade);
    combatGain.gain.linearRampToValueAtTime(0, t + fade);
    bossGain.gain.linearRampToValueAtTime(0, t + fade);
  } else if (mode === 'combat') {
    ambientGain.gain.linearRampToValueAtTime(0.2, t + fade);
    combatGain.gain.linearRampToValueAtTime(1, t + fade);
    bossGain.gain.linearRampToValueAtTime(0, t + fade);
  } else if (mode === 'boss') {
    ambientGain.gain.linearRampToValueAtTime(0, t + fade);
    combatGain.gain.linearRampToValueAtTime(0.3, t + fade);
    bossGain.gain.linearRampToValueAtTime(1, t + fade);
  }

  currentMusicMode = mode;
}

export function setMusicVolume(vol) {
  if (!musicMaster) return;
  musicMaster.gain.value = Math.max(0, Math.min(1, vol));
}

// ── RAIN VOLUME ──
export function setRainVolume(vol) {
  if (!rainGain) return;
  rainGain.gain.setTargetAtTime(vol * 0.08, audioCtx.currentTime, 1.5);
}

// ── SFX LAMA (dipertahankan) ──
function playNoise(duration, freq, type, vol) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'sawtooth';
  osc.frequency.setValueAtTime(freq || 200, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol || 0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (duration || 0.1));
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + (duration || 0.1));
}

export function playGunshot(weaponType = 'rifle') {
  if (!audioCtx) return;
  // Coba file MP3 dulu, fallback ke procedural
  const pitchVariation = 0.95 + Math.random() * 0.1;
  if (playBuffer(weaponType, 0.7, pitchVariation)) return;
  // Fallback procedural
  const bufferSize = audioCtx.sampleRate * 0.08;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(4000, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.08);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
}

export function playFootstep() {
  playNoise(0.06, 80 + Math.random() * 40, 'sine', 0.1);
}

export function playZombieGrowl() {
  if (!audioCtx || Math.random() > 0.15) return;
  const bufferSize = audioCtx.sampleRate * 0.5;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / audioCtx.sampleRate;
    data[i] = (Math.random() * 2 - 1) * 0.3 + Math.sin(t * 50) * 0.7;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(150, audioCtx.currentTime);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
}

export function playZombieAttack() {
  if (!audioCtx) return;
  [0, 120].forEach(offset => {
    const bufferSize = audioCtx.sampleRate * 0.25;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / audioCtx.sampleRate;
      data[i] = Math.sin(t * (40 + offset * 0.3)) * 0.6 + (Math.random() * 2 - 1) * 0.2;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime + offset / 1000);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + offset / 1000 + 0.2);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, audioCtx.currentTime);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(audioCtx.currentTime + offset / 1000);
  });
}

export function playHit() {
  playNoise(0.05, 400, 'square', 0.2);
}

export function playPlayerHurt() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  gain.connect(audioCtx.destination);
  osc.connect(gain);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

export function playReload() {
  if (!audioCtx) return;
  setTimeout(() => playNoise(0.03, 800, 'square', 0.15), 200);
  setTimeout(() => playNoise(0.08, 200, 'sawtooth', 0.1), 500);
  setTimeout(() => playNoise(0.03, 1000, 'square', 0.15), 900);
}

// ── Suara whoosh katana swing (sweep frekuensi tinggi) ──
export function playKatanaWhoosh() {
  if (!audioCtx) return;
  const pitchVariation = 0.95 + Math.random() * 0.1;
  if (playBuffer('katana_whoosh', 0.7, pitchVariation)) return;
  // Fallback procedural
  const dur = 0.18;
  const bufferSize = Math.floor(audioCtx.sampleRate * dur);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    // noise ter-shape jadi whoosh: naik cepat, turun lambat
    const envelope = Math.pow(Math.sin(t * Math.PI), 0.4) * Math.exp(-t * 3);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;

  // BandPass sweep: frekuensi naik saat blade bergerak cepat
  const bpf = audioCtx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.setValueAtTime(800, audioCtx.currentTime);
  bpf.frequency.linearRampToValueAtTime(3500, audioCtx.currentTime + 0.08);
  bpf.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + dur);
  bpf.Q.value = 3;

  // High shelf untuk "kecepatan udara"
  const hpf = audioCtx.createBiquadFilter();
  hpf.type = 'highshelf';
  hpf.frequency.value = 2000;
  hpf.gain.value = 10;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.28, audioCtx.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);

  src.connect(bpf);
  bpf.connect(hpf);
  hpf.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
}

// ── Suara windup sebelum swing (tarikan napas/stance) ──
export function playKatanaWindup() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.12);
}

// ── Suara impact katana kena zombie (flesh hit) ──
export function playKatanaHit() {
  if (!audioCtx) return;
  const pitchVariation = 0.9 + Math.random() * 0.2;
  if (playBuffer('katana_hit', 0.8, pitchVariation)) return;
  // Fallback procedural — Komponen thud rendah
  const bufSize = Math.floor(audioCtx.sampleRate * 0.08);
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    const t = i / bufSize;
    d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.7
          + Math.sin(t * 400) * Math.exp(-t * 25) * 0.3;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const lpf = audioCtx.createBiquadFilter();
  lpf.type = 'lowpass'; lpf.frequency.value = 600;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  src.connect(lpf); lpf.connect(gain); gain.connect(audioCtx.destination);
  src.start();

  // Komponen slicing tipis (high freq)
  const osc = audioCtx.createOscillator();
  const g2  = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(2800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);
  g2.gain.setValueAtTime(0.12, audioCtx.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  osc.connect(g2); g2.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.05);
}

// ── Suara miss (angin lewat) ──
export function playKatanaMiss() {
  if (!audioCtx) return;
  const bufSize = Math.floor(audioCtx.sampleRate * 0.10);
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const bpf = audioCtx.createBiquadFilter();
  bpf.type = 'bandpass'; bpf.frequency.value = 1800; bpf.Q.value = 1.5;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.10);
  src.connect(bpf); bpf.connect(gain); gain.connect(audioCtx.destination);
  src.start();
}

// Alias backward-compat
export function playKnifeSwing() { playKatanaWhoosh(); }

export function playPickup(type) {
  if (!audioCtx) return;
  const freq = type === 'health' ? 600 : 400;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

export function playShellClink() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800 + Math.random() * 400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

export function playImpactWall() {
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * 0.06;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.15;
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 600;
  filter.Q.value = 2;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
}
