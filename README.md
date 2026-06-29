# 🧟 Undead Kingdom

A browser-based **3D zombie survival game** built with **Three.js**.
Features first-person shooter mechanics, multiple weapon systems, wave-based zombie AI, and full **Progressive Web App (PWA)** support.

![Undead Kingdom](https://img.shields.io/badge/Game-3D%20Zombie%20Survival-red)
![Three.js](https://img.shields.io/badge/Engine-Three.js-blue)
![PWA](https://img.shields.io/badge/Support-PWA-green)

---

## 🎮 Play Online

🚀 **Play the game here:**

➡️ https://undead-kingdom.vercel.app/

---

# 📦 Large Assets Download

Some large files are not included in the GitHub repository because they exceed GitHub file size limits.

Download and place the files according to the paths below:

| File                     | Size   | Destination Path        | Download                                                                                          |
| ------------------------ | ------ | ----------------------- | ------------------------------------------------------------------------------------------------- |
| `map.glb`                | ~30 MB | `public/models/map.glb` | [Download](https://drive.google.com/file/d/1tfwPKQu3OljN60TtLUlUj-_XEIoX6xZK/view?usp=sharing)    |
| `menu_bg.mp4`            | ~4 MB  | `public/menu_bg.mp4`    | [Download](https://drive.google.com/file/d/1PC_887Ng_wQniPxxKfDRe_1QSH-nyjUL/view?usp=sharing)    |
| `Laporan UAS Grafis.mp4` | ~47 MB | `report/`               | [Download](https://drive.google.com/file/d/1M5aSAsA3F3bYpdWeHzZLzzLRWPr5qRrE/view?usp=drive_link) |

⚠️ **Important:**
Without `map.glb`, the game will not run properly in local mode.

---

# 🛠️ Local Installation

## 1. Clone Repository

```bash
git clone https://github.com/AfrizaFastaqimummalka/undead-zombie.git

cd undead-zombie
```

## 2. Download Large Assets

Download the required files above and put them into the correct folders.

Example:

```
public/
 └── models/
      └── map.glb
```

---

## 3. Run Local Server

You can use **Live Server extension** in VS Code.

Or run:

### Python

```bash
python -m http.server 8000
```

### Node.js

```bash
npx serve .
```

Open:

```
http://localhost:8000
```

---

# 🎯 Features

## 🔫 Weapon System

* Pistol
* Rifle
* SMG
* Katana

## 🧟 Zombie AI

* Wave-based enemy spawning
* Increasing difficulty per round
* Zombie chasing and attacking system

## 🗺️ 3D Environment

* Full 3D map using `.glb`
* Real-time rendering with Three.js

## 🎵 Audio System

* Weapon sound effects
* Attack sounds
* Background music

## 📱 PWA Support

* Installable as an application
* Offline support using Service Worker

## 🏆 Game Statistics

* Kill counter
* Score tracking
* Leaderboard system

---

# 🧰 Technologies

| Technology         | Usage                 |
| ------------------ | --------------------- |
| Three.js           | 3D rendering engine   |
| GLTFLoader         | Loading `.glb` models |
| HTML5              | Structure             |
| CSS3               | Styling               |
| Vanilla JavaScript | Game logic            |
| Service Worker     | PWA offline support   |
| Vercel             | Deployment            |

---

# 📁 Project Structure

```
undead-zombie/

├── public/
│   ├── models/
│   │    ├── zombie.glb
│   │    ├── sky.hdr
│   │    └── map.glb*
│   │
│   ├── sounds/
│   └── menu_bg.mp4*
│
├── src/
│   └── ui.js
│
├── report/
│   └── Laporan UAS Grafis.mp4
│
├── index.html
├── sw.js
└── manifest.json


* Large files are excluded from GitHub.
Download them from the asset links above.
```

---

# 👤 Author

**Afriza Fastaqimummalka**
NIM: 2341053

UAS — Pemrograman Grafis

---

# 📄 License

This project was created for academic purposes.
