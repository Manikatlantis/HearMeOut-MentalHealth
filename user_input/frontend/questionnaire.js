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

        // Send to backend
        try {
            const resp = await fetch('/api/questionnaire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: getUserId(),
                    session_id: sessionId,
                    phase: 'post',
                    answers: answers
                })
            });
            const data = await resp.json();

            // Show friendly interpretation
            this.showInterpretation(data);
        } catch (e) {
            console.warn('Failed to save post-questionnaire:', e);
        }

        showScreen('questionnaireResultScreen');
    },

    showInterpretation(data) {
        const el = document.getElementById('questionnaireResult');
        if (!el) return;

        const delta = (data.delta !== undefined) ? data.delta : null;
        let message;

        if (delta === null) {
            message = "Thank you for sharing how you feel. Your reflections help personalize your experience.";
        } else if (delta > 3) {
            message = "Your emotional state shows positive movement! The music seems to have resonated with you deeply.";
        } else if (delta > 0) {
            message = "There's a gentle positive shift in your emotional state. Music has a beautiful way of lifting spirits.";
        } else if (delta === 0) {
            message = "Your emotional state feels steady and grounded. Sometimes stability is exactly what we need.";
        } else {
            message = "Thank you for being honest about how you feel. Every session is a step in your journey, and it's okay to feel different things.";
        }

        el.innerHTML = `
            <div class="q-result-card glass">
                <div class="q-result-icon">&#9835;</div>
                <p class="q-result-text">${message}</p>
                <button class="q-result-btn" onclick="showScreen('inputScreen')">
                    <span class="btn-text">Continue</span>
                </button>
            </div>
        `;
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
