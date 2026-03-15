// ============================================
// Three.js Audio-Reactive Background + 3D Musical Notes
// ============================================

let scene, camera, renderer, particles, analyserNode, dataArray;
let mouseX = 0, mouseY = 0;
let audioCtx, sourceConnected = false;
let clock;
let musicalNotes = [];
let lyricsActive = false;
let noteSpawnTimer = 0;

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
    scene.fog = new THREE.FogExp2(0x080c1a, 0.0006);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.z = 800;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    createParticles();
    createNebula();

    window.addEventListener('resize', onResize);
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    animate();
}

function createNoteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 128, 128);

    // Draw a music note (♪) shape with glow
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Note head — filled ellipse at bottom-left
    ctx.beginPath();
    ctx.ellipse(42, 92, 16, 12, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Stem — vertical line going up from the right side of the head
    ctx.beginPath();
    ctx.moveTo(56, 88);
    ctx.lineTo(56, 24);
    ctx.stroke();

    // Flag — curved line from top of stem
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(56, 24);
    ctx.bezierCurveTo(80, 30, 82, 52, 62, 62);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function createBeamedNoteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 128, 128);

    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    // Two note heads
    ctx.beginPath();
    ctx.ellipse(30, 96, 14, 10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(82, 88, 14, 10, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Two stems
    ctx.beginPath();
    ctx.moveTo(42, 92);
    ctx.lineTo(42, 28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(94, 84);
    ctx.lineTo(94, 20);
    ctx.stroke();

    // Beam connecting tops
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(42, 28);
    ctx.lineTo(94, 20);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function createParticleSystem(count, texture, size) {
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
        size: size,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        map: texture,
        alphaTest: 0.01,
    });

    return new THREE.Points(geometry, material);
}

let particles2; // second note system

function createParticles() {
    const noteTex = createNoteTexture();
    const beamTex = createBeamedNoteTexture();

    // Single notes — majority
    particles = createParticleSystem(575, noteTex, 18);
    scene.add(particles);

    // Beamed double notes — fewer, slightly larger
    particles2 = createParticleSystem(385, beamTex, 22);
    scene.add(particles2);
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

    // Note head (flattened sphere)
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

    // Stem
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

    // Flag (curved shape using a bent plane)
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
    // Double beamed note (two note heads connected)
    const group = new THREE.Group();
    const color = PALETTE_ARR[Math.floor(Math.random() * PALETTE_ARR.length)];
    const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    // Two note heads
    for (let x of [-10, 10]) {
        const headGeom = new THREE.SphereGeometry(7, 10, 6);
        headGeom.scale(1.3, 1, 0.8);
        const head = new THREE.Mesh(headGeom, mat.clone());
        head.position.set(x, 0, 0);
        head.rotation.z = -0.3;
        group.add(head);

        // Stems
        const stemGeom = new THREE.CylinderGeometry(1, 1, 30, 4);
        const stem = new THREE.Mesh(stemGeom, mat.clone());
        stem.position.set(x + 8, 15, 0);
        group.add(stem);
    }

    // Beam connecting tops
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

    // Spawn from edges or scattered
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

    // Velocity toward center-ish with drift
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

        // Move
        note.position.add(ud.velocity);

        // Float wobble
        note.position.y += Math.sin(time * 2 + ud.floatPhase) * 0.3;
        note.position.x += Math.cos(time * 1.5 + ud.floatPhase) * 0.2;

        // Rotate
        note.rotation.x += ud.rotSpeed.x;
        note.rotation.y += ud.rotSpeed.y;
        note.rotation.z += ud.rotSpeed.z;

        // Audio reactivity — pulse scale
        if (energy > 0.2) {
            const pulse = 1 + energy * 0.3 * Math.sin(time * 8);
            note.scale.setScalar(note.scale.x * (0.99 + pulse * 0.01));
        }

        // Fade out near end of life
        const fadeStart = ud.maxLife * 0.7;
        if (ud.life > fadeStart) {
            const fade = 1 - (ud.life - fadeStart) / (ud.maxLife - fadeStart);
            note.traverse(child => {
                if (child.material) child.material.opacity = fade * 0.5;
            });
        }

        // Remove dead notes
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
        // Spawn initial burst
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

        // Use effect chain if available, otherwise direct connection
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

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    const energy = getAudioEnergy();
    const bass = getBassEnergy();

    // Camera target: hand > head pose > mouse (priority order)
    let camTargetX = mouseX;
    let camTargetY = mouseY;
    const handPos = (typeof getHandPositionForThreeJS === 'function') ? getHandPositionForThreeJS() : null;
    if (handPos) {
        camTargetX = handPos.x;
        camTargetY = handPos.y;
    } else if (typeof faceGeometry !== 'undefined' && faceGeometry.headPose) {
        // Head pose as camera fallback when no hand is tracking
        camTargetX = faceGeometry.headPose.yaw * 0.6;
        camTargetY = faceGeometry.headPose.pitch * -0.4;
    }
    camera.position.x += (camTargetX * 100 - camera.position.x) * 0.02;
    camera.position.y += (-camTargetY * 60 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    // Helper to animate a particle system
    function animateParticleSystem(ps, baseSize, rotYSpeed) {
        if (!ps) return;
        const positions = ps.geometry.attributes.position.array;
        const velocities = ps.geometry.userData.velocities;
        const colors = ps.geometry.attributes.color.array;
        const count = positions.length / 3;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            positions[i3] += velocities[i3] + Math.sin(time * 0.5 + i) * 0.1;
            positions[i3 + 1] += velocities[i3 + 1] + Math.cos(time * 0.3 + i) * 0.1;
            positions[i3 + 2] += velocities[i3 + 2];

            if (bass > 0.1) {
                const dx = positions[i3];
                const dy = positions[i3 + 1];
                const dz = positions[i3 + 2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > 0) {
                    positions[i3] += (dx / dist) * bass * 3;
                    positions[i3 + 1] += (dy / dist) * bass * 3;
                    positions[i3 + 2] += (dz / dist) * bass * 2;
                }
            }

            const bound = 1200;
            if (Math.abs(positions[i3]) > bound) positions[i3] *= -0.5;
            if (Math.abs(positions[i3 + 1]) > bound) positions[i3 + 1] *= -0.5;
            if (Math.abs(positions[i3 + 2]) > bound) positions[i3 + 2] *= -0.5;
        }
        ps.geometry.attributes.position.needsUpdate = true;

        ps.material.opacity = 0.4 + energy * 0.5;
        ps.material.size = baseSize + energy * 8;

        ps.rotation.y += rotYSpeed + energy * 0.002;
        ps.rotation.x += 0.0002;

        // Emotion-driven particle tinting
        if (typeof faceGeometry !== 'undefined' && faceGeometry.currentLandmarks) {
            const emotionColor = faceGeometry.getCurrentColor();
            const tintCount = Math.floor(count * 0.1);
            const offset = Math.floor(Math.random() * (count - tintCount));
            for (let i = offset; i < offset + tintCount; i++) {
                const i3 = i * 3;
                colors[i3] += (emotionColor.r - colors[i3]) * 0.02;
                colors[i3 + 1] += (emotionColor.g - colors[i3 + 1]) * 0.02;
                colors[i3 + 2] += (emotionColor.b - colors[i3 + 2]) * 0.02;
            }
            ps.geometry.attributes.color.needsUpdate = true;
        }

        // Hand-driven particle attraction
        if (handPos) {
            const hx = handPos.x * 400;
            const hy = handPos.y * 300;
            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                const dx = hx - positions[i3];
                const dy = hy - positions[i3 + 1];
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 300 && dist > 10) {
                    const force = 0.8 / (dist * 0.1);
                    positions[i3] += (dx / dist) * force;
                    positions[i3 + 1] += (dy / dist) * force;
                }
            }
        }

        // Effect-driven visual modifications
        const fxValues = (typeof getEffectValues === 'function') ? getEffectValues() : null;
        if (fxValues) {
            if (fxValues.filterFreq < 15000) {
                const filterIntensity = 1 - fxValues.filterFreq / 20000;
                for (let i = 0; i < Math.min(100, count); i++) {
                    const i3 = i * 3;
                    colors[i3] *= (1 - filterIntensity * 0.3);
                    colors[i3 + 2] = Math.min(1, colors[i3 + 2] + filterIntensity * 0.02);
                }
                ps.geometry.attributes.color.needsUpdate = true;
            }
            if (fxValues.distortionAmount > 5) {
                const chaos = fxValues.distortionAmount / 100;
                for (let i = 0; i < count; i++) {
                    const i3 = i * 3;
                    velocities[i3] += (Math.random() - 0.5) * chaos * 0.5;
                    velocities[i3 + 1] += (Math.random() - 0.5) * chaos * 0.5;
                }
            }
        }
    }

    // Animate both note particle systems
    animateParticleSystem(particles, 18, 0.0005);
    animateParticleSystem(particles2, 22, -0.0003);

    // Spawn musical notes during lyrics playback
    noteSpawnTimer++;
    if (lyricsActive) {
        const spawnRate = energy > 0.3 ? 15 : 40; // faster spawning with more energy
        if (noteSpawnTimer % spawnRate === 0) {
            spawnMusicalNote(energy > 0.3);
        }
    } else {
        // Occasional ambient notes even when not playing
        if (noteSpawnTimer % 120 === 0 && musicalNotes.length < 5) {
            spawnMusicalNote(false);
        }
    }

    updateMusicalNotes(time, energy);

    renderer.render(scene, camera);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Init on load
initBackground();
