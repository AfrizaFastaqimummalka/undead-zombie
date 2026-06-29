# 🧟 Undead Kingdom

A browser-based 3D zombie survival game built with Three.js — featuring first-person shooter mechanics, multiple weapon types, wave-based enemy AI, and full PWA support.

## 🎮 Play Online

> 🚀 **[Play Now on Vercel →]([https://undead-zombie.vercel.app](https://undead-kingdom.vercel.app/))**

## 📦 Download Large Assets (Google Drive)

Beberapa file besar tidak disertakan di repositori GitHub karena melebihi batas ukuran. Silakan unduh dan tempatkan sesuai path berikut:

| File | Ukuran | Path Tujuan | Link |
|------|--------|-------------|------|
| `map.glb` | ~30 MB | `public/models/map.glb` | 🔗 [Download]([https://drive.google.com/LINK_MAP_GLB](https://drive.google.com/file/d/1tfwPKQu3OljN60TtLUlUj-_XEIoX6xZK/view?usp=sharing)) |
| `menu_bg.mp4` | ~4 MB | `public/menu_bg.mp4` | 🔗 [Download]([https://drive.google.com/LINK_MENU_BG](https://drive.google.com/file/d/1PC_887Ng_wQniPxxKfDRe_1QSH-nyjUL/view?usp=sharing)) |
| `Laporan UAS Grafis.mp4` | ~47 MB | `report/` | 🔗 [Download]([https://drive.google.com/LINK_LAPORAN_MP4](https://drive.google.com/file/d/1M5aSAsA3F3bYpdWeHzZLzzLRWPr5qRrE/view?usp=drive_link)) |

> ⚠️ **Catatan:** Tanpa file `map.glb`, game tidak akan bisa dijalankan secara lokal.

## 🛠️ Setup Lokal

### 1. Clone repositori

```bash
git clone https://github.com/AfrizaFastaqimummalka/undead-zombie.git
cd undead-zombie
```
### 2. Download file besar

Download file dari tabel di atas, lalu tempatkan sesuai path yang tertera.

### 3. Jalankan dengan live server

Gunakan ekstensi **Live Server** di VS Code, atau:

```bash
# Menggunakan Python
python -m http.server 8000

# Menggunakan Node.js (npx)
npx serve .
```

Buka browser ke `http://localhost:8000`

---

## 🎯 Fitur

- 🔫 **Multi-weapon system** — Pistol, Rifle, SMG, Katana
- 🧟 **Wave-based zombie AI** — Musuh semakin kuat tiap ronde
- 🗺️ **3D map** — Environment lengkap dengan GLB model
- 🎵 **Sound effects** — Suara senjata dan serangan
- 📱 **PWA Support** — Bisa diinstall sebagai aplikasi
- 🏆 **Leaderboard & Stats** — Tracking score dan kills

---

## 🧰 Teknologi

| Teknologi | Kegunaan |
|-----------|----------|
| [Three.js](https://threejs.org/) | 3D rendering engine |
| [GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader) | Load model 3D (.glb) |
| HTML5 / CSS3 / Vanilla JS | UI & logika game |
| PWA (Service Worker) | Offline support |
| Vercel | Deployment |

## 📁 Struktur Folder

```
undead-kingdom/
├── public/
│   ├── models/          # 3D models (zombie.glb, sky.hdr, map.glb*)
│   ├── sounds/          # Audio files
│   └── menu_bg.mp4*     # Background video menu
├── src/
│   └── ui.js            # Game UI logic
├── report/              # Laporan UAS
├── index.html           # Entry point
├── sw.js                # Service Worker
└── manifest.json        # PWA manifest

* File ini tidak ada di repo, download via Google Drive di atas
```

---

## 👤 Author

**Afriza Fastaqimummalka**  
NIM: 2341053  
UAS — Pemrograman Grafis

---

## 📄 Lisensi

Project ini dibuat untuk keperluan akademik.
