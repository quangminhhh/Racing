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

## Features

- **Professional Three.js Game Interface**: Modern, responsive UI with semantic HTML5, Vietnamese language support, and mobile-first design.
- **Dependencies**: Uses Tailwind CSS (CDN), Three.js, Tone.js, and custom styles/scripts for a rich experience.
- **Game Container & HUD**: 3D canvas, HUD overlay for stats, minimap, boost bar, achievement popups, and badge collection.
- **Interactive UI Components**: Pause/Resume, Sound toggle, Weather effects, Game instructions, and mobile-only directional controls. All buttons have ARIA labels and SVG icons.
- **Responsive & Mobile Controls**: Mobile controls are hidden on desktop, and all controls are touch-friendly. Layout adapts to all screen sizes.
- **Performance Optimizations**: Scripts loaded with async/defer, optimized class/ID naming, and structure for fast rendering.
- **Fixed Camera View**: The camera is now fixed for a consistent racing experience. Mouse-based camera rotation for debugging has been removed to avoid distraction and provide a better gameplay experience.
- **Motion Blur (Hiệu ứng mờ chuyển động)**: Khi xe đạt tốc độ cao, hiệu ứng motion blur nhẹ sẽ được áp dụng cho các vật thể chuyển động (đường, chướng ngại vật, cây cối) để tăng cảm giác tốc độ. Sử dụng Three.js EffectComposer và AfterimagePass.
- **Speed Lines/Distortion Effects (Hiệu ứng đường tốc độ)**: Khi kích hoạt Boost, các đường tốc độ xuất hiện ở cạnh màn hình tạo hiệu ứng không khí bị đẩy lùi, kết hợp với overlay ánh sáng để tăng cảm giác tốc độ extreme.
- **Hiệu ứng va chạm nâng cao (Particle Effects)**: Khi va chạm, hiệu ứng hạt sẽ thay đổi tùy loại va chạm:
  - Va chạm khi đang Boost Invincible: xuất hiện hạt lửa (đỏ/cam/vàng) và hạt vụn kim loại (bạc/xám).
  - Va chạm thông thường: xuất hiện hạt khói (xám/đen) và hạt vụn kim loại.
  - Các hiệu ứng này giúp tăng cảm giác vật lý và chân thực cho trò chơi.

## Usage

1. Open `index.html` in your browser or run a local server as described above.
2. Use the on-screen or keyboard controls:
   - **Start**: Begin the game.
   - **Arrow Left/Right** or on-screen arrows: Change lanes.
   - **Pause/Resume**: Pause or continue the game.
   - **Mute**: Toggle sound.
   - **Weather**: Change weather effects.
   - **Help**: View instructions.
   - **Mobile**: Touch controls appear automatically.

## Accessibility

- All interactive elements have ARIA labels for screen readers.
- Touch areas are large and easy to interact with on mobile devices.

## Future Improvements

Planned enhancements include:

- More varied landscapes as you progress.
- Dynamic weather effects such as rain or fog.

Feel free to submit issues or pull requests with additional ideas!

## License

This project is released under the [MIT License](LICENSE).

## Thay đổi mới về CSS
- Đã chuyển các style inline (ví dụ: style="width:50%;background:#ffff00") trong `index.html` sang quản lý bằng class trong `styles.css`.
- Thêm các biến CSS (`--primary-color`, `--secondary-color`, `--accent-color`) để quản lý màu sắc, giúp dễ dàng thay đổi theme.
- Tạo các class `.boost-bar-inner` và `.boost-timer-inner` trong `styles.css` để thay thế cho style inline boost bar và boost timer.
- Khi muốn thay đổi màu sắc hoặc chiều rộng của boost bar/timer, hãy chỉnh sửa trong `styles.css` hoặc cập nhật biến CSS trong `:root`.

### Ví dụ sử dụng:
```html
<div id="boost-bar-inner" class="bar-inner h-4 rounded-lg transition-all boost-bar-inner"></div>
<div id="boost-timer-inner" class="h-5 rounded-full bg-gradient-to-r from-yellow-300 to-pink-400 transition-all boost-timer-inner"></div>
```
