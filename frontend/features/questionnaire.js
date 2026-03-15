// ============================================
// Mental Health Questionnaire (Pre/Post Session)
// ============================================

// --- PRE-SESSION: mental health assessment ---
const PRE_QUESTIONS = [
    {
        id: 'emotional_state',
        text: 'How are you feeling right now?',
        type: 'single',
        options: [
            { label: 'Anxious or overwhelmed', value: 'anxious' },
            { label: 'Sad or low', value: 'sad' },
            { label: 'Angry or frustrated', value: 'angry' },
            { label: 'Numb or disconnected', value: 'numb' },
            { label: 'Okay but could be better', value: 'neutral' },
            { label: 'Hopeful', value: 'hopeful' },
        ]
    },
    {
        id: 'concern',
        text: "What's weighing on you most?",
        type: 'single',
        options: [
            { label: 'Stress from work or school', value: 'stress' },
            { label: 'Relationship difficulties', value: 'relationships' },
            { label: 'Loneliness or isolation', value: 'loneliness' },
            { label: 'Self-doubt or low confidence', value: 'self_doubt' },
            { label: 'Grief or loss', value: 'grief' },
            { label: 'General unease, hard to pinpoint', value: 'general' },
            { label: 'Nothing specific, just exploring', value: 'none' },
        ]
    },
    {
        id: 'therapeutic_goal',
        text: 'What do you need from this session?',
        type: 'single',
        options: [
            { label: 'Comfort and reassurance', value: 'comfort' },
            { label: 'Motivation and energy', value: 'motivation' },
            { label: 'Distraction — take my mind off things', value: 'distraction' },
            { label: 'To feel understood and seen', value: 'validation' },
            { label: 'Release — let it all out', value: 'release' },
            { label: 'Calm and relaxation', value: 'calm' },
        ]
    },
    {
        id: 'intensity',
        text: 'How intense should the experience be?',
        type: 'single',
        options: [
            { label: 'Gentle — keep it soft and light', value: 'gentle' },
            { label: 'Moderate — I can handle some depth', value: 'moderate' },
            { label: 'Deep — I want to really feel it', value: 'deep' },
        ]
    }
];

// --- POST-SESSION: reflection ---
const POST_QUESTIONS = [
    "How connected do you feel to your emotions now?",
    "How much relief or release do you feel?",
    "How at ease does your mind feel?",
    "How hopeful do you feel about your situation?",
    "How present and grounded do you feel?",
    "Did the music match what you needed?",
    "How comfortable did you feel expressing yourself?",
    "How calm does your body feel?",
    "Would you use this experience again?",
];

const POST_SCORE_LABELS = ["Not at all", "A little", "Moderately", "Very much"];

// Therapy profile — collected from quiz + chat + user story
let therapyProfile = null;

const questionnaire = {
    preAnswers: null,
    postAnswers: null,
    sessionId: null,

    renderQuestions(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (containerId === 'postQuestions') {
            this.renderPostQuestions(container);
            return;
        }

        // Render pre-session mental health questions
        container.innerHTML = PRE_QUESTIONS.map(q => `
            <div class="q-item">
                <p class="q-text">${q.text}</p>
                <div class="q-options q-options-vertical">
                    ${q.options.map(opt => `
                        <button class="q-option q-option-wide"
                                data-question="${q.id}" data-value="${opt.value}"
                                onclick="questionnaire.selectOption(this, '${containerId}')">
                            <span class="q-score-dot"></span>
                            <span class="q-label">${opt.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    renderPostQuestions(container) {
        container.innerHTML = POST_QUESTIONS.map((q, i) => `
            <div class="q-item">
                <p class="q-text">${q}</p>
                <div class="q-options">
                    ${POST_SCORE_LABELS.map((label, score) => `
                        <button class="q-option" data-question="${i}" data-score="${score}" onclick="questionnaire.selectOption(this, 'postQuestions')">
                            <span class="q-score-dot"></span>
                            <span class="q-label">${label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    selectOption(btn, containerId) {
        const questionKey = btn.dataset.question || btn.dataset.value;
        const container = document.getElementById(containerId);
        // Deselect other options for this question
        const questionId = btn.dataset.question;
        container.querySelectorAll(`[data-question="${questionId}"]`).forEach(b => b.classList.remove('selected'));
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
        // Map quiz answers to music generation parameters
        const profile = {
            emotional_state: answers.emotional_state,
            concern: answers.concern,
            therapeutic_goal: answers.therapeutic_goal,
            intensity: answers.intensity,
        };

        // Derive musical guidance from therapeutic goal
        const goalGuidance = {
            comfort: {
                mood_hint: 'warm, tender, reassuring',
                lyric_direction: 'lyrics should be comforting and hopeful, like a warm embrace — tell the listener they are not alone and things will be okay',
                energy_hint: 'low to moderate',
            },
            motivation: {
                mood_hint: 'uplifting, empowering, energetic',
                lyric_direction: 'lyrics should be motivational and empowering — encourage strength, resilience, and forward momentum',
                energy_hint: 'moderate to high',
            },
            distraction: {
                mood_hint: 'fun, playful, light-hearted',
                lyric_direction: 'lyrics should NOT directly address the listener\'s problems — instead paint vivid, imaginative, escapist imagery that transports them somewhere beautiful or exciting',
                energy_hint: 'moderate',
            },
            validation: {
                mood_hint: 'empathetic, soulful, intimate',
                lyric_direction: 'lyrics should validate the listener\'s feelings — acknowledge their pain or struggle without trying to fix it, make them feel truly seen and heard',
                energy_hint: 'low to moderate',
            },
            release: {
                mood_hint: 'raw, emotional, cathartic',
                lyric_direction: 'lyrics should channel intense emotion — give permission to feel everything deeply, building toward a cathartic release',
                energy_hint: 'moderate to high',
            },
            calm: {
                mood_hint: 'peaceful, serene, meditative',
                lyric_direction: 'lyrics should guide the listener toward stillness and peace — use gentle imagery of nature, breath, and quiet moments',
                energy_hint: 'very low',
            },
        };

        const guidance = goalGuidance[answers.therapeutic_goal] || goalGuidance.comfort;
        profile.mood_hint = guidance.mood_hint;
        profile.lyric_direction = guidance.lyric_direction;
        profile.energy_hint = guidance.energy_hint;

        return profile;
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

        // Build therapy profile from answers
        therapyProfile = this.buildTherapyProfile(answers);
        // Store it so other modules can access it
        sessionStorage.setItem('therapy_profile', JSON.stringify(therapyProfile));

        // Send to backend
        try {
            await fetch('/api/questionnaire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: getUserId(),
                    session_id: this.sessionId,
                    phase: 'pre',
                    answers: Object.values(answers),
                    therapy_profile: therapyProfile
                })
            });
        } catch (e) {
            console.warn('Failed to save pre-questionnaire:', e);
        }

        // Route based on selected mode
        const mode = sessionStorage.getItem('hearmeout_mode') || 'music';
        if (mode === 'meditation') {
            showScreen('meditationScreen');
            startStandaloneMeditation(therapyProfile);
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

// --- Mode Selection ---
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
