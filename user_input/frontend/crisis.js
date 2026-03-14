// ============================================
// Crisis Safety Net — Keyword Detection + Modal
// ============================================

const crisis = {
    HIGH_KEYWORDS: [
        "suicide", "kill myself", "end my life", "want to die",
        "self-harm", "cutting myself", "overdose", "end it all",
        "kill me", "take my life", "don't want to live",
        "don't want to be alive", "better off dead"
    ],
    MEDIUM_KEYWORDS: [
        "can't go on", "no reason to live", "better off without me",
        "not worth living", "hurt myself", "give up on life",
        "no point in living", "hopeless", "can't take it anymore",
        "wish i was dead", "wish i wasn't here", "nothing left"
    ],

    checkForCrisis(text) {
        if (!text) return { detected: false, severity: null };
        const lower = text.toLowerCase();

        for (const kw of this.HIGH_KEYWORDS) {
            const regex = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
            if (regex.test(lower)) return { detected: true, severity: 'high' };
        }
        for (const kw of this.MEDIUM_KEYWORDS) {
            const regex = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
            if (regex.test(lower)) return { detected: true, severity: 'medium' };
        }
        return { detected: false, severity: null };
    },

    showModal() {
        const modal = document.getElementById('crisisModal');
        if (modal) {
            modal.classList.add('visible');
        }
    },

    dismissModal() {
        const modal = document.getElementById('crisisModal');
        if (modal) {
            modal.classList.remove('visible');
        }
    }
};
