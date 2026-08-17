// Shared analytics helpers used by both the popup and the dashboard page.
// Classic script, exposes VTAnalytics. Reads sessions via VTDB (IndexedDB),
// which works the same way from the popup/dashboard document context as it
// does from the background context in both Chrome and Firefox.

(function (global) {
  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }

  function startOfWeek(d) {
    const x = new Date(d);
    const day = x.getDay(); // 0 = Sunday
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }

  function startOfMonth(d) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }

  function sumDuration(sessions) {
    return sessions.reduce((acc, s) => acc + (s.durationMs || 0), 0);
  }

  async function getTotals(now) {
    const all = await VTDB.getAllSessions();
    const today = startOfDay(now);
    const week = startOfWeek(now);
    const month = startOfMonth(now);
    return {
      today: sumDuration(all.filter((s) => s.startTime >= today)),
      week: sumDuration(all.filter((s) => s.startTime >= week)),
      month: sumDuration(all.filter((s) => s.startTime >= month)),
      allTime: sumDuration(all),
    };
  }

  async function getBreakdown(sinceMs) {
    const all = await VTDB.getAllSessions();
    const scoped = sinceMs ? all.filter((s) => s.startTime >= sinceMs) : all;
    const byGroup = new Map();
    for (const s of scoped) {
      const key = s.groupKey || s.title || 'Unknown';
      if (!byGroup.has(key)) {
        byGroup.set(key, {
          groupKey: key,
          label: s.groupLabel || s.title || key,
          groupType: s.groupType || 'title',
          durationMs: 0,
          sessionCount: 0,
        });
      }
      const entry = byGroup.get(key);
      entry.durationMs += s.durationMs || 0;
      entry.sessionCount += 1;
    }
    return Array.from(byGroup.values()).sort((a, b) => b.durationMs - a.durationMs);
  }

  /** Daily totals for the last N days, oldest first, for trend charting. */
  async function getDailyTrend(days) {
    const all = await VTDB.getAllSessions();
    const buckets = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = startOfDay(d);
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const durationMs = sumDuration(all.filter((s) => s.startTime >= dayStart && s.startTime < dayEnd));
      buckets.push({
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        dayStart,
        durationMs,
      });
    }
    return buckets;
  }

  async function getRecentSessions(limit) {
    const all = await VTDB.getAllSessions();
    return all.sort((a, b) => b.startTime - a.startTime).slice(0, limit || 50);
  }

  function formatDuration(ms) {
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0 && minutes === 0) return '<1m';
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  }

  global.VTAnalytics = {
    startOfDay,
    startOfWeek,
    startOfMonth,
    getTotals,
    getBreakdown,
    getDailyTrend,
    getRecentSessions,
    formatDuration,
  };
})(typeof self !== 'undefined' ? self : this);
