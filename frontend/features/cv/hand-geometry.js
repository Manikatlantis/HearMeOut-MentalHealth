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
        pinch:         '#2dd4bf',
        fist:          '#f472b6',
        wave:          '#fbbf24',
        circular:      '#a78bfa',
        open_palm:     '#34d399',
        volume_up:     '#f97316',
        volume_down:   '#6366f1',
        stereo_spread: '#ec4899'
    },
    DEFAULT_COLOR: '#e2e8f0',

    init(canvas) {
        this.canvas = canvas;
        canvas.width = 320;
        canvas.height = 240;
        this.ctx = canvas.getContext('2d');
        this.prevLandmarks = [];
        this.particles = [];
    },

    destroy() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.canvas = null;
        this.ctx = null;
        this.prevLandmarks = [];
        this.particles = [];
    },

    draw(multiHandLandmarks, activeGestures) {
        if (!this.ctx || !this.canvas) return;
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
    }
};
