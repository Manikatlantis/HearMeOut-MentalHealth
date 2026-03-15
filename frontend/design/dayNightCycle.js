// ============================================
// Day/Night Cycle + Landscape Transition Manager
// ============================================

// --- Day/Night Cycle ---

const CYCLE_DURATION = 120; // seconds for one full day

// Color temperature keyframes: { t: dayTime, color: THREE.Color }
// Night → Dawn → Day → Sunset → Night
// All stops stay within deep dark aurora range — NEVER bright/light
const _TEMPERATURE_STOPS = [
    { t: 0.00, r: 8/255,   g: 12/255,  b: 26/255  },  // midnight — #080c1a
    { t: 0.10, r: 10/255,  g: 14/255,  b: 30/255  },  // deep night
    { t: 0.18, r: 16/255,  g: 12/255,  b: 42/255  },  // pre-dawn — dark purple hint
    { t: 0.22, r: 22/255,  g: 14/255,  b: 56/255  },  // dawn — dark lavender #160e38
    { t: 0.27, r: 26/255,  g: 16/255,  b: 64/255  },  // dawn peak — #1a1040
    { t: 0.32, r: 20/255,  g: 18/255,  b: 52/255  },  // sunrise — dark warm
    { t: 0.40, r: 16/255,  g: 20/255,  b: 46/255  },  // morning — dark navy-purple
    { t: 0.50, r: 18/255,  g: 24/255,  b: 48/255  },  // noon — #121830 dark warm navy
    { t: 0.60, r: 16/255,  g: 20/255,  b: 46/255  },  // afternoon — dark navy-purple
    { t: 0.70, r: 20/255,  g: 18/255,  b: 52/255  },  // pre-sunset — dark warm
    { t: 0.75, r: 26/255,  g: 16/255,  b: 64/255  },  // sunset — #1a1040
    { t: 0.80, r: 22/255,  g: 14/255,  b: 56/255  },  // dusk — dark lavender
    { t: 0.85, r: 16/255,  g: 12/255,  b: 42/255  },  // twilight
    { t: 0.92, r: 10/255,  g: 14/255,  b: 30/255  },  // deep night
    { t: 1.00, r: 8/255,   g: 12/255,  b: 26/255  },  // midnight — #080c1a
];

function _lerpTemperature(dayTime) {
    const stops = _TEMPERATURE_STOPS;
    const t = dayTime % 1.0;

    if (t <= stops[0].t) return new THREE.Color(stops[0].r, stops[0].g, stops[0].b);
    if (t >= stops[stops.length - 1].t) {
        const last = stops[stops.length - 1];
        return new THREE.Color(last.r, last.g, last.b);
    }

    for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].t && t < stops[i + 1].t) {
            const f = (t - stops[i].t) / (stops[i + 1].t - stops[i].t);
            const a = stops[i];
            const b = stops[i + 1];
            return new THREE.Color(
                a.r + (b.r - a.r) * f,
                a.g + (b.g - a.g) * f,
                a.b + (b.b - a.b) * f
            );
        }
    }
    return new THREE.Color(stops[0].r, stops[0].g, stops[0].b);
}

function _ambientIntensity(dayTime) {
    // Sinusoidal: 0.1 at midnight (0.0/1.0), 1.0 at noon (0.5)
    return 0.1 + 0.9 * Math.sin(dayTime * Math.PI);
}

// --- Landscape Presets ---

const LANDSCAPE_PRESETS = {
    ROLLING_HILLS: {
        noiseFrequency: 1.0,
        noiseAmplitude: 1.0,
        octaves: 4,
        lacunarity: 2.0,
        gain: 0.5,
        yOffset: 0,
        noiseOffsetX: 0,
        noiseOffsetY: 0,
        // palette bias: null = use default elevation colors
        paletteBias: null,
    },
    MOUNTAINS: {
        noiseFrequency: 1.8,
        noiseAmplitude: 1.6,
        octaves: 5,
        lacunarity: 2.2,
        gain: 0.55,
        yOffset: -20,
        noiseOffsetX: 50,
        noiseOffsetY: 0,
        paletteBias: null,
    },
    OCEAN: {
        noiseFrequency: 0.6,
        noiseAmplitude: 0.25,
        octaves: 2,
        lacunarity: 2.0,
        gain: 0.4,
        yOffset: -40,
        noiseOffsetX: 100,
        noiseOffsetY: 50,
        // Bias toward teal
        paletteBias: { r: 45/255, g: 212/255, b: 191/255, strength: 0.5 },
    },
    DESERT_DUNES: {
        noiseFrequency: 0.7,
        noiseAmplitude: 0.6,
        octaves: 3,
        lacunarity: 1.8,
        gain: 0.45,
        yOffset: -10,
        noiseOffsetX: 200,
        noiseOffsetY: 100,
        // Bias toward amber/coral
        paletteBias: { r: 251/255, g: 160/255, b: 70/255, strength: 0.4 },
    },
    FOREST: {
        noiseFrequency: 1.3,
        noiseAmplitude: 0.9,
        octaves: 4,
        lacunarity: 2.4,
        gain: 0.6,
        yOffset: 10,
        noiseOffsetX: 300,
        noiseOffsetY: 200,
        // Bias toward teal/green
        paletteBias: { r: 45/255, g: 200/255, b: 160/255, strength: 0.3 },
    },
};

const PRESET_NAMES = Object.keys(LANDSCAPE_PRESETS);
const LANDSCAPE_TRANSITION_DURATION = 4.0;  // seconds
const LANDSCAPE_AUTO_INTERVAL = 45.0;       // seconds between auto-transitions

function _clonePresetParams(preset) {
    return {
        noiseFrequency: preset.noiseFrequency,
        noiseAmplitude: preset.noiseAmplitude,
        octaves: preset.octaves,
        lacunarity: preset.lacunarity,
        gain: preset.gain,
        yOffset: preset.yOffset,
        noiseOffsetX: preset.noiseOffsetX,
        noiseOffsetY: preset.noiseOffsetY,
        paletteBias: preset.paletteBias ? { ...preset.paletteBias } : null,
    };
}

function _lerpParams(a, b, t) {
    const result = {
        noiseFrequency: a.noiseFrequency + (b.noiseFrequency - a.noiseFrequency) * t,
        noiseAmplitude: a.noiseAmplitude + (b.noiseAmplitude - a.noiseAmplitude) * t,
        octaves: Math.round(a.octaves + (b.octaves - a.octaves) * t),
        lacunarity: a.lacunarity + (b.lacunarity - a.lacunarity) * t,
        gain: a.gain + (b.gain - a.gain) * t,
        yOffset: a.yOffset + (b.yOffset - a.yOffset) * t,
        noiseOffsetX: a.noiseOffsetX + (b.noiseOffsetX - a.noiseOffsetX) * t,
        noiseOffsetY: a.noiseOffsetY + (b.noiseOffsetY - a.noiseOffsetY) * t,
        paletteBias: null,
    };

    // Lerp palette bias
    if (a.paletteBias && b.paletteBias) {
        result.paletteBias = {
            r: a.paletteBias.r + (b.paletteBias.r - a.paletteBias.r) * t,
            g: a.paletteBias.g + (b.paletteBias.g - a.paletteBias.g) * t,
            b: a.paletteBias.b + (b.paletteBias.b - a.paletteBias.b) * t,
            strength: a.paletteBias.strength + (b.paletteBias.strength - a.paletteBias.strength) * t,
        };
    } else if (a.paletteBias) {
        // Fade out bias
        result.paletteBias = {
            r: a.paletteBias.r,
            g: a.paletteBias.g,
            b: a.paletteBias.b,
            strength: a.paletteBias.strength * (1 - t),
        };
        if (result.paletteBias.strength < 0.01) result.paletteBias = null;
    } else if (b.paletteBias) {
        // Fade in bias
        result.paletteBias = {
            r: b.paletteBias.r,
            g: b.paletteBias.g,
            b: b.paletteBias.b,
            strength: b.paletteBias.strength * t,
        };
        if (result.paletteBias.strength < 0.01) result.paletteBias = null;
    }

    return result;
}

// Smooth easing for transitions
function _smoothstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Create the day/night cycle and landscape transition manager.
 *
 * @returns {Object} Controller with update(), getDayTime(), etc.
 */
function createDayNightCycle() {
    let _dayTime = 0.0;
    let _colorTemp = new THREE.Color();

    // Landscape transition state
    let _currentPresetName = 'ROLLING_HILLS';
    let _currentParams = _clonePresetParams(LANDSCAPE_PRESETS.ROLLING_HILLS);
    let _transitionFrom = null;
    let _transitionTo = null;
    let _transitionProgress = 0;
    let _transitioning = false;
    let _autoTransitionTimer = LANDSCAPE_AUTO_INTERVAL;

    return {
        /**
         * Advance the cycle. Call once per frame.
         * @param {number} deltaTime — seconds since last frame
         * @returns {number} current dayTime (0-1)
         */
        update(deltaTime) {
            // Advance day/night
            _dayTime = (_dayTime + deltaTime / CYCLE_DURATION) % 1.0;

            // Update color temperature
            _colorTemp = _lerpTemperature(_dayTime);

            // --- Landscape auto-transition ---
            _autoTransitionTimer -= deltaTime;
            if (_autoTransitionTimer <= 0 && !_transitioning) {
                // Pick a random DIFFERENT preset
                let nextName;
                do {
                    nextName = PRESET_NAMES[Math.floor(Math.random() * PRESET_NAMES.length)];
                } while (nextName === _currentPresetName && PRESET_NAMES.length > 1);
                this.triggerTransition(nextName);
                _autoTransitionTimer = LANDSCAPE_AUTO_INTERVAL;
            }

            // --- Landscape transition lerp ---
            if (_transitioning) {
                _transitionProgress += deltaTime / LANDSCAPE_TRANSITION_DURATION;
                if (_transitionProgress >= 1.0) {
                    _transitionProgress = 1.0;
                    _transitioning = false;
                    _currentParams = _clonePresetParams(_transitionTo);
                    _transitionFrom = null;
                    _transitionTo = null;
                } else {
                    const t = _smoothstep(_transitionProgress);
                    _currentParams = _lerpParams(_transitionFrom, _transitionTo, t);
                }
            }

            return _dayTime;
        },

        /**
         * Get current day time (0-1).
         */
        getDayTime() {
            return _dayTime;
        },

        /**
         * Set day time directly (for debugging / external control).
         * @param {number} t — 0 to 1
         */
        setDayTime(t) {
            _dayTime = t % 1.0;
        },

        /**
         * Get global color temperature as THREE.Color.
         */
        getColorTemperature() {
            return _colorTemp;
        },

        /**
         * Get ambient intensity: 0.1 (night) to 1.0 (noon).
         */
        getAmbientIntensity() {
            return _ambientIntensity(_dayTime);
        },

        /**
         * Is it night? True when dayTime < 0.2 or > 0.8.
         */
        isNight() {
            return _dayTime < 0.2 || _dayTime > 0.8;
        },

        /**
         * Trigger a landscape type transition.
         * @param {string} presetName — one of PRESET_NAMES
         */
        triggerTransition(presetName) {
            if (!LANDSCAPE_PRESETS[presetName]) return;
            if (presetName === _currentPresetName && !_transitioning) return;

            _transitionFrom = _clonePresetParams(_currentParams);
            _transitionTo = _clonePresetParams(LANDSCAPE_PRESETS[presetName]);
            _transitionProgress = 0;
            _transitioning = true;
            _currentPresetName = presetName;
        },

        /**
         * Get the current (possibly mid-transition) landscape noise params.
         * @returns {{ noiseFrequency, noiseAmplitude, octaves, lacunarity, gain, yOffset, noiseOffsetX, noiseOffsetY, paletteBias }}
         */
        getCurrentLandscapeParams() {
            return _currentParams;
        },

        /**
         * Is a landscape transition currently in progress?
         */
        isTransitioning() {
            return _transitioning;
        },

        /**
         * Get the current preset name.
         */
        getCurrentPresetName() {
            return _currentPresetName;
        },

        /**
         * Get all available preset names.
         */
        getPresetNames() {
            return PRESET_NAMES.slice();
        },
    };
}
