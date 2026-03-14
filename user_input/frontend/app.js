// ============================================
// Hear Me Out — Main Application Logic
// ============================================

let currentData = null;
let isPlaying = false;
let lyricsTimeline = [];
let lyricsAnimFrame = null;

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
}

// ---- Generate Song ----
async function generate() {
    const text = document.getElementById('storyInput').value.trim();
    if (!text) return;

    const btn = document.getElementById('generateBtn');
    btn.disabled = true;

    showScreen('loadingScreen');
    animateProgress();

    try {
        const response = await fetch('/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, user_id: getUserId() })
        });

        if (!response.ok) throw new Error('Generation failed');

        currentData = await response.json();
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

    // Tags
    const tags = [f.genre, f.mood, f.tempo + ' BPM', f.scale, f.dynamics, ...f.instruments];
    document.getElementById('trackTags').innerHTML =
        tags.map(t => `<span class="tag">${t}</span>`).join('');

    // Lyrics
    document.getElementById('lyricsStatic').textContent = data.lyrics || 'No lyrics';

    // Narrative
    document.getElementById('narrativeText').textContent = data.narrative;

    // Build lyrics timeline for overlay animation
    buildLyricsTimeline(data.lyrics, f.duration || 30);

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

function buildLyricsTimeline(lyricsText, totalDuration) {
    lyricsTimeline = [];
    lastActiveIdx = -1;
    if (!lyricsText) return;

    const lines = lyricsText.split('\n').filter(l => l.trim());
    const totalLines = lines.filter(l => !l.startsWith('[')).length;
    if (totalLines === 0) return;

    // Vocals start after intro (~25% in), spread across 65% of song
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
                words: trimmed.split(/\s+/),
                time: startOffset + lineIndex * timePerLine,
                duration: timePerLine,
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

    // Only re-render when active index changes
    if (activeIdx === lastActiveIdx) return;
    lastActiveIdx = activeIdx;

    // Show all past lines + active + 1 upcoming
    const endIdx = Math.min(lyricsTimeline.length - 1, activeIdx + 1);

    let html = '';
    for (let i = 0; i <= endIdx; i++) {
        const item = lyricsTimeline[i];

        if (item.type === 'label') {
            html += `<div class="lyrics-section-label">${item.text}</div>`;
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

    showScreen('inputScreen');
}

// ---- Iterate Panel ----
const MOOD_OPTIONS = ['happy', 'sad', 'energetic', 'calm', 'melancholy', 'aggressive', 'romantic', 'dark', 'euphoric', 'nostalgic'];
const GENRE_OPTIONS = ['pop', 'rock', 'hip-hop', 'jazz', 'classical', 'electronic', 'r&b', 'folk', 'country', 'metal', 'ambient', 'reggae', 'blues', 'indie'];
const INSTRUMENT_OPTIONS = ['piano', 'guitar', 'drums', 'bass', 'violin', 'synth', 'trumpet', 'flute', 'cello', 'saxophone', 'harmonica', 'ukulele', 'tabla', 'sitar'];
const DYNAMICS_OPTIONS = ['soft', 'moderate', 'loud', 'building', 'explosive', 'whisper'];

let iterateSelections = { moods: [], genres: [], instruments: [], dynamics: [] };

function toggleIteratePanel() {
    const panel = document.getElementById('iteratePanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        panel.style.animation = 'none';
        panel.offsetHeight;
        panel.style.animation = 'slideDown 0.4s ease forwards';
        populateIterateChips();
    } else {
        panel.style.display = 'none';
    }
}

function populateIterateChips() {
    if (!currentData) return;
    const f = currentData.musical_features;

    // Set tempo slider
    document.getElementById('iterTempo').value = f.tempo;
    document.getElementById('iterTempoVal').textContent = f.tempo;

    // Pre-select current values
    iterateSelections.moods = [f.mood];
    iterateSelections.genres = [f.genre];
    iterateSelections.instruments = [...f.instruments];
    iterateSelections.dynamics = [f.dynamics];

    renderChips('moodChips', MOOD_OPTIONS, iterateSelections.moods, 'moods');
    renderChips('genreChips', GENRE_OPTIONS, iterateSelections.genres, 'genres');
    renderChips('instrumentChips', INSTRUMENT_OPTIONS, iterateSelections.instruments, 'instruments');
    renderChips('dynamicsChips', DYNAMICS_OPTIONS, iterateSelections.dynamics, 'dynamics');
}

function renderChips(containerId, options, selected, key) {
    const container = document.getElementById(containerId);
    container.innerHTML = options.map(opt => {
        const active = selected.includes(opt) ? 'active' : '';
        return `<button class="chip ${active}" onclick="toggleChip('${key}','${opt}','${containerId}')">${opt}</button>`;
    }).join('');
}

function toggleChip(key, value, containerId) {
    const arr = iterateSelections[key];
    const idx = arr.indexOf(value);
    if (idx >= 0) {
        arr.splice(idx, 1);
    } else {
        // For dynamics and genres, only allow one selection
        if (key === 'dynamics' || key === 'genres') {
            arr.length = 0;
        }
        arr.push(value);
    }

    const optionsMap = { moods: MOOD_OPTIONS, genres: GENRE_OPTIONS, instruments: INSTRUMENT_OPTIONS, dynamics: DYNAMICS_OPTIONS };
    renderChips(containerId, optionsMap[key], arr, key);
}

function buildFeedbackString() {
    const parts = [];
    const f = currentData.musical_features;
    const newTempo = parseInt(document.getElementById('iterTempo').value);

    if (newTempo !== f.tempo) {
        parts.push(`Change tempo to ${newTempo} BPM`);
    }
    if (iterateSelections.moods.length && iterateSelections.moods[0] !== f.mood) {
        parts.push(`Change mood to ${iterateSelections.moods.join(', ')}`);
    }
    if (iterateSelections.genres.length && iterateSelections.genres[0] !== f.genre) {
        parts.push(`Change genre to ${iterateSelections.genres.join(', ')}`);
    }

    const origInst = new Set(f.instruments);
    const newInst = new Set(iterateSelections.instruments);
    const added = iterateSelections.instruments.filter(i => !origInst.has(i));
    const removed = f.instruments.filter(i => !newInst.has(i));
    if (added.length) parts.push(`Add instruments: ${added.join(', ')}`);
    if (removed.length) parts.push(`Remove instruments: ${removed.join(', ')}`);

    if (iterateSelections.dynamics.length && iterateSelections.dynamics[0] !== f.dynamics) {
        parts.push(`Change dynamics to ${iterateSelections.dynamics[0]}`);
    }

    const notes = document.getElementById('iterNotes').value.trim();
    if (notes) parts.push(notes);

    return parts.join('. ') || 'Regenerate with similar settings';
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
                session_id: currentData ? currentData.session_id : 'default',
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

// ---- Utilities ----
function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
