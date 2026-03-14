// ============================================
// Emotion Arc Visualization
// Stacked area chart showing emotional journey
// during song playback on the recap screen
// ============================================

const emotionArc = {
    EMOTIONS: ['neutral', 'sad', 'angry', 'fearful', 'happy', 'surprised'],
    COLORS: {
        neutral:   '#6b7280',
        sad:       '#2dd4bf',
        angry:     '#fb7185',
        fearful:   '#a78bfa',
        happy:     '#fbbf24',
        surprised: '#f472b6'
    },
    LABELS: {
        neutral: 'Neutral', sad: 'Sad', angry: 'Angry',
        fearful: 'Fearful', happy: 'Happy', surprised: 'Surprised'
    },

    render(container, options) {
        if (!container) return;
        const { timeline, wordAlignment, duration, emotionInsight } = options || {};
        const mode = this.getDisplayMode(timeline);

        if (mode === 'none') {
            this.renderNoDataFallback(container);
            return;
        }
        if (mode === 'mini') {
            this.renderMiniArc(container, timeline);
            return;
        }
        this.renderFullArc(container, timeline, wordAlignment, duration, emotionInsight);
    },

    getDisplayMode(timeline) {
        if (!timeline || timeline.length === 0) return 'none';
        if (timeline.length < 10) return 'mini';
        return 'full';
    },

    renderNoDataFallback(container) {
        container.innerHTML = `
            <div class="emotion-arc-fallback">
                <span class="emotion-arc-fallback-icon">&#128247;</span>
                <p>Enable camera next time to see your emotional journey visualized here.</p>
            </div>
        `;
    },

    renderMiniArc(container, timeline) {
        const avgEmotions = {};
        for (const emo of this.EMOTIONS) {
            avgEmotions[emo] = timeline.reduce((s, e) => s + (e.emotions[emo] || 0), 0) / timeline.length;
        }

        const sorted = this.EMOTIONS
            .map(e => ({ emotion: e, value: avgEmotions[e] }))
            .sort((a, b) => b.value - a.value);

        let barsHtml = sorted.map(item => `
            <div class="emotion-arc-mini-row">
                <span class="emotion-arc-mini-label">${this.LABELS[item.emotion]}</span>
                <div class="emotion-arc-mini-track">
                    <div class="emotion-arc-mini-fill" style="width:${Math.round(item.value * 100)}%;background:${this.COLORS[item.emotion]}"></div>
                </div>
                <span class="emotion-arc-mini-pct">${Math.round(item.value * 100)}%</span>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="recap-emotion-arc">
                <h3 class="emotion-arc-title">Emotion Snapshot</h3>
                <p class="emotion-arc-subtitle">Brief camera session (${timeline.length} readings)</p>
                <div class="emotion-arc-mini">${barsHtml}</div>
            </div>
        `;
    },

    renderFullArc(container, timeline, wordAlignment, duration, emotionInsight) {
        const smoothed = this.smoothData(timeline);
        const sections = this.extractSections(wordAlignment);
        const keyMoments = this.findKeyMoments(smoothed, sections);
        const totalDuration = duration || (smoothed.length > 0 ? smoothed[smoothed.length - 1].timestamp : 30);

        // Build HTML structure
        let html = `<div class="recap-emotion-arc">`;
        html += `<h3 class="emotion-arc-title">Your Emotional Journey</h3>`;
        html += `<div class="emotion-arc-canvas-wrap"><canvas id="emotionArcCanvas"></canvas><div class="emotion-arc-tooltip" id="emotionArcTooltip"></div></div>`;
        html += this.buildLegendHtml();

        if (keyMoments.length > 0) {
            html += `<div class="emotion-arc-moments">`;
            keyMoments.forEach(m => {
                html += `<div class="emotion-arc-moment"><span class="emotion-arc-moment-time">${this.formatTime(m.timestamp)}</span><p>${m.description}</p></div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;

        container.innerHTML = html;

        // Draw on canvas
        requestAnimationFrame(() => {
            const canvas = document.getElementById('emotionArcCanvas');
            if (!canvas) return;
            this.setupCanvas(canvas);
            this.drawChart(canvas, smoothed, sections, totalDuration);
            this.attachInteractivity(canvas, smoothed, totalDuration, wordAlignment);
        });
    },

    smoothData(timeline) {
        if (timeline.length < 3) return timeline.map(e => ({ ...e }));
        const window = 3;
        const result = [];
        for (let i = 0; i < timeline.length; i++) {
            const start = Math.max(0, i - Math.floor(window / 2));
            const end = Math.min(timeline.length, i + Math.ceil(window / 2));
            const slice = timeline.slice(start, end);
            const smoothedEmotions = {};
            for (const emo of this.EMOTIONS) {
                smoothedEmotions[emo] = slice.reduce((s, e) => s + (e.emotions[emo] || 0), 0) / slice.length;
            }
            result.push({
                timestamp: timeline[i].timestamp,
                emotions: smoothedEmotions,
                dominantEmotion: timeline[i].dominantEmotion,
                lyricsLineIndex: timeline[i].lyricsLineIndex
            });
        }
        return result;
    },

    extractSections(wordAlignment) {
        if (!wordAlignment || !wordAlignment.lines) return [];
        const sections = [];
        let currentSection = null;

        for (const line of wordAlignment.lines) {
            const text = (line.text || '').trim();
            // Detect section labels like [Verse 1], [Chorus], etc.
            const match = text.match(/^\[(.+)\]$/);
            if (match) {
                if (currentSection) {
                    currentSection.endTime = line.start || currentSection.startTime;
                }
                currentSection = {
                    label: match[1],
                    startTime: line.start || 0,
                    endTime: line.end || 0
                };
                sections.push(currentSection);
            } else if (currentSection && line.end) {
                currentSection.endTime = line.end;
            }
        }
        return sections;
    },

    findKeyMoments(smoothed, sections) {
        if (smoothed.length < 3) return [];
        const distances = [];

        for (let i = 1; i < smoothed.length; i++) {
            let dist = 0;
            for (const emo of this.EMOTIONS) {
                const diff = (smoothed[i].emotions[emo] || 0) - (smoothed[i - 1].emotions[emo] || 0);
                dist += diff * diff;
            }
            dist = Math.sqrt(dist);

            // Find dominant before and after
            let domBefore = 'neutral', domAfter = 'neutral';
            let maxBefore = 0, maxAfter = 0;
            for (const emo of this.EMOTIONS) {
                if ((smoothed[i - 1].emotions[emo] || 0) > maxBefore) { maxBefore = smoothed[i - 1].emotions[emo]; domBefore = emo; }
                if ((smoothed[i].emotions[emo] || 0) > maxAfter) { maxAfter = smoothed[i].emotions[emo]; domAfter = emo; }
            }

            distances.push({
                index: i,
                distance: dist,
                timestamp: smoothed[i].timestamp,
                from: domBefore,
                to: domAfter
            });
        }

        distances.sort((a, b) => b.distance - a.distance);

        // Take top 2-3 that are actually shifts (different dominant emotions)
        const moments = [];
        for (const d of distances) {
            if (moments.length >= 3) break;
            if (d.from === d.to) continue;
            // Don't pick moments too close to each other
            if (moments.some(m => Math.abs(m.timestamp - d.timestamp) < 3)) continue;

            const sectionLabel = this.getSectionAtTime(d.timestamp, sections);
            const sectionStr = sectionLabel ? ` during the ${sectionLabel}` : '';
            d.description = `Expression shifted from ${this.LABELS[d.from].toLowerCase()} to ${this.LABELS[d.to].toLowerCase()}${sectionStr} at ${this.formatTime(d.timestamp)}`;
            moments.push(d);
        }

        return moments.sort((a, b) => a.timestamp - b.timestamp);
    },

    getSectionAtTime(time, sections) {
        for (const s of sections) {
            if (time >= s.startTime && time <= s.endTime) return s.label;
        }
        return null;
    },

    setupCanvas(canvas) {
        const wrap = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const w = wrap.clientWidth;
        const h = 220;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
    },

    drawChart(canvas, smoothed, sections, totalDuration) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        const pad = { top: 24, right: 12, bottom: 30, left: 12 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;

        ctx.clearRect(0, 0, w, h);

        // Draw section bands
        this.drawSections(ctx, sections, totalDuration, pad, chartW, chartH);

        // Draw stacked streams
        this.drawStreams(ctx, smoothed, totalDuration, pad, chartW, chartH);

        // Draw time axis
        this.drawTimeAxis(ctx, totalDuration, pad, chartW, h);
    },

    drawSections(ctx, sections, totalDuration, pad, chartW, chartH) {
        const sectionColors = [
            'rgba(251, 191, 36, 0.06)',
            'rgba(244, 114, 182, 0.06)',
            'rgba(45, 212, 191, 0.06)',
            'rgba(167, 139, 250, 0.06)'
        ];

        sections.forEach((section, i) => {
            const x1 = pad.left + (section.startTime / totalDuration) * chartW;
            const x2 = pad.left + (section.endTime / totalDuration) * chartW;
            const w = Math.max(x2 - x1, 2);

            ctx.fillStyle = sectionColors[i % sectionColors.length];
            ctx.fillRect(x1, pad.top, w, chartH);

            // Section label at top
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(section.label, x1 + w / 2, pad.top - 6);
        });
    },

    drawStreams(ctx, smoothed, totalDuration, pad, chartW, chartH) {
        if (smoothed.length < 2) return;

        // Build stacked values
        const points = smoothed.map(entry => {
            const x = pad.left + (entry.timestamp / totalDuration) * chartW;
            let cumulative = 0;
            const stack = {};
            for (const emo of this.EMOTIONS) {
                cumulative += (entry.emotions[emo] || 0);
                stack[emo] = cumulative;
            }
            // Normalize so total = 1
            if (cumulative > 0) {
                for (const emo of this.EMOTIONS) {
                    stack[emo] /= cumulative;
                }
            }
            return { x, stack };
        });

        // Draw from top to bottom so lower layers don't cover upper
        for (let e = this.EMOTIONS.length - 1; e >= 0; e--) {
            const emo = this.EMOTIONS[e];
            ctx.beginPath();

            // Top edge (the emotion's cumulative line)
            for (let i = 0; i < points.length; i++) {
                const x = points[i].x;
                const y = pad.top + chartH * (1 - points[i].stack[emo]);
                if (i === 0) ctx.moveTo(x, y);
                else {
                    // Bezier for smooth curves
                    const prev = points[i - 1];
                    const cpx = (prev.x + x) / 2;
                    const prevY = pad.top + chartH * (1 - prev.stack[emo]);
                    ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
                }
            }

            // Bottom edge (previous emotion's line, or baseline)
            const prevEmo = e > 0 ? this.EMOTIONS[e - 1] : null;
            for (let i = points.length - 1; i >= 0; i--) {
                const x = points[i].x;
                const y = prevEmo
                    ? pad.top + chartH * (1 - points[i].stack[prevEmo])
                    : pad.top + chartH;
                if (i === points.length - 1) ctx.lineTo(x, y);
                else {
                    const next = points[i + 1];
                    const cpx = (next.x + x) / 2;
                    const nextY = prevEmo
                        ? pad.top + chartH * (1 - next.stack[prevEmo])
                        : pad.top + chartH;
                    ctx.bezierCurveTo(cpx, nextY, cpx, y, x, y);
                }
            }

            ctx.closePath();
            ctx.fillStyle = this.COLORS[emo];
            ctx.globalAlpha = 0.75;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    },

    drawTimeAxis(ctx, totalDuration, pad, chartW, canvasH) {
        const y = canvasH - 8;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';

        const interval = totalDuration <= 30 ? 5 : totalDuration <= 60 ? 10 : 15;
        for (let t = 0; t <= totalDuration; t += interval) {
            const x = pad.left + (t / totalDuration) * chartW;
            ctx.fillText(this.formatTime(t), x, y);
        }
    },

    buildLegendHtml() {
        const items = this.EMOTIONS.slice().reverse().map(emo =>
            `<span class="emotion-arc-legend-item"><span class="emotion-arc-legend-dot" style="background:${this.COLORS[emo]}"></span>${this.LABELS[emo]}</span>`
        ).join('');
        return `<div class="emotion-arc-legend">${items}</div>`;
    },

    attachInteractivity(canvas, smoothed, totalDuration, wordAlignment) {
        const tooltip = document.getElementById('emotionArcTooltip');
        if (!tooltip) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const pad = { top: 24, right: 12, bottom: 30, left: 12 };
        const chartW = w - pad.left - pad.right;
        const chartH = (canvas.height / dpr) - pad.top - pad.bottom;

        const handler = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const x = clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, (x - pad.left) / chartW));
            const time = ratio * totalDuration;

            // Find closest data point
            let closest = smoothed[0];
            let minDist = Infinity;
            for (const pt of smoothed) {
                const d = Math.abs(pt.timestamp - time);
                if (d < minDist) { minDist = d; closest = pt; }
            }

            // Dominant emotion
            let dominant = 'neutral', maxVal = 0;
            for (const emo of this.EMOTIONS) {
                if ((closest.emotions[emo] || 0) > maxVal) {
                    maxVal = closest.emotions[emo];
                    dominant = emo;
                }
            }

            // Build tooltip content
            let tipHtml = `<div class="arc-tip-time">${this.formatTime(closest.timestamp)}</div>`;
            tipHtml += `<div class="arc-tip-dominant" style="color:${this.COLORS[dominant]}">${this.LABELS[dominant]}</div>`;
            tipHtml += `<div class="arc-tip-bars">`;
            for (const emo of this.EMOTIONS.slice().reverse()) {
                const pct = Math.round((closest.emotions[emo] || 0) * 100);
                tipHtml += `<div class="arc-tip-bar-row"><span class="arc-tip-bar-label">${this.LABELS[emo]}</span><div class="arc-tip-bar-track"><div class="arc-tip-bar-fill" style="width:${pct}%;background:${this.COLORS[emo]}"></div></div><span class="arc-tip-bar-pct">${pct}%</span></div>`;
            }
            tipHtml += `</div>`;

            // Find lyric at this time
            const lyricLine = this.getLyricAtTime(closest.timestamp, wordAlignment);
            if (lyricLine) {
                tipHtml += `<div class="arc-tip-lyric">"${lyricLine}"</div>`;
            }

            tooltip.innerHTML = tipHtml;
            tooltip.style.display = 'block';

            // Position tooltip
            const tipW = tooltip.offsetWidth;
            let tipX = x - tipW / 2;
            if (tipX < 0) tipX = 0;
            if (tipX + tipW > rect.width) tipX = rect.width - tipW;
            tooltip.style.left = tipX + 'px';

            // Draw crosshair
            this.drawCrosshair(canvas, x, pad, chartH);
        };

        const hideTooltip = () => {
            tooltip.style.display = 'none';
            // Redraw without crosshair
            const sections = this.extractSections(wordAlignment);
            this.drawChart(canvas, smoothed, sections, totalDuration);
        };

        canvas.addEventListener('mousemove', handler);
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handler(e); }, { passive: false });
        canvas.addEventListener('mouseleave', hideTooltip);
        canvas.addEventListener('touchend', hideTooltip);
    },

    drawCrosshair(canvas, x, pad, chartH) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        // We need to redraw the chart first, but to avoid complexity we just draw the line on top
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + chartH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    },

    getLyricAtTime(time, wordAlignment) {
        if (!wordAlignment || !wordAlignment.lines) return null;
        let bestLine = null;
        let bestDist = Infinity;
        for (const line of wordAlignment.lines) {
            const text = (line.text || '').trim();
            if (text.match(/^\[.+\]$/)) continue; // Skip section labels
            if (!line.start && line.start !== 0) continue;
            const mid = ((line.start || 0) + (line.end || line.start || 0)) / 2;
            const d = Math.abs(mid - time);
            if (d < bestDist) { bestDist = d; bestLine = text; }
        }
        return bestDist < 5 ? bestLine : null;
    },

    formatTime(seconds) {
        const s = Math.max(0, Math.round(seconds));
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m + ':' + (sec < 10 ? '0' : '') + sec;
    }
};
