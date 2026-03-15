// ============================================
// Gesture Mixer — MediaPipe Hands integration
// 7 gestures: volume up/down, open palm (best version), fist (bass heavy), vocal isolate, heart, DBZ energy ball
// ============================================

let gestureMixer = {
    active: false,
    hands: null,
    camera: null,
    lastResults: null,
    handPositions: [],
    activeGestures: new Set(),
    // DBZ energy ball state
    _energyCharge: 0,
    _energyMidpoint: null,
    _energyBallReleased: false,
    _energyReleasePos: null,
    _prevWristDist: 0,
    _handVolume: undefined
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
            // If hands disappear while charging, release if enough charge
            if (gestureMixer._energyCharge > 0.3) {
                gestureMixer._energyBallReleased = true;
                gestureMixer._energyReleasePos = gestureMixer._energyMidpoint;
            }
            gestureMixer._energyCharge = 0;
            gestureMixer._energyMidpoint = null;
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
    gestureMixer._energyCharge = 0;
    gestureMixer._energyMidpoint = null;
    gestureMixer._energyBallReleased = false;
}

// --- Utility ---

function distance2D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
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

        gestureMixer.handPositions.push({
            x: wrist.x,
            y: wrist.y,
            z: wrist.z || 0
        });

        // Single-hand gestures
        detectVolumeGesture(lm);
        detectOpenPalm(lm);
        detectFistGesture(lm);
        detectPeaceSign(lm);
    }

    // Two-hand gestures
    if (hands.length >= 2) {
        detectHeartGesture(hands[0], hands[1]);
        detectDBZCharge(hands[0], hands[1]);
    } else {
        // Single hand — if was charging, check release
        if (gestureMixer._energyCharge > 0.3) {
            gestureMixer._energyBallReleased = true;
            gestureMixer._energyReleasePos = gestureMixer._energyMidpoint;
        }
        gestureMixer._energyCharge = 0;
        gestureMixer._energyMidpoint = null;
    }

    // Apply detected gestures to audio effects
    applyGesturesToEffects();
}

function detectVolumeGesture(lm) {
    // Continuous volume control based on wrist height
    // Top of frame (y=0) → volume 2.0, bottom (y=1) → volume 0.1
    // Middle (y=0.5) → volume ~1.0 (neutral)
    const wristY = lm[0].y;
    // Map: y=0 → vol=2.0, y=0.5 → vol=1.0, y=1.0 → vol=0.1
    const vol = 2.0 - wristY * 1.9;
    gestureMixer._handVolume = Math.max(0.1, Math.min(2.0, vol));
    // Only flag as active gesture when clearly away from center
    if (wristY < 0.35) {
        gestureMixer.activeGestures.add('volume_up');
    } else if (wristY > 0.65) {
        gestureMixer.activeGestures.add('volume_down');
    }
}

function detectOpenPalm(lm) {
    // All fingers extended and spread apart
    const indexUp = lm[8].y < lm[6].y;
    const middleUp = lm[12].y < lm[10].y;
    const ringUp = lm[16].y < lm[14].y;
    const pinkyUp = lm[20].y < lm[18].y;

    if (!indexUp || !middleUp || !ringUp || !pinkyUp) return;

    // Check fingers are spread: adjacent fingertips far enough apart
    const idxMidDist = distance2D(lm[8], lm[12]);
    const midRingDist = distance2D(lm[12], lm[16]);
    const ringPinkyDist = distance2D(lm[16], lm[20]);
    const avgSpread = (idxMidDist + midRingDist + ringPinkyDist) / 3;

    if (avgSpread > 0.04) {
        gestureMixer.activeGestures.add('open_palm');
    }
}

function detectFistGesture(lm) {
    // All fingertips close to palm, INCLUDING thumb
    const palm = lm[9];
    const tips = [lm[8], lm[12], lm[16], lm[20]];
    let totalDist = 0;
    for (const tip of tips) {
        totalDist += distance2D(tip, palm);
    }
    const avgDist = totalDist / 4;

    // Also require thumb curled (not extended) to avoid conflict with thumbs up/down
    const thumbDist = distance2D(lm[4], palm);
    if (avgDist < 0.08 && thumbDist < 0.12) {
        gestureMixer.activeGestures.add('bass_heavy');
        gestureMixer._fistTightness = Math.min(1, 1 - (avgDist / 0.08));
    }
}

function detectPeaceSign(lm) {
    // Index up: tip[8].y < pip[6].y
    // Middle up: tip[12].y < pip[10].y
    // Ring down: tip[16].y > pip[14].y
    // Pinky down: tip[20].y > pip[18].y
    const indexUp = lm[8].y < lm[6].y;
    const middleUp = lm[12].y < lm[10].y;
    const ringDown = lm[16].y > lm[14].y;
    const pinkyDown = lm[20].y > lm[18].y;

    if (indexUp && middleUp && ringDown && pinkyDown) {
        gestureMixer.activeGestures.add('vocal_isolate');
    }
}

function detectHeartGesture(hand1, hand2) {
    // Both thumb tips close
    const thumbDist = distance2D(hand1[4], hand2[4]);
    // Both index tips close
    const indexDist = distance2D(hand1[8], hand2[8]);
    // Thumbs below index (thumbs Y > index Y in screen coords)
    const thumbsBelow = hand1[4].y > hand1[8].y && hand2[4].y > hand2[8].y;

    if (thumbDist < 0.06 && indexDist < 0.06 && thumbsBelow) {
        gestureMixer.activeGestures.add('heart');
        gestureMixer._heartMidpoint = {
            x: (hand1[4].x + hand2[4].x + hand1[8].x + hand2[8].x) / 4,
            y: (hand1[4].y + hand2[4].y + hand1[8].y + hand2[8].y) / 4
        };
    }
}

function detectDBZCharge(hand1, hand2) {
    const wristDist = distance2D(hand1[0], hand2[0]);

    // Check both hands are slightly open (not fist, not fully spread)
    function handOpenness(lm) {
        const palm = lm[9];
        const tips = [lm[8], lm[12], lm[16], lm[20]];
        let total = 0;
        for (const tip of tips) total += distance2D(tip, palm);
        return total / 4;
    }

    const open1 = handOpenness(hand1);
    const open2 = handOpenness(hand2);
    const bothSlightlyOpen = open1 > 0.08 && open1 < 0.18 && open2 > 0.08 && open2 < 0.18;

    // Charging: wrists 0.1-0.35 apart, both hands slightly open
    if (wristDist >= 0.1 && wristDist <= 0.35 && bothSlightlyOpen) {
        gestureMixer._energyCharge = Math.min(1, gestureMixer._energyCharge + 0.02);
        gestureMixer._energyMidpoint = {
            x: (hand1[0].x + hand2[0].x) / 2,
            y: (hand1[0].y + hand2[0].y) / 2
        };
        gestureMixer.activeGestures.add('dbz_charge');
        gestureMixer._prevWristDist = wristDist;
    }
    // Release: charge > 0.3 and hands separate
    else if (gestureMixer._energyCharge > 0.3 && wristDist > 0.4) {
        gestureMixer._energyBallReleased = true;
        gestureMixer._energyReleasePos = gestureMixer._energyMidpoint;
        gestureMixer._energyCharge = 0;
        gestureMixer._energyMidpoint = null;
    }
    // Not in range — decay charge slowly
    else if (gestureMixer._energyCharge > 0) {
        gestureMixer._energyCharge = Math.max(0, gestureMixer._energyCharge - 0.01);
        if (gestureMixer._energyCharge > 0.05) {
            gestureMixer.activeGestures.add('dbz_charge');
        }
    }
}

// --- Map Gestures to Audio Effects ---

function applyGesturesToEffects() {
    if (typeof effectChain === 'undefined' || !effectChain) return;

    const g = gestureMixer.activeGestures;

    // Mode gestures (filter/distortion/reverb effects)
    const hasMode = g.has('bass_heavy') || g.has('vocal_isolate') || g.has('open_palm');
    if (hasMode) {
        if (g.has('open_palm')) {
            setBestVersion();
        } else if (g.has('bass_heavy')) {
            setBassBoost(gestureMixer._fistTightness || 0.7);
        } else if (g.has('vocal_isolate')) {
            setVocalIsolate(true);
        }
    } else {
        // No mode gesture — reset filter/distortion/reverb but NOT volume
        setVocalIsolate(false);
        setDistortion(0);
        setDelayParams(0, 0);
        setReverbMix(0);
        setStereoPan(0);
    }

    // Volume ALWAYS from hand height — independent of other gestures
    if (gestureMixer._handVolume !== undefined) {
        setVolume(gestureMixer._handVolume);
    }
}

// --- Getters for UI/Three.js ---

function getHandPositions() {
    return gestureMixer.handPositions;
}

function getActiveGestures() {
    return gestureMixer.activeGestures;
}

function getEnergyBallState() {
    if (gestureMixer._energyCharge <= 0) return null;
    return {
        charge: gestureMixer._energyCharge,
        midpoint: gestureMixer._energyMidpoint
    };
}

function consumeFireballRelease() {
    if (!gestureMixer._energyBallReleased) return null;
    const pos = gestureMixer._energyReleasePos;
    gestureMixer._energyBallReleased = false;
    gestureMixer._energyReleasePos = null;
    return pos;
}
