// ============================================
// Hear Me Out — Meditation Screen
// ============================================

let meditationData = null;
let meditationAudio = null;
let meditationSegmentIndex = 0;
let meditationTimer = null;
let meditationPaused = false;

// Standalone meditation triggered from mode selection (with therapy profile)
async function startStandaloneMeditation(profile) {
    const userId = getUserId();
    const sessionId = (typeof questionnaire !== 'undefined' && questionnaire.sessionId)
        ? questionnaire.sessionId : 'session_' + Date.now();

    showScreen('meditationScreen');

    const textEl = document.getElementById('meditationText');
    const titleEl = document.getElementById('meditationTitle');
    const progressEl = document.getElementById('meditationProgress');

    textEl.textContent = 'Preparing your meditation...';
    titleEl.textContent = '';
    if (progressEl) progressEl.style.width = '0%';

    // Build context from therapy profile
    let storyContext = null;
    if (profile) {
        const goalDescriptions = {
            comfort: 'finding comfort and reassurance',
            motivation: 'building inner strength and motivation',
            distraction: 'letting go and finding a peaceful escape',
            validation: 'feeling understood and accepted',
            release: 'releasing tension and pent-up emotions',
            calm: 'deep relaxation and inner calm',
        };
        storyContext = `The listener is feeling ${profile.emotional_state || 'uncertain'} and dealing with ${profile.concern || 'general unease'}. They need ${goalDescriptions[profile.therapeutic_goal] || 'comfort'}. Intensity: ${profile.intensity || 'moderate'}.`;
    }

    try {
        const response = await fetch('/api/meditation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                session_id: sessionId,
                mode: 'standalone',
                story_context: storyContext
            })
        });

        if (!response.ok) throw new Error('Failed to generate meditation');

        meditationData = await response.json();
        titleEl.textContent = meditationData.title || 'Guided Meditation';

        if (meditationData.audio_url) {
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

        // Load ambient audio if available
        if (meditationData.audio_url) {
            meditationAudio = new Audio(meditationData.audio_url);
            meditationAudio.loop = true;
            meditationAudio.volume = 0.3;
        }

        // Start the guided segments
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

    // Start ambient audio on first segment
    if (meditationSegmentIndex === 0 && meditationAudio) {
        meditationAudio.play().catch(() => {});
    }

    // Schedule next segment
    const pauseMs = (segment.pause_seconds || 5) * 1000 + 4000; // pause + reading time
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

    if (currentData) {
        showScreen('playerScreen');
    } else {
        // Clear session state for fresh start
        sessionStorage.removeItem('questionnaire_pre_done');
        sessionStorage.removeItem('therapy_profile');
        sessionStorage.removeItem('hearmeout_mode');
        showScreen('modeSelectScreen');
    }
}
