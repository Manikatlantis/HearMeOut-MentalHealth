// ============================================
// Glyph Atlas — Renders musical characters to a
// sprite sheet texture for the landscape background
// ============================================

const GLYPH_CHARS = [
    { name: 'quarter_note',   char: '♩' },
    { name: 'eighth_note',    char: '♪' },
    { name: 'beamed_notes',   char: '♫' },
    { name: 'beamed_16th',    char: '♬' },
    { name: 'treble_clef',    char: '𝄞' },
    { name: 'bass_clef',      char: '𝄢' },
    { name: 'sharp',          char: '♯' },
    { name: 'flat',           char: '♭' },
    { name: 'tilde',          char: '~' },
    { name: 'wave',           char: '≈' },
    { name: 'star4',          char: '✦' },
    { name: 'asterisk',       char: '*' },
    { name: 'dot',            char: '·' },
    { name: 'shade_light',    char: '░' },
    { name: 'shade_medium',   char: '▒' },
];

const GLYPH_CELL_SIZE = 64;
// Arrange in a single row for simplicity (15 chars = 960x64 atlas)
// If more chars are added, wrap into rows
const GLYPH_COLS = GLYPH_CHARS.length;
const GLYPH_ROWS = 1;
const GLYPH_ATLAS_WIDTH = GLYPH_COLS * GLYPH_CELL_SIZE;
const GLYPH_ATLAS_HEIGHT = GLYPH_ROWS * GLYPH_CELL_SIZE;

let _glyphAtlasTexture = null;
let _glyphUVMap = null;

/**
 * Build the glyph atlas: render all characters to an offscreen canvas,
 * create a THREE.CanvasTexture, and build a UV lookup map.
 *
 * Call once at init time. Returns { texture, uvMap }.
 */
function buildGlyphAtlas() {
    if (_glyphAtlasTexture && _glyphUVMap) {
        return { texture: _glyphAtlasTexture, uvMap: _glyphUVMap };
    }

    const canvas = document.createElement('canvas');
    canvas.width = GLYPH_ATLAS_WIDTH;
    canvas.height = GLYPH_ATLAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    // Clear to transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render each character into its cell
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';

    const uvMap = {};

    for (let i = 0; i < GLYPH_CHARS.length; i++) {
        const entry = GLYPH_CHARS[i];
        const col = i % GLYPH_COLS;
        const row = Math.floor(i / GLYPH_COLS);

        const cx = col * GLYPH_CELL_SIZE + GLYPH_CELL_SIZE / 2;
        const cy = row * GLYPH_CELL_SIZE + GLYPH_CELL_SIZE / 2;

        // Pick font size — most chars render well at 40px,
        // but some musical symbols need adjustment
        let fontSize = 40;
        if (entry.char === '𝄞' || entry.char === '𝄢') {
            fontSize = 48; // clefs are complex, render larger
        } else if (entry.char === '·') {
            fontSize = 32; // dot is tiny, keep smaller font but it's fine
        } else if (entry.char === '░' || entry.char === '▒') {
            fontSize = 44; // block chars
        }

        ctx.font = `${fontSize}px "Segoe UI Symbol", "Noto Music", "Apple Symbols", "Symbola", sans-serif`;
        ctx.fillText(entry.char, cx, cy);

        // UV coordinates normalized to [0, 1]
        uvMap[entry.name] = {
            u: (col * GLYPH_CELL_SIZE) / GLYPH_ATLAS_WIDTH,
            v: (row * GLYPH_CELL_SIZE) / GLYPH_ATLAS_HEIGHT,
            width: GLYPH_CELL_SIZE / GLYPH_ATLAS_WIDTH,
            height: GLYPH_CELL_SIZE / GLYPH_ATLAS_HEIGHT,
        };
    }

    // Also store numeric index for each glyph (useful for per-instance attributes)
    for (let i = 0; i < GLYPH_CHARS.length; i++) {
        uvMap[GLYPH_CHARS[i].name].index = i;
    }

    // Create Three.js texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;

    _glyphAtlasTexture = texture;
    _glyphUVMap = uvMap;

    return { texture, uvMap };
}

/**
 * Get the UV map entry for a glyph by name.
 * Returns { u, v, width, height, index } or null.
 */
function getGlyphUV(name) {
    if (!_glyphUVMap) return null;
    return _glyphUVMap[name] || null;
}

/**
 * Get the total number of glyphs in the atlas.
 */
function getGlyphCount() {
    return GLYPH_CHARS.length;
}

/**
 * Get glyph names grouped by terrain elevation category.
 * Used by the landscape builder to pick characters based on height.
 */
function getGlyphsByElevation() {
    return {
        water:  ['tilde', 'wave', 'flat'],
        low:    ['eighth_note', 'beamed_notes', 'quarter_note'],
        mid:    ['beamed_notes', 'beamed_16th', 'quarter_note'],
        high:   ['sharp', 'treble_clef'],
        peak:   ['bass_clef', 'asterisk'],
    };
}

/**
 * Get glyph names suitable for sky rendering.
 */
function getGlyphsForSky() {
    return ['dot', 'asterisk', 'star4'];
}

/**
 * Get glyph names suitable for cloud rendering.
 */
function getGlyphsForClouds() {
    return ['shade_light', 'shade_medium', 'wave', 'tilde'];
}
