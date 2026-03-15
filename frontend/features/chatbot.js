// ============================================
// AI Chatbot — Compassionate Music Therapy Assistant
// ============================================

const chatbot = {
    isOpen: false,
    history: [],
    lastSummary: null,
    lastEmotionalProfile: null,

    toggle() {
        const panel = document.getElementById('chatbotPanel');
        if (!panel) return;

        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            panel.classList.add('open');
            this.loadHistory();
            const input = document.getElementById('chatInput');
            if (input) input.focus();
        } else {
            panel.classList.remove('open');
        }
    },

    close() {
        const panel = document.getElementById('chatbotPanel');
        if (panel) panel.classList.remove('open');
        this.isOpen = false;
    },

    async loadHistory() {
        try {
            const resp = await fetch(`/api/chat/history?user_id=${getUserId()}`);
            if (resp.ok) {
                const data = await resp.json();
                this.history = data.messages || [];
                this.renderMessages();
            }
        } catch (e) {
            console.warn('Failed to load chat history:', e);
        }
    },

    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        // Show "Use for song" button after 2+ exchanges
        if (this.history.filter(m => m.role === 'user').length >= 2) {
            this.showUseForSongBtn();
        }

        if (this.history.length === 0) {
            const onPlayerScreen = document.getElementById('playerScreen')?.classList.contains('active');
            const welcomeMsg = onPlayerScreen
                ? "How did the song feel? Tell me what you liked, what you'd change, or how you're feeling now — I'll help shape your next song."
                : "Hi there! I'm your music therapy companion. Tell me about what you're feeling, and I'll help you shape it into a story for your song.";
            container.innerHTML = `
                <div class="chat-welcome">
                    <p>${welcomeMsg}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.history.map(msg => `
            <div class="chat-msg ${msg.role}">
                <div class="chat-bubble">${this.escapeHtml(msg.content)}</div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    async send() {
        const input = document.getElementById('chatInput');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        // Crisis safety check
        if (typeof crisis !== 'undefined') {
            const check = crisis.checkForCrisis(message);
            if (check.detected) crisis.showModal();
        }

        // Add user message to UI immediately
        this.history.push({ role: 'user', content: message });
        this.renderMessages();
        input.value = '';

        // Show typing indicator
        const container = document.getElementById('chatMessages');
        const typingEl = document.createElement('div');
        typingEl.className = 'chat-msg assistant';
        typingEl.innerHTML = '<div class="chat-bubble typing">...</div>';
        container.appendChild(typingEl);
        container.scrollTop = container.scrollHeight;

        try {
            const resp = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: getUserId(),
                    message: message,
                    history: this.history.slice(-20) // send last 20 messages for context
                })
            });

            const data = await resp.json();

            // Remove typing indicator
            typingEl.remove();

            // Add assistant response
            this.history.push({ role: 'assistant', content: data.reply });
            this.renderMessages();

            // Store emotional profile if present (with backward compat)
            if (data.emotional_profile) {
                this.lastEmotionalProfile = data.emotional_profile;
            } else if (data.therapeutic_context) {
                this.lastEmotionalProfile = data.therapeutic_context;
            }

            // Check if response contains a summary
            if (data.summary) {
                this.lastSummary = data.summary;
                this.showUseForSongBtn();
            }
        } catch (e) {
            typingEl.remove();
            this.history.push({ role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' });
            this.renderMessages();
        }
    },

    showUseForSongBtn() {
        const btn = document.getElementById('useForSongBtn');
        if (btn) btn.style.display = 'flex';
    },

    useForSong() {
        // Build story text from summary or last few messages
        let storyText = this.lastSummary;
        if (!storyText) {
            // Use the user's messages as the story input
            const userMessages = this.history.filter(m => m.role === 'user');
            storyText = userMessages.map(m => m.content).join('. ');
        }
        if (!storyText) return;

        const textarea = document.getElementById('storyInput');
        if (textarea) {
            textarea.value = storyText;
            textarea.dispatchEvent(new Event('input'));
        }
        // Pass emotional profile to the generate flow
        window._emotionalProfile = this.lastEmotionalProfile || null;
        showScreen('inputScreen');
        this.close();
    },

    handleKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.send();
        }
    }
};
