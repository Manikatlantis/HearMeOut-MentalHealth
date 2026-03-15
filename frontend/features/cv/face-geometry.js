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
    smoothedConfidence: 0,
    currentExpressions: null,
    headPose: null,
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

    // RGB versions for blending
    EMOTION_RGB: {
        happy:     { r: 251, g: 191, b: 36 },
        sad:       { r: 45,  g: 212, b: 191 },
        angry:     { r: 251, g: 113, b: 133 },
        fearful:   { r: 167, g: 139, b: 250 },
        surprised: { r: 244, g: 114, b: 182 },
        disgusted: { r: 251, g: 113, b: 133 },
        neutral:   { r: 107, g: 114, b: 128 }
    },

    // Per-feature visual hierarchy
    FEATURE_STYLE: {
        eyes:     { lineWidth: 2.0, shadowBlur: 16, alpha: 0.9 },
        lips:     { lineWidth: 1.8, shadowBlur: 14, alpha: 0.85 },
        eyebrows: { lineWidth: 1.5, shadowBlur: 10, alpha: 0.7 },
        jawline:  { lineWidth: 1.2, shadowBlur: 6,  alpha: 0.5 },
        nose:     { lineWidth: 1.0, shadowBlur: 4,  alpha: 0.45 }
    },

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.targetLandmarks = null;
        this.currentLandmarks = null;
        this.particles = [];
        this.headPose = null;
        this.currentExpressions = null;
        this.smoothedConfidence = 0;
    },

    destroy() {
        this.canvas = null;
        this.ctx = null;
        this.targetLandmarks = null;
        this.currentLandmarks = null;
        this.particles = [];
        this.currentEmotion = 'neutral';
        this.currentConfidence = 0;
        this.smoothedConfidence = 0;
        this.currentExpressions = null;
        this.headPose = null;
    },

    updateLandmarks(landmarks68, emotion, confidence, expressions) {
        this.targetLandmarks = landmarks68;
        this.currentEmotion = emotion || 'neutral';
        this.currentConfidence = confidence || 0;
        if (expressions) {
            this.currentExpressions = { ...expressions };
        }
    },

    // Expose current blended color as {r, g, b} normalized 0-1 for Three.js integration
    getCurrentColor() {
        if (this.currentExpressions) {
            const rgb = this._blendColor(this.currentExpressions);
            return { r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 };
        }
        const hex = this.EMOTION_COLORS[this.currentEmotion] || this.EMOTION_COLORS.neutral;
        const rgb = this.EMOTION_RGB[this.currentEmotion] || this.EMOTION_RGB.neutral;
        return { r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 };
    },

    // Weighted RGB lerp of top 2 emotions for smooth color transitions
    _blendColor(expressions) {
        if (!expressions) {
            return this.EMOTION_RGB[this.currentEmotion] || this.EMOTION_RGB.neutral;
        }
        // Sort emotions by score descending, take top 2
        const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
        const top1 = sorted[0] || ['neutral', 1];
        const top2 = sorted[1] || ['neutral', 0];

        const c1 = this.EMOTION_RGB[top1[0]] || this.EMOTION_RGB.neutral;
        const c2 = this.EMOTION_RGB[top2[0]] || this.EMOTION_RGB.neutral;

        const total = top1[1] + top2[1];
        if (total < 0.001) return c1;
        const w1 = top1[1] / total;
        const w2 = top2[1] / total;

        return {
            r: Math.round(c1.r * w1 + c2.r * w2),
            g: Math.round(c1.g * w1 + c2.g * w2),
            b: Math.round(c1.b * w1 + c2.b * w2)
        };
    },

    drawFrame(ctx, canvas) {
        if (!this.targetLandmarks) return;

        const w = canvas.width;
        const h = canvas.height;

        // Lerp toward target landmarks
        this._lerpLandmarks(0.15);

        // Lerp confidence across frames
        this.smoothedConfidence += (this.currentConfidence - this.smoothedConfidence) * 0.15;

        if (!this.currentLandmarks) return;

        // Blended color from expressions
        const blended = this._blendColor(this.currentExpressions);
        const color = `rgb(${blended.r}, ${blended.g}, ${blended.b})`;

        // Confidence-weighted opacity multiplier (ghosts when uncertain, crisp when strong)
        const confidenceAlpha = 0.3 + 0.7 * this.smoothedConfidence;

        // Audio-sync values
        let bass = 0, energy = 0;
        if (typeof getBassEnergy !== 'undefined') {
            try { bass = getBassEnergy(); } catch (e) { /* no audio */ }
        }
        if (typeof getAudioEnergy !== 'undefined') {
            try { energy = getAudioEnergy(); } catch (e) { /* no audio */ }
        }

        // Ambient breathing
        const now = performance.now();
        const breathe = 0.95 + 0.05 * Math.sin(now * 0.002);
        const overallAlpha = confidenceAlpha * breathe;

        // Scale normalized [0,1] landmarks to canvas pixel coords
        const lm = this.currentLandmarks.map(p => ({
            x: p.x * w,
            y: p.y * h
        }));

        this._drawJawline(ctx, lm, color, overallAlpha);
        this._drawEyebrows(ctx, lm, color, overallAlpha);
        this._drawNose(ctx, lm, color, overallAlpha);
        this._drawEyes(ctx, lm, color, overallAlpha, energy);
        this._drawLips(ctx, lm, color, overallAlpha);
        this._drawSacredGeometry(ctx, lm, color, overallAlpha, bass);
        this._updateParticles(lm);
        this._drawParticles(ctx, color, overallAlpha);
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

    _drawConnectedPoints(ctx, lm, indices, color, close, style, overallAlpha) {
        if (indices.length < 2) return;
        const s = style || { lineWidth: 1.5, shadowBlur: 10, alpha: 0.7 };
        const alpha = s.alpha * (overallAlpha || 1);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = s.lineWidth;
        ctx.shadowColor = color;
        ctx.shadowBlur = s.shadowBlur;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(lm[indices[0]].x, lm[indices[0]].y);
        for (let i = 1; i < indices.length; i++) {
            ctx.lineTo(lm[indices[i]].x, lm[indices[i]].y);
        }
        if (close) ctx.closePath();
        ctx.stroke();
        ctx.restore();
    },

    _drawJawline(ctx, lm, color, overallAlpha) {
        const indices = [];
        for (let i = 0; i <= 16; i++) indices.push(i);
        this._drawConnectedPoints(ctx, lm, indices, color, false, this.FEATURE_STYLE.jawline, overallAlpha);
    },

    _drawEyebrows(ctx, lm, color, overallAlpha) {
        const right = [];
        for (let i = 17; i <= 21; i++) right.push(i);
        this._drawConnectedPoints(ctx, lm, right, color, false, this.FEATURE_STYLE.eyebrows, overallAlpha);

        const left = [];
        for (let i = 22; i <= 26; i++) left.push(i);
        this._drawConnectedPoints(ctx, lm, left, color, false, this.FEATURE_STYLE.eyebrows, overallAlpha);
    },

    _drawNose(ctx, lm, color, overallAlpha) {
        const bridge = [];
        for (let i = 27; i <= 30; i++) bridge.push(i);
        this._drawConnectedPoints(ctx, lm, bridge, color, false, this.FEATURE_STYLE.nose, overallAlpha);

        const bottom = [];
        for (let i = 31; i <= 35; i++) bottom.push(i);
        this._drawConnectedPoints(ctx, lm, bottom, color, false, this.FEATURE_STYLE.nose, overallAlpha);
    },

    _drawEyes(ctx, lm, color, overallAlpha, energy) {
        // Right eye: 36-41 (closed loop)
        const right = [];
        for (let i = 36; i <= 41; i++) right.push(i);
        this._drawConnectedPoints(ctx, lm, right, color, true, this.FEATURE_STYLE.eyes, overallAlpha);

        // Left eye: 42-47 (closed loop)
        const left = [];
        for (let i = 42; i <= 47; i++) left.push(i);
        this._drawConnectedPoints(ctx, lm, left, color, true, this.FEATURE_STYLE.eyes, overallAlpha);

        // Iris dots at centroids — pulse with audio energy
        const irisRadius = 2.5 * (1 + energy * 0.3);
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.9 * overallAlpha;

        const rc = this._centroid(lm, [36,37,38,39,40,41]);
        ctx.beginPath();
        ctx.arc(rc.x, rc.y, irisRadius, 0, Math.PI * 2);
        ctx.fill();

        const lc = this._centroid(lm, [42,43,44,45,46,47]);
        ctx.beginPath();
        ctx.arc(lc.x, lc.y, irisRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    _drawLips(ctx, lm, color, overallAlpha) {
        const outer = [];
        for (let i = 48; i <= 59; i++) outer.push(i);
        this._drawConnectedPoints(ctx, lm, outer, color, true, this.FEATURE_STYLE.lips, overallAlpha);

        const inner = [];
        for (let i = 60; i <= 67; i++) inner.push(i);
        this._drawConnectedPoints(ctx, lm, inner, color, true, this.FEATURE_STYLE.lips, overallAlpha);
    },

    _drawSacredGeometry(ctx, lm, color, overallAlpha, bass) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.35 * overallAlpha;
        ctx.setLineDash([4, 4]);

        // Eye centroids (reused throughout)
        const rightEyeC = this._centroid(lm, [36,37,38,39,40,41]);
        const leftEyeC = this._centroid(lm, [42,43,44,45,46,47]);

        // Eye-to-eye line
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

        // Face circumscription circle — pulse with bass
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

        // Skip advanced geometry if face too small
        if (maxR < 30) {
            ctx.globalAlpha = 0.2 * overallAlpha;
            ctx.beginPath();
            ctx.arc(center.x, center.y, maxR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
            return;
        }

        // Pulse circle radius with bass
        const pulsedR = maxR * (1 + bass * 0.15);

        ctx.globalAlpha = 0.2 * overallAlpha;
        ctx.beginPath();
        ctx.arc(center.x, center.y, pulsedR, 0, Math.PI * 2);
        ctx.stroke();

        // --- Vesica Piscis between eyes ---
        const interEyeDist = Math.sqrt(
            (leftEyeC.x - rightEyeC.x) ** 2 + (leftEyeC.y - rightEyeC.y) ** 2
        );
        ctx.globalAlpha = 0.12 * overallAlpha;
        ctx.lineWidth = 0.8;
        // Circle centered on right eye
        ctx.beginPath();
        ctx.arc(rightEyeC.x, rightEyeC.y, interEyeDist, 0, Math.PI * 2);
        ctx.stroke();
        // Circle centered on left eye
        ctx.beginPath();
        ctx.arc(leftEyeC.x, leftEyeC.y, interEyeDist, 0, Math.PI * 2);
        ctx.stroke();

        // Vesica intersection fill (very subtle)
        ctx.globalAlpha = 0.06 * overallAlpha;
        ctx.fillStyle = color;
        // Approximate intersection as an ellipse at midpoint
        const midEye = { x: (rightEyeC.x + leftEyeC.x) / 2, y: (rightEyeC.y + leftEyeC.y) / 2 };
        const vesicaW = interEyeDist * 0.5;
        const vesicaH = interEyeDist * 0.866; // sqrt(3)/2
        ctx.beginPath();
        ctx.ellipse(midEye.x, midEye.y, vesicaW, vesicaH, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Golden Ratio Triangle ---
        // Left eye → right eye → mouth center
        const mouthCenter = this._centroid(lm, [48,49,50,51,52,53,54,55,56,57,58,59]);
        ctx.globalAlpha = 0.15 * overallAlpha;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(leftEyeC.x, leftEyeC.y);
        ctx.lineTo(rightEyeC.x, rightEyeC.y);
        ctx.lineTo(mouthCenter.x, mouthCenter.y);
        ctx.closePath();
        ctx.stroke();

        // Phi-rectangle: height from brow midpoint to chin, width = height/1.618
        const browMid = { x: (lm[19].x + lm[24].x) / 2, y: (lm[19].y + lm[24].y) / 2 };
        const phiHeight = lm[8].y - browMid.y;
        const phiWidth = phiHeight / 1.618;
        const phiCx = (browMid.x + lm[8].x) / 2;
        const phiCy = (browMid.y + lm[8].y) / 2;
        ctx.beginPath();
        ctx.rect(phiCx - phiWidth / 2, phiCy - phiHeight / 2, phiWidth, phiHeight);
        ctx.stroke();

        // --- Mandala Rings ---
        const now = performance.now();
        const rotation = now * 0.0003;
        ctx.globalAlpha = 0.12 * overallAlpha;
        ctx.lineWidth = 0.6;
        ctx.setLineDash([3, 5]);

        // Concentric circles at golden ratio subdivisions
        const ring1 = pulsedR * 0.618;
        const ring2 = pulsedR * 0.382;

        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(rotation);

        ctx.beginPath();
        ctx.arc(0, 0, ring1, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, ring2, 0, Math.PI * 2);
        ctx.stroke();

        // Third ring at 0.236 (phi^3 ≈ 0.236)
        const ring3 = pulsedR * 0.236;
        ctx.beginPath();
        ctx.arc(0, 0, ring3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

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

    _drawParticles(ctx, color, overallAlpha) {
        if (this.particles.length === 0) return;
        ctx.save();
        ctx.shadowBlur = 0;
        for (const p of this.particles) {
            ctx.globalAlpha = p.life * 0.4 * (overallAlpha || 1);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5 * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
};
