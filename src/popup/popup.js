async function renderPopup() {
  const now = Date.now();
  const totals = await VTAnalytics.getTotals(now);

  document.getElementById('stat-today').textContent = VTAnalytics.formatDuration(totals.today);
  document.getElementById('stat-week').textContent = VTAnalytics.formatDuration(totals.week);
  document.getElementById('stat-month').textContent = VTAnalytics.formatDuration(totals.month);

  const breakdown = await VTAnalytics.getBreakdown(VTAnalytics.startOfMonth(now));
  const list = document.getElementById('top-list');
  const empty = document.getElementById('top-empty');
  list.innerHTML = '';

  if (breakdown.length === 0) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    breakdown.slice(0, 6).forEach((entry) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = entry.label;
      const duration = document.createElement('span');
      duration.className = 'duration';
      duration.textContent = VTAnalytics.formatDuration(entry.durationMs);
      li.appendChild(name);
      li.appendChild(duration);
      list.appendChild(li);
    });
  }
}

document.getElementById('open-dashboard').addEventListener('click', () => {
  browser.tabs.create({ url: browser.runtime.getURL('src/dashboard/dashboard.html') });
});

renderPopup().catch((err) => console.error('[watch-time-tracker] popup render failed', err));
