let currentRange = 'day';
let chartInstance = null;

function rangeStart(range, now) {
  if (range === 'day') return VTAnalytics.startOfDay(now);
  if (range === 'week') return VTAnalytics.startOfWeek(now);
  if (range === 'month') return VTAnalytics.startOfMonth(now);
  return 0; // all time
}

async function renderTotals(now) {
  const totals = await VTAnalytics.getTotals(now);
  document.getElementById('total-today').textContent = VTAnalytics.formatDuration(totals.today);
  document.getElementById('total-week').textContent = VTAnalytics.formatDuration(totals.week);
  document.getElementById('total-month').textContent = VTAnalytics.formatDuration(totals.month);
  document.getElementById('total-all').textContent = VTAnalytics.formatDuration(totals.allTime);
}

async function renderTrend() {
  const buckets = await VTAnalytics.getDailyTrend(14);
  const ctx = document.getElementById('trend-chart').getContext('2d');
  const labels = buckets.map((b) => b.label);
  const data = buckets.map((b) => Math.round(b.durationMs / 60000));

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Minutes watched',
          data,
          backgroundColor: 'rgba(124, 111, 242, 0.55)',
          hoverBackgroundColor: 'rgba(124, 111, 242, 0.85)',
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${item.parsed.y} min`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9aa1b1', font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#262b36' },
          ticks: { color: '#9aa1b1', font: { size: 11 }, precision: 0 },
        },
      },
    },
  });
}

async function renderBreakdown(now) {
  const since = rangeStart(currentRange, now);
  const breakdown = await VTAnalytics.getBreakdown(since || null);
  const list = document.getElementById('breakdown-list');
  const empty = document.getElementById('breakdown-empty');
  list.innerHTML = '';

  if (breakdown.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const max = breakdown[0].durationMs || 1;
  breakdown.slice(0, 12).forEach((entry) => {
    const li = document.createElement('li');

    const top = document.createElement('div');
    top.className = 'breakdown-row-top';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = entry.groupType === 'channel' ? `${entry.label} (YouTube)` : entry.label;
    const duration = document.createElement('span');
    duration.className = 'duration';
    duration.textContent = VTAnalytics.formatDuration(entry.durationMs);
    top.appendChild(name);
    top.appendChild(duration);

    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = `${Math.max(4, Math.round((entry.durationMs / max) * 100))}%`;
    track.appendChild(fill);

    li.appendChild(top);
    li.appendChild(track);
    list.appendChild(li);
  });
}

async function renderSessions(now) {
  const since = rangeStart(currentRange, now);
  const all = await VTAnalytics.getRecentSessions(500);
  const scoped = since ? all.filter((s) => s.startTime >= since) : all;
  const body = document.getElementById('sessions-body');
  const empty = document.getElementById('sessions-empty');
  body.innerHTML = '';

  if (scoped.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  scoped.slice(0, 100).forEach((s) => {
    const tr = document.createElement('tr');

    const when = document.createElement('td');
    when.textContent = new Date(s.startTime).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const titleCell = document.createElement('td');
    titleCell.textContent = s.isYouTube && s.channelName ? `${s.title} — ${s.channelName}` : s.title;

    const domainCell = document.createElement('td');
    domainCell.textContent = s.domain;

    const durationCell = document.createElement('td');
    durationCell.textContent = VTAnalytics.formatDuration(s.durationMs);

    tr.appendChild(when);
    tr.appendChild(titleCell);
    tr.appendChild(domainCell);
    tr.appendChild(durationCell);
    body.appendChild(tr);
  });
}

async function renderAll() {
  const now = Date.now();
  await Promise.all([renderTotals(now), renderTrend(), renderBreakdown(now), renderSessions(now)]);
}

document.getElementById('range-toggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-range]');
  if (!btn) return;
  currentRange = btn.dataset.range;
  document
    .querySelectorAll('.range-toggle button')
    .forEach((b) => b.classList.toggle('active', b === btn));
  const now = Date.now();
  renderBreakdown(now);
  renderSessions(now);
});

renderAll().catch((err) => console.error('[watch-time-tracker] dashboard render failed', err));
