/* ============================================================
   bokskie-v1 · engine/similarity.js
   ------------------------------------------------------------
   Four scores, because each one fails in a different place:

     cosine  - the main signal. "what is javascript" vs a JavaScript
               entry scores high, an unrelated one near zero.
     jaccard - blunt overlap. Stops a long entry from stealing the
               match with one incidental shared word.
     dice    - character bigrams. This is what rescues typos:
               "progaming" still reaches "programming".
     levRatio- edit distance, for near-miss words like "javascrip".

   A single cosine is not enough. It happily returns a high score for
   an entry that shares a common word and nothing else, which is how
   you get a confident wrong answer - the failure mode this whole
   project exists to avoid.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BokskieSimilarity = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function cosine(a, b) {
    var dot = 0, na = 0, nb = 0, k;
    for (k in a) { if (Object.prototype.hasOwnProperty.call(a, k)) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; } }
    for (k in b) { if (Object.prototype.hasOwnProperty.call(b, k)) nb += b[k] * b[k]; }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function jaccard(a, b) {
    var inter = 0, total = 0, k;
    for (k in a) { if (Object.prototype.hasOwnProperty.call(a, k)) { total++; if (b[k]) inter++; } }
    for (k in b) { if (Object.prototype.hasOwnProperty.call(b, k) && !a[k]) total++;
    }
    if (!total) return 0;
    return inter / total;
  }

  function dice(aArr, bArr) {
    if (!aArr.length || !bArr.length) return 0;
    var m = Object.create(null);
    for (var i = 0; i < aArr.length; i++) m[aArr[i]] = (m[aArr[i]] || 0) + 1;
    var hits = 0;
    for (var j = 0; j < bArr.length; j++) {
      if (m[bArr[j]]) { hits++; m[bArr[j]]--; }
    }
    return (2 * hits) / (aArr.length + bArr.length);
  }

  /* Standard Levenshtein, two-row. */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = new Array(b.length + 1);
    var i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function levRatio(a, b) {
    if (!a.length || !b.length) return 0;
    var d = levenshtein(a, b);
    return 1 - d / Math.max(a.length, b.length);
  }

  /* Best fuzzy ratio of a token against a list, used to forgive
     misspellings before they poison the exact-match index. */
  function bestFuzzy(token, candidates, cutoff) {
    cutoff = cutoff || 0.82;
    var best = 0;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (Math.abs(c.length - token.length) > 2) continue;
      var r = levRatio(token, c);
      if (r > best) { best = r; if (best === 1) break; }
    }
    return best >= cutoff ? best : 0;
  }

  /* The blend. Weights are deliberate: cosine leads because it
     understands weighting, dice guards typos, and jaccard is the
     tie-breaker that rejects "shares one common word" matches. */
  function score(query, entry) {
    var c = cosine(query.vector, entry.vector);
    var j = jaccard(query.set, entry.set);
    var d = dice(query.bigrams, entry.bigrams);
    var total = c * 0.55 + j * 0.20 + d * 0.25;
    return { total: total, cosine: c, jaccard: j, dice: d };
  }

  return {
    cosine: cosine,
    jaccard: jaccard,
    dice: dice,
    levenshtein: levenshtein,
    levRatio: levRatio,
    bestFuzzy: bestFuzzy,
    score: score
  };
});
