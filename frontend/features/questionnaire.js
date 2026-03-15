// ============================================
// Mental Health Check-In (4 targeted questions)
// + Mode Selection (Music Therapy / Guided Meditation)
// ============================================

const PRE_QUESTIONS = [
    {
        id: 'emotional_state',
        text: 'How are you feeling right now?',
        options: [
            { label: 'Sad or down', value: 'sad' },
            { label: 'Anxious or restless', value: 'anxious' },
            { label: 'Angry or frustrated', value: 'angry' },
            { label: 'Numb or empty', value: 'numb' },
        ]
    },
    {
        id: 'concern',
        text: 'What\'s weighing on you the most?',
        options: [
            { label: 'A relationship', value: 'relationship' },
            { label: 'Stress or pressure', value: 'stress' },
            { label: 'Loss or grief', value: 'grief' },
            { label: 'Feeling lost or stuck', value: 'lost' },
        ]
    },
    {
        id: 'therapeutic_goal',
        text: 'What do you need from this session?',
        options: [
            { label: 'To feel understood', value: 'validation' },
            { label: 'To let it out', value: 'release' },
            { label: 'To find calm', value: 'calm' },
            { label: 'To feel hopeful', value: 'hope' },
        ]
    },
    {
        id: 'intensity',
        text: 'How intense are your feelings right now?',
        options: [
            { label: 'Mild — a light weight', value: 'mild' },
            { label: 'Moderate — hard to ignore', value: 'moderate' },
            { label: 'Heavy — it\'s a lot', value: 'heavy' },
            { label: 'Overwhelming', value: 'overwhelming' },
        ]
    }
];

// Post-session questions (unchanged from original 9-question scale)
const POST_QUESTIONS = [
    "How connected do you feel to your emotions now?",
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

        if (containerId === 'preQuestions') {
            // New 4-question format
            container.innerHTML = PRE_QUESTIONS.map(q => `
                <div class="q-item">
                    <p class="q-text">${q.text}</p>
                    <div class="q-options q-options-vertical">
                        ${q.options.map(opt => `
                            <button class="q-option q-option-wide" data-question="${q.id}" data-value="${opt.value}" onclick="questionnaire.selectOption(this, '${containerId}')">
                                <span class="q-label">${opt.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } else {
            // Post-session: original scale format
            container.innerHTML = POST_QUESTIONS.map((q, i) => `
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
        }
    },

    selectOption(btn, containerId) {
        const questionKey = btn.dataset.question || btn.dataset.questionId;
        const container = document.getElementById(containerId);
        container.querySelectorAll(`[data-question="${questionKey}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    },

    collectPreAnswers() {
        const answers = {};
        for (const q of PRE_QUESTIONS) {
            const selected = document.querySelector(`#preQuestions [data-question="${q.id}"].selected`);
            if (!selected) return null;
            answers[q.id] = selected.dataset.value;
        }
        return answers;
    },

    collectPostAnswers() {
        const answers = [];
        for (let i = 0; i < POST_QUESTIONS.length; i++) {
            const selected = document.querySelector(`#postQuestions [data-question="${i}"].selected`);
            if (!selected) return null;
            answers.push(parseInt(selected.dataset.score));
        }
        return answers;
    },

    buildTherapyProfile(answers) {
        const moodMap = {
            sad: 'melancholy', anxious: 'tense', angry: 'intense', numb: 'somber'
        };
        const directionMap = {
            validation: 'lyrics about being seen and understood',
            release: 'raw emotional expression and catharsis',
            calm: 'soothing reassurance and peace',
            hope: 'gentle encouragement and looking forward'
        };
        const energyMap = {
            mild: 'low-medium', moderate: 'medium', heavy: 'medium-high', overwhelming: 'low'
        };

        return {
            mood_hint: moodMap[answers.emotional_state] || 'reflective',
            concern: answers.concern,
            therapeutic_need: answers.therapeutic_goal,
            lyric_direction: directionMap[answers.therapeutic_goal] || 'emotionally supportive',
            energy_hint: energyMap[answers.intensity] || 'medium',
            emotional_state: answers.emotional_state,
            intensity: answers.intensity,
        };
    },

    async submitPre() {
        const answers = this.collectPreAnswers();
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
        localStorage.setItem('current_session_id', this.sessionId);
        sessionStorage.setItem('questionnaire_pre_done', 'true');

        // Build and store therapy profile
        const profile = this.buildTherapyProfile(answers);
        sessionStorage.setItem('therapy_profile', JSON.stringify(profile));

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

        // Route based on mode
        const mode = sessionStorage.getItem('hearmeout_mode');
        if (mode === 'meditation') {
            startStandaloneMeditation(profile);
        } else {
            showScreen('inputScreen');
        }
    },

    async submitPost() {
        const answers = this.collectPostAnswers();
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

        if (typeof saveEmotionData === 'function') saveEmotionData();

        showScreen('questionnaireResultScreen');

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

        html += `<div id="emotionArcContainer"></div>`;

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
                <button class="q-submit-btn" onclick="showScreen('modeSelectScreen')">
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

        if (typeof emotionArc !== 'undefined') {
            const arcContainer = document.getElementById('emotionArcContainer');
            if (arcContainer) {
                const timeline = (typeof emotionTracker !== 'undefined') ? emotionTracker.timeline : [];
                const wa = (typeof currentData !== 'undefined' && currentData) ? currentData.word_alignment : null;
                const player = document.getElementById('audioPlayer');
                const dur = player ? player.duration : 30;
                emotionArc.render(arcContainer, {
                    timeline: timeline,
                    wordAlignment: wa,
                    duration: isFinite(dur) ? dur : 30,
                    emotionInsight: recap.emotion_insight || null
                });
            }
        }
    },

    showInterpretation(data) {
        const el = document.getElementById('questionnaireResult');
        if (!el) return;

        el.innerHTML = `
            <div class="q-result-card glass">
                <div class="q-result-icon">&#9835;</div>
                <p class="q-result-text">Thank you for sharing how you feel. Your reflections help personalize your experience.</p>
                <button class="q-result-btn" onclick="showScreen('modeSelectScreen')">
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

// Mode selection
function selectMode(mode) {
    sessionStorage.setItem('hearmeout_mode', mode);
    showScreen('questionnairePreScreen');
}

// Helper to get or create user ID
function getUserId() {
    let userId = localStorage.getItem('hearmeout_user_id');
    if (!userId) {
        userId = 'user_' + crypto.randomUUID();
        localStorage.setItem('hearmeout_user_id', userId);
    }
    return userId;
}
