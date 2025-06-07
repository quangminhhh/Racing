// Import necessary components from Three.js
        import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

        let scene, camera, renderer, car, road, obstacles = [];
        let roadMarkings = []; // Array to store road marking segments
        let sideElements = []; // Array to store trees and other side elements
        let ambientLight, directionalLight, skybox;
        let rainSystem, rainGeometry;
        let transitionRoad = null;
        let isTransitioning = false;
        let fadeStartTime = 0;
        const FADE_DURATION = 1000; // milliseconds for environment transitions

        let score = 0;
        let highScore = localStorage.getItem('carRacingHighScore') || 0;
        let gameActive = false;
        let gamePaused = false;
        let animationFrameId;

        // UI elements
        const gameContainer = document.querySelector('.game-container');
        const scoreDisplay = document.getElementById('score-display');
        const highScoreDisplay = document.getElementById('high-score-display');
        const difficultyDisplay = document.getElementById('difficulty-display');
        const startOverlay = document.getElementById('start-overlay');
        const gameOverOverlay = document.getElementById('game-over-overlay');
        const pauseOverlay = document.getElementById('pause-overlay'); // New pause overlay
        const finalScoreDisplay = document.getElementById('final-score');
        const finalHighScoreDisplay = document.getElementById('final-high-score');
        const startButton = document.getElementById('start-button');
        const restartButton = document.getElementById('restart-button');
        const leftButton = document.getElementById('left-button');
        const rightButton = document.getElementById('right-button');
        const pauseButton = document.getElementById('pause-button'); // New pause button
        const resumeButton = document.getElementById('resume-button'); // New resume button
        const muteButton = document.getElementById('mute-button'); // New mute button
        const volumeSlider = document.getElementById('volume-slider');
        const countdownDisplay = document.getElementById('countdown-display'); // New countdown display
        const weatherDisplay = document.getElementById('weather-display');
        const weatherToggleButton = document.getElementById('weather-toggle');
        const helpButton = document.getElementById('help-button');
        const helpOverlay = document.getElementById('help-overlay');
        const closeHelpButton = document.getElementById('close-help-button');

        // Game parameters
        const INITIAL_CAR_SPEED = 0.05; // Car's horizontal movement speed
        const INITIAL_ROAD_SPEED = 0.2; // Giảm tốc độ ban đầu để game dễ hơn
        const INITIAL_OBSTACLE_INTERVAL = 1500; // Tăng khoảng cách spawn để dễ hơn
        let currentRoadSpeed = INITIAL_ROAD_SPEED;
        let currentObstacleInterval = INITIAL_OBSTACLE_INTERVAL;
        let difficultyLevel = 1;

        const OBSTACLE_BASE_SIZE = 0.8;
        const CAR_WIDTH = 0.7;
        const CAR_HEIGHT = 0.5;
        const CAR_DEPTH = 1.2;

        // Lane system parameters
        const LANE_WIDTH = 2; // Width of each lane
        const NUM_LANES = 3; // Number of lanes (e.g., -1, 0, 1)
        const LANE_POSITIONS = [-LANE_WIDTH, 0, LANE_WIDTH]; // X-positions for each lane center
        let currentLane = 1; // Start in the middle lane (index 1 for 0, 1, 2)
        const LANE_CHANGE_SPEED = 0.1; // Speed at which car moves between lanes

        // Keyboard state
        const keys = {
            left: false,
            right: false
        };

        // Audio setup
        let scoreSynth, crashSynth, backgroundMusic, volumeControl;
        let isMuted = false;

        const TIME_OF_DAY_SEQUENCE = ['sunrise', 'day', 'sunset', 'night'];
        const TIME_LABELS = {
            sunrise: 'Bình minh',
            day: 'Ban ngày',
            sunset: 'Hoàng hôn',
            night: 'Ban đêm'
        };
        let currentTimeIndex = 1;
        let lastWeatherChangeScore = 0;
        const WEATHER_CHANGE_SCORE = 30;

        let weatherState = {
            rainIntensity: 0,
            fogDensity: 0,
            timeOfDay: 'day'
        };

        // Environment configurations
        const environmentConfigs = [
            {
                sideObject: 'tree',
                treeColor: 0x228B22,
                buildingColor: 0x808080,
                roadTexture: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/hardwood2_diffuse.jpg'
            },
            {
                sideObject: 'building',
                treeColor: 0xffa500,
                buildingColor: 0x999999,
                roadTexture: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/brick_diffuse.jpg'
            },
            {
                sideObject: 'tree',
                treeColor: 0x00ff00,
                buildingColor: 0x777777,
                roadTexture: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg'
            }
        ];

        const preloadedRoadTextures = [];

        /**
         * Preloads all road textures so switching environments does not cause a delay.
         */
        function preloadRoadTextures() {
            let loaded = 0;
            environmentConfigs.forEach((config, i) => {
                textureLoader.load(config.roadTexture, tex => {
                    preloadedRoadTextures[i] = tex;
                    loaded++;
                });
            });
        }

        let currentEnvironmentIndex = 0;
        let currentEnvironment = environmentConfigs[currentEnvironmentIndex];
        const textureLoader = new THREE.TextureLoader();
        let lastEnvChangeScore = 0;
        const ENV_CHANGE_SCORE = 20;

        /**
         * Initializes audio context and synths.
         */
        function initAudio() {
            volumeControl = new Tone.Gain(1).toDestination();
            // Synth for score sound (simple click)
            scoreSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: {
                    type: "sine"
                },
                envelope: {
                    attack: 0.001,
                    decay: 0.1,
                    sustain: 0.01,
                    release: 0.1
                }
            }).connect(volumeControl);

            // Synth for crash sound (noise)
            crashSynth = new Tone.NoiseSynth().connect(volumeControl);

            // Background music (simple loop)
            backgroundMusic = new Tone.Loop(time => {
                // A slightly more complex beat for background music
                scoreSynth.triggerAttackRelease("C4", "8n", time);
                scoreSynth.triggerAttackRelease("E4", "8n", time + Tone.Time("16n").toSeconds());
                scoreSynth.triggerAttackRelease("G4", "8n", time + Tone.Time("8n").toSeconds());
            }, "1n").start(0); // Loop every whole note
            Tone.Transport.bpm.value = 140; // Faster tempo
            backgroundMusic.mute = true; // Start muted
        }

        /**
         * Creates a more detailed car model using multiple geometries.
         * @returns {THREE.Group} A group containing the car meshes.
         */
        function createCarModel() {
            const carGroup = new THREE.Group();

            // Main body
            const bodyGeometry = new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT * 0.8, CAR_DEPTH);
            const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x007bff });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.position.y = CAR_HEIGHT * 0.4; // Base of the car

            // Cabin (top part)
            const cabinWidth = CAR_WIDTH * 0.6;
            const cabinHeight = CAR_HEIGHT * 0.7;
            const cabinDepth = CAR_DEPTH * 0.6;
            const cabinGeometry = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinDepth);
            const cabinMaterial = new THREE.MeshPhongMaterial({ color: 0x424242 }); // Darker color for cabin
            const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
            cabin.position.y = CAR_HEIGHT * 0.8 + cabinHeight / 2; // On top of the body
            cabin.position.z = -CAR_DEPTH * 0.1; // Slightly forward

            carGroup.add(body);
            carGroup.add(cabin);

            return carGroup;
        }

        /**
         * Creates a dashed road marking segment.
         * @param {number} yPos - Y position of the marking.
         * @returns {THREE.Mesh} A mesh representing a road marking.
         */
        function createRoadMarking(yPos) {
            const markingGeometry = new THREE.PlaneGeometry(0.2, 2); // Thin, long stripe
            const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow color
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            marking.rotation.x = -Math.PI / 2;
            marking.position.y = yPos;
            return marking;
        }

        /**
         * Creates a simple tree model.
         * @param {number} xPos - X position of the tree.
         * @returns {THREE.Group} A group containing the tree meshes.
         */
        function createTree(xPos) {
            const treeGroup = new THREE.Group();

            // Trunk
            const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
            const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 }); // Brown
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.y = 0.75; // Half of its height
            treeGroup.add(trunk);

            // Leaves
            const leavesGeometry = new THREE.ConeGeometry(1, 2, 8);
            const leavesMaterial = new THREE.MeshPhongMaterial({ color: currentEnvironment.treeColor });
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.y = 2.25; // On top of the trunk
            treeGroup.add(leaves);

            treeGroup.position.x = xPos;
            treeGroup.position.z = -50; // Far in the distance
            return treeGroup;
        }

        /**
         * Creates a simple building model.
         * @param {number} xPos - X position of the building.
         * @returns {THREE.Group} A group containing the building mesh.
         */
        function createBuilding(xPos) {
            const buildingGroup = new THREE.Group();
            const height = 2 + Math.random() * 2;
            const geometry = new THREE.BoxGeometry(1, height, 1);
            const material = new THREE.MeshPhongMaterial({ color: currentEnvironment.buildingColor });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = height / 2;
            buildingGroup.add(mesh);
            buildingGroup.position.x = xPos;
            buildingGroup.position.z = -50;
            return buildingGroup;
        }

        /**
         * Initializes the Three.js scene, camera, renderer, and game objects.
         */
        function init() {
            // Set up scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x2d3748); // Dark background for the scene

            preloadRoadTextures();

            // Create a simple skybox (larger sphere or box around the scene)
            const skyGeometry = new THREE.BoxGeometry(200, 200, 200);
            const skyMaterial = new THREE.MeshBasicMaterial({
                color: 0x7ED6DF, // Light blue
                side: THREE.BackSide // Render inside the box
            });
            skybox = new THREE.Mesh(skyGeometry, skyMaterial);
            scene.add(skybox);

            // Set up camera (PerspectiveCamera for 3D view)
            camera = new THREE.PerspectiveCamera(75, gameContainer.offsetWidth / gameContainer.offsetHeight, 0.1, 1000);
            camera.position.set(0, 3, 5); // Position the camera to look down on the road
            camera.lookAt(0, 0, 0); // Point camera towards the origin

            // Set up renderer
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(gameContainer.offsetWidth, gameContainer.offsetHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            gameContainer.appendChild(renderer.domElement);

            // Add lighting
            ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
            scene.add(ambientLight);
            directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(0, 10, 5);
            scene.add(directionalLight);

            // Create road (a long plane)
            const roadGeometry = new THREE.PlaneGeometry(10, 100); // Width, Length
            const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x606060, transparent: true, opacity: 1 }); // Grey color for road
            if (roadMaterial.map) {
                roadMaterial.map.wrapS = roadMaterial.map.wrapT = THREE.RepeatWrapping;
                roadMaterial.map.repeat.set(1, 10);
                roadMaterial.map.needsUpdate = true;
            }
            road = new THREE.Mesh(roadGeometry, roadMaterial);
            road.rotation.x = -Math.PI / 2; // Rotate to be horizontal
            road.position.y = -0.5; // Slightly below the ground
            road.position.z = -40; // Extend far into the distance
            scene.add(road);

            changeEnvironment(0); // Apply initial environment

            // Add road markings
            for (let i = 0; i < 20; i++) { // Create multiple segments
                const marking = createRoadMarking(-0.49); // Slightly above road surface
                marking.position.z = -50 + i * 5; // Space them out
                scene.add(marking);
                roadMarkings.push(marking);
            }

            // Create car model
            car = createCarModel();
            car.position.set(LANE_POSITIONS[currentLane], 0, 3); // Position car in middle lane
            scene.add(car);

            // Initialize audio
            initAudio();
            volumeSlider.value = volumeControl.gain.value;

            // Update UI elements
            updateScoreDisplay();
            updateHighScoreDisplay();
            updateDifficultyDisplay();

            // Event Listeners
            window.addEventListener('resize', onWindowResize, false);
            document.addEventListener('keydown', onKeyDown, false);
            document.addEventListener('keyup', onKeyUp, false);

            startButton.addEventListener('click', startCountdown);
            restartButton.addEventListener('click', startCountdown);

            pauseButton.addEventListener('click', togglePause);
            resumeButton.addEventListener('click', togglePause);
            muteButton.addEventListener('click', toggleMute);
            volumeSlider.addEventListener('input', () => {
                if (volumeControl) {
                    volumeControl.gain.value = parseFloat(volumeSlider.value);
                }
            });
            weatherToggleButton.addEventListener('click', cycleWeather);
            helpButton.addEventListener('click', () => {
                helpOverlay.classList.remove('hidden');
            });
            closeHelpButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                helpOverlay.classList.add('hidden');
                console.log('Help overlay closed');
            });

            // Touch controls for mobile - Refactored for cleaner code
            const handleTouchStart = (e, direction) => { e.preventDefault(); keys[direction] = true; };
            const handleTouchEnd = (e, direction) => { e.preventDefault(); keys[direction] = false; };

            leftButton.addEventListener('touchstart', (e) => handleTouchStart(e, 'left'), { passive: false });
            leftButton.addEventListener('touchend', (e) => handleTouchEnd(e, 'left'));
            rightButton.addEventListener('touchstart', (e) => handleTouchStart(e, 'right'), { passive: false });
            rightButton.addEventListener('touchend', (e) => handleTouchEnd(e, 'right'));

            initRain();
            applyTimeOfDaySettings(weatherState.timeOfDay);
            updateFog();
            updateWeatherDisplay();
        }

        /**
         * Handles window resize events to keep the canvas responsive.
         */
        function onWindowResize() {
            camera.aspect = gameContainer.offsetWidth / gameContainer.offsetHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(gameContainer.offsetWidth, gameContainer.offsetHeight);
        }

        /**
         * Handles keydown events for car movement and pausing.
         * @param {KeyboardEvent} event - The keyboard event object.
         */
        function onKeyDown(event) {
            if (gameActive && !gamePaused) {
                if (event.key === 'ArrowLeft') {
                    keys.left = true;
                    // Attempt to change lane
                    if (currentLane > 0) {
                        currentLane--;
                    }
                } else if (event.key === 'ArrowRight') {
                    keys.right = true;
                    // Attempt to change lane
                    if (currentLane < NUM_LANES - 1) {
                        currentLane++;
                    }
                } else if (event.key === ' ' || event.code === 'Space') {
                    event.preventDefault(); // Prevent page scrolling
                    const isBoostReady = playerStats.boost >= playerStats.maxBoost && !boostActive &&
                        (boostCooldownTime === null || Date.now() - boostCooldownTime >= BOOST_COOLDOWN_DURATION);
                    if (isBoostReady) {
                        activateBoost();
                    }
                } else if (event.key === 'w' || event.key === 'W') {
                    cycleWeather();
                } else if (event.key === 'p' || event.key === 'P') {
                    togglePause();
                }
            } else if (event.key === 'p' || event.key === 'P') {
                togglePause(); // Allow pausing/resuming even if game is not active
            }
        }

        /**
         * Handles keyup events to stop car movement.
         * @param {KeyboardEvent} event - The keyboard event object.
         */
        function onKeyUp(event) {
            if (gameActive && !gamePaused) {
                if (event.key === 'ArrowLeft') {
                    keys.left = false;
                } else if (event.key === 'ArrowRight') {
                    keys.right = false;
                }
            }
        }

        /**
         * Toggles the game pause state.
         */
        function togglePause() {
            gamePaused = !gamePaused;
            if (gamePaused) {
                cancelAnimationFrame(animationFrameId);
                pauseOverlay.classList.remove('hidden');
                backgroundMusic.mute = true; // Mute music when paused
            } else {
                pauseOverlay.classList.add('hidden');
                animate(); // Resume animation
                if (!isMuted) { // Only unmute if not globally muted
                    backgroundMusic.mute = false;
                }
            }
        }

        /**
         * Toggles global audio mute state.
         */
        function toggleMute() {
            isMuted = !isMuted;
            Tone.Destination.mute = isMuted; // Mute/unmute all Tone.js output
            muteButton.textContent = isMuted ? 'Bật âm' : 'Tắt âm';
            if (isMuted) {
                backgroundMusic.mute = true; // Ensure background music is muted
            } else if (gameActive && !gamePaused) {
                backgroundMusic.mute = false; // Unmute background music only if game is active and not paused
            }
        }

        /**
         * Starts a countdown before the game begins.
         */
        function startCountdown() {
            startOverlay.classList.add('hidden');
            gameOverOverlay.classList.add('hidden');
            pauseOverlay.classList.add('hidden'); // Ensure pause overlay is hidden

            let count = 3;
            countdownDisplay.textContent = count;
            countdownDisplay.classList.remove('hidden');
            countdownDisplay.classList.add('show');

            const countdownInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    countdownDisplay.textContent = count;
                } else if (count === 0) {
                    countdownDisplay.textContent = 'GO!';
                } else {
                    clearInterval(countdownInterval);
                    countdownDisplay.classList.remove('show');
                    countdownDisplay.classList.add('hidden');
                    startGame();
                }
            }, 1000);
        }

        /**
         * Starts the game, resets scores, and hides overlays.
         */
        function startGame() {
            score = 0;
            difficultyLevel = 1;
            currentRoadSpeed = INITIAL_ROAD_SPEED;
            currentObstacleInterval = INITIAL_OBSTACLE_INTERVAL;
            updateScoreDisplay();
            updateDifficultyDisplay();
            obstacles.forEach(obstacle => scene.remove(obstacle)); // Remove existing obstacles
            obstacles = []; // Clear obstacle array
            sideElements.forEach(el => scene.remove(el)); // Clear existing side elements
            sideElements = [];

            // Reset weather
            currentTimeIndex = 0;
            weatherState = { rainIntensity: 0, fogDensity: 0, timeOfDay: 'sunrise' };
            applyTimeOfDaySettings(weatherState.timeOfDay);
            updateFog();
            updateWeatherDisplay();

            currentEnvironmentIndex = 0;
            lastEnvChangeScore = 0;
            changeEnvironment(0);

            // Reset camera shake parameters and camera position
            cameraShake.active = false;
            cameraShake.duration = 0;
            camera.position.set(0, 3, 5);
            camera.lookAt(0, 0, 0);
            cameraShake.originalPosition.copy(camera.position);
            cameraShake.originalRotation.copy(camera.rotation);

            gameActive = true;
            gamePaused = false; // Ensure game is not paused
            car.position.set(LANE_POSITIONS[1], 0, 3); // Reset car to middle lane
            currentLane = 1;
            lastObstacleSpawnTime = Date.now(); // Reset obstacle spawn timer
            lastSideElementSpawnTime = Date.now(); // Reset side element spawn timer

            // Ensure Tone.js context is started and background music plays if not muted
            Tone.start().then(() => {
                if (!isMuted) {
                    backgroundMusic.mute = false;
                }
            });

            // Reset badges on new game
            resetBadges();

            // Reset player stats
            playerStats.health = playerStats.maxHealth;
            playerStats.boost = 0; // Start with empty boost - player needs to earn it
            playerStats.speed = 0;

            // Reset boost state
            boostActive = false;
            boostInvincible = false;

            achievementStartTime = Date.now();

            animate(); // Start the game loop
        }

        /**
         * Ends the game, shows game over overlay, and updates high score.
         */
        function endGame() {
            gameActive = false;
            cancelAnimationFrame(animationFrameId); // Stop the animation loop
            crashSynth.triggerAttackRelease("8n"); // Play crash sound
            backgroundMusic.mute = true; // Mute background music

            // Update high score
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('carRacingHighScore', highScore);
            }

            finalScoreDisplay.textContent = score;
            finalHighScoreDisplay.textContent = highScore;
            updateHighScoreDisplay(); // Update display for current session
            gameOverOverlay.classList.remove('hidden');
            // Camera shake effect on collision
            shakeCamera(0.2, 0.05, 500); // Intensity, duration, frames

            playerStats.health = 0;
            updateProgressBars();
        }

        /**
         * Updates the score display on the UI.
         */
        function updateScoreDisplay() {
            scoreDisplay.textContent = `Điểm: ${score}`;
        }

        /**
         * Updates the high score display on the UI.
         */
        function updateHighScoreDisplay() {
            highScoreDisplay.textContent = `Điểm cao: ${highScore}`;
        }

        /**
         * Updates the difficulty display on the UI.
         */
        function updateDifficultyDisplay() {
            difficultyDisplay.textContent = `Độ khó: ${difficultyLevel}`;
        }

        function updateWeatherDisplay() {
            const rainText = weatherState.rainIntensity > 0 ? 'Có mưa' : 'Quang đãng';
            const fogText = weatherState.fogDensity > 0 ? ', Sương mù' : '';
            weatherDisplay.textContent = `Thời tiết: ${TIME_LABELS[weatherState.timeOfDay]} - ${rainText}${fogText}`;
        }

        function applyTimeOfDaySettings(time) {
            const configs = {
                sunrise: { sky: 0xFFCF9F, light: 0xFFE4B5, intensity: 0.7 },
                day: { sky: 0x7ED6DF, light: 0xFFFFFF, intensity: 1 },
                sunset: { sky: 0xF2994A, light: 0xFFD27F, intensity: 0.6 },
                night: { sky: 0x001D3D, light: 0xAAAAFF, intensity: 0.3 }
            };
            const cfg = configs[time];
            skybox.material.color.setHex(cfg.sky);
            directionalLight.color.setHex(cfg.light);
            directionalLight.intensity = cfg.intensity;
        }

        function initRain() {
            const count = 500;
            rainGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                positions[i * 3] = (Math.random() - 0.5) * 20;
                positions[i * 3 + 1] = Math.random() * 20 + 5;
                positions[i * 3 + 2] = -Math.random() * 60;
            }
            rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const material = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.1, transparent: true });
            rainSystem = new THREE.Points(rainGeometry, material);
            scene.add(rainSystem);
        }

        function updateRain() {
            if (!rainSystem) return;
            rainSystem.visible = weatherState.rainIntensity > 0;
            if (weatherState.rainIntensity <= 0) return;
            const positions = rainGeometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] -= 0.2 * weatherState.rainIntensity;
                if (positions[i + 1] < 0) {
                    positions[i + 1] = Math.random() * 20 + 5;
                }
            }
            rainGeometry.attributes.position.needsUpdate = true;
        }

        function updateFog() {
            if (weatherState.fogDensity <= 0) {
                scene.fog = null;
                return;
            }
            const far = 80 - weatherState.fogDensity * 50;
            scene.fog = new THREE.Fog(0xaaaaaa, 10, far);
        }

        function cycleWeather() {
            currentTimeIndex = (currentTimeIndex + 1) % TIME_OF_DAY_SEQUENCE.length;
            weatherState.timeOfDay = TIME_OF_DAY_SEQUENCE[currentTimeIndex];
            weatherState.rainIntensity = Math.random() < 0.5 ? 0 : Math.random();
            weatherState.fogDensity = Math.random() < 0.5 ? 0 : Math.random();
            applyTimeOfDaySettings(weatherState.timeOfDay);
            updateFog();
            updateWeatherDisplay();
        }

        /**
         * Changes the environment based on the provided level.
         * Loads new road textures and resets side objects.
         * @param {number} level - Environment level index.
         */
        function changeEnvironment(level) {
            if (isTransitioning) return; // prevent overlapping transitions

            currentEnvironmentIndex = level % environmentConfigs.length;
            currentEnvironment = environmentConfigs[currentEnvironmentIndex];

            // Clear existing side objects
            sideElements.forEach(el => scene.remove(el));
            sideElements = [];

            const tex = preloadedRoadTextures[currentEnvironmentIndex];
            if (tex) {
                startRoadTransition(tex);
            } else {
                textureLoader.load(currentEnvironment.roadTexture, startRoadTransition);
            }
        }

        /**
         * Begins a fade transition between the current road texture and a new one.
         * @param {THREE.Texture} texture - The texture for the new road surface.
         */
        function startRoadTransition(texture) {
            const newMaterial = new THREE.MeshLambertMaterial({
                map: texture,
                transparent: true,
                opacity: 0
            });
            if (newMaterial.map) {
                newMaterial.map.wrapS = newMaterial.map.wrapT = THREE.RepeatWrapping;
                newMaterial.map.repeat.set(1, 10);
                newMaterial.map.needsUpdate = true;
                newMaterial.map.offset.set(0, 0);
            }
            const newRoad = new THREE.Mesh(road.geometry.clone(), newMaterial);
            newRoad.rotation.copy(road.rotation);
            newRoad.position.copy(road.position);
            scene.add(newRoad);
            transitionRoad = newRoad;
            fadeStartTime = Date.now();
            isTransitioning = true;
        }


        let lastObstacleSpawnTime = 0;
        let lastSideElementSpawnTime = 0; // For spawning trees etc.
        const SIDE_ELEMENT_INTERVAL = 1500; // Interval for spawning side elements
        let particles = []; // Array to store active particles

        /**
         * Creates different types of obstacles.
         * @returns {THREE.Mesh} A mesh representing an obstacle.
         */
        function createObstacle() {
            let obstacleGeometry;
            const obstacleType = Math.floor(Math.random() * 3); // 0: Box, 1: Cone, 2: Cylinder
            const obstacleColor = new THREE.Color(Math.random() * 0xffffff);
            const obstacleMaterial = new THREE.MeshPhongMaterial({ color: obstacleColor });

            switch (obstacleType) {
                case 0: // Box
                    obstacleGeometry = new THREE.BoxGeometry(OBSTACLE_BASE_SIZE, OBSTACLE_BASE_SIZE, OBSTACLE_BASE_SIZE);
                    break;
                case 1: // Cone
                    obstacleGeometry = new THREE.ConeGeometry(OBSTACLE_BASE_SIZE * 0.6, OBSTACLE_BASE_SIZE * 1.2, 8);
                    break;
                case 2: // Cylinder
                    obstacleGeometry = new THREE.CylinderGeometry(OBSTACLE_BASE_SIZE * 0.5, OBSTACLE_BASE_SIZE * 0.5, OBSTACLE_BASE_SIZE, 16);
                    break;
            }

            const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);

            // Spawn obstacle in a random lane
            const randomLaneIndex = Math.floor(Math.random() * NUM_LANES);
            obstacle.position.x = LANE_POSITIONS[randomLaneIndex];
            obstacle.position.y = obstacleGeometry.parameters.height ? obstacleGeometry.parameters.height / 2 : OBSTACLE_BASE_SIZE / 2; // Position correctly on the road
            obstacle.position.z = -50; // Far in the distance

            scene.add(obstacle);
            obstacles.push(obstacle);
        }

        /**
         * Creates and adds collision particles to the scene.
         * @param {THREE.Vector3} position - The position where particles should appear.
         */
        function createCollisionParticles(position) {
            const particleCount = 50;
            const geometry = new THREE.BufferGeometry();
            const positions = [];
            const colors = [];
            const color = new THREE.Color(0xFFFFFF); // White particles

            for (let i = 0; i < particleCount; i++) {
                // Random position around the collision point
                positions.push(position.x + (Math.random() - 0.5) * 2);
                positions.push(position.y + (Math.random() - 0.5) * 2);
                positions.push(position.z + (Math.random() - 0.5) * 2);

                colors.push(color.r, color.g, color.b);
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: 0.2,
                vertexColors: true,
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending,
                sizeAttenuation: true
            });

            const particleSystem = new THREE.Points(geometry, material);
            scene.add(particleSystem);
            particles.push({ system: particleSystem, life: 60 }); // life in frames
        }

        /**
         * Updates active particles (moves them and fades them out).
         */
        function updateParticles() {
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.system.material.opacity -= 0.02; // Fade out
                p.system.position.y += 0.05; // Move up
                p.system.scale.multiplyScalar(1.02); // Grow
                p.life--;

                if (p.life <= 0 || p.system.material.opacity <= 0) {
                    scene.remove(p.system);
                    particles.splice(i, 1);
                }
            }
        }

        let cameraShake = {
            active: false,
            intensity: 0,
            duration: 0,
            originalPosition: new THREE.Vector3(),
            originalRotation: new THREE.Euler()
        };

        /**
         * Initiates a camera shake effect.
         * @param {number} intensity - How much the camera shakes.
         * @param {number} duration - How long the shake lasts (in frames).
         * @param {number} shakeLength - Total frames for the shake to occur over.
         */
        function shakeCamera(intensity, rotationIntensity, shakeLength) {
            cameraShake.active = true;
            cameraShake.intensity = intensity;
            cameraShake.rotationIntensity = rotationIntensity;
            cameraShake.duration = shakeLength;
            cameraShake.originalPosition.copy(camera.position);
            cameraShake.originalRotation.copy(camera.rotation);
        }

        /**
         * Updates the camera shake effect.
         */
        function updateCameraShake() {
            if (!cameraShake.active) return;

            const remainingDuration = cameraShake.duration;
            const progress = (cameraShake.duration - remainingDuration) / cameraShake.duration; // 0 to 1

            // Gradually reduce intensity
            const currentIntensity = cameraShake.intensity * (1 - progress);
            const currentRotationIntensity = cameraShake.rotationIntensity * (1 - progress);

            // Apply random offsets
            camera.position.x = cameraShake.originalPosition.x + (Math.random() * 2 - 1) * currentIntensity;
            camera.position.y = cameraShake.originalPosition.y + (Math.random() * 2 - 1) * currentIntensity;
            camera.position.z = cameraShake.originalPosition.z + (Math.random() * 2 - 1) * currentIntensity;

            camera.rotation.x = cameraShake.originalRotation.x + (Math.random() * 2 - 1) * currentRotationIntensity;
            camera.rotation.y = cameraShake.originalRotation.y + (Math.random() * 2 - 1) * currentRotationIntensity;
            camera.rotation.z = cameraShake.originalRotation.z + (Math.random() * 2 - 1) * currentRotationIntensity;

            cameraShake.duration--;

            if (cameraShake.duration <= 0) {
                cameraShake.active = false;
                camera.position.copy(cameraShake.originalPosition); // Reset to original position
                camera.rotation.copy(cameraShake.originalRotation); // Reset to original rotation
            }
        }


        /**
         * --- HUD & Achievement System ---
         * Progress bar state
         */
        let playerStats = {
            speed: 0,
            maxSpeed: 100,
            health: 100,
            maxHealth: 100,
            boost: 50,
            maxBoost: 100
        };

        /**
         * Achievement system state
         */
        let achievements = [
            { id: 'score10', name: 'Điểm 10!', desc: 'Đạt 10 điểm', unlocked: false, badge: '🏅' },
            { id: 'score50', name: 'Điểm 50!', desc: 'Đạt 50 điểm', unlocked: false, badge: '🥇' },
            { id: 'score100', name: 'Điểm 100!', desc: 'Đạt 100 điểm', unlocked: false, badge: '🏆' },
            { id: 'survivor', name: 'Sinh tồn', desc: 'Không va chạm 60s', unlocked: false, badge: '🛡️' }
        ];
        let achievementTimeout = null;
        let achievementStartTime = null;

        let boostActive = false;
        let boostDuration = 4000; // ms
        let boostStartTime = null;
        let boostInvincible = false;
        let boostInitialSpeed = null;
        let boostCooldownTime = null; // Track when boost was last used
        const BOOST_SPEED_MULTIPLIER = 1.7;
        const BOOST_COOLDOWN_DURATION = 3000; // 3 seconds cooldown after boost ends

        /**
         * Updates the progress bars on the HUD.
         */
        function updateProgressBars() {
            // Animate width for boost bar
            const boostBar = document.getElementById('boost-bar-inner');
            const boostReadyNotification = document.getElementById('boost-ready-notification');
            const boostPercent = (playerStats.boost/playerStats.maxBoost)*100;

            if (boostBar) {
                boostBar.style.width = `${boostPercent}%`;

                // Check if boost is ready (full boost AND not in cooldown)
                const isBoostReady = boostPercent >= 100 && !boostActive &&
                    (boostCooldownTime === null || Date.now() - boostCooldownTime >= BOOST_COOLDOWN_DURATION);

                // Boost full effect
                if (isBoostReady) {
                    boostBar.classList.add('full');
                    // Show boost ready notification
                    if (boostReadyNotification) {
                        boostReadyNotification.classList.remove('hidden');
                        boostReadyNotification.classList.add('show');
                    }
                } else {
                    boostBar.classList.remove('full');
                    // Hide boost ready notification
                    if (boostReadyNotification) {
                        boostReadyNotification.classList.add('hidden');
                        boostReadyNotification.classList.remove('show');
                    }
                }
            }
        }

        function activateBoost() {
            // Check if boost is ready (full boost AND not in cooldown)
            if (playerStats.boost < playerStats.maxBoost) return;
            if (boostCooldownTime !== null && Date.now() - boostCooldownTime < BOOST_COOLDOWN_DURATION) return;

            boostActive = true;
            boostStartTime = Date.now();
            boostInvincible = true;
            boostInitialSpeed = currentRoadSpeed;
            currentRoadSpeed = boostInitialSpeed * BOOST_SPEED_MULTIPLIER;

            // Enhanced visual and audio feedback
            const timerBar = document.getElementById('boost-timer-bar');
            const readyNotification = document.getElementById('boost-ready-notification');

            // Show timer bar with smooth animation
            timerBar.classList.remove('hidden');
            timerBar.classList.add('show');

            // Hide ready notification immediately
            readyNotification.classList.remove('show');
            readyNotification.classList.add('hidden');

            // Enhanced car glow effect
            if (car && car.children) {
                car.traverse(obj => {
                    if (obj.material) {
                        obj.material.emissive = new THREE.Color(0xffff66);
                        obj.material.emissiveIntensity = 0.5;
                    }
                });
            }

            // Play boost activation sound
            if (scoreSynth) {
                scoreSynth.triggerAttackRelease("E5", "8n");
                setTimeout(() => scoreSynth.triggerAttackRelease("A5", "8n"), 100);
            }

            // Screen flash effect for boost activation
            const canvas = renderer.domElement;
            canvas.style.filter = 'brightness(1.3) saturate(1.5)';
            setTimeout(() => {
                canvas.style.filter = '';
            }, 200);
        }

        function endBoost() {
            boostActive = false;
            boostInvincible = false;
            playerStats.boost = 0; // Reset boost to 0 after use
            boostCooldownTime = Date.now(); // Record when boost ended for cooldown tracking

            // Enhanced visual feedback for boost end
            const timerBar = document.getElementById('boost-timer-bar');
            timerBar.classList.remove('show');
            timerBar.classList.add('hidden');

            // Remove invincible effect with smooth transition
            if (car && car.children) {
                car.traverse(obj => {
                    if (obj.material) {
                        obj.material.emissive = new THREE.Color(0x000000);
                        obj.material.emissiveIntensity = 0;
                    }
                });
            }

            // Gradually return speed to normal (smoother transition)
            const speedDeclineInterval = setInterval(() => {
                if (currentRoadSpeed > boostInitialSpeed) {
                    currentRoadSpeed = Math.max(boostInitialSpeed, currentRoadSpeed - 0.01);
                } else {
                    clearInterval(speedDeclineInterval);
                    currentRoadSpeed = boostInitialSpeed;
                }
            }, 50);

            // Play boost end sound
            if (scoreSynth) {
                scoreSynth.triggerAttackRelease("C4", "16n");
            }
        }

        /**
         * Render minimap showing car position and obstacles
         */
        function renderMinimap() {
            const canvas = document.getElementById('minimap-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw background
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw lanes
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 3; i++) {
                const x = (i / 3) * canvas.width;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }

            // Draw car (bottom center)
            const carX = (currentLane / (NUM_LANES - 1)) * canvas.width;
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(carX - 3, canvas.height - 10, 6, 8);

            // Draw obstacles
            ctx.fillStyle = '#ff0000';
            obstacles.forEach(obstacle => {
                if (obstacle.position.z < 0 && obstacle.position.z > -30) {
                    const obstacleX = ((obstacle.position.x + LANE_WIDTH) / (LANE_WIDTH * 2)) * canvas.width;
                    const obstacleY = ((30 + obstacle.position.z) / 30) * canvas.height;
                    ctx.fillRect(obstacleX - 2, obstacleY - 2, 4, 4);
                }
            });
        }

        /**
         * Unlock an achievement and show notification with enhanced effects
         */
        function unlockAchievement(id) {
            const achievement = achievements.find(a => a.id === id);
            if (!achievement || achievement.unlocked) return;

            achievement.unlocked = true;

            // Enhanced popup notification with sound
            const popup = document.getElementById('achievement-popup');
            popup.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">${achievement.badge}</div>
                <div style="font-weight: bold; font-size: 1.1rem;">${achievement.name}</div>
                <div style="font-size: 0.9rem; opacity: 0.8;">${achievement.desc}</div>
            `;
            popup.classList.remove('hidden');
            popup.classList.add('show', 'achievement-earned');

            // Add badge to collection with enhanced animation
            const badge = document.createElement('div');
            badge.className = 'badge achievement-earned';
            badge.innerHTML = `${achievement.badge} ${achievement.name}`;
            badge.style.animationDelay = '0.2s';
            document.getElementById('badge-collection').appendChild(badge);

            // Play achievement sound (higher pitch for positive feedback)
            if (scoreSynth) {
                scoreSynth.triggerAttackRelease("G5", "16n");
                setTimeout(() => scoreSynth.triggerAttackRelease("C6", "16n"), 100);
            }

            // Hide popup after 4 seconds (longer for better readability)
            setTimeout(() => {
                popup.classList.remove('show', 'achievement-earned');
                setTimeout(() => popup.classList.add('hidden'), 400);
            }, 4000);
        }

        /**
         * Reset all achievements for new game
         */
        function resetBadges() {
            achievements.forEach(achievement => achievement.unlocked = false);
            document.getElementById('badge-collection').innerHTML = '';
        }

        function animate() {
            if (!gameActive && !gamePaused) {
                // Continue rendering even when game is not active (for start screen)
                renderer.render(scene, camera);
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

            animationFrameId = requestAnimationFrame(animate);

            if (gameActive && !gamePaused) {
                // Car movement
                // Smoothly interpolate car to target lane position
                car.position.x += (LANE_POSITIONS[currentLane] - car.position.x) * LANE_CHANGE_SPEED;

                // Car tilting animation based on horizontal movement
                const targetRotationZ = (LANE_POSITIONS[currentLane] - car.position.x) * 0.1; // More tilt when further from target lane
                car.rotation.z += (targetRotationZ - car.rotation.z) * 0.1; // Smooth interpolation

                // Road texture scrolling
                if (road.material.map) {
                    road.material.map.offset.y += currentRoadSpeed * 0.02;
                }
                if (transitionRoad && transitionRoad.material.map) {
                    transitionRoad.material.map.offset.y -= currentRoadSpeed * 0.02;
                }

                if (isTransitioning && transitionRoad) {
                    const elapsed = Date.now() - fadeStartTime;
                    const progress = Math.min(elapsed / FADE_DURATION, 1);
                    transitionRoad.material.opacity = progress;
                    road.material.opacity = 1 - progress;
                    if (progress >= 1) {
                        scene.remove(road);
                        road = transitionRoad;
                        transitionRoad = null;
                        isTransitioning = false;
                    }
                }

                // Road markings movement
                for (let i = roadMarkings.length - 1; i >= 0; i--) {
                    const marking = roadMarkings[i];
                    marking.position.z += currentRoadSpeed * 0.2; // Đồng bộ tốc độ với texture mặt đường
                    if (marking.position.z > camera.position.z + 5) { // Reset when off-screen
                        marking.position.z = -50;
                    }
                }

                // Side elements spawning
                const currentTime = Date.now();
                if (currentTime - lastSideElementSpawnTime > SIDE_ELEMENT_INTERVAL) {
                    if (currentEnvironment.sideObject === 'building') {
                        const bLeft = createBuilding(-7 + Math.random() * 0.5);
                        const bRight = createBuilding(7 - Math.random() * 0.5);
                        scene.add(bLeft);
                        scene.add(bRight);
                        sideElements.push(bLeft, bRight);
                    } else {
                        const treeLeft = createTree(-7 + Math.random() * 0.5);
                        const treeRight = createTree(7 - Math.random() * 0.5);
                        scene.add(treeLeft);
                        scene.add(treeRight);
                        sideElements.push(treeLeft, treeRight);
                    }
                    lastSideElementSpawnTime = currentTime;
                }

                // Side elements movement
                for (let i = sideElements.length - 1; i >= 0; i--) {
                    const element = sideElements[i];
                    element.position.z += currentRoadSpeed;
                    if (element.position.z > camera.position.z + 5) {
                        scene.remove(element);
                        sideElements.splice(i, 1);
                    }
                }

                // Obstacle generation
                if (currentTime - lastObstacleSpawnTime > currentObstacleInterval) {
                    createObstacle();
                    lastObstacleSpawnTime = currentTime;
                }

                // Obstacle movement and collision detection
                for (let i = obstacles.length - 1; i >= 0; i--) {
                    const obstacle = obstacles[i];
                    obstacle.position.z += currentRoadSpeed; // Move towards camera

                    // Check if obstacle is off-screen
                    if (obstacle.position.z > camera.position.z + 2) {
                        scene.remove(obstacle);
                        obstacles.splice(i, 1);
                        score++; // Increase score when obstacle is passed
                        updateScoreDisplay();
                        scoreSynth.triggerAttackRelease("C5", "32n"); // Play score sound

                        // Boost regeneration - only when successfully avoiding obstacles
                        if (!boostActive && playerStats.boost < playerStats.maxBoost) {
                            playerStats.boost = Math.min(playerStats.maxBoost, playerStats.boost + 2); // +2 boost per obstacle avoided
                        }

                        // Increase difficulty every 10 points
                        if (score % 10 === 0 && score > 0) {
                            difficultyLevel++;
                            updateDifficultyDisplay();
                            currentRoadSpeed *= 1.05; // Increase speed by 5%
                            currentObstacleInterval = Math.max(200, currentObstacleInterval * 0.95); // Decrease interval by 5%, minimum 200ms
                            Tone.Transport.bpm.value += 5; // Slightly increase music tempo
                        }

                        if (!isTransitioning && score - lastEnvChangeScore >= ENV_CHANGE_SCORE) {
                            lastEnvChangeScore = score;
                            changeEnvironment(currentEnvironmentIndex + 1);
                        }

                        if (score - lastWeatherChangeScore >= WEATHER_CHANGE_SCORE) {
                            lastWeatherChangeScore = score;
                            cycleWeather();
                        }
                    } else {
                        // Simple AABB collision detection
                        // Get world bounding boxes for collision
                        const carBox = new THREE.Box3().setFromObject(car);
                        const obstacleBox = new THREE.Box3().setFromObject(obstacle);

                        if (carBox.intersectsBox(obstacleBox)) {
                            if (boostInvincible) {
                                // Enhanced invincible collision effect
                                createCollisionParticles(obstacle.position);
                                // Remove the obstacle and add extra score for invincible collision
                                scene.remove(obstacle);
                                obstacles.splice(i, 1);
                                score += 2; // Bonus points for destroying obstacle while invincible
                                updateScoreDisplay();
                                // Play special invincible collision sound
                                if (scoreSynth) {
                                    scoreSynth.triggerAttackRelease("F#5", "32n");
                                }
                                continue;
                            } else {
                                createCollisionParticles(car.position); // Create particles at collision point
                                endGame(); // Game over on collision
                                break; // Exit loop immediately after game over
                            }
                        }
                    }
                }

                updateParticles(); // Update collision particles
                updateCameraShake(); // Update camera shake effect
                updateRain();

                // --- HUD updates ---
                // Simulate speed for demo
                playerStats.speed = Math.min(100, Math.floor(currentRoadSpeed * 20));
                // Boost regeneration moved to obstacle avoidance logic for better balance
                updateProgressBars();
                renderMinimap();

                        // Achievement: score milestones with better timing
                        if (score === 10) unlockAchievement('score10');
                        if (score === 50) unlockAchievement('score50');
                        if (score === 100) unlockAchievement('score100');

                        // Achievement: survive 60s (check every 10 points for performance)
                        if (score % 10 === 0 && !achievements.find(a=>a.id==='survivor').unlocked) {
                            if (!achievementStartTime) achievementStartTime = Date.now();
                            else if (Date.now() - achievementStartTime > 60000) unlockAchievement('survivor');
                        }

                if (boostActive) {
                    const elapsed = Date.now() - boostStartTime;
                    // Update timer bar
                    const percent = Math.max(0, 1 - elapsed/boostDuration);
                    document.getElementById('boost-timer-inner').style.width = (percent*100)+"%";
                    // Gradually reduce speed
                    currentRoadSpeed = boostInitialSpeed + (BOOST_SPEED_MULTIPLIER-1)*boostInitialSpeed*percent;
                    // End boost if time's up
                    if (elapsed >= boostDuration) {
                        endBoost();
                    }
                }
            }
            renderer.render(scene, camera);
        }

        // Initialize Three.js on window load
        window.onload = function () {
            init();

            // Ensure help overlay can be closed - additional safeguard
            const helpOverlay = document.getElementById('help-overlay');
            const closeHelpButton = document.getElementById('close-help-button');

            if (helpOverlay && closeHelpButton) {
                // Additional event listener as backup
                closeHelpButton.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    helpOverlay.classList.add('hidden');
                    console.log('Help overlay closed via backup handler');
                    return false;
                };

                // Also allow clicking outside the help content to close
                helpOverlay.addEventListener('click', function(e) {
                    if (e.target === helpOverlay) {
                        helpOverlay.classList.add('hidden');
                        console.log('Help overlay closed by clicking outside');
                    }
                });
            }

            // Start the animation loop immediately to show the start screen
            animate();
        };
