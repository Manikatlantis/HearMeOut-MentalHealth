// ============================================
// Three.js Audio-Reactive Background + Musical Landscape
// ============================================

let scene, camera, renderer, particles, analyserNode, dataArray;
let mouseX = 0, mouseY = 0;
let audioCtx, sourceConnected = false;
let clock;
let musicalNotes = [];
let fireballs = [];
let lyricsActive = false;
let noteSpawnTimer = 0;

// New landscape systems
let landscapeGrid = null;
let skySystem = null;
let dayNightCycle = null;
let glyphAtlas = null;
let fireflies = [];

// Cinematic camera path state
let _camBaseZ = 600;        // starting Z (matches camera.position.z init)
let _camForwardSpeed = 3.0; // units per frame forward into -Z
let _lookAroundAngle = 0;   // current horizontal look offset in radians
let _lookAroundTarget = 0;  // target angle for sweeps
let _lookAroundTimer = 15;  // countdown to next look-around (first one after 15s)
let _lookAroundPhase = 0;   // 0=idle, 1=sweeping out, 2=holding, 3=sweeping back
let _lookAroundHoldTimer = 0;
let _lookAroundSweepT = 0;  // 0..1 progress of current sweep

function _cinematicSmoothstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
}

// Aurora palette colors
const PALETTE = {
    rose:     new THREE.Color(0xf472b6),
    amber:    new THREE.Color(0xfbbf24),
    teal:     new THREE.Color(0x2dd4bf),
    coral:    new THREE.Color(0xfb7185),
    lavender: new THREE.Color(0xa78bfa),
};
const PALETTE_ARR = Object.values(PALETTE);

function initBackground() {
    const canvas = document.getElementById('bgCanvas');
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080c1a, 0.0003);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 4000);
    camera.position.z = 600;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Old particle field — hidden but kept for potential fallback
    createParticles();
    if (particles) particles.material.opacity = 0;
    createNebula();

    // --- New landscape systems ---
    try {
        glyphAtlas = buildGlyphAtlas();

        // Landscape terrain grid
        landscapeGrid = createLandscapeGrid(glyphAtlas);
        landscapeGrid.position.set(0, -200, 0);
        scene.add(landscapeGrid);

        // Sky system (stars, sun, moon, clouds, shooting stars)
        skySystem = createSkySystem(glyphAtlas);
        scene.add(skySystem);

        // Day/night cycle controller
        dayNightCycle = createDayNightCycle();

        // Firefly notes above terrain
        _spawnFireflies(100);
    } catch (e) {
        console.warn('Landscape system init failed, falling back to particles:', e);
        if (particles) particles.material.opacity = 0.6;
    }

    window.addEventListener('resize', onResize);
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    animate();
}

// --- Firefly Notes (small floating glyph characters above terrain) ---

function _spawnFireflies(count) {
    if (!glyphAtlas) return;
    const { uvMap } = glyphAtlas;
    const skyGlyphs = getGlyphsForSky();
    const elevGlyphs = getGlyphsByElevation();
    const allNames = [...skyGlyphs, ...elevGlyphs.low, ...elevGlyphs.mid];

    for (let i = 0; i < count; i++) {
        const name = allNames[Math.floor(Math.random() * allNames.length)];
        const glyphIdx = uvMap[name].index;

        // Single-point Points mesh
        const positions = new Float32Array([0, 0, 0]);
        const colors = new Float32Array(3);
        const glyphIndices = new Float32Array([glyphIdx]);
        const opacities = new Float32Array([0.5 + Math.random() * 0.2]);

        const col = PALETTE_ARR[Math.floor(Math.random() * PALETTE_ARR.length)];
        colors[0] = col.r; colors[1] = col.g; colors[2] = col.b;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aGlyphIndex', new THREE.BufferAttribute(glyphIndices, 1));
        geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

        const uniforms = {
            uAtlas:      { value: glyphAtlas.texture },
            uAtlasWidth: { value: getGlyphCount() },
            uTime:       { value: 0 },
        };

        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: `
                attribute float aGlyphIndex;
                attribute float aOpacity;
                uniform float uAtlasWidth;
                uniform float uTime;
                varying vec2 vUvOffset;
                varying vec2 vUvScale;
                varying vec3 vColor;
                varying float vOpacity;
                void main() {
                    vUvOffset = vec2(aGlyphIndex / uAtlasWidth, 0.0);
                    vUvScale = vec2(1.0 / uAtlasWidth, 1.0);
                    vColor = color;
                    vOpacity = aOpacity;
                    float pulse = sin(uTime * 2.0 + position.x * 0.1) * 0.2 + 0.8;
                    vOpacity *= pulse;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    gl_PointSize = 36.0 * (400.0 / -mvPosition.z);
                    gl_PointSize = max(gl_PointSize, 3.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D uAtlas;
                varying vec2 vUvOffset;
                varying vec2 vUvScale;
                varying vec3 vColor;
                varying float vOpacity;
                void main() {
                    vec2 uv = vUvOffset + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y) * vUvScale;
                    vec4 texel = texture2D(uAtlas, uv);
                    if (texel.a < 0.05) discard;
                    vec3 glowColor = vColor * texel.rgb * 1.5;
                    gl_FragColor = vec4(glowColor, texel.a * vOpacity);
                }
            `,
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        const point = new THREE.Points(geometry, material);

        // Random position above terrain (grid is 250*14 = 3500 wide, at y=-200)
        const halfW = 250 * 14 / 2;
        const x = (Math.random() - 0.5) * halfW * 1.2;
        const y = -200 + 40 + Math.random() * 200; // above landscape grid base
        const z = -Math.random() * 600;
        point.position.set(x, y, z);

        point.userData = {
            uniforms,
            baseY: y,
            floatPhase: Math.random() * Math.PI * 2,
            driftX: (Math.random() - 0.5) * 0.15,
            driftZ: (Math.random() - 0.5) * 0.05,
        };

        scene.add(point);
        fireflies.push(point);
    }
}

function _updateFireflies(time) {
    const camZ = camera ? camera.position.z : 0;
    const camX = camera ? camera.position.x : 0;

    for (const ff of fireflies) {
        const ud = ff.userData;
        ud.uniforms.uTime.value = time;
        ff.position.x += ud.driftX;
        ff.position.y = ud.baseY + Math.sin(time * 0.8 + ud.floatPhase) * 12;
        ff.position.z += ud.driftZ;

        // Wrap around camera — keep fireflies in a zone surrounding the viewer
        const halfW = 900;
        const halfD = 400;
        if (ff.position.x > camX + halfW) ff.position.x = camX - halfW;
        if (ff.position.x < camX - halfW) ff.position.x = camX + halfW;
        if (ff.position.z > camZ + 100) ff.position.z = camZ - halfD;
        if (ff.position.z < camZ - halfD) ff.position.z = camZ + 50;
    }
}

// --- Old particle field (hidden, kept for fallback) ---

function createParticles() {
    const count = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 400 + Math.random() * 800;

        positions[i3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = r * Math.cos(phi);

        velocities[i3] = (Math.random() - 0.5) * 0.3;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.3;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;

        const col = PALETTE_ARR[Math.floor(Math.random() * PALETTE_ARR.length)];
        colors[i3] = col.r;
        colors[i3 + 1] = col.g;
        colors[i3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData.velocities = velocities;

    const material = new THREE.PointsMaterial({
        size: 2.5,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function createNebula() {
    const cloudGeom = new THREE.PlaneGeometry(700, 700);
    const nebulaColors = [0xf472b6, 0xfbbf24, 0x2dd4bf, 0xa78bfa, 0xfb7185, 0x2dd4bf];

    for (let i = 0; i < 8; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: nebulaColors[i % nebulaColors.length],
            transparent: true,
            opacity: 0.012,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(cloudGeom, mat);
        mesh.position.set(
            (Math.random() - 0.5) * 1200,
            (Math.random() - 0.5) * 700,
            (Math.random() - 0.5) * 800 - 200
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        mesh.scale.set(1 + Math.random(), 1 + Math.random(), 1);
        scene.add(mesh);
    }
}

// ---- 3D Musical Note Geometry ----
function createNoteGeometry() {
    const group = new THREE.Group();

    const headGeom = new THREE.SphereGeometry(8, 12, 8);
    headGeom.scale(1.3, 1, 0.8);
    const color = PALETTE_ARR[Math.floor(Math.random() * PALETTE_ARR.length)];
    const headMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const head = new THREE.Mesh(headGeom, headMat);
    head.rotation.z = -0.3;
    group.add(head);

    const stemGeom = new THREE.CylinderGeometry(1, 1, 35, 4);
    const stemMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.set(9, 17, 0);
    group.add(stem);

    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.quadraticCurveTo(12, -5, 8, -18);
    flagShape.lineTo(6, -16);
    flagShape.quadraticCurveTo(10, -5, 0, -2);
    const flagGeom = new THREE.ShapeGeometry(flagShape);
    const flagMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const flag = new THREE.Mesh(flagGeom, flagMat);
    flag.position.set(9, 34, 0);
    group.add(flag);

    return group;
}

function createBeamNoteGeometry() {
    const group = new THREE.Group();
    const color = PALETTE_ARR[Math.floor(Math.random() * PALETTE_ARR.length)];
    const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    for (let x of [-10, 10]) {
        const headGeom = new THREE.SphereGeometry(7, 10, 6);
        headGeom.scale(1.3, 1, 0.8);
        const head = new THREE.Mesh(headGeom, mat.clone());
        head.position.set(x, 0, 0);
        head.rotation.z = -0.3;
        group.add(head);

        const stemGeom = new THREE.CylinderGeometry(1, 1, 30, 4);
        const stem = new THREE.Mesh(stemGeom, mat.clone());
        stem.position.set(x + 8, 15, 0);
        group.add(stem);
    }

    const beamGeom = new THREE.BoxGeometry(22, 3, 2);
    const beam = new THREE.Mesh(beamGeom, mat.clone());
    beam.position.set(8, 30, 0);
    group.add(beam);

    return group;
}

function spawnMusicalNote(intense) {
    const note = Math.random() > 0.4 ? createNoteGeometry() : createBeamNoteGeometry();
    const scale = 0.6 + Math.random() * 1.2;
    note.scale.set(scale, scale, scale);

    const side = Math.floor(Math.random() * 4);
    const spread = 600;
    if (side === 0) {
        note.position.set(-spread - 100, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 400);
    } else if (side === 1) {
        note.position.set(spread + 100, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 400);
    } else if (side === 2) {
        note.position.set((Math.random() - 0.5) * spread, -spread - 100, (Math.random() - 0.5) * 400);
    } else {
        note.position.set((Math.random() - 0.5) * spread, spread + 100, (Math.random() - 0.5) * 400);
    }

    const target = new THREE.Vector3(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200
    );
    const dir = target.clone().sub(note.position).normalize();
    const speed = intense ? (1.5 + Math.random() * 2) : (0.5 + Math.random() * 1);

    note.userData = {
        velocity: dir.multiplyScalar(speed),
        rotSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 0.03,
            (Math.random() - 0.5) * 0.03,
            (Math.random() - 0.5) * 0.02
        ),
        life: 0,
        maxLife: 300 + Math.random() * 200,
        floatPhase: Math.random() * Math.PI * 2,
    };

    scene.add(note);
    musicalNotes.push(note);
}

function updateMusicalNotes(time, energy) {
    for (let i = musicalNotes.length - 1; i >= 0; i--) {
        const note = musicalNotes[i];
        const ud = note.userData;
        ud.life++;

        note.position.add(ud.velocity);
        note.position.y += Math.sin(time * 2 + ud.floatPhase) * 0.3;
        note.position.x += Math.cos(time * 1.5 + ud.floatPhase) * 0.2;

        note.rotation.x += ud.rotSpeed.x;
        note.rotation.y += ud.rotSpeed.y;
        note.rotation.z += ud.rotSpeed.z;

        if (energy > 0.2) {
            const pulse = 1 + energy * 0.3 * Math.sin(time * 8);
            note.scale.setScalar(note.scale.x * (0.99 + pulse * 0.01));
        }

        const fadeStart = ud.maxLife * 0.7;
        if (ud.life > fadeStart) {
            const fade = 1 - (ud.life - fadeStart) / (ud.maxLife - fadeStart);
            note.traverse(child => {
                if (child.material) child.material.opacity = fade * 0.5;
            });
        }

        if (ud.life > ud.maxLife || note.position.length() > 1500) {
            scene.remove(note);
            musicalNotes.splice(i, 1);
        }
    }
}

// Called from app.js when lyrics overlay shows/hides
function setLyricsActive(active) {
    lyricsActive = active;
    if (active) {
        for (let i = 0; i < 8; i++) {
            setTimeout(() => spawnMusicalNote(true), i * 120);
        }
    }
}

function connectAudioAnalyser(audioElement) {
    if (sourceConnected) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(audioElement);
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;
        dataArray = new Uint8Array(analyserNode.frequencyBinCount);

        if (typeof initEffectChain === 'function') {
            initEffectChain(source, analyserNode, audioCtx);
        } else {
            source.connect(analyserNode);
            analyserNode.connect(audioCtx.destination);
        }
        sourceConnected = true;
    } catch (e) {
        console.warn('Audio analyser failed:', e);
    }
}

function getAudioEnergy() {
    if (!analyserNode || !dataArray) return 0;
    analyserNode.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    return sum / dataArray.length / 255;
}

function getBassEnergy() {
    if (!analyserNode || !dataArray) return 0;
    analyserNode.getByteFrequencyData(dataArray);
    let sum = 0;
    const bassRange = Math.floor(dataArray.length * 0.15);
    for (let i = 0; i < bassRange; i++) sum += dataArray[i];
    return sum / bassRange / 255;
}

// ---- 3D Fireball (DBZ energy ball release) ----

function createFireballGeometry() {
    const group = new THREE.Group();

    const coreGeom = new THREE.SphereGeometry(12, 16, 12);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    group.add(new THREE.Mesh(coreGeom, coreMat));

    const innerGeom = new THREE.SphereGeometry(20, 14, 10);
    const innerMat = new THREE.MeshBasicMaterial({
        color: 0xff8800,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    group.add(new THREE.Mesh(innerGeom, innerMat));

    const outerGeom = new THREE.SphereGeometry(30, 12, 8);
    const outerMat = new THREE.MeshBasicMaterial({
        color: 0xff3300,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    group.add(new THREE.Mesh(outerGeom, outerMat));

    return group;
}

function spawnFireball(normalizedPos) {
    if (!normalizedPos || !scene) return;
    const fb = createFireballGeometry();

    const x = (normalizedPos.x - 0.5) * 800;
    const y = -(normalizedPos.y - 0.5) * 600;
    const z = -200;
    fb.position.set(x, y, z);

    fb.userData = {
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            12 + Math.random() * 6
        ),
        life: 0,
        maxLife: 120,
    };

    scene.add(fb);
    fireballs.push(fb);
}

function updateFireballs(time) {
    for (let i = fireballs.length - 1; i >= 0; i--) {
        const fb = fireballs[i];
        const ud = fb.userData;
        ud.life++;

        fb.position.add(ud.velocity);
        fb.position.x += Math.sin(time * 5 + i) * 0.5;
        fb.position.y += Math.cos(time * 4 + i) * 0.3;

        const pulse = 1 + Math.sin(time * 10) * 0.1;
        fb.scale.setScalar(pulse);

        const fadeStart = ud.maxLife * 0.7;
        if (ud.life > fadeStart) {
            const fade = 1 - (ud.life - fadeStart) / (ud.maxLife - fadeStart);
            fb.traverse(child => {
                if (child.material) child.material.opacity = child.material.opacity * fade;
            });
        }

        if (ud.life > ud.maxLife || fb.position.z > 1200) {
            scene.remove(fb);
            fireballs.splice(i, 1);
        }
    }
}

// ---- Landscape transition tracking ----
let _lastLandscapePreset = 'ROLLING_HILLS';

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const time = clock.getElapsedTime();
    const energy = getAudioEnergy();
    const bass = getBassEnergy();

    // === Cinematic camera base path ===
    // Forward movement (into -Z)
    _camBaseZ -= _camForwardSpeed;

    // Gentle lateral drift (lazy river)
    const camDriftX = Math.sin(time * (2 * Math.PI / 25)) * 80;

    // Vertical bob (floating/breathing)
    const camBobY = Math.sin(time * (2 * Math.PI / 15)) * 30;

    // Altitude variation — hover just above terrain peaks, occasional slight rise
    const altitudeBase = -200 + 30; // terrain base + small offset (skimming)
    const altitudeVariation = Math.sin(time * (2 * Math.PI / 40)) * 30 + 30;
    const camBaseY = altitudeBase + altitudeVariation + camBobY;

    // --- Look-around sweeps (every 20-30 seconds) ---
    if (_lookAroundPhase === 0) {
        _lookAroundTimer -= deltaTime;
        if (_lookAroundTimer <= 0) {
            // Start a new look-around
            _lookAroundTarget = (Math.random() < 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.1); // ~15-20 degrees
            _lookAroundPhase = 1;
            _lookAroundSweepT = 0;
        }
    } else if (_lookAroundPhase === 1) {
        // Sweeping out (5 seconds)
        _lookAroundSweepT += deltaTime / 5.0;
        if (_lookAroundSweepT >= 1) {
            _lookAroundSweepT = 1;
            _lookAroundPhase = 2;
            _lookAroundHoldTimer = 2.0;
        }
        _lookAroundAngle = _lookAroundTarget * _cinematicSmoothstep(_lookAroundSweepT);
    } else if (_lookAroundPhase === 2) {
        // Holding (2 seconds)
        _lookAroundHoldTimer -= deltaTime;
        if (_lookAroundHoldTimer <= 0) {
            _lookAroundPhase = 3;
            _lookAroundSweepT = 0;
        }
    } else if (_lookAroundPhase === 3) {
        // Sweeping back (5 seconds)
        _lookAroundSweepT += deltaTime / 5.0;
        if (_lookAroundSweepT >= 1) {
            _lookAroundSweepT = 1;
            _lookAroundPhase = 0;
            _lookAroundTimer = 20 + Math.random() * 10;
        }
        _lookAroundAngle = _lookAroundTarget * (1 - _cinematicSmoothstep(_lookAroundSweepT));
    }

    // --- Tracking offset (hand > head > mouse) layered on top ---
    let trackOffsetX = mouseX;
    let trackOffsetY = mouseY;
    const handPos = (typeof getHandPositionForThreeJS === 'function') ? getHandPositionForThreeJS() : null;
    if (handPos) {
        trackOffsetX = handPos.x;
        trackOffsetY = handPos.y;
    } else if (typeof faceGeometry !== 'undefined' && faceGeometry.headPose) {
        trackOffsetX = faceGeometry.headPose.yaw * 0.6;
        trackOffsetY = faceGeometry.headPose.pitch * -0.4;
    }

    // Compose final camera position: cinematic base + smoothed tracking offset
    const targetX = camDriftX + trackOffsetX * 80;
    const targetY = camBaseY + (-trackOffsetY * 40);
    const targetZ = _camBaseZ;

    camera.position.x += (targetX - camera.position.x) * 0.03;
    camera.position.y += (targetY - camera.position.y) * 0.03;
    camera.position.z += (targetZ - camera.position.z) * 0.03;

    // Look target: forward + look-around offset
    const lookDistance = 400;
    const lookTarget = new THREE.Vector3(
        camera.position.x + Math.sin(_lookAroundAngle) * lookDistance,
        camera.position.y - 15, // gaze toward horizon level
        camera.position.z - lookDistance
    );
    camera.lookAt(lookTarget);

    // --- Day/night cycle ---
    let dayTime = 0.0;
    if (dayNightCycle) {
        dayTime = dayNightCycle.update(deltaTime);

        // Update scene fog + background color from day/night temperature
        const temp = dayNightCycle.getColorTemperature();
        // Clamp fog color to stay dark — never lighter than #1a1535
        const maxR = 0x1a / 255, maxG = 0x15 / 255, maxB = 0x35 / 255;
        scene.fog.color.setRGB(
            Math.min(temp.r, maxR),
            Math.min(temp.g, maxG),
            Math.min(temp.b, maxB)
        );
        // Always use deep dark base for clear color
        renderer.setClearColor(0x080c1a, 1);
    }

    // --- Landscape terrain ---
    if (landscapeGrid) {
        // Move terrain grid with camera Z so it always surrounds the viewer
        landscapeGrid.position.z = camera.position.z + 100;

        const lu = landscapeGrid.userData.uniforms;
        lu.uTime.value = time;
        lu.uBassEnergy.value = bass;
        lu.uScrollOffset.value = time * 2.0; // gentle horizontal drift

        // Landscape type transitions from day/night cycle
        if (dayNightCycle) {
            const currentPreset = dayNightCycle.getCurrentPresetName();
            if (currentPreset !== _lastLandscapePreset) {
                _lastLandscapePreset = currentPreset;
            }

            // Apply current landscape params for terrain morphing during transitions
            if (dayNightCycle.isTransitioning()) {
                const params = dayNightCycle.getCurrentLandscapeParams();
                regenerateTerrainHeights(
                    landscapeGrid,
                    params.noiseOffsetX * 0.01,
                    params.noiseOffsetY * 0.01,
                    params.noiseFrequency,
                    params.noiseAmplitude,
                    glyphAtlas.uvMap
                );

                // Apply palette bias if present
                if (params.paletteBias) {
                    const colors = landscapeGrid.userData.geometry.attributes.color.array;
                    const count = colors.length / 3;
                    const bias = params.paletteBias;
                    for (let i = 0; i < count; i++) {
                        const i3 = i * 3;
                        colors[i3]     += (bias.r - colors[i3]) * bias.strength * 0.1;
                        colors[i3 + 1] += (bias.g - colors[i3 + 1]) * bias.strength * 0.1;
                        colors[i3 + 2] += (bias.b - colors[i3 + 2]) * bias.strength * 0.1;
                    }
                    landscapeGrid.userData.geometry.attributes.color.needsUpdate = true;
                }
            }
        }

        // Emotion tinting on terrain
        if (typeof faceGeometry !== 'undefined' && faceGeometry.currentLandmarks) {
            const emotionColor = faceGeometry.getCurrentColor();
            const colors = landscapeGrid.userData.geometry.attributes.color.array;
            const count = colors.length / 3;
            const tintCount = Math.floor(count * 0.05);
            const offset = Math.floor(Math.random() * (count - tintCount));
            for (let i = offset; i < offset + tintCount; i++) {
                const i3 = i * 3;
                colors[i3]     += (emotionColor.r - colors[i3]) * 0.015;
                colors[i3 + 1] += (emotionColor.g - colors[i3 + 1]) * 0.015;
                colors[i3 + 2] += (emotionColor.b - colors[i3 + 2]) * 0.015;
            }
            landscapeGrid.userData.geometry.attributes.color.needsUpdate = true;
        }

        // Camera parallax — subtle landscape shift opposite to tracking offset (not cinematic base)
        landscapeGrid.position.x = -trackOffsetX * 8;

        // Gentle Y-axis oscillation — slow perspective shift (not continuous spin)
        landscapeGrid.rotation.y = Math.sin(time * (2 * Math.PI / 60)) * 0.018;
    }

    // --- Sky system ---
    if (skySystem && skySystem.userData.update) {
        skySystem.userData.update(time, dayTime, energy);

        // Emotion tinting on star field
        if (typeof faceGeometry !== 'undefined' && faceGeometry.currentLandmarks && skySystem.userData.stars) {
            const emotionColor = faceGeometry.getCurrentColor();
            const starColors = skySystem.userData.stars.geometry.attributes.color.array;
            const starCount = starColors.length / 3;
            const tintCount = Math.floor(starCount * 0.03);
            const offset = Math.floor(Math.random() * (starCount - tintCount));
            for (let i = offset; i < offset + tintCount; i++) {
                const i3 = i * 3;
                starColors[i3]     += (emotionColor.r - starColors[i3]) * 0.01;
                starColors[i3 + 1] += (emotionColor.g - starColors[i3 + 1]) * 0.01;
                starColors[i3 + 2] += (emotionColor.b - starColors[i3 + 2]) * 0.01;
            }
            skySystem.userData.stars.geometry.attributes.color.needsUpdate = true;
        }

        // Sky follows camera but at reduced rate for natural parallax
        // Stars are "far away" so they move slower than terrain
        skySystem.position.z = camera.position.z + 50;
        skySystem.position.x = camera.position.x * 0.3 - trackOffsetX * 3;
    }

    // --- Fireflies ---
    _updateFireflies(time);

    // --- Old particle system (hidden but still animating for hand attraction) ---
    if (particles && particles.material.opacity > 0) {
        const positions = particles.geometry.attributes.position.array;
        const velocities = particles.geometry.userData.velocities;
        const count = positions.length / 3;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            positions[i3] += velocities[i3] + Math.sin(time * 0.5 + i) * 0.1;
            positions[i3 + 1] += velocities[i3 + 1] + Math.cos(time * 0.3 + i) * 0.1;
            positions[i3 + 2] += velocities[i3 + 2];

            const bound = 1200;
            if (Math.abs(positions[i3]) > bound) positions[i3] *= -0.5;
            if (Math.abs(positions[i3 + 1]) > bound) positions[i3 + 1] *= -0.5;
            if (Math.abs(positions[i3 + 2]) > bound) positions[i3 + 2] *= -0.5;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }

    // Spawn musical notes during lyrics playback
    noteSpawnTimer++;
    if (lyricsActive) {
        const spawnRate = energy > 0.3 ? 15 : 40;
        if (noteSpawnTimer % spawnRate === 0) {
            spawnMusicalNote(energy > 0.3);
        }
    } else {
        if (noteSpawnTimer % 120 === 0 && musicalNotes.length < 5) {
            spawnMusicalNote(false);
        }
    }

    updateMusicalNotes(time, energy);

    // DBZ fireball system
    if (typeof consumeFireballRelease === 'function') {
        const releasePos = consumeFireballRelease();
        if (releasePos) {
            spawnFireball(releasePos);
        }
    }
    updateFireballs(time);

    renderer.render(scene, camera);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Init on load
initBackground();
