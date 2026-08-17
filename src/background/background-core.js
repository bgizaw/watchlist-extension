// Shared background logic: receives WATCH_SESSION messages from content scripts,
// assigns a group key (YouTube channel, or fuzzy-matched cleaned title), and
// persists the session to IndexedDB via VTDB.
//
// Classic (non-module) script. Expects `browser`, `VTDB`, and `VTTitle` to
// already be defined on the global scope by the time this runs — see
// service-worker.chrome.js (importScripts) and the Firefox manifest's
// background.scripts array for how that's wired up on each browser.

async function resolveGroupKey(payload) {
  if (payload.isYouTube && payload.channelName) {
    return { groupKey: `youtube:${payload.channelName}`, groupLabel: payload.channelName, groupType: 'channel' };
  }

  const cleaned = VTTitle.cleanTitle(payload.rawTitle, payload.domain);
  const existing = await VTDB.getAllSessions();
  const existingKeys = Array.from(
    new Set(existing.filter((s) => s.groupType === 'title').map((s) => s.groupKey))
  );
  const matchedKey = VTTitle.findMatchingGroup(cleaned, existingKeys);
  return { groupKey: matchedKey, groupLabel: matchedKey, groupType: 'title' };
}

async function handleWatchSession(payload) {
  const { groupKey, groupLabel, groupType } = await resolveGroupKey(payload);

  const session = {
    url: payload.url,
    domain: payload.domain,
    title: payload.isYouTube ? payload.videoTitle : VTTitle.cleanTitle(payload.rawTitle, payload.domain),
    rawTitle: payload.rawTitle,
    channelName: payload.isYouTube ? payload.channelName : null,
    isYouTube: !!payload.isYouTube,
    groupKey,
    groupLabel,
    groupType,
    startTime: payload.startTime,
    endTime: payload.endTime,
    durationMs: payload.durationMs,
  };

  await VTDB.addSession(session);

  try {
    await browser.action.setBadgeText({ text: '' });
  } catch (e) {
    // action API may briefly be unavailable during startup; safe to ignore.
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'WATCH_SESSION') return undefined;
  handleWatchSession(message.payload)
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // keep the message channel open for the async response
});
