// ============================================
// Hand Geometry Visualization
// Draws glowing skeletal connections, sacred geometry,
// gesture-reactive colors, and particle trails on hand landmarks
// ============================================

const handGeometry = {
    canvas: null,
    ctx: null,
    prevLandmarks: [],
    particles: [],

    // Bone connections (finger segments + palm cross-links)
    BONES: [
        // Thumb
        [0,1],[1,2],[2,3],[3,4],
        // Index
        [0,5],[5,6],[6,7],[7,8],
        // Middle
        [0,9],[9,10],[10,11],[11,12],
        // Ring
        [0,13],[13,14],[14,15],[15,16],
        // Pinky
        [0,17],[17,18],[18,19],[19,20],
        // Palm cross-links
        [5,9],[9,13],[13,17]
    ],

    // Sacred geometry: pentagon + star through fingertips
    PENTAGON: [4,8,12,16,20],
    STAR: [[4,12],[8,16],[12,20],[16,4],[20,8]],

    // Fingertip indices
    FINGERTIPS: [4, 8, 12, 16, 20],

    // Gesture -> color mapping
    GESTURE_COLORS: {
        volume_up:     '#f97316',
        volume_down:   '#6366f1',
        bass_boost:    '#f472b6',
        vocal_isolate: '#2dd4bf',
        heart:         '#fb7185',
        dbz_charge:    '#fbbf24'
    },
    DEFAULT_COLOR: '#e2e8f0',

    // Heart particles (visual-only gesture)
    heartParticles: [],

    // Energy ball state cache
    _energyBallState: null,

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.prevLandmarks = [];
        this.particles = [];
        this._syncSize();
    },

    _syncSize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dw = Math.round(rect.width) || 320;
        const dh = Math.round(rect.height) || 240;
        if (this.canvas.width !== dw || this.canvas.height !== dh) {
            this.canvas.width = dw;
            this.canvas.height = dh;
        }
    },

    destroy() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.canvas = null;
        this.ctx = null;
        this.prevLandmarks = [];
        this.particles = [];
        this.heartParticles = [];
        this._energyBallState = null;
    },

    // Store latest data for shared render loop
    _latestLandmarks: null,
    _latestGestures: null,

    updateData(multiHandLandmarks, activeGestures) {
        this._latestLandmarks = multiHandLandmarks;
        this._latestGestures = activeGestures;
    },

    drawFrame(ctx, canvas) {
        if (!canvas) return;
        const w = canvas.width;
        const h = canvas.height;

        const multiHandLandmarks = this._latestLandmarks;
        const activeGestures = this._latestGestures;

        if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
            this._updateParticles(null);
            this._drawParticles(ctx);
            this._updateHeartParticles(ctx, w, h);
            this._drawEnergyBall(ctx, canvas, null);
            this.prevLandmarks = [];
            return;
        }

        const color = this._getGestureColor(activeGestures);

        for (let hi = 0; hi < multiHandLandmarks.length; hi++) {
            const raw = multiHandLandmarks[hi];
            const lm = raw.map(p => ({
                x: p.x * w,
                y: p.y * h
            }));

            const smoothed = this._lerpLandmarks(hi, lm, 0.45);

            this._drawBones(ctx, smoothed, color);
            this._drawSacredGeometry(ctx, smoothed, color);
            this._drawJoints(ctx, smoothed, color);
            this._updateParticles(smoothed);
        }

        this._drawParticles(ctx);

        // Heart particles (spawn if heart gesture active)
        if (activeGestures && activeGestures.has('heart') && typeof gestureMixer !== 'undefined' && gestureMixer._heartMidpoint) {
            const mp = gestureMixer._heartMidpoint;
            this._spawnHeartParticles(mp.x * w, mp.y * h);
        }
        this._updateHeartParticles(ctx, w, h);

        // Energy ball
        const ebState = (typeof getEnergyBallState === 'function') ? getEnergyBallState() : null;
        this._drawEnergyBall(ctx, canvas, ebState);
    },

    draw(multiHandLandmarks, activeGestures) {
        if (!this.ctx || !this.canvas) return;
        this._syncSize();
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
            // Still draw fading particles
            this._updateParticles(null);
            this._drawParticles(ctx);
            this.prevLandmarks = [];
            return;
        }

        const color = this._getGestureColor(activeGestures);

        for (let hi = 0; hi < multiHandLandmarks.length; hi++) {
            const raw = multiHandLandmarks[hi];
            // Convert to canvas coordinates (mirrored X to match CSS scaleX(-1))
            const lm = raw.map(p => ({
                x: p.x * w,
                y: p.y * h
            }));

            // Smooth via lerp with previous frame
            const smoothed = this._lerpLandmarks(hi, lm, 0.45);

            this._drawBones(ctx, smoothed, color);
            this._drawSacredGeometry(ctx, smoothed, color);
            this._drawJoints(ctx, smoothed, color);
            this._updateParticles(smoothed);
        }

        this._drawParticles(ctx);
    },

    _lerpLandmarks(handIndex, current, factor) {
        if (!this.prevLandmarks[handIndex]) {
            this.prevLandmarks[handIndex] = current;
            return current;
        }
        const prev = this.prevLandmarks[handIndex];
        const smoothed = current.map((p, i) => ({
            x: prev[i].x + (p.x - prev[i].x) * (1 - factor),
            y: prev[i].y + (p.y - prev[i].y) * (1 - factor)
        }));
        this.prevLandmarks[handIndex] = smoothed;
        return smoothed;
    },

    _getGestureColor(activeGestures) {
        if (!activeGestures || activeGestures.size === 0) return this.DEFAULT_COLOR;
        for (const gesture of activeGestures) {
            if (this.GESTURE_COLORS[gesture]) return this.GESTURE_COLORS[gesture];
        }
        return this.DEFAULT_COLOR;
    },

    _drawBones(ctx, lm, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.7;

        for (const [a, b] of this.BONES) {
            ctx.beginPath();
            ctx.moveTo(lm[a].x, lm[a].y);
            ctx.lineTo(lm[b].x, lm[b].y);
            ctx.stroke();
        }
        ctx.restore();
    },

    _drawSacredGeometry(ctx, lm, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.globalAlpha = 0.6;

        // Pentagon
        ctx.beginPath();
        const p = this.PENTAGON;
        ctx.moveTo(lm[p[0]].x, lm[p[0]].y);
        for (let i = 1; i < p.length; i++) {
            ctx.lineTo(lm[p[i]].x, lm[p[i]].y);
        }
        ctx.closePath();
        ctx.stroke();

        // Star (pentagram)
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1.5;
        for (const [a, b] of this.STAR) {
            ctx.beginPath();
            ctx.moveTo(lm[a].x, lm[a].y);
            ctx.lineTo(lm[b].x, lm[b].y);
            ctx.stroke();
        }

        // Wrist-to-middle axis
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(lm[0].x, lm[0].y);
        ctx.lineTo(lm[12].x, lm[12].y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
    },

    _drawJoints(ctx, lm, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;

        for (let i = 0; i < 21; i++) {
            const isTip = this.FINGERTIPS.includes(i);
            const r = isTip ? 4 : 2;
            ctx.shadowBlur = isTip ? 14 : 4;
            ctx.globalAlpha = isTip ? 0.9 : 0.6;
            ctx.beginPath();
            ctx.arc(lm[i].x, lm[i].y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    _updateParticles(lm) {
        // Spawn particles at fingertips
        if (lm) {
            for (const ti of this.FINGERTIPS) {
                // 1-2 particles per fingertip per frame
                const count = 1 + (Math.random() > 0.5 ? 1 : 0);
                for (let n = 0; n < count; n++) {
                    this.particles.push({
                        x: lm[ti].x + (Math.random() - 0.5) * 4,
                        y: lm[ti].y + (Math.random() - 0.5) * 4,
                        vx: (Math.random() - 0.5) * 1.5,
                        vy: (Math.random() - 0.5) * 1.5,
                        life: 1.0
                    });
                }
            }
        }

        // Decay and remove
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.04;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Cap at 100
        if (this.particles.length > 100) {
            this.particles.splice(0, this.particles.length - 100);
        }
    },

    _drawParticles(ctx) {
        if (this.particles.length === 0) return;
        ctx.save();
        ctx.shadowBlur = 0;
        for (const p of this.particles) {
            ctx.globalAlpha = p.life * 0.5;
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5 * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    // --- Heart Particles ---

    _spawnHeartParticles(cx, cy) {
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            this.heartParticles.push({
                x: cx + (Math.random() - 0.5) * 30,
                y: cy,
                vx: (Math.random() - 0.5) * 2,
                vy: -(1 + Math.random() * 2.5),
                size: 8 + Math.random() * 14,
                life: 1.0,
                hue: Math.random() > 0.5 ? '#fb7185' : '#f472b6'
            });
        }
        if (this.heartParticles.length > 60) {
            this.heartParticles.splice(0, this.heartParticles.length - 60);
        }
    },

    _updateHeartParticles(ctx, w, h) {
        for (let i = this.heartParticles.length - 1; i >= 0; i--) {
            const p = this.heartParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy -= 0.02; // float up faster over time
            p.life -= 0.015;
            if (p.life <= 0 || p.y < -20) {
                this.heartParticles.splice(i, 1);
                continue;
            }
            this._drawHeart(ctx, p.x, p.y, p.size * p.life, p.hue, p.life * 0.8);
        }
    },

    _drawHeart(ctx, x, y, size, color, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        const s = size / 2;
        ctx.moveTo(x, y + s * 0.3);
        ctx.bezierCurveTo(x, y - s * 0.5, x - s, y - s * 0.5, x - s, y + s * 0.1);
        ctx.bezierCurveTo(x - s, y + s * 0.6, x, y + s, x, y + s * 1.2);
        ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.6, x + s, y + s * 0.1);
        ctx.bezierCurveTo(x + s, y - s * 0.5, x, y - s * 0.5, x, y + s * 0.3);
        ctx.fill();
        ctx.restore();
    },

    // --- DBZ Energy Ball ---

    _drawEnergyBall(ctx, canvas, state) {
        if (!state || !state.midpoint) return;
        const w = canvas.width;
        const h = canvas.height;
        const cx = state.midpoint.x * w;
        const cy = state.midpoint.y * h;
        const charge = state.charge;

        const baseRadius = 15 + charge * 40;
        const flicker = Math.sin(Date.now() * 0.02) * 3 * charge;
        const radius = baseRadius + flicker;

        ctx.save();

        // Outer glow
        const outerGrad = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 2);
        outerGrad.addColorStop(0, `rgba(255, 180, 50, ${charge * 0.4})`);
        outerGrad.addColorStop(0.5, `rgba(255, 100, 20, ${charge * 0.2})`);
        outerGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Inner core
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        coreGrad.addColorStop(0, `rgba(255, 255, 200, ${0.6 + charge * 0.4})`);
        coreGrad.addColorStop(0.4, `rgba(255, 200, 50, ${0.5 + charge * 0.3})`);
        coreGrad.addColorStop(1, `rgba(255, 120, 20, ${charge * 0.5})`);
        ctx.fillStyle = coreGrad;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 20 + charge * 30;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Sparkle ring
        ctx.shadowBlur = 0;
        const sparkleCount = Math.floor(charge * 12);
        for (let i = 0; i < sparkleCount; i++) {
            const angle = (Date.now() * 0.003 + i * (Math.PI * 2 / sparkleCount));
            const dist = radius * (1.2 + Math.sin(Date.now() * 0.01 + i) * 0.4);
            const sx = cx + Math.cos(angle) * dist;
            const sy = cy + Math.sin(angle) * dist;
            ctx.globalAlpha = charge * 0.7;
            ctx.fillStyle = '#ffffcc';
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5 + charge * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
};
