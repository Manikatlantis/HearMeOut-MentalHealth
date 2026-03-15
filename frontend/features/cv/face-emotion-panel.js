// ============================================
// Face Emotion Panel — Virtual wireframe avatar
// Shows a small morphing wireframe face with emotion label
// ============================================

const faceEmotionPanel = {
    panelEl: null,
    canvas: null,
    ctx: null,
    labelEl: null,
    rafId: null,

    // Current and target emotion state
    currentEmotion: 'neutral',
    targetEmotion: 'neutral',
    currentConfidence: 0,
    targetConfidence: 0,
    morphProgress: 1, // 0 = at current, 1 = reached target
    currentExpressions: null,

    // Smooth color lerp state
    currentColor: { r: 107, g: 114, b: 128 }, // neutral

    // Morph parameters for avatar (normalized offsets)
    MORPH_STATES: {
        neutral:   { mouthCurve: 0, mouthOpen: 0, browLift: 0, eyeSquint: 0, eyeWide: 0 },
        happy:     { mouthCurve: 0.4, mouthOpen: 0.1, browLift: 0.1, eyeSquint: 0.3, eyeWide: 0 },
        sad:       { mouthCurve: -0.3, mouthOpen: 0, browLift: -0.2, eyeSquint: 0.1, eyeWide: 0 },
        angry:     { mouthCurve: -0.15, mouthOpen: 0.1, browLift: -0.3, eyeSquint: 0.2, eyeWide: 0 },
        fearful:   { mouthCurve: -0.1, mouthOpen: 0.3, browLift: 0.3, eyeSquint: 0, eyeWide: 0.3 },
        surprised: { mouthCurve: 0, mouthOpen: 0.5, browLift: 0.4, eyeSquint: 0, eyeWide: 0.4 },
        disgusted: { mouthCurve: -0.2, mouthOpen: 0.05, browLift: -0.15, eyeSquint: 0.25, eyeWide: 0 }
    },

    // Interpolated morph values
    morph: { mouthCurve: 0, mouthOpen: 0, browLift: 0, eyeSquint: 0, eyeWide: 0 },

    EMOTION_COLORS: {
        happy:     '#fbbf24',
        sad:       '#2dd4bf',
        angry:     '#fb7185',
        fearful:   '#a78bfa',
        surprised: '#f472b6',
        disgusted: '#fb7185',
        neutral:   '#6b7280'
    },

    EMOTION_RGB: {
        happy:     { r: 251, g: 191, b: 36 },
        sad:       { r: 45,  g: 212, b: 191 },
        angry:     { r: 251, g: 113, b: 133 },
        fearful:   { r: 167, g: 139, b: 250 },
        surprised: { r: 244, g: 114, b: 182 },
        disgusted: { r: 251, g: 113, b: 133 },
        neutral:   { r: 107, g: 114, b: 128 }
    },

    init() {
        const overlay = document.getElementById('webcamOverlay');
        if (!overlay) return;

        // Create panel
        this.panelEl = document.createElement('div');
        this.panelEl.className = 'face-emotion-panel';

        this.canvas = document.createElement('canvas');
        this.canvas.width = 120;
        this.canvas.height = 120;
        this.canvas.className = 'face-emotion-canvas';
        this.panelEl.appendChild(this.canvas);

        this.labelEl = document.createElement('div');
        this.labelEl.className = 'face-emotion-label';
        this.labelEl.textContent = 'Neutral';
        this.panelEl.appendChild(this.labelEl);

        overlay.appendChild(this.panelEl);
        this.ctx = this.canvas.getContext('2d');

        this._startLoop();
    },

    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.panelEl && this.panelEl.parentNode) {
            this.panelEl.parentNode.removeChild(this.panelEl);
        }
        this.panelEl = null;
        this.canvas = null;
        this.ctx = null;
        this.labelEl = null;
        this.currentEmotion = 'neutral';
        this.targetEmotion = 'neutral';
        this.morphProgress = 1;
        this.currentExpressions = null;
        this.currentColor = { r: 107, g: 114, b: 128 };
    },

    setEmotion(emotion, confidence, expressions) {
        if (emotion !== this.targetEmotion) {
            this.targetEmotion = emotion;
            this.targetConfidence = confidence;
            this.morphProgress = 0;
        } else {
            this.targetConfidence = confidence;
        }
        if (expressions) {
            this.currentExpressions = { ...expressions };
        }
    },

    _startLoop() {
        const loop = () => {
            this.rafId = requestAnimationFrame(loop);
            this._update();
            this._draw();
        };
        this.rafId = requestAnimationFrame(loop);
    },

    _update() {
        // Interpolate morph toward target
        const target = this.MORPH_STATES[this.targetEmotion] || this.MORPH_STATES.neutral;
        const speed = 0.04; // ~1s transition at 60fps

        for (const key of Object.keys(this.morph)) {
            const t = target[key] || 0;
            this.morph[key] += (t - this.morph[key]) * speed;
        }

        // Interpolate confidence
        this.currentConfidence += (this.targetConfidence - this.currentConfidence) * speed;

        // Smooth color lerp toward target emotion color
        const targetRGB = this.EMOTION_RGB[this.targetEmotion] || this.EMOTION_RGB.neutral;
        const colorSpeed = 0.04;
        this.currentColor.r += (targetRGB.r - this.currentColor.r) * colorSpeed;
        this.currentColor.g += (targetRGB.g - this.currentColor.g) * colorSpeed;
        this.currentColor.b += (targetRGB.b - this.currentColor.b) * colorSpeed;

        // Update label
        if (this.labelEl) {
            const name = this.targetEmotion.charAt(0).toUpperCase() + this.targetEmotion.slice(1);
            this.labelEl.textContent = `${name} (${Math.round(this.targetConfidence * 100)}%)`;
            const c = this.currentColor;
            this.labelEl.style.color = `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
        }
    },

    _draw() {
        const ctx = this.ctx;
        if (!ctx) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const c = this.currentColor;
        const color = `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;

        ctx.clearRect(0, 0, w, h);

        ctx.save();
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;

        // Head ellipse
        ctx.beginPath();
        ctx.ellipse(cx, cy, 38, 48, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Eyebrows
        const browY = cy - 18 + this.morph.browLift * -12;
        // Left brow
        ctx.beginPath();
        ctx.moveTo(cx - 22, browY);
        ctx.quadraticCurveTo(cx - 14, browY - 5 + this.morph.browLift * -4, cx - 6, browY);
        ctx.stroke();
        // Right brow
        ctx.beginPath();
        ctx.moveTo(cx + 6, browY);
        ctx.quadraticCurveTo(cx + 14, browY - 5 + this.morph.browLift * -4, cx + 22, browY);
        ctx.stroke();

        // Eyes
        const eyeY = cy - 8;
        const eyeH = 4 * (1 - this.morph.eyeSquint * 0.6) * (1 + this.morph.eyeWide * 0.5);
        // Left eye
        ctx.beginPath();
        ctx.ellipse(cx - 14, eyeY, 8, eyeH, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Right eye
        ctx.beginPath();
        ctx.ellipse(cx + 14, eyeY, 8, eyeH, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Iris dots
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(cx - 14, eyeY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 14, eyeY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.8;

        // Nose
        ctx.beginPath();
        ctx.moveTo(cx, cy - 4);
        ctx.lineTo(cx - 4, cy + 8);
        ctx.lineTo(cx + 4, cy + 8);
        ctx.stroke();

        // Mouth
        const mouthY = cy + 20;
        const mouthW = 16;
        const curve = this.morph.mouthCurve * 14;
        const openAmt = this.morph.mouthOpen * 10;

        ctx.beginPath();
        ctx.moveTo(cx - mouthW, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + curve, cx + mouthW, mouthY);
        ctx.stroke();

        // Lower lip for open mouth
        if (openAmt > 1) {
            ctx.beginPath();
            ctx.moveTo(cx - mouthW + 2, mouthY);
            ctx.quadraticCurveTo(cx, mouthY + openAmt + 2, cx + mouthW - 2, mouthY);
            ctx.stroke();
        }

        ctx.restore();
    }
};
