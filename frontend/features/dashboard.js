// ============================================
// Wellness Dashboard — My Journey
// ============================================

const dashboard = {
    data: null,

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
            container.innerHTML = '<p class="dashboard-loading">Unable to load dashboard data.</p>';
        }
    },

    render() {
        const container = document.getElementById('dashboardContent');
        if (!container || !this.data) return;

        const d = this.data;

        // Stats row
        const avgImprovement = d.questionnaire_trend.length > 0
            ? d.questionnaire_trend.reduce((sum, s) => sum + (s.post !== null ? s.post - s.pre : 0), 0) / d.questionnaire_trend.filter(s => s.post !== null).length || 0
            : 0;

        const daysBetween = d.first_session && d.latest_session
            ? Math.max(1, Math.ceil((new Date(d.latest_session) - new Date(d.first_session)) / 86400000))
            : 0;

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
            </div>

            <div class="dashboard-chart-section glass">
                <h3 class="dashboard-chart-title">Wellness Score Trend</h3>
                ${d.questionnaire_trend.length > 0
                    ? '<canvas id="scoreChart" height="200"></canvas>'
                    : '<p class="dashboard-empty">Complete a session with pre &amp; post questionnaires to see your trends.</p>'}
            </div>

            <div class="dashboard-chart-section glass">
                <h3 class="dashboard-chart-title">Emotion Profile</h3>
                ${d.emotion_aggregate && Object.keys(d.emotion_aggregate).length > 0
                    ? '<canvas id="emotionDonut" height="200"></canvas>'
                    : '<p class="dashboard-empty">Enable the camera during playback to track your emotional responses.</p>'}
            </div>
        `;

        if (d.questionnaire_trend.length > 0) {
            this.drawLineChart();
        }
        if (d.emotion_aggregate && Object.keys(d.emotion_aggregate).length > 0) {
            this.drawDonut();
        }
    },

    drawLineChart() {
        const canvas = document.getElementById('scoreChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = 200 * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = '200px';
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = 200;
        const pad = { top: 20, right: 20, bottom: 35, left: 40 };
        const plotW = w - pad.left - pad.right;
        const plotH = h - pad.top - pad.bottom;

        const trend = this.data.questionnaire_trend;
        const maxScore = 27;
        const n = trend.length;

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
            const y = pad.top + (plotH / 3) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();
        }

        // Y-axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 3; i++) {
            const val = Math.round(maxScore - (maxScore / 3) * i);
            const y = pad.top + (plotH / 3) * i;
            ctx.fillText(val, pad.left - 8, y + 4);
        }

        // X-axis labels
        ctx.textAlign = 'center';
        trend.forEach((s, i) => {
            const x = n === 1 ? pad.left + plotW / 2 : pad.left + (plotW / (n - 1)) * i;
            const label = s.date ? new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : `#${i + 1}`;
            ctx.fillText(label, x, h - 8);
        });

        const getX = (i) => n === 1 ? pad.left + plotW / 2 : pad.left + (plotW / (n - 1)) * i;
        const getY = (val) => pad.top + plotH - (val / maxScore) * plotH;

        // Shade improvement zone
        const sessionsWithBoth = trend.filter(s => s.post !== null);
        if (sessionsWithBoth.length > 1) {
            ctx.beginPath();
            trend.forEach((s, i) => {
                if (s.post === null) return;
                const x = getX(i);
                const y = getY(s.post);
                if (i === 0 || trend[i - 1].post === null) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            for (let i = trend.length - 1; i >= 0; i--) {
                if (trend[i].post === null) continue;
                ctx.lineTo(getX(i), getY(trend[i].pre));
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(45, 212, 191, 0.08)';
            ctx.fill();
        }

        // Draw pre-score line (teal)
        this.drawLine(ctx, trend.map((s, i) => ({ x: getX(i), y: getY(s.pre) })), '#2dd4bf');

        // Draw post-score line (rose)
        const postPoints = trend
            .map((s, i) => s.post !== null ? { x: getX(i), y: getY(s.post) } : null)
            .filter(Boolean);
        if (postPoints.length > 0) {
            this.drawLine(ctx, postPoints, '#f472b6');
        }

        // Draw dots
        trend.forEach((s, i) => {
            const x = getX(i);
            this.drawDot(ctx, x, getY(s.pre), '#2dd4bf');
            if (s.post !== null) this.drawDot(ctx, x, getY(s.post), '#f472b6');
        });

        // Legend
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = '#2dd4bf';
        ctx.fillRect(w - 130, 8, 12, 3);
        ctx.fillText('Pre', w - 110, 13);
        ctx.fillStyle = '#f472b6';
        ctx.fillRect(w - 80, 8, 12, 3);
        ctx.fillText('Post', w - 60, 13);
    },

    drawLine(ctx, points, color) {
        if (points.length < 1) return;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
    },

    drawDot(ctx, x, y, color) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;
    },

    drawDonut() {
        const canvas = document.getElementById('emotionDonut');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = 200 * dpr;
        canvas.height = 200 * dpr;
        canvas.style.width = '200px';
        canvas.style.height = '200px';
        canvas.style.margin = '0 auto';
        canvas.style.display = 'block';
        ctx.scale(dpr, dpr);

        const emotions = this.data.emotion_aggregate;
        const colors = {
            happy: '#fbbf24',
            sad: '#60a5fa',
            angry: '#fb7185',
            fearful: '#a78bfa',
            disgusted: '#34d399',
            surprised: '#f472b6',
            neutral: '#8a8a9a'
        };

        const entries = Object.entries(emotions).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((sum, [, v]) => sum + v, 0);
        if (total === 0) return;

        const cx = 100, cy = 100, outerR = 80, innerR = 50;
        let startAngle = -Math.PI / 2;

        entries.forEach(([emotion, value]) => {
            const sliceAngle = (value / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
            ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = colors[emotion] || '#666';
            ctx.fill();
            startAngle += sliceAngle;
        });

        // Center label
        ctx.fillStyle = '#f0eef5';
        ctx.font = '600 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (entries.length > 0) {
            ctx.fillText(entries[0][0], cx, cy - 6);
            ctx.font = '11px Inter, sans-serif';
            ctx.fillStyle = '#8a8a9a';
            ctx.fillText(Math.round((entries[0][1] / total) * 100) + '%', cx, cy + 10);
        }

        // Legend below
        const legendY = 195;
        // Use parent to add legend
        const parent = canvas.parentElement;
        let legendHtml = '<div class="donut-legend">';
        entries.slice(0, 5).forEach(([emotion, value]) => {
            const pct = Math.round((value / total) * 100);
            legendHtml += `<span class="donut-legend-item"><span class="donut-dot" style="background:${colors[emotion] || '#666'}"></span>${emotion} ${pct}%</span>`;
        });
        legendHtml += '</div>';
        const existing = parent.querySelector('.donut-legend');
        if (existing) existing.remove();
        parent.insertAdjacentHTML('beforeend', legendHtml);
    }
};
