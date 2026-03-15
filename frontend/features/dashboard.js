// ============================================
// Wellness Dashboard — My Journey
// ============================================

const dashboard = {
    data: null,
    _hoveredBar: null,
    _hoveredRadar: null,
    _radarAngles: null,
    _radarEntries: null,

    async show() {
        showScreen('dashboardScreen');
        const container = document.getElementById('dashboardContent');
        if (!container) return;

        container.innerHTML = '<p class="dashboard-loading">Loading your journey...</p>';

        try {
            const resp = await fetch(`/api/dashboard/${getUserId()}`);
            if (!resp.ok) throw new Error('Failed to load dashboard');
            this.data = await resp.json();
            this.render();
        } catch (e) {
            console.error('Dashboard error:', e);
            container.innerHTML = `<p class="dashboard-loading">Unable to load dashboard data. (${e.message})</p>`;
        }
    },

    render() {
        const container = document.getElementById('dashboardContent');
        if (!container || !this.data) return;

        const d = this.data;

        const avgImprovement = d.questionnaire_trend.length > 0
            ? d.questionnaire_trend.reduce((sum, s) => sum + (s.post !== null ? s.post - s.pre : 0), 0) / d.questionnaire_trend.filter(s => s.post !== null).length || 0
            : 0;

        const daysBetween = d.first_session && d.latest_session
            ? Math.max(1, Math.ceil((new Date(d.latest_session) - new Date(d.first_session)) / 86400000))
            : 0;

        const diaryCount = d.diary_count || 0;

        container.innerHTML = `
            <div class="dashboard-stats">
                <div class="stat-card glass">
                    <span class="stat-value">${d.session_count}</span>
                    <span class="stat-label">Sessions</span>
                </div>
                <div class="stat-card glass">
                    <span class="stat-value">${daysBetween > 0 ? daysBetween + 'd' : '--'}</span>
                    <span class="stat-label">Journey</span>
                </div>
                <div class="stat-card glass">
                    <span class="stat-value">${avgImprovement > 0 ? '+' : ''}${avgImprovement.toFixed(1)}</span>
                    <span class="stat-label">Avg Change</span>
                </div>
                <div class="stat-card glass">
                    <span class="stat-value">${diaryCount}</span>
                    <span class="stat-label">Diary Entries</span>
                </div>
            </div>

            ${d.progress_summary ? `
                <div class="dashboard-progress-insight glass">
                    <span class="progress-insight-icon">&#127793;</span>
                    <span class="progress-insight-text">${this._escapeHtml(d.progress_summary)}</span>
                </div>
            ` : ''}

            <div class="dashboard-chart-section glass">
                <h3 class="dashboard-chart-title">Wellness Score Trend</h3>
                ${d.questionnaire_trend.length > 0
                    ? '<div class="chart-container"><canvas id="scoreChart"></canvas><div id="chartTooltip" class="chart-tooltip"></div></div>'
                    : '<p class="dashboard-empty">Complete a session with pre &amp; post questionnaires to see your trends.</p>'}
            </div>

            <div class="dashboard-chart-section glass">
                <h3 class="dashboard-chart-title">Emotion Profile</h3>
                ${d.emotion_aggregate && Object.keys(d.emotion_aggregate).length > 0
                    ? '<div class="chart-container radar-container"><canvas id="emotionRadar"></canvas><div id="radarTooltip" class="chart-tooltip"></div></div>'
                    : '<p class="dashboard-empty">Enable the camera during playback to track your emotional responses.</p>'}
            </div>

            <button class="dashboard-diary-btn" onclick="dashboard.showDiary()">
                &#128214; My Diary ${diaryCount > 0 ? '(' + diaryCount + ')' : ''}
            </button>
        `;

        if (d.questionnaire_trend.length > 0) {
            this.drawBarChart();
        }
        if (d.emotion_aggregate && Object.keys(d.emotion_aggregate).length > 0) {
            this.drawRadarChart();
        }
    },

    // ---- Grouped Bar Chart for Wellness Score ----

    drawBarChart() {
        const canvas = document.getElementById('scoreChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = rect.width;
        const h = 220;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);

        const pad = { top: 20, right: 20, bottom: 40, left: 40 };
        const plotW = w - pad.left - pad.right;
        const plotH = h - pad.top - pad.bottom;
        const trend = this.data.questionnaire_trend;
        const maxScore = 27;
        const n = trend.length;

        // Group width and bar width
        const groupW = Math.min(100, plotW / Math.max(n, 1) * 0.85);
        const barW = Math.min(28, (groupW - 8) / 2);
        const gap = 4;

        // Store bar rects for hover
        this._barRects = [];

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (plotH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();
        }

        // Y-axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round(maxScore - (maxScore / 4) * i);
            const y = pad.top + (plotH / 4) * i;
            ctx.fillText(val, pad.left - 8, y);
        }

        // Draw bars for each session
        trend.forEach((s, i) => {
            const cx = n === 1
                ? pad.left + plotW / 2
                : pad.left + (plotW / (n)) * i + (plotW / n) / 2;

            // Pre bar
            const preH = (s.pre / maxScore) * plotH;
            const preX = cx - barW - gap / 2;
            const preY = pad.top + plotH - preH;
            this._drawRoundedBar(ctx, preX, preY, barW, preH, '#2dd4bf', 0.9);
            this._barRects.push({ x: preX, y: preY, w: barW, h: preH, label: 'Pre', value: s.pre, session: s, index: i });

            // Post bar
            if (s.post !== null) {
                const postH = (s.post / maxScore) * plotH;
                const postX = cx + gap / 2;
                const postY = pad.top + plotH - postH;
                this._drawRoundedBar(ctx, postX, postY, barW, postH, '#f472b6', 0.9);
                this._barRects.push({ x: postX, y: postY, w: barW, h: postH, label: 'Post', value: s.post, session: s, index: i });

                // Improvement indicator
                const diff = s.post - s.pre;
                if (diff !== 0) {
                    const arrow = diff > 0 ? '+' : '';
                    ctx.fillStyle = diff > 0 ? '#2dd4bf' : '#fb7185';
                    ctx.font = 'bold 10px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    const topY = Math.min(preY, postY) - 6;
                    ctx.fillText(`${arrow}${diff}`, cx, topY);
                }
            }

            // X-axis label
            const label = s.date
                ? new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                : `#${i + 1}`;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(label, cx, pad.top + plotH + 10);
        });

        // Legend
        ctx.textBaseline = 'middle';
        ctx.font = '11px Inter, sans-serif';
        const legendX = w - 130;
        ctx.fillStyle = '#2dd4bf';
        this._drawRoundedBar(ctx, legendX, 6, 14, 10, '#2dd4bf', 1);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'left';
        ctx.fillText('Pre', legendX + 20, 11);
        ctx.fillStyle = '#f472b6';
        this._drawRoundedBar(ctx, legendX + 55, 6, 14, 10, '#f472b6', 1);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Post', legendX + 75, 11);

        // Hover interaction
        canvas.onmousemove = (e) => this._handleBarHover(e, canvas);
        canvas.onmouseleave = () => {
            this._hoveredBar = null;
            const tip = document.getElementById('chartTooltip');
            if (tip) tip.style.opacity = '0';
            this.drawBarChart();
        };
    },

    _drawRoundedBar(ctx, x, y, w, h, color, alpha) {
        if (h <= 0) return;
        const r = Math.min(4, w / 2, h / 2);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    },

    _handleBarHover(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        let hit = null;
        for (const bar of this._barRects) {
            if (mx >= bar.x && mx <= bar.x + bar.w && my >= bar.y && my <= bar.y + bar.h) {
                hit = bar;
                break;
            }
        }

        if (hit !== this._hoveredBar) {
            this._hoveredBar = hit;
            this.drawBarChart();

            const tip = document.getElementById('chartTooltip');
            if (tip && hit) {
                // Highlight hovered bar
                const ctx = canvas.getContext('2d');
                const color = hit.label === 'Pre' ? '#2dd4bf' : '#f472b6';
                this._drawRoundedBar(ctx, hit.x, hit.y, hit.w, hit.h, color, 1);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                const r = Math.min(4, hit.w / 2, hit.h / 2);
                ctx.moveTo(hit.x + r, hit.y);
                ctx.lineTo(hit.x + hit.w - r, hit.y);
                ctx.quadraticCurveTo(hit.x + hit.w, hit.y, hit.x + hit.w, hit.y + r);
                ctx.lineTo(hit.x + hit.w, hit.y + hit.h);
                ctx.lineTo(hit.x, hit.y + hit.h);
                ctx.lineTo(hit.x, hit.y + r);
                ctx.quadraticCurveTo(hit.x, hit.y, hit.x + r, hit.y);
                ctx.closePath();
                ctx.stroke();
                ctx.globalAlpha = 1;

                tip.innerHTML = `<strong>${hit.label}:</strong> ${hit.value}/27`;
                tip.style.left = (hit.x + hit.w / 2) + 'px';
                tip.style.top = (hit.y - 10) + 'px';
                tip.style.opacity = '1';
            } else if (tip) {
                tip.style.opacity = '0';
            }
        }
    },

    // ---- Radar Chart for Emotion Profile ----

    drawRadarChart() {
        const canvas = document.getElementById('emotionRadar');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const size = Math.min(320, canvas.parentElement.getBoundingClientRect().width);
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        canvas.style.margin = '0 auto';
        canvas.style.display = 'block';
        ctx.scale(dpr, dpr);

        const emotions = this.data.emotion_aggregate;
        const colors = {
            happy: { fill: '#fbbf24', label: 'Happy' },
            sad: { fill: '#60a5fa', label: 'Sad' },
            angry: { fill: '#fb7185', label: 'Angry' },
            fearful: { fill: '#a78bfa', label: 'Fearful' },
            disgusted: { fill: '#34d399', label: 'Disgusted' },
            surprised: { fill: '#f472b6', label: 'Surprised' },
            neutral: { fill: '#8a8a9a', label: 'Neutral' }
        };

        const entries = Object.entries(emotions)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((sum, [, v]) => sum + v, 0);
        if (total === 0 || entries.length < 2) {
            // Fallback for too few emotions
            this._drawSimpleBars(ctx, entries, total, size);
            return;
        }

        const cx = size / 2;
        const cy = size / 2;
        const maxR = (size / 2) - 45;
        const n = entries.length;
        const angleStep = (Math.PI * 2) / n;

        // Store for hover
        this._radarEntries = entries;
        this._radarAngles = entries.map((_, i) => -Math.PI / 2 + angleStep * i);
        this._radarCenter = { x: cx, y: cy };
        this._radarMaxR = maxR;
        this._radarSize = size;

        // Draw concentric rings
        for (let ring = 1; ring <= 4; ring++) {
            const r = (maxR / 4) * ring;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw axis lines and labels
        entries.forEach(([emotion], i) => {
            const angle = this._radarAngles[i];
            const ex = cx + Math.cos(angle) * maxR;
            const ey = cy + Math.sin(angle) * maxR;

            // Axis line
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(ex, ey);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label
            const pct = Math.round((entries[i][1] / total) * 100);
            const labelR = maxR + 22;
            const lx = cx + Math.cos(angle) * labelR;
            const ly = cy + Math.sin(angle) * labelR;
            ctx.fillStyle = colors[emotion] ? colors[emotion].fill : '#888';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = colors[emotion] ? colors[emotion].label : emotion;
            ctx.fillText(`${label}`, lx, ly - 6);
            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(`${pct}%`, lx, ly + 7);
        });

        // Draw filled radar shape
        const maxVal = Math.max(...entries.map(([, v]) => v / total));

        ctx.beginPath();
        entries.forEach(([, value], i) => {
            const angle = this._radarAngles[i];
            const r = ((value / total) / maxVal) * maxR;
            const px = cx + Math.cos(angle) * r;
            const py = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.closePath();

        // Gradient fill
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        grad.addColorStop(0, 'rgba(244, 114, 182, 0.25)');
        grad.addColorStop(1, 'rgba(45, 212, 191, 0.08)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw vertex dots
        entries.forEach(([emotion, value], i) => {
            const angle = this._radarAngles[i];
            const r = ((value / total) / maxVal) * maxR;
            const px = cx + Math.cos(angle) * r;
            const py = cy + Math.sin(angle) * r;
            const color = colors[emotion] ? colors[emotion].fill : '#888';
            const isHovered = this._hoveredRadar === i;

            // Outer glow
            ctx.beginPath();
            ctx.arc(px, py, isHovered ? 8 : 5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.25;
            ctx.fill();
            ctx.globalAlpha = 1;

            // Inner dot
            ctx.beginPath();
            ctx.arc(px, py, isHovered ? 5 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // White ring on hover
            if (isHovered) {
                ctx.beginPath();
                ctx.arc(px, py, 7, 0, Math.PI * 2);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.6;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        });

        // Hover interaction
        canvas.onmousemove = (e) => this._handleRadarHover(e, canvas);
        canvas.onmouseleave = () => {
            this._hoveredRadar = null;
            const tip = document.getElementById('radarTooltip');
            if (tip) tip.style.opacity = '0';
            this.drawRadarChart();
        };
    },

    _handleRadarHover(e, canvas) {
        if (!this._radarEntries || !this._radarAngles) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const total = this._radarEntries.reduce((s, [, v]) => s + v, 0);
        const maxVal = Math.max(...this._radarEntries.map(([, v]) => v / total));
        const cx = this._radarCenter.x;
        const cy = this._radarCenter.y;
        const maxR = this._radarMaxR;

        let closest = null;
        let closestDist = 25; // max hover distance in px

        this._radarEntries.forEach(([, value], i) => {
            const angle = this._radarAngles[i];
            const r = ((value / total) / maxVal) * maxR;
            const px = cx + Math.cos(angle) * r;
            const py = cy + Math.sin(angle) * r;
            const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
            if (dist < closestDist) {
                closestDist = dist;
                closest = i;
            }
        });

        if (closest !== this._hoveredRadar) {
            this._hoveredRadar = closest;
            this.drawRadarChart();

            const tip = document.getElementById('radarTooltip');
            if (tip && closest !== null) {
                const [emotion, value] = this._radarEntries[closest];
                const pct = Math.round((value / total) * 100);
                const colors = { happy: '#fbbf24', sad: '#60a5fa', angry: '#fb7185', fearful: '#a78bfa', disgusted: '#34d399', surprised: '#f472b6', neutral: '#8a8a9a' };
                tip.innerHTML = `<span style="color:${colors[emotion] || '#888'}">${emotion}</span> — ${pct}%`;

                const angle = this._radarAngles[closest];
                const r = ((value / total) / maxVal) * maxR;
                const px = cx + Math.cos(angle) * r;
                const py = cy + Math.sin(angle) * r;
                tip.style.left = px + 'px';
                tip.style.top = (py - 12) + 'px';
                tip.style.opacity = '1';
            } else if (tip) {
                tip.style.opacity = '0';
            }
        }
    },

    // Show diary screen
    async showDiary() {
        showScreen('diaryScreen');
        const container = document.getElementById('diaryContent');
        if (!container) return;
        container.innerHTML = '<p class="dashboard-loading">Loading diary...</p>';

        try {
            const resp = await fetch(`/api/diary/${getUserId()}`);
            if (!resp.ok) throw new Error('Failed to load diary');
            const data = await resp.json();
            const entries = data.entries || [];

            if (entries.length === 0) {
                container.innerHTML = '<p class="dashboard-empty">No diary entries yet. Complete a session and journal your thoughts!</p>';
                return;
            }

            container.innerHTML = entries.map(e => `
                <div class="diary-entry">
                    <div class="diary-entry-header">
                        <span class="diary-entry-type ${e.entry_type === 'ai_insight' ? 'diary-type-ai' : 'diary-type-user'}">
                            ${e.entry_type === 'ai_insight' ? 'AI Insight' : 'My Note'}
                        </span>
                        <span class="diary-entry-date">${e.created_at ? new Date(e.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    <p class="diary-entry-content">${this._escapeHtml(e.content)}</p>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = '<p class="dashboard-loading">Unable to load diary.</p>';
        }
    },

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Fallback horizontal bars when too few emotions for radar
    _drawSimpleBars(ctx, entries, total, size) {
        const colors = { happy: '#fbbf24', sad: '#60a5fa', angry: '#fb7185', fearful: '#a78bfa', disgusted: '#34d399', surprised: '#f472b6', neutral: '#8a8a9a' };
        const barH = 24;
        const gap = 12;
        const pad = { left: 80, right: 20, top: 20 };
        const maxBarW = size - pad.left - pad.right;

        entries.forEach(([emotion, value], i) => {
            const pct = total > 0 ? value / total : 0;
            const y = pad.top + i * (barH + gap);
            const bw = pct * maxBarW;

            // Label
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(emotion, pad.left - 10, y + barH / 2);

            // Bar bg
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.beginPath();
            ctx.roundRect(pad.left, y, maxBarW, barH, 6);
            ctx.fill();

            // Bar fill
            if (bw > 0) {
                ctx.fillStyle = colors[emotion] || '#888';
                ctx.globalAlpha = 0.85;
                ctx.beginPath();
                ctx.roundRect(pad.left, y, Math.max(bw, 8), barH, 6);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // Percentage
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(Math.round(pct * 100) + '%', pad.left + bw + 8, y + barH / 2);
        });
    }
};
