// ============================================
// Mental Health Questionnaire (Pre/Post Session)
// ============================================

const QUESTIONNAIRE_QUESTIONS = [
    "How connected do you feel to your emotions today?",
    "How much creative energy do you feel right now?",
    "How at ease does your mind feel?",
    "How open are you to exploring your feelings through music?",
    "How present and grounded do you feel in this moment?",
    "How much hope or optimism are you experiencing?",
    "How comfortable do you feel expressing yourself?",
    "How calm does your body feel right now?",
    "How ready do you feel to let music guide your emotions?"
];

const SCORE_LABELS = ["Not at all", "A little", "Moderately", "Very much"];

const questionnaire = {
    preAnswers: null,
    postAnswers: null,
    sessionId: null,

    renderQuestions(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = QUESTIONNAIRE_QUESTIONS.map((q, i) => `
            <div class="q-item">
                <p class="q-text">${q}</p>
                <div class="q-options">
                    ${SCORE_LABELS.map((label, score) => `
                        <button class="q-option" data-question="${i}" data-score="${score}" onclick="questionnaire.selectOption(this, '${containerId}')">
                            <span class="q-score-dot"></span>
                            <span class="q-label">${label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    selectOption(btn, containerId) {
        const questionIdx = btn.dataset.question;
        const container = document.getElementById(containerId);
        // Deselect other options for this question
        container.querySelectorAll(`[data-question="${questionIdx}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    },

    collectAnswers(containerId) {
        const container = document.getElementById(containerId);
        const answers = [];
        for (let i = 0; i < QUESTIONNAIRE_QUESTIONS.length; i++) {
            const selected = container.querySelector(`[data-question="${i}"].selected`);
            if (!selected) return null; // Not all answered
            answers.push(parseInt(selected.dataset.score));
        }
        return answers;
    },

    async submitPre() {
        const answers = this.collectAnswers('preQuestions');
        if (!answers) {
            const warning = document.getElementById('preWarning');
            if (warning) {
                warning.textContent = 'Please answer all questions before continuing.';
                warning.style.display = 'block';
            }
            return;
        }

        this.preAnswers = answers;
        this.sessionId = 'session_' + Date.now();

        // Store in localStorage for later reference
        localStorage.setItem('current_session_id', this.sessionId);

        // Mark pre-questionnaire as done for this session
        sessionStorage.setItem('questionnaire_pre_done', 'true');

        // Send to backend
        try {
            await fetch('/api/questionnaire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: getUserId(),
                    session_id: this.sessionId,
                    phase: 'pre',
                    answers: answers
                })
            });
        } catch (e) {
            console.warn('Failed to save pre-questionnaire:', e);
        }

        showScreen('inputScreen');
    },

    async submitPost() {
        const answers = this.collectAnswers('postQuestions');
        if (!answers) {
            const warning = document.getElementById('postWarning');
            if (warning) {
                warning.textContent = 'Please answer all questions before continuing.';
                warning.style.display = 'block';
            }
            return;
        }

        this.postAnswers = answers;
        const sessionId = this.sessionId || localStorage.getItem('current_session_id') || 'default';

        // Ensure emotion data is persisted before fetching recap
        if (typeof saveEmotionData === 'function') saveEmotionData();

        showScreen('questionnaireResultScreen');

        // Show loading state while we save + fetch recap
        const el = document.getElementById('questionnaireResult');
        if (el) {
            el.innerHTML = `
                <div class="q-result-card glass">
                    <div class="recap-loading">
                        <div class="recap-spinner"></div>
                        <p class="q-result-text">Reflecting on your session...</p>
                    </div>
                </div>
            `;
        }

        // Send post-questionnaire
        try {
            await fetch('/api/questionnaire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: getUserId(),
                    session_id: sessionId,
                    phase: 'post',
                    answers: answers
                })
            });
        } catch (e) {
            console.warn('Failed to save post-questionnaire:', e);
        }

        // Fetch therapeutic recap
        try {
            const recapResp = await fetch('/api/session-recap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: getUserId(),
                    session_id: sessionId
                })
            });
            const recap = await recapResp.json();
            this.showRecap(recap);
        } catch (e) {
            console.warn('Failed to fetch recap:', e);
            this.showInterpretation({});
        }
    },

    showRecap(recap) {
        const el = document.getElementById('questionnaireResult');
        if (!el) return;

        const deltaArrow = recap.delta > 0 ? '&uarr;' : recap.delta < 0 ? '&darr;' : '&mdash;';
        const deltaClass = recap.delta > 0 ? 'positive' : recap.delta < 0 ? 'negative' : 'neutral';

        let html = `<div class="recap-card glass">`;
        html += `<h2 class="recap-headline">${this.escapeHtml(recap.headline || 'Your Musical Journey')}</h2>`;
        html += `<p class="recap-reflection">${this.escapeHtml(recap.reflection || '')}</p>`;

        if (recap.emotion_insight) {
            html += `<div class="recap-section"><span class="recap-section-icon">&#127911;</span><p>${this.escapeHtml(recap.emotion_insight)}</p></div>`;
        }

        if (recap.pre_score !== null && recap.pre_score !== undefined) {
            html += `
                <div class="recap-score-row">
                    <div class="recap-score"><span class="recap-score-label">Before</span><span class="recap-score-value">${recap.pre_score}</span></div>
                    <div class="recap-delta ${deltaClass}"><span class="recap-delta-arrow">${deltaArrow}</span><span>${recap.delta !== null ? Math.abs(recap.delta) : '--'}</span></div>
                    <div class="recap-score"><span class="recap-score-label">After</span><span class="recap-score-value">${recap.post_score !== null ? recap.post_score : '--'}</span></div>
                </div>
            `;
        }

        if (recap.score_insight) {
            html += `<p class="recap-insight">${this.escapeHtml(recap.score_insight)}</p>`;
        }

        if (recap.next_step) {
            html += `<div class="recap-next"><strong>Next time:</strong> ${this.escapeHtml(recap.next_step)}</div>`;
        }

        html += `
            <div class="recap-actions">
                <button class="q-submit-btn" onclick="showScreen('inputScreen')">
                    <span class="btn-text">New Session</span>
                    <span class="btn-icon">&rarr;</span>
                </button>
                <button class="recap-journey-btn glass" onclick="dashboard.show()">
                    <span class="btn-text">&#128200; My Journey</span>
                </button>
            </div>
        `;
        html += `</div>`;
        el.innerHTML = html;
    },

    showInterpretation(data) {
        const el = document.getElementById('questionnaireResult');
        if (!el) return;

        el.innerHTML = `
            <div class="q-result-card glass">
                <div class="q-result-icon">&#9835;</div>
                <p class="q-result-text">Thank you for sharing how you feel. Your reflections help personalize your experience.</p>
                <button class="q-result-btn" onclick="showScreen('inputScreen')">
                    <span class="btn-text">Continue</span>
                </button>
            </div>
        `;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Helper to get or create user ID
function getUserId() {
    let userId = localStorage.getItem('hearmeout_user_id');
    if (!userId) {
        userId = 'user_' + crypto.randomUUID();
        localStorage.setItem('hearmeout_user_id', userId);
    }
    return userId;
}
