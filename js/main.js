        // Import necessary components from Three.js
        import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

        let scene, camera, renderer, car, road, obstacles = [];
        let roadMarkings = []; // Array to store road marking segments
        let sideElements = []; // Array to store trees and other side elements
        let ambientLight, directionalLight, skybox;
        let rainSystem, rainGeometry;

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
        const countdownDisplay = document.getElementById('countdown-display'); // New countdown display
        const weatherDisplay = document.getElementById('weather-display');
        const weatherToggleButton = document.getElementById('weather-toggle');

        // Game parameters
        const INITIAL_CAR_SPEED = 0.05; // Car's horizontal movement speed
        const INITIAL_ROAD_SPEED = 0.5; // Speed at which the road and obstacles move towards the camera
        const INITIAL_OBSTACLE_INTERVAL = 1000; // Milliseconds between obstacle spawns
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

        // Mouse for camera rotation (optional, for viewing the scene)
        let isMouseDown = false;
        let mouseX = 0;
        let mouseY = 0;

        // Audio setup
        let scoreSynth, crashSynth, backgroundMusic;
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

        let currentEnvironmentIndex = 0;
        let currentEnvironment = environmentConfigs[currentEnvironmentIndex];
        const textureLoader = new THREE.TextureLoader();
        let lastEnvChangeScore = 0;
        const ENV_CHANGE_SCORE = 20;

        /**
         * Initializes audio context and synths.
         */
        function initAudio() {
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
            }).toDestination();

            // Synth for crash sound (noise)
            crashSynth = new Tone.NoiseSynth().toDestination();

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
            const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x606060 }); // Grey color for road
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
            weatherToggleButton.addEventListener('click', cycleWeather);

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


            // Mouse camera control
            renderer.domElement.addEventListener('mousedown', (e) => {
                isMouseDown = true;
                mouseX = e.clientX;
                mouseY = e.clientY;
            });
            renderer.domElement.addEventListener('mouseup', () => {
                isMouseDown = false;
            });
            renderer.domElement.addEventListener('mousemove', (e) => {
                if (isMouseDown) {
                    const deltaX = e.clientX - mouseX;
                    const deltaY = e.clientY - mouseY;
                    mouseX = e.clientX;
                    mouseY = e.clientY;

                    // Rotate camera around the scene
                    const rotationSpeed = 0.01;
                    camera.rotation.y -= deltaX * rotationSpeed;
                    camera.rotation.x -= deltaY * rotationSpeed;
                    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x)); // Clamp vertical rotation
                }
            });
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
            currentEnvironmentIndex = level % environmentConfigs.length;
            currentEnvironment = environmentConfigs[currentEnvironmentIndex];

            // Clear existing side objects
            sideElements.forEach(el => scene.remove(el));
            sideElements = [];

            // Apply road texture
            textureLoader.load(currentEnvironment.roadTexture, texture => {
                road.material.map = texture;
                road.material.needsUpdate = true;
            });
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
         * Main animation loop for the game.
         */
        function animate() {
            animationFrameId = requestAnimationFrame(animate);

            if (gameActive && !gamePaused) {
                // Car movement
                // Smoothly interpolate car to target lane position
                car.position.x += (LANE_POSITIONS[currentLane] - car.position.x) * LANE_CHANGE_SPEED;

                // Car tilting animation based on horizontal movement
                const targetRotationZ = (LANE_POSITIONS[currentLane] - car.position.x) * 0.1; // More tilt when further from target lane
                car.rotation.z += (targetRotationZ - car.rotation.z) * 0.1; // Smooth interpolation

                // Road movement (visual effect)
                road.position.z += currentRoadSpeed;
                if (road.position.z > 0) {
                    road.position.z = -40; // Reset road position to create continuous scrolling
                }

                // Road markings movement
                for (let i = roadMarkings.length - 1; i >= 0; i--) {
                    const marking = roadMarkings[i];
                    marking.position.z += currentRoadSpeed;
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

                        // Increase difficulty every 10 points
                        if (score % 10 === 0 && score > 0) {
                            difficultyLevel++;
                            updateDifficultyDisplay();
                            currentRoadSpeed *= 1.05; // Increase speed by 5%
                            currentObstacleInterval = Math.max(200, currentObstacleInterval * 0.95); // Decrease interval by 5%, minimum 200ms
                            Tone.Transport.bpm.value += 5; // Slightly increase music tempo
                        }

                if (score - lastEnvChangeScore >= ENV_CHANGE_SCORE) {
                    lastEnvChangeScore = score;
                    changeEnvironment(currentEnvironmentIndex + 1);
                }

                if (score - lastWeatherChangeScore >= WEATHER_CHANGE_SCORE) {
                    lastWeatherChangeScore = score;
                    cycleWeather();
                }
            }

            // Simple AABB collision detection
                    // Get world bounding boxes for collision
                    const carBox = new THREE.Box3().setFromObject(car);
                    const obstacleBox = new THREE.Box3().setFromObject(obstacle);

                    if (carBox.intersectsBox(obstacleBox)) {
                        createCollisionParticles(car.position); // Create particles at collision point
                        endGame(); // Game over on collision
                        break; // Exit loop immediately after game over
                    }
                }

                updateParticles(); // Update collision particles
                updateCameraShake(); // Update camera shake effect
                updateRain();
            }
            renderer.render(scene, camera);
        }

        // Initialize Three.js on window load
        window.onload = function () {
            init();
            // Start the initial render to show the start screen
            renderer.render(scene, camera);
        };
