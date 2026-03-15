// ============================================
// Landscape Grid — Procedural terrain of musical
// characters using THREE.Points + custom shaders
// ============================================

// --- Inline 2D Simplex Noise (compact, no dependencies) ---
// Based on Stefan Gustavson's simplex noise implementation

const _noiseGrad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
];
const _noisePerm = new Uint8Array(512);
const _noisePermMod12 = new Uint8Array(512);

(function _initNoisePerm() {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle with fixed seed for determinism
    let seed = 42;
    for (let i = 255; i > 0; i--) {
        seed = (seed * 16807 + 0) % 2147483647;
        const j = seed % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
        _noisePerm[i] = p[i & 255];
        _noisePermMod12[i] = _noisePerm[i] % 12;
    }
})();

function simplex2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;

    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
        t0 *= t0;
        const gi0 = _noisePermMod12[ii + _noisePerm[jj]];
        n0 = t0 * t0 * (_noiseGrad3[gi0][0] * x0 + _noiseGrad3[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
        t1 *= t1;
        const gi1 = _noisePermMod12[ii + i1 + _noisePerm[jj + j1]];
        n1 = t1 * t1 * (_noiseGrad3[gi1][0] * x1 + _noiseGrad3[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
        t2 *= t2;
        const gi2 = _noisePermMod12[ii + 1 + _noisePerm[jj + 1]];
        n2 = t2 * t2 * (_noiseGrad3[gi2][0] * x2 + _noiseGrad3[gi2][1] * y2);
    }

    // Result in [-1, 1]
    return 70.0 * (n0 + n1 + n2);
}

/**
 * Fractal Brownian Motion — layer multiple octaves of simplex noise.
 */
function fbm2D(x, y, octaves, lacunarity, gain) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
        value += amplitude * simplex2D(x * frequency, y * frequency);
        maxAmp += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return value / maxAmp; // normalize to [-1, 1]
}

// --- Grid Constants ---

const LANDSCAPE_COLS = 250;
const LANDSCAPE_ROWS = 80;
const LANDSCAPE_TOTAL = LANDSCAPE_COLS * LANDSCAPE_ROWS;

// World-space sizing — total width = 250 * 14 = 3500 units (fills viewport edge-to-edge)
const GRID_SPACING_X = 14;   // horizontal spacing between columns
const GRID_SPACING_Z = 14;   // depth spacing between rows (deep recession)
const TERRAIN_HEIGHT = 150;  // max height amplitude

// Noise parameters
const NOISE_SCALE = 0.012;
const NOISE_OCTAVES = 4;
const NOISE_LACUNARITY = 2.0;
const NOISE_GAIN = 0.5;

// Aurora palette RGB (matches CSS vars)
const TERRAIN_COLORS = {
    teal:     { r: 50/255,  g: 235/255, b: 210/255 },  // --teal (vivid)
    rose:     { r: 255/255, g: 120/255, b: 195/255 },  // --rose (vivid)
    coral:    { r: 255/255, g: 120/255, b: 140/255 },  // --coral (vivid)
    amber:    { r: 255/255, g: 200/255, b: 40/255  },  // --amber (vivid)
    lavender: { r: 180/255, g: 150/255, b: 255/255 },  // --lavender (vivid)
};

// --- Elevation helpers ---

/**
 * Classify a normalized height [0, 1] into an elevation band.
 */
function getElevationBand(h) {
    if (h < 0.2) return 'water';
    if (h < 0.4) return 'low';
    if (h < 0.65) return 'mid';
    if (h < 0.85) return 'high';
    return 'peak';
}

/**
 * Pick a glyph index for a given elevation band, using the atlas uvMap.
 */
function pickGlyphIndex(band, uvMap) {
    const groups = getGlyphsByElevation();
    const names = groups[band];
    const name = names[Math.floor(Math.random() * names.length)];
    return uvMap[name].index;
}

/**
 * Get a color (r, g, b) for a given normalized height [0, 1].
 * Blends between palette stops.
 */
function getTerrainColor(h) {
    // Gradient stops: 0=teal, 0.3=rose, 0.55=coral, 0.75=amber, 0.9+=lavender
    const stops = [
        { t: 0.0,  c: TERRAIN_COLORS.teal },
        { t: 0.3,  c: TERRAIN_COLORS.rose },
        { t: 0.55, c: TERRAIN_COLORS.coral },
        { t: 0.75, c: TERRAIN_COLORS.amber },
        { t: 0.9,  c: TERRAIN_COLORS.lavender },
    ];

    // Clamp
    if (h <= stops[0].t) return stops[0].c;
    if (h >= stops[stops.length - 1].t) return stops[stops.length - 1].c;

    // Find segment and lerp
    for (let i = 0; i < stops.length - 1; i++) {
        if (h >= stops[i].t && h < stops[i + 1].t) {
            const f = (h - stops[i].t) / (stops[i + 1].t - stops[i].t);
            const a = stops[i].c;
            const b = stops[i + 1].c;
            return {
                r: a.r + (b.r - a.r) * f,
                g: a.g + (b.g - a.g) * f,
                b: a.b + (b.b - a.b) * f,
            };
        }
    }
    return stops[stops.length - 1].c;
}

// --- Shaders ---

const LANDSCAPE_VERTEX_SHADER = `
    // Per-point attributes
    attribute float aGlyphIndex;
    attribute float aOpacity;

    // Uniforms
    uniform float uGlyphCount;
    uniform float uAtlasWidth;   // in cells (= uGlyphCount for single row)
    uniform float uTime;
    uniform float uBassEnergy;
    uniform float uScrollOffset;

    // Varyings to fragment
    varying vec2 vUvOffset;      // bottom-left UV of glyph cell
    varying vec2 vUvScale;       // size of one cell in UV space
    varying vec3 vColor;
    varying float vOpacity;
    varying float vSparklePhase; // for fragment sparkle effect

    // --- HSV helpers for color cycling ---
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        // Compute UV offset for this glyph cell
        float col = aGlyphIndex;
        vUvOffset = vec2(col / uAtlasWidth, 0.0);
        vUvScale = vec2(1.0 / uAtlasWidth, 1.0);

        // --- Color cycling: slow hue rotation across the landscape ---
        vec3 hsv = rgb2hsv(color);
        hsv.x += sin(uTime * 0.1 + position.x * 0.002) * 0.15;
        hsv.x = fract(hsv.x); // wrap hue to [0, 1]
        vColor = hsv2rgb(hsv);

        vOpacity = aOpacity;

        // Sparkle phase derived from position (deterministic per-point)
        vSparklePhase = fract(position.x * 0.137 + position.z * 0.291);

        // Apply horizontal scroll by shifting x
        vec3 pos = position;
        pos.x += uScrollOffset;

        // Wrap x to stay within grid range
        float gridWidth = ${(LANDSCAPE_COLS * GRID_SPACING_X).toFixed(1)};
        pos.x = mod(pos.x + gridWidth * 0.5, gridWidth) - gridWidth * 0.5;

        // --- Ocean-like wave motion ---
        // Primary rolling wave
        pos.y += sin(pos.x * 0.008 + uTime * 0.8) * 25.0;
        // Secondary cross-wave
        pos.y += sin(pos.z * 0.012 + uTime * 1.2) * 15.0;
        // Fine detail shimmer
        pos.y += sin((pos.x + pos.z) * 0.03 + uTime * 2.5) * 5.0;

        // Bass energy: ripple the foreground upward
        float depthFactor = 1.0 - clamp(pos.z / ${(LANDSCAPE_ROWS * GRID_SPACING_Z).toFixed(1)}, 0.0, 1.0);
        pos.y += uBassEnergy * 15.0 * depthFactor * sin(pos.x * 0.05 + uTime * 4.0);

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Size attenuation
        float baseSize = 60.0;
        gl_PointSize = baseSize * (400.0 / -mvPosition.z);
        gl_PointSize = max(gl_PointSize, 2.5);
    }
`;

const LANDSCAPE_FRAGMENT_SHADER = `
    uniform sampler2D uAtlas;
    uniform float uTime;

    varying vec2 vUvOffset;
    varying vec2 vUvScale;
    varying vec3 vColor;
    varying float vOpacity;
    varying float vSparklePhase;

    void main() {
        // Map gl_PointCoord [0,1]x[0,1] to the glyph cell in the atlas
        vec2 uv = vUvOffset + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y) * vUvScale;

        vec4 texel = texture2D(uAtlas, uv);

        // Discard fully transparent pixels (character whitespace)
        if (texel.a < 0.05) discard;

        // Sparkle: sharp brief flashes (~20% of points at any moment)
        float sparkle = pow(max(0.0, sin(uTime * 3.0 + vSparklePhase * 6.28)), 8.0);
        float brightness = 0.7 + 0.3 * sparkle;

        // Apply per-point color with emissive glow boost + sparkle
        vec3 glowColor = vColor * texel.rgb * 1.4 * brightness;
        gl_FragColor = vec4(glowColor, texel.a * vOpacity);
    }
`;

// --- Grid Builder ---

/**
 * Create the landscape terrain grid as a THREE.Points mesh.
 *
 * @param {{ texture: THREE.CanvasTexture, uvMap: Object }} glyphAtlas
 *   The atlas returned by buildGlyphAtlas().
 * @returns {THREE.Points} The points mesh, ready to add to a scene.
 *   The returned object has a `.userData.uniforms` reference for
 *   updating uTime, uBassEnergy, uScrollOffset each frame.
 */
function createLandscapeGrid(glyphAtlas) {
    const { texture, uvMap } = glyphAtlas;

    const count = LANDSCAPE_TOTAL;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const glyphIndices = new Float32Array(count);
    const opacities = new Float32Array(count);

    // Center the grid horizontally, extend into -Z (away from camera)
    const halfWidth = (LANDSCAPE_COLS * GRID_SPACING_X) / 2;

    for (let row = 0; row < LANDSCAPE_ROWS; row++) {
        for (let col = 0; col < LANDSCAPE_COLS; col++) {
            const idx = row * LANDSCAPE_COLS + col;
            const i3 = idx * 3;

            // World position
            const x = col * GRID_SPACING_X - halfWidth;
            const z = row * GRID_SPACING_Z;  // 0 = near, increasing = far

            // Sample noise for height
            const noiseVal = fbm2D(
                col * NOISE_SCALE,
                row * NOISE_SCALE,
                NOISE_OCTAVES,
                NOISE_LACUNARITY,
                NOISE_GAIN
            );
            // Map from [-1, 1] to [0, 1]
            const h = (noiseVal + 1) * 0.5;
            const y = h * TERRAIN_HEIGHT;

            positions[i3]     = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = -z;  // negative Z = into the screen

            // Glyph selection by elevation
            const band = getElevationBand(h);
            glyphIndices[idx] = pickGlyphIndex(band, uvMap);

            // Color by elevation
            const c = getTerrainColor(h);
            colors[i3]     = c.r;
            colors[i3 + 1] = c.g;
            colors[i3 + 2] = c.b;

            // Opacity: LOD — near rows fully opaque, far rows fade out
            const depthRatio = row / LANDSCAPE_ROWS;
            // Near 30% = full opacity, then linear fade to 0.15 at far edge
            if (depthRatio < 0.3) {
                opacities[idx] = 0.85;
            } else {
                opacities[idx] = 0.85 - (depthRatio - 0.3) * (0.7 / 0.7);
                opacities[idx] = Math.max(0.35, opacities[idx]);
            }
        }
    }

    // Build geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aGlyphIndex', new THREE.BufferAttribute(glyphIndices, 1));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

    // Shader material
    const uniforms = {
        uAtlas:        { value: texture },
        uGlyphCount:   { value: getGlyphCount() },
        uAtlasWidth:   { value: getGlyphCount() },  // single row atlas
        uTime:         { value: 0.0 },
        uBassEnergy:   { value: 0.0 },
        uScrollOffset: { value: 0.0 },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: LANDSCAPE_VERTEX_SHADER,
        fragmentShader: LANDSCAPE_FRAGMENT_SHADER,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);

    // Store references for per-frame updates
    points.userData.uniforms = uniforms;
    points.userData.geometry = geometry;
    points.userData.gridCols = LANDSCAPE_COLS;
    points.userData.gridRows = LANDSCAPE_ROWS;
    points.userData.gridSpacingX = GRID_SPACING_X;
    points.userData.gridSpacingZ = GRID_SPACING_Z;
    points.userData.terrainHeight = TERRAIN_HEIGHT;

    return points;
}

/**
 * Regenerate terrain heights with new noise offset.
 * Used for landscape type transitions (morphing).
 *
 * @param {THREE.Points} landscapePoints - the mesh from createLandscapeGrid
 * @param {number} offsetX - noise offset X (shifts the noise sample space)
 * @param {number} offsetY - noise offset Y
 * @param {number} scale - noise frequency multiplier (higher = more jagged)
 * @param {number} amplitude - height multiplier [0, 1]
 * @param {Object} uvMap - glyph atlas UV map for re-picking glyphs
 */
function regenerateTerrainHeights(landscapePoints, offsetX, offsetY, scale, amplitude, uvMap) {
    const geo = landscapePoints.userData.geometry;
    const positions = geo.attributes.position.array;
    const glyphIndices = geo.attributes.aGlyphIndex.array;
    const colors = geo.attributes.color.array;
    const cols = landscapePoints.userData.gridCols;
    const rows = landscapePoints.userData.gridRows;
    const heightAmp = landscapePoints.userData.terrainHeight * amplitude;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const idx = row * cols + col;
            const i3 = idx * 3;

            const noiseVal = fbm2D(
                (col * NOISE_SCALE + offsetX) * scale,
                (row * NOISE_SCALE + offsetY) * scale,
                NOISE_OCTAVES,
                NOISE_LACUNARITY,
                NOISE_GAIN
            );
            const h = (noiseVal + 1) * 0.5;
            positions[i3 + 1] = h * heightAmp;

            const band = getElevationBand(h);
            glyphIndices[idx] = pickGlyphIndex(band, uvMap);

            const c = getTerrainColor(h);
            colors[i3]     = c.r;
            colors[i3 + 1] = c.g;
            colors[i3 + 2] = c.b;
        }
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.aGlyphIndex.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
}
