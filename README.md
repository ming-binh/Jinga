# Knowledge Jenga Tower (Tháp Jenga Tri Thức)

A 3D multiplayer Jenga game combined with an interactive quiz system, built using **Three.js** and **Physijs** (physics engine).

---

## 🎮 Features
- **3D Physics Simulation**: Powered by [Physijs](https://github.com/chandlerprall/Physijs) and [Ammo.js](https://github.com/kripken/ammo.js/) running in a web worker for smooth performance.
- **Interactive Quiz System**: Players must answer multiple-choice questions correctly within a time limit (15 seconds) to unlock their turn to push a block.
- **Dynamic Turn-based Gameplay**: Supports 1 to 20 players with custom names and a dynamic scoreboard.
- **Active Zone Mechanic**: Highlights a random 5-level active zone. Players are only allowed to push blocks inside this zone, raising the challenge.
- **Adjustable Push Force**: A custom slider allows players to control the magnitude of the push/impulse applied to the blocks.
- **Camera Controls**: Rotatable and zoomable camera view using OrbitControls (right-click and drag to rotate, scroll to zoom).

---

## 🛠️ Tech Stack
- **Core**: HTML5, Vanilla JavaScript, CSS3
- **3D Graphics**: [Three.js](https://threejs.org/)
- **Physics**: [Physijs](https://github.com/chandlerprall/Physijs) / Ammo.js
- **Data**: JSON-based quiz questions (`cau_hoi_chuong_3_CNXHKH.json`)

---

## 🚀 How to Play
1. Open `index.html` in your browser.
2. Enter the number of players and their names, then click **Bắt Đầu Chơi** (Start Game).
3. On each player's turn, a quiz question is displayed. Choose the correct answer before the timer runs out.
4. If correct, a random 5-level zone will be highlighted.
5. Adjust the force slider at the bottom, then **left-click** on a block within the highlighted zone to push/shoot it out.
6. Earn points by successfully removing blocks. Try not to knock over other blocks or collapse the tower!
7. The game ends when the tower collapses or too many blocks fall.

---

## 👥 Credits
Originally built based on a web-based Jenga board game prototype in collaboration with [haoRchen](https://github.com/haoRchen).
