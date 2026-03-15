// ============================================
// Gesture Mixer — MediaPipe Hands integration
// Detects hand gestures, maps to audio effects
// ============================================

let gestureMixer = {
    active: false,
    hands: null,
    camera: null,
    lastResults: null,
    handPositions: [], // normalized [0,1] positions for Three.js
    activeGestures: new Set(),
    prevLandmarks: [],  // for motion tracking
    motionHistory: []   // for wave/circular detection
};

function initGestureMixer(videoElement) {
    if (typeof Hands === 'undefined') {
        console.warn('MediaPipe Hands not loaded');
        return false;
    }

    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5
    });

    hands.onResults((results) => {
        gestureMixer.lastResults = results;
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            processGestures(results);
            if (typeof handGeometry !== 'undefined') {
                handGeometry.updateData(results.multiHandLandmarks, gestureMixer.activeGestures);
            }
        } else {
            gestureMixer.handPositions = [];
            gestureMixer.activeGestures.clear();
            if (typeof handGeometry !== 'undefined') {
                handGeometry.updateData([], new Set());
            }
        }
    });

    gestureMixer.hands = hands;

    if (typeof Camera !== 'undefined') {
        const cam = new Camera(videoElement, {
            onFrame: async () => {
                if (gestureMixer.active) {
                    await hands.send({ image: videoElement });
                }
            },
            width: 320,
            height: 240
        });
        gestureMixer.camera = cam;
    }

    return true;
}

function startGestureMixer() {
    if (!gestureMixer.hands) return;
    gestureMixer.active = true;
    if (gestureMixer.camera) {
        gestureMixer.camera.start();
    }
}

function stopGestureMixer() {
    gestureMixer.active = false;
    if (gestureMixer.camera) {
        gestureMixer.camera.stop();
    }
    gestureMixer.handPositions = [];
    gestureMixer.activeGestures.clear();
}

// --- Gesture Detection ---

function processGestures(results) {
    const hands = results.multiHandLandmarks;
    if (!hands || hands.length === 0) return;

    gestureMixer.activeGestures.clear();
    gestureMixer.handPositions = [];

    for (let h = 0; h < hands.length; h++) {
        const lm = hands[h];
        const wrist = lm[0];

        // Store normalized hand position for Three.js
        gestureMixer.handPositions.push({
            x: wrist.x,
            y: wrist.y,
            z: wrist.z || 0
        });

        // Detect gestures
        detectVolumeGesture(lm);
        detectPinchGesture(lm);
        detectFingerSpread(lm);
        if (!gestureMixer.activeGestures.has('finger_spread')) {
            detectOpenPalmGesture(lm);
        }
        detectFistGesture(lm);
    }

    // Two-hand gestures
    if (hands.length >= 2) {
        detectStereoSpread(hands[0], hands[1]);
    }

    // Motion-based gestures (wave + circular)
    detectMotionGestures(hands[0]);

    // Apply detected gestures to effects
    applyGesturesToEffects();
}

function detectVolumeGesture(lm) {
    const wristY = lm[0].y;
    // Hand raised high → volume up; lowered → volume down
    if (wristY < 0.3) {
        gestureMixer.activeGestures.add('volume_up');
    } else if (wristY > 0.7) {
        gestureMixer.activeGestures.add('volume_down');
    }
}

function detectPinchGesture(lm) {
    // Thumb tip (4) to index tip (8) distance
    const dx = lm[4].x - lm[8].x;
    const dy = lm[4].y - lm[8].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.06) {
        gestureMixer.activeGestures.add('pinch');
        // Store pinch tightness for filter sweep
        gestureMixer._pinchDist = dist;
    }
}

function detectOpenPalmGesture(lm) {
    // All fingertips far from palm center (landmark 9 = middle finger base)
    const palm = lm[9];
    const tips = [lm[4], lm[8], lm[12], lm[16], lm[20]];
    let totalDist = 0;
    for (const tip of tips) {
        const dx = tip.x - palm.x;
        const dy = tip.y - palm.y;
        totalDist += Math.sqrt(dx * dx + dy * dy);
    }
    const avgDist = totalDist / 5;
    if (avgDist > 0.15) {
        gestureMixer.activeGestures.add('open_palm');
    }
}

function detectFingerSpread(lm) {
    // Check hand is open first (tips far from palm)
    const palm = lm[9];
    const tips = [lm[4], lm[8], lm[12], lm[16], lm[20]];
    let totalDist = 0;
    for (const tip of tips) {
        const dx = tip.x - palm.x;
        const dy = tip.y - palm.y;
        totalDist += Math.sqrt(dx * dx + dy * dy);
    }
    const avgDist = totalDist / 5;
    if (avgDist <= 0.15) return;

    // Check inter-fingertip spread: adjacent tips [4↔8, 8↔12, 12↔16, 16↔20]
    const pairs = [[4,8],[8,12],[12,16],[16,20]];
    let spreadTotal = 0;
    for (const [a, b] of pairs) {
        const dx = lm[a].x - lm[b].x;
        const dy = lm[a].y - lm[b].y;
        spreadTotal += Math.sqrt(dx * dx + dy * dy);
    }
    const avgSpread = spreadTotal / 4;
    if (avgSpread > 0.09) {
        gestureMixer.activeGestures.add('finger_spread');
        gestureMixer._spreadIntensity = Math.min(1, (avgSpread - 0.09) / 0.06);
    }
}

function detectFistGesture(lm) {
    // All fingertips close to palm
    const palm = lm[9];
    const tips = [lm[8], lm[12], lm[16], lm[20]];
    let totalDist = 0;
    for (const tip of tips) {
        const dx = tip.x - palm.x;
        const dy = tip.y - palm.y;
        totalDist += Math.sqrt(dx * dx + dy * dy);
    }
    const avgDist = totalDist / 4;
    if (avgDist < 0.08) {
        gestureMixer.activeGestures.add('fist');
        gestureMixer._fistTightness = Math.min(1, 1 - (avgDist / 0.08));
    }
}

function detectStereoSpread(hand1, hand2) {
    const dist = Math.abs(hand1[0].x - hand2[0].x);
    if (dist > 0.3) {
        gestureMixer.activeGestures.add('stereo_spread');
        gestureMixer._stereoDist = dist;
        gestureMixer._stereoMidpoint = (hand1[0].x + hand2[0].x) / 2;
    }
}

function detectMotionGestures(lm) {
    const current = { x: lm[9].x, y: lm[9].y, t: Date.now() };
    gestureMixer.motionHistory.push(current);

    // Keep last 15 frames (~0.5s at 30fps)
    if (gestureMixer.motionHistory.length > 15) {
        gestureMixer.motionHistory.shift();
    }

    const history = gestureMixer.motionHistory;
    if (history.length < 8) return;

    // Wave detection: significant lateral movement
    const xValues = history.map(p => p.x);
    const xRange = Math.max(...xValues) - Math.min(...xValues);
    if (xRange > 0.2) {
        gestureMixer.activeGestures.add('wave');
        gestureMixer._waveIntensity = Math.min(1, xRange / 0.4);
    }

    // Circular motion detection: check if points form an arc
    if (history.length >= 12) {
        const cx = history.reduce((s, p) => s + p.x, 0) / history.length;
        const cy = history.reduce((s, p) => s + p.y, 0) / history.length;
        const radii = history.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2));
        const avgR = radii.reduce((s, r) => s + r, 0) / radii.length;
        const variance = radii.reduce((s, r) => s + (r - avgR) ** 2, 0) / radii.length;
        // Low variance + decent radius = circular motion
        if (variance < 0.002 && avgR > 0.05) {
            gestureMixer.activeGestures.add('circular');
            gestureMixer._circularIntensity = Math.min(1, avgR / 0.15);
        }
    }
}

// --- Map Gestures to Effects ---

function applyGesturesToEffects() {
    if (typeof effectChain === 'undefined' || !effectChain) return;

    const g = gestureMixer.activeGestures;

    // Open palm reset — only if no finger_spread active
    if (g.has('open_palm') && !g.has('pinch') && !g.has('fist') && !g.has('finger_spread')) {
        resetAllEffects();
        return;
    }

    // Volume (unchanged)
    if (g.has('volume_up')) setVolume(1.5);
    else if (g.has('volume_down')) setVolume(0.3);

    // Pinch → filter sweep (unchanged)
    if (g.has('pinch')) {
        const freq = 200 + ((gestureMixer._pinchDist || 0.05) / 0.06) * 19800;
        setFilterFrequency(Math.min(20000, freq));
    }

    // Fist → reverb (was distortion)
    if (g.has('fist')) {
        setReverbMix((gestureMixer._fistTightness || 0.5) * 0.85);
    }

    // Finger spread → distortion + bright filter (new gesture)
    if (g.has('finger_spread')) {
        const intensity = gestureMixer._spreadIntensity || 0.5;
        setDistortion(intensity * 35);
        setFilterFrequency(2000 + intensity * 8000);
    }

    // Stereo spread → pan + reverb (enhanced — was pan only)
    if (g.has('stereo_spread')) {
        const dist = gestureMixer._stereoDist || 0.3;
        const normalized = Math.min(1, (dist - 0.3) / 0.5);
        const midpoint = gestureMixer._stereoMidpoint || 0.5;
        setStereoPan((0.5 - midpoint) * 2 * normalized * 0.8);
        setReverbMix(normalized * 0.6);
    }

    // Wave → distortion + auto-pan "shatter" (was reverb)
    if (g.has('wave')) {
        const intensity = gestureMixer._waveIntensity || 0.5;
        setDistortion(intensity * 70);
        setStereoPan(Math.sin(Date.now() * 0.01) * intensity * 0.9);
    }

    // Circular → delay + filter + pitch wobble "vortex" (was simple delay)
    if (g.has('circular')) {
        const intensity = gestureMixer._circularIntensity || 0.5;
        const wobble = Math.sin(Date.now() * 0.008 * intensity) * 0.005 * intensity;
        setDelayParams(0.2 * intensity + wobble, 0.3 + intensity * 0.4);
        setFilterFrequency(20000 - intensity * 15000);
    }
}

// --- Getters for UI/Three.js ---

function getHandPositions() {
    return gestureMixer.handPositions;
}

function getActiveGestures() {
    return gestureMixer.activeGestures;
}
