// ============================================
// Face Geometry Visualization
// Draws glowing wireframe over 68 facial landmarks,
// sacred geometry cross-connections, and particle trails
// ============================================

const faceGeometry = {
    canvas: null,
    ctx: null,
    targetLandmarks: null,
    currentLandmarks: null,
    currentEmotion: 'neutral',
    currentConfidence: 0,
    particles: [],

    // Emotion → color mapping (matches emotion-arc.js palette)
    EMOTION_COLORS: {
        happy:     '#fbbf24',
        sad:       '#2dd4bf',
        angry:     '#fb7185',
        fearful:   '#a78bfa',
        surprised: '#f472b6',
        disgusted: '#fb7185',
        neutral:   '#6b7280'
    },

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.targetLandmarks = null;
        this.currentLandmarks = null;
        this.particles = [];
    },

    destroy() {
        this.canvas = null;
        this.ctx = null;
        this.targetLandmarks = null;
        this.currentLandmarks = null;
        this.particles = [];
        this.currentEmotion = 'neutral';
        this.currentConfidence = 0;
    },

    updateLandmarks(landmarks68, emotion, confidence) {
        this.targetLandmarks = landmarks68;
        this.currentEmotion = emotion || 'neutral';
        this.currentConfidence = confidence || 0;
    },

    drawFrame(ctx, canvas) {
        if (!this.targetLandmarks) return;

        const w = canvas.width;
        const h = canvas.height;
        const color = this.EMOTION_COLORS[this.currentEmotion] || this.EMOTION_COLORS.neutral;

        // Lerp toward target landmarks
        this._lerpLandmarks(0.15);

        if (!this.currentLandmarks) return;

        // Scale normalized [0,1] landmarks to canvas pixel coords
        const lm = this.currentLandmarks.map(p => ({
            x: p.x * w,
            y: p.y * h
        }));

        this._drawJawline(ctx, lm, color);
        this._drawEyebrows(ctx, lm, color);
        this._drawNose(ctx, lm, color);
        this._drawEyes(ctx, lm, color);
        this._drawLips(ctx, lm, color);
        this._drawSacredGeometry(ctx, lm, color);
        this._updateParticles(lm);
        this._drawParticles(ctx, color);
    },

    _lerpLandmarks(factor) {
        if (!this.targetLandmarks) return;
        if (!this.currentLandmarks) {
            this.currentLandmarks = this.targetLandmarks.map(p => ({ x: p.x, y: p.y }));
            return;
        }
        for (let i = 0; i < this.targetLandmarks.length; i++) {
            if (!this.currentLandmarks[i]) {
                this.currentLandmarks[i] = { x: this.targetLandmarks[i].x, y: this.targetLandmarks[i].y };
            } else {
                this.currentLandmarks[i].x += (this.targetLandmarks[i].x - this.currentLandmarks[i].x) * factor;
                this.currentLandmarks[i].y += (this.targetLandmarks[i].y - this.currentLandmarks[i].y) * factor;
            }
        }
    },

    _drawConnectedPoints(ctx, lm, indices, color, close) {
        if (indices.length < 2) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(lm[indices[0]].x, lm[indices[0]].y);
        for (let i = 1; i < indices.length; i++) {
            ctx.lineTo(lm[indices[i]].x, lm[indices[i]].y);
        }
        if (close) ctx.closePath();
        ctx.stroke();
        ctx.restore();
    },

    _drawJawline(ctx, lm, color) {
        const indices = [];
        for (let i = 0; i <= 16; i++) indices.push(i);
        this._drawConnectedPoints(ctx, lm, indices, color, false);
    },

    _drawEyebrows(ctx, lm, color) {
        // Right eyebrow: 17-21
        const right = [];
        for (let i = 17; i <= 21; i++) right.push(i);
        this._drawConnectedPoints(ctx, lm, right, color, false);

        // Left eyebrow: 22-26
        const left = [];
        for (let i = 22; i <= 26; i++) left.push(i);
        this._drawConnectedPoints(ctx, lm, left, color, false);
    },

    _drawNose(ctx, lm, color) {
        // Nose bridge: 27-30
        const bridge = [];
        for (let i = 27; i <= 30; i++) bridge.push(i);
        this._drawConnectedPoints(ctx, lm, bridge, color, false);

        // Nose bottom: 31-35
        const bottom = [];
        for (let i = 31; i <= 35; i++) bottom.push(i);
        this._drawConnectedPoints(ctx, lm, bottom, color, false);
    },

    _drawEyes(ctx, lm, color) {
        // Right eye: 36-41 (closed loop)
        const right = [];
        for (let i = 36; i <= 41; i++) right.push(i);
        this._drawConnectedPoints(ctx, lm, right, color, true);

        // Left eye: 42-47 (closed loop)
        const left = [];
        for (let i = 42; i <= 47; i++) left.push(i);
        this._drawConnectedPoints(ctx, lm, left, color, true);

        // Iris dots at centroids
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.9;

        const rc = this._centroid(lm, [36,37,38,39,40,41]);
        ctx.beginPath();
        ctx.arc(rc.x, rc.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        const lc = this._centroid(lm, [42,43,44,45,46,47]);
        ctx.beginPath();
        ctx.arc(lc.x, lc.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    _drawLips(ctx, lm, color) {
        // Outer lip: 48-59 (closed loop)
        const outer = [];
        for (let i = 48; i <= 59; i++) outer.push(i);
        this._drawConnectedPoints(ctx, lm, outer, color, true);

        // Inner lip: 60-67 (closed loop)
        const inner = [];
        for (let i = 60; i <= 67; i++) inner.push(i);
        this._drawConnectedPoints(ctx, lm, inner, color, true);
    },

    _drawSacredGeometry(ctx, lm, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([4, 4]);

        // Eye-to-eye line
        const rightEyeC = this._centroid(lm, [36,37,38,39,40,41]);
        const leftEyeC = this._centroid(lm, [42,43,44,45,46,47]);
        ctx.beginPath();
        ctx.moveTo(rightEyeC.x, rightEyeC.y);
        ctx.lineTo(leftEyeC.x, leftEyeC.y);
        ctx.stroke();

        // Face axis: point 27 (top of nose) → point 8 (chin)
        ctx.beginPath();
        ctx.moveTo(lm[27].x, lm[27].y);
        ctx.lineTo(lm[8].x, lm[8].y);
        ctx.stroke();

        // Diagonals: point 19 → point 8, point 24 → point 8
        ctx.beginPath();
        ctx.moveTo(lm[19].x, lm[19].y);
        ctx.lineTo(lm[8].x, lm[8].y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(lm[24].x, lm[24].y);
        ctx.lineTo(lm[8].x, lm[8].y);
        ctx.stroke();

        // Face circumscription circle
        const allIndices = [];
        for (let i = 0; i < 68; i++) allIndices.push(i);
        const center = this._centroid(lm, allIndices);
        let maxR = 0;
        for (let i = 0; i <= 16; i++) {
            const dx = lm[i].x - center.x;
            const dy = lm[i].y - center.y;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r > maxR) maxR = r;
        }
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, maxR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();
    },

    _centroid(lm, indices) {
        let sx = 0, sy = 0;
        for (const i of indices) {
            sx += lm[i].x;
            sy += lm[i].y;
        }
        return { x: sx / indices.length, y: sy / indices.length };
    },

    _updateParticles(lm) {
        // Spawn particles along jawline and at key points
        const spawnPoints = [0, 4, 8, 12, 16, 36, 39, 42, 45, 48, 54];
        for (const idx of spawnPoints) {
            if (Math.random() > 0.3) continue;
            this.particles.push({
                x: lm[idx].x + (Math.random() - 0.5) * 3,
                y: lm[idx].y + (Math.random() - 0.5) * 3,
                vx: (Math.random() - 0.5) * 1.2,
                vy: (Math.random() - 0.5) * 1.2,
                life: 1.0
            });
        }

        // Decay and remove
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.03;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Cap at ~80
        if (this.particles.length > 80) {
            this.particles.splice(0, this.particles.length - 80);
        }
    },

    _drawParticles(ctx, color) {
        if (this.particles.length === 0) return;
        ctx.save();
        ctx.shadowBlur = 0;
        for (const p of this.particles) {
            ctx.globalAlpha = p.life * 0.4;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5 * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
};
