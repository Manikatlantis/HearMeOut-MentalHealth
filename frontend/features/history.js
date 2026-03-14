// ============================================
// Hear Me Out — Session History Panel
// ============================================

let historyLoaded = false;

async function loadHistory() {
    const userId = getUserId();
    const container = document.getElementById('historyList');
    if (!container) return;

    container.innerHTML = '<p class="history-loading">Loading sessions...</p>';

    try {
        const response = await fetch(`/api/history/${userId}`);
        if (!response.ok) throw new Error('Failed to load history');

        const sessions = await response.json();

        if (!sessions.length) {
            container.innerHTML = '<p class="history-empty">No past sessions yet. Create your first song!</p>';
            return;
        }

        container.innerHTML = sessions.map(s => {
            const f = s.musical_features || {};
            const snippet = (s.user_input || '').slice(0, 80);
            const date = new Date(s.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const mood = f.mood || '';
            const genre = f.genre || '';

            return `
                <div class="history-item glass" onclick="replaySession('${s.session_id}')">
                    <div class="history-date">${date}</div>
                    <div class="history-snippet">${snippet}${snippet.length >= 80 ? '...' : ''}</div>
                    <div class="history-tags">
                        ${mood ? `<span class="history-tag">${mood}</span>` : ''}
                        ${genre ? `<span class="history-tag">${genre}</span>` : ''}
                        ${f.tempo ? `<span class="history-tag">${f.tempo} BPM</span>` : ''}
                    </div>
                    <button class="history-replay-btn">Replay</button>
                </div>
            `;
        }).join('');

        historyLoaded = true;
    } catch (e) {
        container.innerHTML = '<p class="history-empty">Could not load history.</p>';
    }
}

function replaySession(sessionId) {
    // Fetch the session and load it into the player
    const userId = getUserId();
    fetch(`/api/history/${userId}`)
        .then(r => r.json())
        .then(sessions => {
            const session = sessions.find(s => s.session_id === sessionId);
            if (!session) return;

            // Build currentData-compatible object
            currentData = {
                session_id: session.session_id,
                iteration: session.iteration || 0,
                narrative: session.narrative || '',
                lyrics: session.lyrics || '',
                musical_features: session.musical_features || {},
                audio_url: session.audio_filename ? `/audio/${session.audio_filename}` : null,
            };

            displayResults(currentData);
            showScreen('playerScreen');
        });
}

function toggleHistoryPanel() {
    const panel = document.getElementById('historyPanel');
    if (!panel) return;

    if (panel.style.display === 'none' || !panel.style.display) {
        panel.style.display = 'block';
        panel.style.animation = 'none';
        panel.offsetHeight;
        panel.style.animation = 'slideDown 0.4s ease forwards';
        if (!historyLoaded) loadHistory();
    } else {
        panel.style.display = 'none';
    }
}
