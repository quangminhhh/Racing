# 3D Racing Game

This repository contains a small WebGL-based racing game using [Three.js](https://threejs.org/). The game runs entirely in the browser and does not require a backend service.

## Prerequisites

- A modern web browser with WebGL enabled (Chrome, Firefox, Edge or similar).
- While you can open `index.html` directly from your file system, running a local web server is recommended to avoid any issues with loading modules. You can use one of the following commands from the repository root:

```bash
# Python 3
python -m http.server 8000
# or
# Node.js
npx http-server .
```

Then navigate to `http://localhost:8000` in your browser.

## Playing the Game

1. Open `index.html` in your WebGL-capable browser or visit the local server URL.
2. Press **Start** to begin. Use the **Arrow Left** and **Arrow Right** keys (or the on‑screen buttons on mobile) to change lanes and avoid obstacles.
3. Press **P** or use the Pause/Resume buttons to pause or resume the game. Use the Mute button to toggle sound.
4. Scores increase as you successfully pass obstacles. Your best score is saved in your browser's `localStorage` under the key `carRacingHighScore`.

## Future Improvements

Planned enhancements include:

- More varied landscapes as you progress.
- Dynamic weather effects such as rain or fog.

Feel free to submit issues or pull requests with additional ideas!
