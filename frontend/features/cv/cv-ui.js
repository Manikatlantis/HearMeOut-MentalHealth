// ============================================
// CV UI — Webcam overlay, gesture guide,
// emotion heatmap, effect indicators, refinement modal
// ============================================

let cvUI = {
    webcamActive: false,
    stream: null,
    gestureGuideVisible: false
};

// --- Webcam Toggle ---

async function toggleWebcam() {
    const video = document.getElementById('cvVideo');
    const btn = document.getElementById('webcamToggleBtn');
    if (!video || !btn) return;

    if (cvUI.webcamActive) {
        // Stop
        stopWebcam();
        btn.classList.remove('active');
        btn.querySelector('.btn-text').textContent = 'Camera';
    } else {
        // Start
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: 'user' }
            });
            cvUI.stream = stream;
            video.srcObject = stream;
            await video.play();
            cvUI.webcamActive = true;
            btn.classList.add('active');
            btn.querySelector('.btn-text').textContent = 'Camera On';

            document.getElementById('webcamOverlay').classList.add('visible');

            // Init models if not done
            const emotionReady = await initEmotionModels();
            const gestureReady = initGestureMixer(video);

            if (emotionReady) {
                document.getElementById('emotionBadge').style.display = 'block';
            }
            if (gestureReady) {
                startGestureMixer();
                document.getElementById('effectIndicators').classList.add('visible');
                // Init hand geometry canvas
                const hgCanvas = document.getElementById('handGeometryCanvas');
                if (hgCanvas && typeof handGeometry !== 'undefined') {
                    handGeometry.init(hgCanvas);
                }
            }
        } catch (e) {
            console.warn('Camera access denied:', e);
            btn.disabled = true;
            btn.querySelector('.btn-text').textContent = 'No Camera';
            btn.title = 'Camera permission denied';
        }
    }
}

function stopWebcam() {
    cvUI.webcamActive = false;
    if (cvUI.stream) {
        cvUI.stream.getTracks().forEach(t => t.stop());
        cvUI.stream = null;
    }
    const video = document.getElementById('cvVideo');
    if (video) video.srcObject = null;

    document.getElementById('webcamOverlay').classList.remove('visible');
    document.getElementById('webcamOverlay').classList.remove('meditation-mode');
    document.getElementById('effectIndicators').classList.remove('visible');

    if (typeof handGeometry !== 'undefined') handGeometry.destroy();
    stopGestureMixer();
    stopEmotionTracking();
}

// --- Persistent webcam across screens ---
function updateWebcamForScreen(screenId) {
    const overlay = document.getElementById('webcamOverlay');
    if (!overlay || !cvUI.webcamActive) return;

    if (screenId === 'playerScreen' || screenId === 'meditationScreen') {
        overlay.classList.add('visible');
        if (screenId === 'meditationScreen') {
            overlay.classList.add('meditation-mode');
        } else {
            overlay.classList.remove('meditation-mode');
        }
    } else {
        // Keep stream alive but hide overlay on other screens
        overlay.classList.remove('meditation-mode');
        overlay.classList.remove('visible');
    }
}

// --- Effect Indicator Bar ---

function updateEffectIndicators() {
    const values = getEffectValues();
    if (!values) return;

    const indicators = {
        'fx-volume': { label: 'Vol', val: values.volume, active: Math.abs(values.volume - 1.0) > 0.05 },
        'fx-filter': { label: 'Filter', val: Math.round(values.filterFreq) + 'Hz', active: values.filterFreq < 19000 },
        'fx-distortion': { label: 'Dist', val: Math.round(values.distortionAmount), active: values.distortionAmount > 1 },
        'fx-delay': { label: 'Delay', val: values.delayTime.toFixed(2) + 's', active: values.delayTime > 0.01 },
        'fx-reverb': { label: 'Reverb', val: Math.round(values.reverbWet * 100) + '%', active: values.reverbWet > 0.01 },
        'fx-pan': { label: 'Pan', val: values.pan.toFixed(2), active: Math.abs(values.pan) > 0.05 }
    };

    for (const [id, info] of Object.entries(indicators)) {
        const el = document.getElementById(id);
        if (!el) continue;
        const valSpan = el.querySelector('.fx-val');
        if (valSpan) valSpan.textContent = info.val;
        if (info.active) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    }
}

// Run indicator update loop
setInterval(updateEffectIndicators, 100);

// --- Emotion Heatmap ---

function renderEmotionHeatmap() {
    const container = document.getElementById('emotionHeatmap');
    if (!container) return;

    const data = getEmotionHeatmapData();
    if (data.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const canvas = document.getElementById('heatmapCanvas');
    if (!canvas) return;

    const player = document.getElementById('audioPlayer');
    const duration = player.duration || 30;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const segWidth = canvas.width / data.length;

    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        // Color: warm (happy/surprised) → rose/amber, cool (sad) → teal, gray (neutral)
        let r, g, b;
        const happy = d.happy + d.surprised * 0.5;
        const sad = d.sad;
        const neutral = d.neutral;

        // Blend: happy=rose(244,114,182), sad=teal(45,212,191), neutral=gray(100,100,110)
        r = Math.round(244 * happy + 45 * sad + 100 * neutral);
        g = Math.round(114 * happy + 212 * sad + 100 * neutral);
        b = Math.round(182 * happy + 191 * sad + 110 * neutral);

        r = Math.min(255, r);
        g = Math.min(255, g);
        b = Math.min(255, b);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.fillRect(i * segWidth, 0, segWidth + 1, canvas.height);
    }
}

// --- Refinement Prompt Modal ---

function showEmotionRefinementPrompt(analysis) {
    if (!analysis) return;

    const modal = document.getElementById('refinementModal');
    if (!modal) return;

    // Build description
    const desc = document.getElementById('refinementDesc');
    if (desc) {
        const parts = [];
        if (analysis.peakMoments.length > 0) {
            parts.push('We noticed you were most moved during certain moments.');
        }
        if (analysis.engagementScore > 0.5) {
            parts.push('Your engagement was strong throughout!');
        } else if (analysis.engagementScore < 0.3) {
            parts.push('Some sections could be more emotionally resonant.');
        }
        parts.push('Create an enhanced version based on your emotional response?');
        desc.textContent = parts.join(' ');
    }

    modal.classList.add('visible');
}

function hideEmotionRefinementPrompt() {
    const modal = document.getElementById('refinementModal');
    if (modal) modal.classList.remove('visible');
}

async function acceptEmotionRefinement() {
    hideEmotionRefinementPrompt();

    const analysis = emotionTracker.analysis;
    if (!analysis) return;

    const feedback = buildEmotionFeedback(analysis);
    if (!feedback) return;

    // Stop playback
    const player = document.getElementById('audioPlayer');
    player.pause();
    isPlaying = false;
    document.getElementById('playIcon').style.display = 'block';
    document.getElementById('pauseIcon').style.display = 'none';
    document.getElementById('albumArt').classList.remove('spinning');
    hideLyricsOverlay();

    // Show loading
    showScreen('loadingScreen');
    animateProgress();

    try {
        const response = await fetch('/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedback: feedback,
                session_id: 'default'
            })
        });

        if (!response.ok) throw new Error('Emotion refinement failed');

        currentData = await response.json();
        displayResults(currentData);
        showScreen('playerScreen');
    } catch (e) {
        document.getElementById('loaderText').textContent = 'Error: ' + e.message;
        setTimeout(() => showScreen('playerScreen'), 2000);
    }
}

function declineEmotionRefinement() {
    hideEmotionRefinementPrompt();
}

// --- Gesture Guide ---

function toggleGestureGuide() {
    const guide = document.getElementById('gestureGuide');
    if (!guide) return;
    cvUI.gestureGuideVisible = !cvUI.gestureGuideVisible;
    if (cvUI.gestureGuideVisible) {
        guide.classList.add('visible');
    } else {
        guide.classList.remove('visible');
    }
}

// --- Three.js hand integration helper ---

function getHandPositionForThreeJS() {
    const positions = getHandPositions();
    if (!positions || positions.length === 0) return null;
    // Return first hand, mapped from [0,1] to [-1,1]
    return {
        x: (positions[0].x - 0.5) * 2,
        y: -(positions[0].y - 0.5) * 2  // flip Y
    };
}
