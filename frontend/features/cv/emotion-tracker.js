// ============================================
// Emotion Tracker — face-api.js integration
// Collects emotion timeline during playback,
// analyzes results, builds feedback for refinement
// ============================================

let emotionTracker = {
    active: false,
    modelsLoaded: false,
    timeline: [],
    intervalId: null,
    videoEl: null,
    analysis: null
};

async function initEmotionModels() {
    if (emotionTracker.modelsLoaded) return true;
    if (typeof faceapi === 'undefined') {
        console.warn('face-api.js not loaded');
        return false;
    }
    try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        emotionTracker.modelsLoaded = true;
        return true;
    } catch (e) {
        console.warn('Failed to load face-api models:', e);
        return false;
    }
}

function startEmotionTracking(videoElement) {
    if (!emotionTracker.modelsLoaded || !videoElement) return;
    emotionTracker.active = true;
    emotionTracker.videoEl = videoElement;
    emotionTracker.timeline = [];
    emotionTracker.analysis = null;

    emotionTracker.intervalId = setInterval(async () => {
        if (!emotionTracker.active) return;
        try {
            const detection = await faceapi
                .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
                .withFaceLandmarks()
                .withFaceExpressions();

            if (detection) {
                const player = document.getElementById('audioPlayer');
                const emotions = detection.expressions;

                // Extract 68 landmarks normalized to [0,1]
                const vw = videoElement.videoWidth || videoElement.width || 640;
                const vh = videoElement.videoHeight || videoElement.height || 480;
                if (detection.landmarks) {
                    const positions = detection.landmarks.positions;
                    const normalized = positions.map(p => ({
                        x: p.x / vw,
                        y: p.y / vh
                    }));
                    let dominantForGeometry = 'neutral';
                    let maxValForGeometry = 0;
                    for (const [em, val] of Object.entries(emotions)) {
                        if (val > maxValForGeometry) {
                            maxValForGeometry = val;
                            dominantForGeometry = em;
                        }
                    }
                    if (typeof faceGeometry !== 'undefined') {
                        faceGeometry.updateLandmarks(normalized, dominantForGeometry, maxValForGeometry);
                    }
                    if (typeof faceEmotionPanel !== 'undefined') {
                        faceEmotionPanel.setEmotion(dominantForGeometry, maxValForGeometry);
                    }
                }
                let dominantEmotion = 'neutral';
                let maxVal = 0;
                for (const [emotion, val] of Object.entries(emotions)) {
                    if (val > maxVal) {
                        maxVal = val;
                        dominantEmotion = emotion;
                    }
                }
                emotionTracker.timeline.push({
                    timestamp: player.currentTime,
                    emotions: { ...emotions },
                    dominantEmotion,
                    lyricsLineIndex: typeof lastActiveIdx !== 'undefined' ? lastActiveIdx : -1
                });

                // Update live badge
                updateEmotionBadge(dominantEmotion, maxVal);
            }
        } catch (e) {
            // Silently skip detection errors
        }
    }, 500);
}

function stopEmotionTracking() {
    emotionTracker.active = false;
    if (emotionTracker.intervalId) {
        clearInterval(emotionTracker.intervalId);
        emotionTracker.intervalId = null;
    }
}

function resetEmotionTracker() {
    stopEmotionTracking();
    emotionTracker.timeline = [];
    emotionTracker.analysis = null;
    const badge = document.getElementById('emotionBadge');
    if (badge) badge.textContent = '';
}

// --- Post-Playback Analysis ---

function analyzeEmotionTimeline() {
    const tl = emotionTracker.timeline;
    if (tl.length < 3) return null;

    // Sliding window analysis (3-second windows at 500ms intervals = ~6 samples)
    const windowSize = 6;
    const windows = [];
    for (let i = 0; i <= tl.length - windowSize; i++) {
        const slice = tl.slice(i, i + windowSize);
        const avgEmotions = {};
        const emotionKeys = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral'];
        for (const key of emotionKeys) {
            avgEmotions[key] = slice.reduce((s, e) => s + (e.emotions[key] || 0), 0) / slice.length;
        }
        windows.push({
            startTime: slice[0].timestamp,
            endTime: slice[slice.length - 1].timestamp,
            avgEmotions,
            positiveScore: (avgEmotions.happy || 0) + (avgEmotions.surprised || 0) * 0.5,
            flatScore: avgEmotions.neutral || 0,
            lyricsLineIndex: slice[Math.floor(slice.length / 2)].lyricsLineIndex
        });
    }

    // Sort by positive score to find peaks
    const sortedByPositive = [...windows].sort((a, b) => b.positiveScore - a.positiveScore);
    const peakMoments = sortedByPositive.slice(0, 3).filter(w => w.positiveScore > 0.3);

    // Sort by flat score to find flat moments
    const sortedByFlat = [...windows].sort((a, b) => b.flatScore - a.flatScore);
    const flatMoments = sortedByFlat.slice(0, 3).filter(w => w.flatScore > 0.5);

    // Overall dominant emotion
    const totalEmotions = {};
    const emotionKeys = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral'];
    for (const key of emotionKeys) {
        totalEmotions[key] = tl.reduce((s, e) => s + (e.emotions[key] || 0), 0) / tl.length;
    }
    let overallDominant = 'neutral';
    let maxAvg = 0;
    for (const [k, v] of Object.entries(totalEmotions)) {
        if (v > maxAvg) { maxAvg = v; overallDominant = k; }
    }

    // Engagement score (inversely proportional to neutral)
    const engagementScore = Math.min(1, Math.max(0, 1 - (totalEmotions.neutral || 0)));

    emotionTracker.analysis = { peakMoments, flatMoments, overallDominant, engagementScore, totalEmotions };
    return emotionTracker.analysis;
}

// --- Build feedback string for /refine endpoint ---

function buildEmotionFeedback(analysis) {
    if (!analysis) return null;
    const parts = [];

    if (analysis.peakMoments.length > 0) {
        const peakSections = analysis.peakMoments.map(p => {
            const section = getSectionForLyricsIndex(p.lyricsLineIndex);
            return section || `the section around ${Math.round(p.startTime)}s`;
        });
        const unique = [...new Set(peakSections)];
        parts.push(`The listener felt most emotionally moved during ${unique.join(' and ')}. Amplify and expand those elements — they resonated strongly.`);
    }

    if (analysis.flatMoments.length > 0) {
        const flatSections = analysis.flatMoments.map(p => {
            const section = getSectionForLyricsIndex(p.lyricsLineIndex);
            return section || `the section around ${Math.round(p.startTime)}s`;
        });
        const unique = [...new Set(flatSections)];
        parts.push(`${unique.join(' and ')} felt emotionally flat — rework to be more emotionally resonant.`);
    }

    if (analysis.overallDominant !== 'neutral' && analysis.overallDominant !== 'happy') {
        parts.push(`The overall listener mood was "${analysis.overallDominant}" — consider whether to lean into this or contrast it.`);
    }

    if (analysis.engagementScore < 0.3) {
        parts.push('Overall emotional engagement was low — make the song more dynamic and emotionally varied.');
    }

    return parts.length > 0 ? parts.join(' ') : 'The listener was moderately engaged. Enhance the most memorable moments.';
}

function getSectionForLyricsIndex(idx) {
    if (idx < 0 || typeof lyricsTimeline === 'undefined' || !lyricsTimeline.length) return null;
    // Walk backwards from idx to find nearest section label
    for (let i = idx; i >= 0; i--) {
        if (lyricsTimeline[i] && lyricsTimeline[i].type === 'label') {
            return 'the ' + lyricsTimeline[i].text + ' section';
        }
    }
    return null;
}

// --- Heatmap data for UI ---

function getEmotionHeatmapData() {
    const tl = emotionTracker.timeline;
    if (tl.length === 0) return [];
    return tl.map(entry => ({
        timestamp: entry.timestamp,
        dominant: entry.dominantEmotion,
        happy: entry.emotions.happy || 0,
        sad: entry.emotions.sad || 0,
        neutral: entry.emotions.neutral || 0,
        surprised: entry.emotions.surprised || 0
    }));
}

function updateEmotionBadge(emotion, confidence) {
    const badge = document.getElementById('emotionBadge');
    if (!badge) return;
    const emotionEmojis = {
        happy: '😊', sad: '😢', angry: '😠', fearful: '😨',
        disgusted: '🤢', surprised: '😮', neutral: '😐'
    };
    badge.textContent = emotionEmojis[emotion] || '😐';
    badge.title = `${emotion} (${Math.round(confidence * 100)}%)`;
}
