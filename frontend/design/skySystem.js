// ============================================
// Sky System — Stars, sun/moon cycle, shooting
// stars, and clouds built from glyph atlas
// ============================================

// --- Constants ---

const SKY_COLS = 200;
const SKY_ROWS = 50;
const SKY_TOTAL = SKY_COLS * SKY_ROWS;
const SKY_SPACING_X = 16;
const SKY_SPACING_Y = 12;
const SKY_Y_OFFSET = 120;       // base Y above terrain
const SKY_Z_BASE = -200;        // push sky slightly back
const SKY_DENSITY = 0.35;       // ~35% of cells get a visible star

// Sun / Moon arc
const SUN_COUNT = 18;
const MOON_COUNT = 10;
const CELESTIAL_ARC_RADIUS_X = 1200;
const CELESTIAL_ARC_RADIUS_Y = 450;
const SUN_WARM_RADIUS = 250;    // world-space radius for warming nearby stars

// Shooting stars
const SHOOTING_STAR_POINTS = 7;
const SHOOTING_STAR_LIFE = 60;  // frames
const SHOOTING_STAR_MIN_INTERVAL = 8;  // seconds
const SHOOTING_STAR_MAX_INTERVAL = 20;

// Clouds
const CLOUD_COUNT = 4;
const CLOUD_MAX_CHARS = 10;     // max chars per cloud cluster
const CLOUD_DRIFT_SPEED = 0.3;  // world units per frame

// Palette (matching landscapeGrid.js TERRAIN_COLORS)
const SKY_COLORS = {
    teal:     { r: 50/255,  g: 235/255, b: 210/255 },
    rose:     { r: 255/255, g: 120/255, b: 195/255 },
    coral:    { r: 255/255, g: 120/255, b: 140/255 },
    amber:    { r: 255/255, g: 200/255, b: 40/255  },
    lavender: { r: 180/255, g: 150/255, b: 255/255 },
    white:    { r: 0.9,     g: 0.9,     b: 0.95    },
    dimWhite: { r: 0.55,    g: 0.55,    b: 0.65    },
};

// --- Sky Star Field Shaders ---

const SKY_VERTEX_SHADER = `
    attribute float aGlyphIndex;
    attribute float aOpacity;
    attribute float aBaseOpacity;

    uniform float uAtlasWidth;
    uniform float uTime;
    uniform float uDayTime;
    uniform float uAudioEnergy;

    // Sun/moon positions for proximity warming (computed on CPU, passed as uniforms)
    uniform vec3 uSunPos;
    uniform float uSunActive;   // 1.0 when sun visible, 0.0 at night

    varying vec2 vUvOffset;
    varying vec2 vUvScale;
    varying vec3 vColor;
    varying float vOpacity;

    void main() {
        float col = aGlyphIndex;
        vUvOffset = vec2(col / uAtlasWidth, 0.0);
        vUvScale = vec2(1.0 / uAtlasWidth, 1.0);

        vColor = color;
        vOpacity = aOpacity;

        vec3 pos = position;

        // Twinkle: subtle size/opacity variation
        float twinkle = sin(uTime * 3.0 + pos.x * 0.1 + pos.y * 0.15) * 0.5 + 0.5;

        // Audio energy: mid/high energy makes stars twinkle faster & brighter
        float energyBoost = uAudioEnergy * 0.4;
        twinkle = mix(twinkle, 1.0, energyBoost);

        vOpacity *= (0.7 + twinkle * 0.3);

        // Sun warming: shift color toward amber when sun is nearby
        if (uSunActive > 0.5) {
            float distToSun = distance(pos, uSunPos);
            float warmth = smoothstep(${SUN_WARM_RADIUS.toFixed(1)}, 0.0, distToSun) * uSunActive;
            // Warm = shift toward amber
            vColor = mix(vColor, vec3(${SKY_COLORS.amber.r.toFixed(3)}, ${SKY_COLORS.amber.g.toFixed(3)}, ${SKY_COLORS.amber.b.toFixed(3)}), warmth * 0.6);
            vOpacity += warmth * 0.3;
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float baseSize = 32.0 + energyBoost * 12.0;
        gl_PointSize = baseSize * (400.0 / -mvPosition.z);
        gl_PointSize = max(gl_PointSize, 2.0);
    }
`;

const SKY_FRAGMENT_SHADER = `
    uniform sampler2D uAtlas;

    varying vec2 vUvOffset;
    varying vec2 vUvScale;
    varying vec3 vColor;
    varying float vOpacity;

    void main() {
        vec2 uv = vUvOffset + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y) * vUvScale;
        vec4 texel = texture2D(uAtlas, uv);
        if (texel.a < 0.05) discard;
        vec3 glowColor = vColor * texel.rgb * 1.3;
        gl_FragColor = vec4(glowColor, texel.a * vOpacity);
    }
`;

// --- Simple celestial body shader (same atlas approach) ---

const CELESTIAL_VERTEX_SHADER = `
    attribute float aGlyphIndex;
    attribute float aOpacity;

    uniform float uAtlasWidth;
    uniform float uTime;

    varying vec2 vUvOffset;
    varying vec2 vUvScale;
    varying vec3 vColor;
    varying float vOpacity;

    void main() {
        float col = aGlyphIndex;
        vUvOffset = vec2(col / uAtlasWidth, 0.0);
        vUvScale = vec2(1.0 / uAtlasWidth, 1.0);

        vColor = color;
        vOpacity = aOpacity;

        // Gentle pulse
        float pulse = sin(uTime * 2.0 + position.x * 0.5) * 0.15 + 1.0;
        vOpacity *= pulse;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float baseSize = 50.0;
        gl_PointSize = baseSize * (400.0 / -mvPosition.z);
        gl_PointSize = max(gl_PointSize, 4.0);
    }
`;

// Reuse SKY_FRAGMENT_SHADER for celestial bodies

// --- Shooting star shader (rapid fade trail) ---

const SHOOTING_VERTEX_SHADER = `
    attribute float aGlyphIndex;
    attribute float aOpacity;

    uniform float uAtlasWidth;

    varying vec2 vUvOffset;
    varying vec2 vUvScale;
    varying vec3 vColor;
    varying float vOpacity;

    void main() {
        float col = aGlyphIndex;
        vUvOffset = vec2(col / uAtlasWidth, 0.0);
        vUvScale = vec2(1.0 / uAtlasWidth, 1.0);

        vColor = color;
        vOpacity = aOpacity;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        gl_PointSize = 18.0 * (300.0 / -mvPosition.z);
        gl_PointSize = max(gl_PointSize, 1.5);
    }
`;

// --- Helper: pick random sky glyph index ---

function _skyGlyphIndex(uvMap) {
    const names = getGlyphsForSky();
    const name = names[Math.floor(Math.random() * names.length)];
    return uvMap[name].index;
}

function _cloudGlyphIndex(uvMap) {
    const names = getGlyphsForClouds();
    const name = names[Math.floor(Math.random() * names.length)];
    return uvMap[name].index;
}

// --- Helper: celestial arc position ---
// dayTime 0..1, where 0.25 = sunrise (left horizon), 0.5 = noon (top), 0.75 = sunset (right)

function _sunArcPos(dayTime) {
    // Sun visible roughly dayTime 0.2 to 0.8
    // Angle: map [0.2, 0.8] to [PI, 0] (left to right arc)
    const t = (dayTime - 0.2) / 0.6; // 0 at sunrise, 1 at sunset
    const angle = Math.PI * (1 - t);
    return {
        x: Math.cos(angle) * CELESTIAL_ARC_RADIUS_X,
        y: Math.sin(angle) * CELESTIAL_ARC_RADIUS_Y + SKY_Y_OFFSET,
        z: SKY_Z_BASE - 50
    };
}

function _moonArcPos(dayTime) {
    // Moon visible roughly dayTime 0.7 to 1.0 and 0.0 to 0.3 (wraps around midnight)
    // Normalize to a 0..1 range for the moon's own arc
    let t;
    if (dayTime >= 0.7) {
        t = (dayTime - 0.7) / 0.6; // 0.7->0 to 1.0->0.5
    } else {
        t = (dayTime + 0.3) / 0.6; // 0.0->0.5 to 0.3->1.0
    }
    t = Math.min(1, Math.max(0, t));
    const angle = Math.PI * (1 - t);
    return {
        x: Math.cos(angle) * CELESTIAL_ARC_RADIUS_X * 0.8,
        y: Math.sin(angle) * CELESTIAL_ARC_RADIUS_Y * 0.7 + SKY_Y_OFFSET,
        z: SKY_Z_BASE - 30
    };
}

// --- Build Star Field ---

function _createStarField(texture, uvMap, atlasWidth) {
    const positions = new Float32Array(SKY_TOTAL * 3);
    const colors = new Float32Array(SKY_TOTAL * 3);
    const glyphIndices = new Float32Array(SKY_TOTAL);
    const opacities = new Float32Array(SKY_TOTAL);
    const baseOpacities = new Float32Array(SKY_TOTAL);

    const halfWidth = (SKY_COLS * SKY_SPACING_X) / 2;

    for (let row = 0; row < SKY_ROWS; row++) {
        for (let col = 0; col < SKY_COLS; col++) {
            const idx = row * SKY_COLS + col;
            const i3 = idx * 3;

            const x = col * SKY_SPACING_X - halfWidth + (Math.random() - 0.5) * SKY_SPACING_X * 0.6;
            const y = SKY_Y_OFFSET + row * SKY_SPACING_Y + (Math.random() - 0.5) * SKY_SPACING_Y * 0.4;
            const z = SKY_Z_BASE - row * 4 + (Math.random() - 0.5) * 20;

            positions[i3]     = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = z;

            glyphIndices[idx] = _skyGlyphIndex(uvMap);

            // Sparse: only ~35% visible
            const visible = Math.random() < SKY_DENSITY;
            const baseOp = visible ? (0.35 + Math.random() * 0.5) : 0;
            opacities[idx] = baseOp;
            baseOpacities[idx] = baseOp;

            // Default night-ish color: dim white / lavender mix
            const useLav = Math.random() < 0.3;
            const c = useLav ? SKY_COLORS.lavender : SKY_COLORS.white;
            colors[i3]     = c.r;
            colors[i3 + 1] = c.g;
            colors[i3 + 2] = c.b;
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aGlyphIndex', new THREE.BufferAttribute(glyphIndices, 1));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute('aBaseOpacity', new THREE.BufferAttribute(baseOpacities, 1));

    const uniforms = {
        uAtlas:       { value: texture },
        uAtlasWidth:  { value: atlasWidth },
        uTime:        { value: 0 },
        uDayTime:     { value: 0 },
        uAudioEnergy: { value: 0 },
        uSunPos:      { value: new THREE.Vector3(0, 300, SKY_Z_BASE) },
        uSunActive:   { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: SKY_FRAGMENT_SHADER,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.userData.uniforms = uniforms;
    points.userData.baseOpacities = baseOpacities;
    return points;
}

// --- Build Celestial Body (Sun or Moon) ---

function _createCelestialBody(texture, uvMap, atlasWidth, count, glyphNames, colorA, colorB) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const glyphIndices = new Float32Array(count);
    const opacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        // Tight cluster around origin; will be repositioned each frame
        positions[i3]     = (Math.random() - 0.5) * 30;
        positions[i3 + 1] = (Math.random() - 0.5) * 30;
        positions[i3 + 2] = (Math.random() - 0.5) * 10;

        const name = glyphNames[Math.floor(Math.random() * glyphNames.length)];
        glyphIndices[i] = uvMap[name].index;

        const t = Math.random();
        colors[i3]     = colorA.r + (colorB.r - colorA.r) * t;
        colors[i3 + 1] = colorA.g + (colorB.g - colorA.g) * t;
        colors[i3 + 2] = colorA.b + (colorB.b - colorA.b) * t;

        // Core points brighter, edge points dimmer
        const distFromCenter = Math.sqrt(
            positions[i3] * positions[i3] + positions[i3 + 1] * positions[i3 + 1]
        );
        opacities[i] = Math.max(0.4, 1.0 - distFromCenter / 20);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aGlyphIndex', new THREE.BufferAttribute(glyphIndices, 1));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

    const uniforms = {
        uAtlas:      { value: texture },
        uAtlasWidth: { value: atlasWidth },
        uTime:       { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: CELESTIAL_VERTEX_SHADER,
        fragmentShader: SKY_FRAGMENT_SHADER,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.userData.uniforms = uniforms;
    return points;
}

// --- Shooting Stars ---

let _shootingStars = [];
let _nextShootingStarTime = 0;

function _createShootingStarMesh(texture, uvMap, atlasWidth) {
    const count = SHOOTING_STAR_POINTS;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const glyphIndices = new Float32Array(count);
    const opacities = new Float32Array(count);

    const glyphs = ['star4', 'asterisk', 'dot', 'dot', 'dot', 'dot', 'dot'];
    const useRose = Math.random() < 0.5;
    const baseColor = useRose ? SKY_COLORS.rose : SKY_COLORS.lavender;

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        positions[i3] = 0;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = 0;

        const gn = glyphs[Math.min(i, glyphs.length - 1)];
        glyphIndices[i] = uvMap[gn].index;

        colors[i3]     = baseColor.r;
        colors[i3 + 1] = baseColor.g;
        colors[i3 + 2] = baseColor.b;

        // Head bright, trail fades
        opacities[i] = Math.max(0.1, 1.0 - i / count);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aGlyphIndex', new THREE.BufferAttribute(glyphIndices, 1));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

    const uniforms = {
        uAtlas:      { value: texture },
        uAtlasWidth: { value: atlasWidth },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: SHOOTING_VERTEX_SHADER,
        fragmentShader: SKY_FRAGMENT_SHADER,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    return new THREE.Points(geometry, material);
}

function _spawnShootingStar(group, texture, uvMap, atlasWidth) {
    const mesh = _createShootingStarMesh(texture, uvMap, atlasWidth);

    // Random start position in upper sky
    const halfW = (SKY_COLS * SKY_SPACING_X) / 2;
    const startX = (Math.random() - 0.3) * halfW * 1.5;
    const startY = SKY_Y_OFFSET + SKY_ROWS * SKY_SPACING_Y * (0.4 + Math.random() * 0.5);
    const startZ = SKY_Z_BASE - Math.random() * 80;

    // Diagonal velocity (mostly horizontal + downward)
    const dirX = (Math.random() < 0.5 ? 1 : -1) * (8 + Math.random() * 6);
    const dirY = -(2 + Math.random() * 3);

    const starData = {
        mesh,
        life: 0,
        maxLife: SHOOTING_STAR_LIFE,
        startX, startY, startZ,
        dirX, dirY,
        trailSpacing: 12,
    };

    group.add(mesh);
    _shootingStars.push(starData);
}

function _updateShootingStars(group) {
    for (let i = _shootingStars.length - 1; i >= 0; i--) {
        const s = _shootingStars[i];
        s.life++;

        const positions = s.mesh.geometry.attributes.position.array;
        const opacities = s.mesh.geometry.attributes.aOpacity.array;

        // Position each trail point behind the head
        for (let p = 0; p < SHOOTING_STAR_POINTS; p++) {
            const age = s.life - p * 2; // stagger trail
            const p3 = p * 3;
            positions[p3]     = s.startX + s.dirX * Math.max(0, age);
            positions[p3 + 1] = s.startY + s.dirY * Math.max(0, age);
            positions[p3 + 2] = s.startZ;

            // Fade: head bright, trail fades, overall fades near end of life
            const trailFade = Math.max(0, 1.0 - p / SHOOTING_STAR_POINTS);
            const lifeFade = s.life > s.maxLife * 0.6
                ? 1.0 - (s.life - s.maxLife * 0.6) / (s.maxLife * 0.4)
                : 1.0;
            opacities[p] = trailFade * lifeFade * 0.9;
        }

        s.mesh.geometry.attributes.position.needsUpdate = true;
        s.mesh.geometry.attributes.aOpacity.needsUpdate = true;

        // Remove when dead
        if (s.life >= s.maxLife) {
            group.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
            _shootingStars.splice(i, 1);
        }
    }
}

// --- Clouds ---

function _createCloudCluster(texture, uvMap, atlasWidth) {
    // Each cloud is a small cluster of 4-10 glyph points
    const count = 4 + Math.floor(Math.random() * (CLOUD_MAX_CHARS - 4));
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const glyphIndices = new Float32Array(count);
    const opacities = new Float32Array(count);

    const halfW = (SKY_COLS * SKY_SPACING_X) / 2;

    // Cloud shape: roughly elliptical cluster
    const cx = (Math.random() - 0.5) * halfW * 2;
    const cy = SKY_Y_OFFSET + 80 + Math.random() * 200;
    const cz = SKY_Z_BASE - 20 - Math.random() * 60;

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        // Spread horizontally more than vertically
        positions[i3]     = cx + (Math.random() - 0.5) * 60;
        positions[i3 + 1] = cy + (Math.random() - 0.5) * 20;
        positions[i3 + 2] = cz + (Math.random() - 0.5) * 10;

        glyphIndices[i] = _cloudGlyphIndex(uvMap);

        // Soft white
        colors[i3]     = 0.8;
        colors[i3 + 1] = 0.8;
        colors[i3 + 2] = 0.85;

        opacities[i] = 0.08 + Math.random() * 0.1; // very subtle
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aGlyphIndex', new THREE.BufferAttribute(glyphIndices, 1));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

    const uniforms = {
        uAtlas:      { value: texture },
        uAtlasWidth: { value: atlasWidth },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: SHOOTING_VERTEX_SHADER, // simple, no special effects
        fragmentShader: SKY_FRAGMENT_SHADER,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.userData.driftDir = Math.random() < 0.5 ? 1 : -1;
    points.userData.baseOpacities = Array.from(opacities);
    return points;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Create the complete sky system.
 *
 * @param {{ texture: THREE.CanvasTexture, uvMap: Object }} glyphAtlas
 * @returns {THREE.Group} Group containing all sky elements.
 *   .userData.uniforms — shared uniform refs { uDayTime, uTime }
 *   .userData.update(time, dayTime, audioEnergy) — call each frame
 */
function createSkySystem(glyphAtlas) {
    const { texture, uvMap } = glyphAtlas;
    const atlasWidth = getGlyphCount();
    const group = new THREE.Group();

    // 1. Star field
    const stars = _createStarField(texture, uvMap, atlasWidth);
    group.add(stars);

    // 2. Sun
    const sun = _createCelestialBody(
        texture, uvMap, atlasWidth, SUN_COUNT,
        ['star4', 'asterisk'],
        SKY_COLORS.amber, SKY_COLORS.coral
    );
    group.add(sun);

    // 3. Moon
    const moon = _createCelestialBody(
        texture, uvMap, atlasWidth, MOON_COUNT,
        ['dot', 'star4'],
        SKY_COLORS.lavender, SKY_COLORS.teal
    );
    group.add(moon);

    // 4. Clouds
    const clouds = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
        const cloud = _createCloudCluster(texture, uvMap, atlasWidth);
        group.add(cloud);
        clouds.push(cloud);
    }

    // Shared state
    _shootingStars = [];
    _nextShootingStarTime = SHOOTING_STAR_MIN_INTERVAL + Math.random() * 5;

    // --- Per-frame update function ---

    function update(time, dayTime, audioEnergy) {
        // Determine sun/moon visibility
        const sunVisible = dayTime > 0.15 && dayTime < 0.85;
        const moonVisible = dayTime < 0.25 || dayTime > 0.75;
        const isNight = dayTime < 0.2 || dayTime > 0.8;

        // -- Sun position --
        const sunPos = _sunArcPos(dayTime);
        sun.position.set(sunPos.x, sunPos.y, sunPos.z);
        sun.visible = sunVisible;

        // Fade sun near horizon
        const sunAltitude = sunVisible
            ? Math.sin(Math.max(0, Math.min(1, (dayTime - 0.2) / 0.6)) * Math.PI)
            : 0;
        sun.traverse(child => {
            if (child.material && child.material.uniforms) {
                child.material.uniforms.uTime.value = time;
            }
        });
        // Scale sun opacity by altitude
        const sunOpacities = sun.geometry.attributes.aOpacity;
        for (let i = 0; i < SUN_COUNT; i++) {
            const baseOp = Math.max(0.4, 1.0 - Math.sqrt(
                sun.geometry.attributes.position.array[i * 3] ** 2 +
                sun.geometry.attributes.position.array[i * 3 + 1] ** 2
            ) / 20);
            sunOpacities.array[i] = baseOp * sunAltitude;
        }
        sunOpacities.needsUpdate = true;

        // -- Moon position --
        const moonPos = _moonArcPos(dayTime);
        moon.position.set(moonPos.x, moonPos.y, moonPos.z);
        moon.visible = moonVisible;

        const moonAltFrac = moonVisible
            ? (dayTime >= 0.7
                ? Math.sin(((dayTime - 0.7) / 0.6) * Math.PI)
                : Math.sin(((dayTime + 0.3) / 0.6) * Math.PI))
            : 0;
        moon.traverse(child => {
            if (child.material && child.material.uniforms) {
                child.material.uniforms.uTime.value = time;
            }
        });
        const moonOpacities = moon.geometry.attributes.aOpacity;
        for (let i = 0; i < MOON_COUNT; i++) {
            const baseOp = Math.max(0.3, 1.0 - Math.sqrt(
                moon.geometry.attributes.position.array[i * 3] ** 2 +
                moon.geometry.attributes.position.array[i * 3 + 1] ** 2
            ) / 20);
            moonOpacities.array[i] = baseOp * Math.max(0, moonAltFrac);
        }
        moonOpacities.needsUpdate = true;

        // -- Star field uniforms --
        const starUniforms = stars.userData.uniforms;
        starUniforms.uTime.value = time;
        starUniforms.uDayTime.value = dayTime;
        starUniforms.uAudioEnergy.value = audioEnergy;
        starUniforms.uSunPos.value.set(sunPos.x, sunPos.y, sunPos.z);
        starUniforms.uSunActive.value = sunVisible ? sunAltitude : 0;

        // Day/night star brightness: stars dim during day, bright at night
        const starOpacities = stars.geometry.attributes.aOpacity;
        const baseOps = stars.userData.baseOpacities;
        // dayBrightness: 0 at noon, 1 at night
        const dayBrightness = 1.0 - Math.sin(Math.min(1, Math.max(0, (dayTime - 0.15) / 0.7)) * Math.PI);
        for (let i = 0; i < SKY_TOTAL; i++) {
            starOpacities.array[i] = baseOps[i] * (0.05 + dayBrightness * 0.95);
        }
        starOpacities.needsUpdate = true;

        // -- Clouds: drift horizontally, visible during day only --
        const cloudOpacityMult = sunVisible ? (0.6 + sunAltitude * 0.4) : 0;
        for (const cloud of clouds) {
            // Drift
            cloud.position.x += CLOUD_DRIFT_SPEED * cloud.userData.driftDir;

            // Wrap around
            const halfW = (SKY_COLS * SKY_SPACING_X) / 2;
            if (cloud.position.x > halfW + 100) cloud.position.x = -halfW - 100;
            if (cloud.position.x < -halfW - 100) cloud.position.x = halfW + 100;

            // Opacity: visible during day
            const cloudOps = cloud.geometry.attributes.aOpacity;
            const cloudBase = cloud.userData.baseOpacities;
            for (let i = 0; i < cloudOps.count; i++) {
                cloudOps.array[i] = cloudBase[i] * cloudOpacityMult;
            }
            cloudOps.needsUpdate = true;
        }

        // -- Shooting stars: spawn at night --
        if (isNight) {
            _nextShootingStarTime -= 1 / 60; // assume ~60fps
            if (_nextShootingStarTime <= 0) {
                _spawnShootingStar(group, texture, uvMap, atlasWidth);
                _nextShootingStarTime = SHOOTING_STAR_MIN_INTERVAL +
                    Math.random() * (SHOOTING_STAR_MAX_INTERVAL - SHOOTING_STAR_MIN_INTERVAL);
            }
        }
        _updateShootingStars(group);
    }

    // Store references
    group.userData.update = update;
    group.userData.stars = stars;
    group.userData.sun = sun;
    group.userData.moon = moon;
    group.userData.clouds = clouds;
    group.userData.spawnShootingStar = function() {
        _spawnShootingStar(group, texture, uvMap, atlasWidth);
    };

    return group;
}
