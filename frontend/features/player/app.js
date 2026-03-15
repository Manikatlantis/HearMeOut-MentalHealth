// ============================================
// Hear Me Out — Main Application Logic
// ============================================

let currentData = null;
let isPlaying = false;
let lyricsTimeline = [];
let lyricsAnimFrame = null;
let currentSessionId = null;

// ---- User Identity (anonymous UUID in localStorage) ----
function getUserId() {
    let uid = localStorage.getItem('hearmeout_user_id');
    if (!uid) {
        uid = crypto.randomUUID ? crypto.randomUUID() :
              'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                  const r = Math.random() * 16 | 0;
                  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
              });
        localStorage.setItem('hearmeout_user_id', uid);
    }
    return uid;
}

// ---- Screen Management ----
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(id);
    screen.classList.add('active');
    // Re-trigger animation
    screen.style.animation = 'none';
    screen.offsetHeight; // reflow
    screen.style.animation = '';

    // Render questionnaire questions when screens are shown
    if (id === 'questionnairePreScreen' && typeof questionnaire !== 'undefined') {
        questionnaire.renderQuestions('preQuestions');
    }
    if (id === 'questionnairePostScreen' && typeof questionnaire !== 'undefined') {
        questionnaire.renderQuestions('postQuestions');
    }
}

// ---- Generate Song ----
async function generate() {
    const text = document.getElementById('storyInput').value.trim();
    if (!text) return;

    // Crisis safety check
    if (typeof crisis !== 'undefined') {
        const check = crisis.checkForCrisis(text);
        if (check.detected) crisis.showModal();
    }

    const btn = document.getElementById('generateBtn');
    btn.disabled = true;

    showScreen('loadingScreen');
    animateProgress();

    try {
        currentSessionId = (typeof questionnaire !== 'undefined' && questionnaire.sessionId)
            ? questionnaire.sessionId
            : 'session_' + Date.now();
        const processBody = {
            text,
            session_id: currentSessionId,
            user_id: getUserId()
        };
        // Include emotional profile from chatbot if available
        if (window._emotionalProfile) {
            processBody.emotional_profile = window._emotionalProfile;
            window._emotionalProfile = null;
        }
        // Include therapy profile from quiz if available
        const storedProfile = sessionStorage.getItem('therapy_profile');
        if (storedProfile) {
            processBody.therapy_profile = JSON.parse(storedProfile);
        }
        const response = await fetch('/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(processBody)
        });

        if (!response.ok) throw new Error('Generation failed');

        currentData = await response.json();
        // Update currentSessionId from server response (server may generate a new one)
        if (currentData.session_id) currentSessionId = currentData.session_id;
        displayResults(currentData);
        showScreen('playerScreen');

    } catch (e) {
        document.getElementById('loaderText').textContent = 'Error: ' + e.message;
        setTimeout(() => {
            showScreen('inputScreen');
        }, 2000);
    }

    btn.disabled = false;
}

// ---- Progress Animation ----
function animateProgress() {
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('loaderText');
    const stages = [
        { pct: 15, msg: 'Crafting your narrative...' },
        { pct: 35, msg: 'Extracting musical features...' },
        { pct: 55, msg: 'Writing lyrics...' },
        { pct: 75, msg: 'Composing music with AI vocals...' },
        { pct: 90, msg: 'Almost there...' },
    ];
    let i = 0;
    fill.style.width = '0%';

    const interval = setInterval(() => {
        if (i < stages.length) {
            fill.style.width = stages[i].pct + '%';
            text.textContent = stages[i].msg;
            i++;
        }
    }, 8000);

    // Clean up when screen changes
    const observer = new MutationObserver(() => {
        if (!document.getElementById('loadingScreen').classList.contains('active')) {
            clearInterval(interval);
            fill.style.width = '100%';
            observer.disconnect();
        }
    });
    observer.observe(document.getElementById('loadingScreen'), { attributes: true });
}

// ---- Display Results ----
function displayResults(data) {
    // Audio
    const player = document.getElementById('audioPlayer');
    if (data.audio_url) {
        player.src = data.audio_url;
    }

    // Track title from genre + mood
    const f = data.musical_features;
    document.getElementById('trackTitle').textContent =
        capitalize(f.mood) + ' ' + capitalize(f.genre);

    // Hide technical music tags — not relevant for mental health experience
    document.getElementById('trackTags').innerHTML = '';

    // Lyrics
    document.getElementById('lyricsStatic').textContent = data.lyrics || 'No lyrics';

    // Narrative
    document.getElementById('narrativeText').textContent = data.narrative;

    // Build lyrics timeline for overlay animation
    buildLyricsTimeline(data.lyrics, f.duration || 30, data.word_alignment);

    // Draw waveform bars
    drawWaveformBars();
}

// ---- Audio Player ----
function togglePlay() {
    const player = document.getElementById('audioPlayer');
    const art = document.getElementById('albumArt');

    if (player.paused) {
        // Connect analyser on first play
        connectAudioAnalyser(player);
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

        player.play();
        isPlaying = true;
        document.getElementById('playIcon').style.display = 'none';
        document.getElementById('pauseIcon').style.display = 'block';
        art.classList.add('spinning');
        if (document.getElementById('miniPlayIcon'))
            document.getElementById('miniPlayIcon').textContent = '❚❚';

        // Start emotion tracking if webcam is active
        if (typeof cvUI !== 'undefined' && cvUI.webcamActive) {
            const video = document.getElementById('cvVideo');
            if (video && typeof startEmotionTracking === 'function') {
                startEmotionTracking(video);
            }
        }

        // Show lyrics overlay
        showLyricsOverlay();
    } else {
        player.pause();
        isPlaying = false;
        document.getElementById('playIcon').style.display = 'block';
        document.getElementById('pauseIcon').style.display = 'none';
        art.classList.remove('spinning');
        if (document.getElementById('miniPlayIcon'))
            document.getElementById('miniPlayIcon').textContent = '▶';

        // Save emotion data on pause if significant data collected
        if (typeof emotionTracker !== 'undefined' && emotionTracker.timeline.length > 5) {
            saveEmotionData();
        }
    }
}

// Update progress
setInterval(() => {
    const player = document.getElementById('audioPlayer');
    if (!player.duration) return;

    const pct = (player.currentTime / player.duration) * 100;
    document.getElementById('waveformProgress').style.width = pct + '%';

    const m = Math.floor(player.currentTime / 60);
    const s = Math.floor(player.currentTime % 60).toString().padStart(2, '0');
    const timeStr = m + ':' + s;
    document.getElementById('timeDisplay').textContent = timeStr;

    // Update mini time in lyrics overlay
    const miniTime = document.getElementById('miniTime');
    if (miniTime) miniTime.textContent = timeStr;

    // Update lyrics overlay
    updateLyricsOverlay(player.currentTime, player.duration);
}, 100);

// Seek
function seekAudio(e) {
    const player = document.getElementById('audioPlayer');
    if (!player.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    player.currentTime = pct * player.duration;
}

// On ended
document.addEventListener('DOMContentLoaded', () => {
    const player = document.getElementById('audioPlayer');
    player.addEventListener('ended', () => {
        isPlaying = false;
        document.getElementById('playIcon').style.display = 'block';
        document.getElementById('pauseIcon').style.display = 'none';
        document.getElementById('albumArt').classList.remove('spinning');
        hideLyricsOverlay();

        // Emotion analysis on song end
        if (typeof stopEmotionTracking === 'function') {
            stopEmotionTracking();
        }
        if (typeof analyzeEmotionTimeline === 'function' && typeof emotionTracker !== 'undefined' && emotionTracker.timeline.length > 5) {
            const analysis = analyzeEmotionTimeline();
            if (analysis) {
                if (typeof renderEmotionHeatmap === 'function') renderEmotionHeatmap();
                if (typeof showEmotionRefinementPrompt === 'function') showEmotionRefinementPrompt(analysis);
            }
        }

        // Persist emotion data to backend
        saveEmotionData();

        // Show post-session questionnaire
        if (typeof questionnaire !== 'undefined' && !questionnaire.postAnswers) {
            setTimeout(() => showScreen('questionnairePostScreen'), 1500);
        }
    });
});

// Draw fake waveform bars
function drawWaveformBars() {
    const canvas = document.getElementById('waveformCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = 80;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bars = 80;
    const barW = canvas.width / bars;
    const mid = canvas.height / 2;

    for (let i = 0; i < bars; i++) {
        const h = (Math.sin(i * 0.3) * 0.5 + 0.5) * 25 + Math.random() * 10 + 5;
        const gradient = ctx.createLinearGradient(0, mid - h, 0, mid + h);
        gradient.addColorStop(0, 'rgba(244, 114, 182, 0.6)');
        gradient.addColorStop(1, 'rgba(45, 212, 191, 0.3)');
        ctx.fillStyle = gradient;
        ctx.fillRect(i * barW + 1, mid - h, barW - 2, h * 2);
    }
}

// ---- Lyrics Overlay Animation ----
let lastActiveIdx = -1;

function buildLyricsTimeline(lyricsText, totalDuration, wordAlignment) {
    lyricsTimeline = [];
    lastActiveIdx = -1;
    if (!lyricsText) return;

    // If server provided alignment data, use it directly
    if (wordAlignment && wordAlignment.lines && wordAlignment.lines.length > 0) {
        let lastSection = null;
        wordAlignment.lines.forEach(line => {
            // Insert section label when section changes
            if (line.section && line.section !== lastSection) {
                lyricsTimeline.push({
                    type: 'label',
                    text: line.section.toUpperCase(),
                    time: line.start,
                });
                lastSection = line.section;
            }
            lyricsTimeline.push({
                type: 'line',
                text: line.text,
                words: line.words || line.text.split(/\s+/).map(w => ({ word: w })),
                time: line.start,
                endTime: line.end,
                duration: line.end - line.start,
                hasWordTimes: !!(line.words && line.words.length > 0 && line.words[0].start != null),
            });
        });
        return;
    }

    // Fallback: estimate timing client-side (original logic)
    const lines = lyricsText.split('\n').filter(l => l.trim());
    const totalLines = lines.filter(l => !l.startsWith('[')).length;
    if (totalLines === 0) return;

    const startOffset = totalDuration * 0.25;
    const availableTime = totalDuration * 0.65;
    const timePerLine = availableTime / totalLines;
    let lineIndex = 0;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('[')) {
            lyricsTimeline.push({
                type: 'label',
                text: trimmed.replace(/[\[\]]/g, '').toUpperCase(),
                time: startOffset + lineIndex * timePerLine,
            });
        } else if (trimmed) {
            lyricsTimeline.push({
                type: 'line',
                text: trimmed,
                words: trimmed.split(/\s+/).map(w => ({ word: w })),
                time: startOffset + lineIndex * timePerLine,
                duration: timePerLine,
                hasWordTimes: false,
            });
            lineIndex++;
        }
    });
}

function showLyricsOverlay() {
    const overlay = document.getElementById('lyricsOverlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('visible');
    if (typeof setLyricsActive === 'function') setLyricsActive(true);
}

function hideLyricsOverlay() {
    const overlay = document.getElementById('lyricsOverlay');
    overlay.classList.remove('visible');
    overlay.classList.add('hidden');
    lastActiveIdx = -1;
    if (typeof setLyricsActive === 'function') setLyricsActive(false);
}

function updateLyricsOverlay(currentTime, duration) {
    if (!isPlaying || lyricsTimeline.length === 0) return;

    const container = document.getElementById('lyricsLines');

    // Find active line
    let activeIdx = -1;
    for (let i = lyricsTimeline.length - 1; i >= 0; i--) {
        if (currentTime >= lyricsTimeline[i].time) {
            activeIdx = i;
            break;
        }
    }

    // For word-level highlighting, update even if line hasn't changed
    const activeItem = activeIdx >= 0 ? lyricsTimeline[activeIdx] : null;
    const needsWordUpdate = activeItem && activeItem.type === 'line' && activeItem.hasWordTimes;

    if (activeIdx === lastActiveIdx && !needsWordUpdate) return;

    const lineChanged = activeIdx !== lastActiveIdx;
    lastActiveIdx = activeIdx;

    // Show all past lines + active + 1 upcoming
    const endIdx = Math.min(lyricsTimeline.length - 1, activeIdx + 1);

    if (lineChanged) {
        let html = '';
        for (let i = 0; i <= endIdx; i++) {
            const item = lyricsTimeline[i];

            if (item.type === 'label') {
                html += `<div class="lyrics-section-label">${item.text}</div>`;
            } else if (item.hasWordTimes) {
                // Render each word as a span for highlighting
                const isActive = i === activeIdx;
                const wordSpans = item.words.map((w, wi) => {
                    let cls = 'lyric-word';
                    if (isActive) {
                        if (w.start != null && currentTime >= w.start) {
                            cls += (w.end != null && currentTime < w.end) ? ' word-active' : ' word-past';
                        }
                    } else if (i < activeIdx) {
                        cls += ' word-past';
                    }
                    return `<span class="${cls}" data-start="${w.start}" data-end="${w.end}">${w.word}</span>`;
                }).join(' ');
                html += `<div class="lyrics-line">${wordSpans}</div>`;
            } else {
                html += `<div class="lyrics-line">${item.text}</div>`;
            }
        }
        container.innerHTML = html;

        // Auto-scroll to the latest line
        const allLines = container.querySelectorAll('.lyrics-line');
        if (allLines.length) {
            allLines[allLines.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else if (needsWordUpdate) {
        // Just update word classes on the active line without full re-render
        const allLines = container.querySelectorAll('.lyrics-line');
        if (allLines.length) {
            const activeLine = allLines[allLines.length - (endIdx > activeIdx ? 2 : 1)];
            if (activeLine) {
                const spans = activeLine.querySelectorAll('.lyric-word');
                spans.forEach(span => {
                    const start = parseFloat(span.dataset.start);
                    const end = parseFloat(span.dataset.end);
                    span.classList.remove('word-active', 'word-past');
                    if (!isNaN(start) && currentTime >= start) {
                        if (!isNaN(end) && currentTime < end) {
                            span.classList.add('word-active');
                        } else {
                            span.classList.add('word-past');
                        }
                    }
                });
            }
        }
    }
}

// ---- Save Emotion Data Helper ----
function saveEmotionData() {
    if (typeof emotionTracker !== 'undefined' && emotionTracker.timeline.length > 0 && currentSessionId) {
        fetch('/api/emotion-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionId,
                user_id: getUserId(),
                emotion_timeline: emotionTracker.timeline
            })
        }).catch(e => console.warn('Failed to save emotion data:', e));
    }
}

// ---- Reset ----
function reset() {
    const player = document.getElementById('audioPlayer');
    player.pause();
    player.src = '';
    isPlaying = false;
    document.getElementById('playIcon').style.display = 'block';
    document.getElementById('pauseIcon').style.display = 'none';
    document.getElementById('albumArt').classList.remove('spinning');
    hideLyricsOverlay();
    document.getElementById('waveformProgress').style.width = '0%';
    document.getElementById('timeDisplay').textContent = '0:00';

    // Persist any collected emotion data before resetting
    saveEmotionData();

    // Reset CV features
    if (typeof resetEmotionTracker === 'function') resetEmotionTracker();
    if (typeof stopWebcam === 'function') stopWebcam();
    if (typeof hideEmotionRefinementPrompt === 'function') hideEmotionRefinementPrompt();
    if (typeof resetAllEffects === 'function') resetAllEffects();
    const heatmap = document.getElementById('emotionHeatmap');
    if (heatmap) heatmap.style.display = 'none';
    const btn = document.getElementById('webcamToggleBtn');
    if (btn) {
        btn.classList.remove('active');
        const btnText = btn.querySelector('.btn-text');
        if (btnText) btnText.textContent = 'Camera';
    }

    // Clear session state so user picks mode again
    sessionStorage.removeItem('questionnaire_pre_done');
    sessionStorage.removeItem('therapy_profile');
    sessionStorage.removeItem('hearmeout_mode');
    if (typeof questionnaire !== 'undefined') {
        questionnaire.preAnswers = null;
        questionnaire.postAnswers = null;
    }

    showScreen('modeSelectScreen');
}

// ---- Iterate Panel ----
function toggleIteratePanel() {
    const panel = document.getElementById('iteratePanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        panel.style.animation = 'none';
        panel.offsetHeight;
        panel.style.animation = 'slideDown 0.4s ease forwards';
    } else {
        panel.style.display = 'none';
    }
}

function buildFeedbackString() {
    const notes = document.getElementById('iterNotes').value.trim();
    return notes || 'Regenerate with similar settings';
}

async function iterate() {
    const feedback = buildFeedbackString();

    // Stop current playback
    const player = document.getElementById('audioPlayer');
    player.pause();
    isPlaying = false;
    document.getElementById('playIcon').style.display = 'block';
    document.getElementById('pauseIcon').style.display = 'none';
    document.getElementById('albumArt').classList.remove('spinning');
    hideLyricsOverlay();

    // Hide iterate panel and show loading
    document.getElementById('iteratePanel').style.display = 'none';
    showScreen('loadingScreen');
    animateProgress();

    try {
        const response = await fetch('/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedback,
                session_id: currentSessionId || (currentData ? currentData.session_id : 'default'),
                user_id: getUserId()
            })
        });

        if (!response.ok) throw new Error('Refinement failed');

        currentData = await response.json();
        displayResults(currentData);
        showScreen('playerScreen');
    } catch (e) {
        document.getElementById('loaderText').textContent = 'Error: ' + e.message;
        setTimeout(() => showScreen('playerScreen'), 2000);
    }
}

// ---- Recap Refine Panel ----
function toggleRecapRefinePanel() {
    const panel = document.getElementById('recapIteratePanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        panel.style.animation = 'none';
        panel.offsetHeight;
        panel.style.animation = 'slideDown 0.4s ease forwards';
    } else {
        panel.style.display = 'none';
    }
}

async function iterateFromRecap() {
    const notes = document.getElementById('recapIterNotes').value.trim();
    const feedback = notes || 'Regenerate with similar settings';

    showScreen('loadingScreen');
    animateProgress();

    try {
        const response = await fetch('/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedback,
                session_id: currentSessionId || (currentData ? currentData.session_id : 'default'),
                user_id: getUserId()
            })
        });

        if (!response.ok) throw new Error('Refinement failed');

        currentData = await response.json();

        // Reset post-questionnaire state so the flow can repeat
        if (typeof questionnaire !== 'undefined') {
            questionnaire.postAnswers = null;
        }

        displayResults(currentData);
        showScreen('playerScreen');
    } catch (e) {
        document.getElementById('loaderText').textContent = 'Error: ' + e.message;
        setTimeout(() => showScreen('playerScreen'), 2000);
    }
}

// ---- Utilities ----
function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
