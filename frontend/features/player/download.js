// ============================================
// Hear Me Out — Download Button Logic
// ============================================

function downloadSong() {
    if (!currentData || !currentData.session_id) return;

    const sessionId = currentData.session_id;
    const f = currentData.musical_features || {};
    const mood = f.mood || 'song';
    const genre = f.genre || 'ai';
    const date = new Date().toISOString().slice(0, 10);
    const filename = `hearmeout_${mood}_${genre}_${date}.mp3`;

    const link = document.createElement('a');
    link.href = `/api/download/${sessionId}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
