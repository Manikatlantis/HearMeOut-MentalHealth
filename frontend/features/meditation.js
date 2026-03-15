// ============================================
// Hear Me Out — Meditation Screen
// ============================================

let meditationData = null;
let meditationAudio = null;
let meditationSegmentIndex = 0;
let meditationTimer = null;
let meditationPaused = false;

async function startMeditation() {
    const userId = getUserId();
    const sessionId = currentData ? currentData.session_id : null;
    const storyContext = currentData ? currentData.narrative : null;

    showScreen('meditationScreen');

    const textEl = document.getElementById('meditationText');
    const titleEl = document.getElementById('meditationTitle');
    const progressEl = document.getElementById('meditationProgress');

    textEl.textContent = 'Preparing your meditation...';
    titleEl.textContent = '';
    if (progressEl) progressEl.style.width = '0%';

    try {
        const response = await fetch('/api/meditation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                session_id: sessionId,
                mode: storyContext ? 'story-connected' : 'standalone',
                story_context: storyContext
            })
        });

        if (!response.ok) throw new Error('Failed to generate meditation');

        meditationData = await response.json();
        titleEl.textContent = meditationData.title || 'Guided Meditation';

        // Load narration audio if available (TTS voice)
        if (meditationData.narration_url) {
            meditationAudio = new Audio(meditationData.narration_url);
            meditationAudio.volume = 1.0;
        } else if (meditationData.audio_url) {
            meditationAudio = new Audio(meditationData.audio_url);
            meditationAudio.loop = true;
            meditationAudio.volume = 0.3;
        }

        meditationSegmentIndex = 0;
        meditationPaused = false;

        // If we have narration audio, play it and sync text
        if (meditationData.narration_url && meditationAudio) {
            meditationAudio.play().catch(() => {});
        }

        playMeditationSegment();

    } catch (e) {
        textEl.textContent = 'Could not start meditation. Please try again.';
    }
}

// Standalone meditation — called from quiz when meditation mode is selected
async function startStandaloneMeditation(profile) {
    showScreen('meditationScreen');

    const textEl = document.getElementById('meditationText');
    const titleEl = document.getElementById('meditationTitle');
    const progressEl = document.getElementById('meditationProgress');

    textEl.textContent = 'Creating your personalized meditation...';
    titleEl.textContent = '';
    if (progressEl) progressEl.style.width = '0%';

    try {
        const response = await fetch('/api/meditation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: getUserId(),
                mode: 'standalone',
                therapy_profile: profile
            })
        });

        if (!response.ok) throw new Error('Failed to generate meditation');

        meditationData = await response.json();
        titleEl.textContent = meditationData.title || 'Guided Meditation';

        // Load narration audio (TTS voice)
        if (meditationData.narration_url) {
            meditationAudio = new Audio(meditationData.narration_url);
            meditationAudio.volume = 1.0;
            meditationAudio.play().catch(() => {});
        } else if (meditationData.audio_url) {
            meditationAudio = new Audio(meditationData.audio_url);
            meditationAudio.loop = true;
            meditationAudio.volume = 0.3;
        }

        meditationSegmentIndex = 0;
        meditationPaused = false;
        playMeditationSegment();

    } catch (e) {
        textEl.textContent = 'Could not start meditation. Please try again.';
    }
}

function playMeditationSegment() {
    if (!meditationData || meditationPaused) return;

    const segments = meditationData.segments;
    if (meditationSegmentIndex >= segments.length) {
        finishMeditation();
        return;
    }

    const segment = segments[meditationSegmentIndex];
    const textEl = document.getElementById('meditationText');
    const progressEl = document.getElementById('meditationProgress');

    // Fade transition
    textEl.style.opacity = '0';
    setTimeout(() => {
        textEl.textContent = segment.text;
        textEl.style.opacity = '1';
    }, 500);

    // Update progress
    const pct = ((meditationSegmentIndex + 1) / segments.length) * 100;
    if (progressEl) progressEl.style.width = pct + '%';

    // Start audio on first segment if not already playing
    if (meditationSegmentIndex === 0 && meditationAudio && meditationAudio.paused) {
        meditationAudio.play().catch(() => {});
    }

    // Schedule next segment
    const pauseMs = (segment.pause_seconds || 5) * 1000 + 4000;
    meditationTimer = setTimeout(() => {
        meditationSegmentIndex++;
        playMeditationSegment();
    }, pauseMs);
}

function toggleMeditationPause() {
    meditationPaused = !meditationPaused;
    const btn = document.getElementById('meditationPauseBtn');

    if (meditationPaused) {
        clearTimeout(meditationTimer);
        if (meditationAudio) meditationAudio.pause();
        if (btn) btn.textContent = 'Continue';
    } else {
        if (meditationAudio) meditationAudio.play().catch(() => {});
        playMeditationSegment();
        if (btn) btn.textContent = 'Pause';
    }
}

function finishMeditation() {
    const textEl = document.getElementById('meditationText');
    textEl.style.opacity = '0';
    setTimeout(() => {
        textEl.textContent = 'Take a deep breath. When you\'re ready, return gently.';
        textEl.style.opacity = '1';
    }, 500);

    // Fade out audio
    if (meditationAudio) {
        let vol = meditationAudio.volume;
        const fadeOut = setInterval(() => {
            vol -= 0.02;
            if (vol <= 0) {
                meditationAudio.pause();
                meditationAudio.volume = 0;
                clearInterval(fadeOut);
            } else {
                meditationAudio.volume = vol;
            }
        }, 100);
    }
}

function exitMeditation() {
    clearTimeout(meditationTimer);
    if (meditationAudio) {
        meditationAudio.pause();
        meditationAudio = null;
    }
    meditationData = null;
    meditationSegmentIndex = 0;
    meditationPaused = false;

    if (typeof currentData !== 'undefined' && currentData) {
        showScreen('playerScreen');
    } else {
        showScreen('modeSelectScreen');
    }
}
