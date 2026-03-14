// ============================================
// Ethics Disclaimer Modal
// ============================================

const ethics = {
    cvOptOut: false,

    init() {
        this.cvOptOut = localStorage.getItem('cv_opt_out') === 'true';
        const accepted = localStorage.getItem('ethics_accepted');
        if (!accepted) {
            // Hide all screens and show ethics modal
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            this.show();
        } else {
            this.applyCvOptOut();
            // If ethics accepted but no pre-questionnaire done this session, show it
            if (!sessionStorage.getItem('questionnaire_pre_done')) {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                if (typeof showScreen === 'function') {
                    showScreen('questionnairePreScreen');
                }
            }
        }
    },

    show() {
        const modal = document.getElementById('ethicsModal');
        if (modal) modal.classList.add('visible');
    },

    accept() {
        // Check CV opt-out toggle state
        const toggle = document.getElementById('cvOptOutToggle');
        if (toggle) {
            this.cvOptOut = toggle.checked;
            localStorage.setItem('cv_opt_out', this.cvOptOut);
        }

        localStorage.setItem('ethics_accepted', 'true');
        const modal = document.getElementById('ethicsModal');
        if (modal) modal.classList.remove('visible');

        this.applyCvOptOut();

        // Show questionnaire pre-screen after ethics acceptance
        if (typeof showScreen === 'function') {
            showScreen('questionnairePreScreen');
        }
    },

    applyCvOptOut() {
        if (this.cvOptOut) {
            const camBtn = document.getElementById('webcamToggleBtn');
            if (camBtn) {
                camBtn.disabled = true;
                camBtn.style.opacity = '0.3';
                camBtn.style.pointerEvents = 'none';
                camBtn.title = 'Camera disabled (opted out in ethics settings)';
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ethics.init();
});
