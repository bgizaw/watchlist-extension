// Local heuristics for turning a raw page title into a clean show/movie title,
// and for fuzzy-grouping similar titles together. No external metadata lookups.
// Plain classic script, exposed on the global VTTitle namespace (see db.js for why).

(function (global) {
  const JUNK_PATTERNS = [
    /\bwatch\s+online\b/gi,
    /\bfree\s+online\b/gi,
    /\bwatch\s+free\b/gi,
    /\bfull\s+movie\b/gi,
    /\bhd\s*online\b/gi,
    /\b(1080p|720p|480p|4k)\b/gi,
    /\bsub(bed)?\b/gi,
    /\bdub(bed)?\b/gi,
    /\bepisode\s*\d+\b/gi,
    /\bep\.?\s*\d+\b/gi,
    /\bseason\s*\d+\b/gi,
    /\bs\d{1,2}e\d{1,3}\b/gi,
    /\bstream(ing)?\b/gi,
    /\bonline\s+free\b/gi,
  ];

  const SEPARATORS = [' | ', ' - ', ' – ', ' — ', ' :: ', ' » '];

  function cleanTitle(rawTitle, siteName) {
    if (!rawTitle) return 'Untitled';
    let title = rawTitle.trim();

    for (const sep of SEPARATORS) {
      if (title.includes(sep)) {
        const parts = title.split(sep).map((p) => p.trim());
        if (parts.length > 1) {
          const last = parts[parts.length - 1].toLowerCase();
          const looksLikeBrand =
            (siteName && last.includes(siteName.toLowerCase())) || last.length <= 20;
          if (looksLikeBrand) {
            parts.pop();
            title = parts.join(sep).trim() || title;
          }
        }
      }
    }

    for (const pattern of JUNK_PATTERNS) {
      title = title.replace(pattern, ' ');
    }

    title = title.replace(/\s+/g, ' ').replace(/^[-|:\s]+|[-|:\s]+$/g, '').trim();

    return title || rawTitle.trim() || 'Untitled';
  }

  function normalizeForMatch(title) {
    return title
      .toLowerCase()
      .replace(/\bs\d{1,2}e\d{1,3}\b/gi, '')
      .replace(/\bepisode\s*\d+\b/gi, '')
      .replace(/\bep\.?\s*\d+\b/gi, '')
      .replace(/\bpart\s*\d+\b/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[n];
  }

  function titleSimilarity(a, b) {
    const na = normalizeForMatch(a);
    const nb = normalizeForMatch(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    const maxLen = Math.max(na.length, nb.length);
    const dist = levenshtein(na, nb);
    return 1 - dist / maxLen;
  }

  const SIMILARITY_THRESHOLD = 0.72;

  function findMatchingGroup(newTitle, existingGroupKeys) {
    let best = null;
    let bestScore = 0;
    for (const key of existingGroupKeys) {
      const score = titleSimilarity(newTitle, key);
      if (score > bestScore) {
        bestScore = score;
        best = key;
      }
    }
    if (best && bestScore >= SIMILARITY_THRESHOLD) return best;
    return newTitle;
  }

  global.VTTitle = {
    cleanTitle,
    normalizeForMatch,
    titleSimilarity,
    findMatchingGroup,
  };
})(typeof self !== 'undefined' ? self : this);
