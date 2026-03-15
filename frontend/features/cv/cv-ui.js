// ============================================
// CV UI — Webcam overlay, gesture guide,
// emotion heatmap, effect indicators, refinement modal
// ============================================

let cvUI = {
    webcamActive: false,
    stream: null,
    gestureGuideVisible: false,
    overlayRafId: null
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
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            });
            cvUI.stream = stream;
            video.srcObject = stream;
            await video.play();
            cvUI.webcamActive = true;
            btn.classList.add('active');
            btn.querySelector('.btn-text').textContent = 'Camera On';

            // Dock webcam into current screen
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen) {
                updateWebcamForScreen(activeScreen.id);
            }

            // Init models if not done
            const emotionReady = await initEmotionModels();
            const gestureReady = initGestureMixer(video);

            if (emotionReady) {
                document.getElementById('emotionBadge').style.display = 'block';
                // Start face detection immediately so face geometry works on all screens
                startEmotionTracking(video);
            }
            if (gestureReady) {
                startGestureMixer();
                document.getElementById('effectIndicators').classList.add('visible');
            }

            // Init shared geometry canvas and overlays
            const hgCanvas = document.getElementById('handGeometryCanvas');
            if (hgCanvas) {
                if (typeof handGeometry !== 'undefined') {
                    handGeometry.init(hgCanvas);
                }
                if (typeof faceGeometry !== 'undefined') {
                    faceGeometry.init(hgCanvas);
                }
            }
            if (typeof faceEmotionPanel !== 'undefined') {
                faceEmotionPanel.init();
            }
            startOverlayRenderLoop();
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

    // Deactivate all docks and move overlay back to body
    const overlay = document.getElementById('webcamOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
        document.body.appendChild(overlay);
    }
    document.querySelectorAll('.webcam-dock').forEach(d => d.classList.remove('active'));
    document.getElementById('effectIndicators').classList.remove('visible');

    if (cvUI.overlayRafId) {
        cancelAnimationFrame(cvUI.overlayRafId);
        cvUI.overlayRafId = null;
    }
    if (typeof faceGeometry !== 'undefined') faceGeometry.destroy();
    if (typeof faceEmotionPanel !== 'undefined') faceEmotionPanel.destroy();
    if (typeof handGeometry !== 'undefined') handGeometry.destroy();
    stopGestureMixer();
    stopEmotionTracking();
}

// --- Shared overlay render loop ---

function startOverlayRenderLoop() {
    const canvas = document.getElementById('handGeometryCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function loop() {
        cvUI.overlayRafId = requestAnimationFrame(loop);

        // Sync canvas size
        const rect = canvas.getBoundingClientRect();
        const dw = Math.round(rect.width) || 320;
        const dh = Math.round(rect.height) || 240;
        if (canvas.width !== dw || canvas.height !== dh) {
            canvas.width = dw;
            canvas.height = dh;
        }

        // Clear once per frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw face geometry first (underneath hands)
        if (typeof faceGeometry !== 'undefined') {
            faceGeometry.drawFrame(ctx, canvas);
        }

        // Draw hand geometry on top
        if (typeof handGeometry !== 'undefined') {
            handGeometry.drawFrame(ctx, canvas);
        }
    }

    cvUI.overlayRafId = requestAnimationFrame(loop);
}

// --- Persistent webcam across screens (reparenting into docks) ---

const _webcamDockMap = {
    'playerScreen': 'playerWebcamDock',
    'meditationScreen': 'meditationWebcamDock'
};

function updateWebcamForScreen(screenId) {
    const overlay = document.getElementById('webcamOverlay');
    if (!overlay) return;

    // Deactivate all docks
    document.querySelectorAll('.webcam-dock').forEach(d => d.classList.remove('active'));

    if (!cvUI.webcamActive) return;

    const dockId = _webcamDockMap[screenId];
    if (dockId) {
        const dock = document.getElementById(dockId);
        if (dock) {
            dock.appendChild(overlay);
            dock.classList.add('active');
            overlay.classList.add('visible');
        }
    } else {
        // Move back to body, hide overlay (stream stays alive)
        document.body.appendChild(overlay);
        overlay.classList.remove('visible');
    }
}

function updateWebcamForLyricsOverlay(isShowing) {
    const overlay = document.getElementById('webcamOverlay');
    if (!overlay || !cvUI.webcamActive) return;

    document.querySelectorAll('.webcam-dock').forEach(d => d.classList.remove('active'));

    if (isShowing) {
        const dock = document.getElementById('lyricsWebcamDock');
        if (dock) {
            dock.appendChild(overlay);
            dock.classList.add('active');
            overlay.classList.add('visible');
        }
    } else {
        // Return to player dock
        updateWebcamForScreen('playerScreen');
    }
}

// --- Effect Indicator Bar ---

function updateEffectIndicators() {
    const values = getEffectValues();
    if (!values) return;

    // Determine mode from filter type
    let mode = 'Normal';
    if (values.filterType === 'highpass' && values.filterFreq < 1000) {
        mode = 'Vocal';
    } else if (values.filterType === 'lowpass' && values.filterFreq < 5000) {
        mode = 'Bass';
    }

    const indicators = {
        'fx-volume': { label: 'Vol', val: values.volume.toFixed(1), active: Math.abs(values.volume - 1.0) > 0.05 },
        'fx-filter': { label: 'Mode', val: mode, active: mode !== 'Normal' },
        'fx-distortion': { label: 'Dist', val: Math.round(values.distortionAmount), active: values.distortionAmount > 1 },
        'fx-delay': { label: 'Delay', val: values.delayTime.toFixed(2) + 's', active: values.delayTime > 0.01 },
        'fx-reverb': { label: 'Reverb', val: Math.round(values.reverbWet * 100) + '%', active: values.reverbWet > 0.01 },
        'fx-pan': { label: 'Pan', val: values.pan.toFixed(2), active: Math.abs(values.pan) > 0.05 }
    };

    for (const [id, info] of Object.entries(indicators)) {
        const el = document.getElementById(id);
        if (!el) continue;
        const labelSpan = el.querySelector('.fx-label');
        if (labelSpan) labelSpan.textContent = info.label;
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
