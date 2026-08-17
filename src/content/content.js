// Content script: detects playing <video> elements on any page, tracks active
// watch time (pause / tab-hidden stop the timer), and reports finished sessions
// to the background script once they cross the minimum watch threshold.
//
// Loaded as a classic (non-module) script after browser-polyfill.min.js, which
// defines the global `browser` used below — this keeps the same source file
// runnable unmodified as a Chrome MV3 content script and a Firefox MV3 one.

const MIN_SESSION_SECONDS = 30;
const URL_POLL_MS = 1500;
const PROGRESS_REPORT_MS = 5000;

let currentUrl = location.href;
let tracked = new Map(); // video element -> tracking state

function nowMs() {
  return Date.now();
}

function getYouTubeChannelName() {
  const selectors = [
    'ytd-channel-name#channel-name a',
    '#owner #channel-name a',
    '#upload-info #channel-name a',
    'ytd-video-owner-renderer ytd-channel-name a',
    'link[itemprop="name"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.getAttribute && el.getAttribute('content');
      if (text) return text.trim();
      if (el.textContent && el.textContent.trim()) return el.textContent.trim();
    }
  }
  const meta = document.querySelector('meta[itemprop="channelId"]');
  return meta ? 'YouTube Channel' : null;
}

function getYouTubeVideoTitle() {
  const el =
    document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
    document.querySelector('h1.title yt-formatted-string') ||
    document.querySelector('meta[name="title"]');
  if (!el) return document.title;
  return (el.getAttribute && el.getAttribute('content')) || el.textContent || document.title;
}

function getPageMeta() {
  const isYouTube = /(^|\.)youtube\.com$/.test(location.hostname);
  if (isYouTube) {
    return {
      isYouTube: true,
      channelName: getYouTubeChannelName(),
      videoTitle: getYouTubeVideoTitle(),
      rawTitle: document.title,
    };
  }
  return {
    isYouTube: false,
    channelName: null,
    videoTitle: null,
    rawTitle: document.title,
  };
}

function newState() {
  return {
    activeMs: 0,
    lastTickAt: null,
    startedAt: null,
    reported: false,
  };
}

function isVideoActivelyPlaying(video) {
  return !video.paused && !video.ended && video.readyState > 2 && !document.hidden;
}

function tick(video) {
  const state = tracked.get(video);
  if (!state) return;
  const playing = isVideoActivelyPlaying(video);
  const t = nowMs();

  if (playing) {
    if (state.startedAt === null) state.startedAt = t;
    if (state.lastTickAt !== null) {
      state.activeMs += t - state.lastTickAt;
    }
    state.lastTickAt = t;
  } else {
    state.lastTickAt = null;
  }
}

function finalizeSession(video, reason) {
  const state = tracked.get(video);
  if (!state || state.reported) return;
  tick(video);

  const activeSeconds = state.activeMs / 1000;
  if (activeSeconds >= MIN_SESSION_SECONDS && state.startedAt) {
    const meta = getPageMeta();
    const endTime = nowMs();
    const startTime = endTime - state.activeMs;

    browser.runtime
      .sendMessage({
        type: 'WATCH_SESSION',
        payload: {
          url: location.href,
          domain: location.hostname,
          startTime,
          endTime,
          durationMs: state.activeMs,
          ...meta,
        },
      })
      .catch(() => {});
  }

  if (reason === 'pause') {
    // The video may resume playing later (buffering, ads, a manual pause) —
    // keep it in `tracked` so play/playing events keep accumulating a new
    // session instead of being silently ignored by tick()'s `!state` guard.
    tracked.set(video, newState());
  } else {
    state.reported = true;
    tracked.delete(video);
  }
}

function attachVideo(video) {
  if (tracked.has(video)) return;
  const state = newState();
  tracked.set(video, state);

  const onPlay = () => tick(video);
  const onPause = () => finalizeSession(video, 'pause');
  const onEnded = () => finalizeSession(video, 'ended');
  const onRateOrSeek = () => tick(video);

  video.addEventListener('play', onPlay);
  video.addEventListener('playing', onPlay);
  video.addEventListener('pause', onPause);
  video.addEventListener('ended', onEnded);
  video.addEventListener('seeking', onRateOrSeek);

  video.__watchTrackerCleanup = () => {
    video.removeEventListener('play', onPlay);
    video.removeEventListener('playing', onPlay);
    video.removeEventListener('pause', onPause);
    video.removeEventListener('ended', onEnded);
    video.removeEventListener('seeking', onRateOrSeek);
  };
}

function scanForVideos() {
  document.querySelectorAll('video').forEach(attachVideo);
}

function onVisibilityChange() {
  if (document.hidden) {
    tracked.forEach((_, video) => tick(video));
  } else {
    tracked.forEach((_, video) => tick(video));
  }
}

function finalizeAll() {
  Array.from(tracked.keys()).forEach((video) => finalizeSession(video, 'navigate/unload'));
}

function checkUrlChange() {
  if (location.href !== currentUrl) {
    finalizeAll();
    currentUrl = location.href;
  }
}

const mutationObserver = new MutationObserver(() => {
  scanForVideos();
});

mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('visibilitychange', onVisibilityChange);
window.addEventListener('pagehide', finalizeAll);
window.addEventListener('beforeunload', finalizeAll);

setInterval(() => {
  tracked.forEach((_, video) => tick(video));
}, PROGRESS_REPORT_MS);

setInterval(checkUrlChange, URL_POLL_MS);

scanForVideos();
