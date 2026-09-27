/* ============================================================
   bokskie.v1 · engine/mood.js
   ------------------------------------------------------------
   Reads the emotional tone of a message so the reply can match it.

   Why a module and not keywords bolted onto intent.js: mood is
   orthogonal to intent. "I am so tired of this bug" and "I am so
   happy you fixed it" share every content word and differ only in
   tone, and intent detection calls both of them `definition`. A
   separate signal is the only way to tell them apart.

   The honest limits, stated up front because they matter:

   - It reads words, punctuation and emphasis. That is real signal, not
     a mind read. Someone can be angry in a flat sentence and nothing
     here will notice.
   - It is deliberately biased toward `neutral`. When the signal is
     weak the answer is "no mood detected" and the reply stays
     ordinary. A bot that guesses happiness on every message reads as
     insincere, which is worse than not trying.
   - It never claims to know how the user actually feels. It reports
     the tone of what they typed, and that is the whole claim.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BokskieMood = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Weighted, because some words are much stronger evidence than
     others: "gutters" is anger, "ok" is nothing. */
  var MOODS = {
    sad: [
      ["sad", 3], ["unhappy", 3], ["cry", 3], ["crying", 3], ["tears", 3],
      ["hurt", 3], ["lonely", 3], ["depressed", 4], ["hopeless", 4],
      ["broken", 3], ["painful", 3], ["awful", 3],
      ["nalungkot", 4], ["umiyak", 4], ["nasasaktan", 3], ["kalungkutan", 3],
      ["hapis", 3], ["kaluoy", 3], ["masakit", 3]
    ],
    angry: [
      ["angry", 4], ["furious", 4], ["mad", 3], ["hate", 3], ["annoyed", 3],
      ["annoying", 3], ["frustrated", 4], ["frustrating", 4], ["rage", 4],
      ["stupid", 3], ["useless", 3], ["buntat", 4], ["galit", 4], ["mapagit", 4],
      ["nasalakot", 4], ["obos", 3], ["kuyog", 3], ["kaunod", 3]
    ],
    anxious: [
      ["anxious", 4], ["nervous", 4], ["worried", 4], ["worry", 3],
      ["scared", 4], ["afraid", 4], ["stress", 3], ["stressed", 4],
      ["panic", 4], ["overwhelmed", 4], ["paranoid", 4],
      ["dugtong", 3], ["bukhau", 3], ["kulab", 3], ["natakot", 4],
      ["mahitungod", 3], ["nalipong", 3]
    ],
    tired: [
      ["tired", 4], ["exhausted", 4], ["sleepy", 4], ["drained", 4],
      ["burnt", 3], ["weary", 3],
      ["pagod", 4], ["kapagodon", 4], ["humpa", 3], ["matulog", 2]
    ],
    grateful: [
      ["thank", 4], ["thanks", 4], ["grateful", 4], ["appreciate", 4],
      ["appreciated", 4], ["helpful", 3], ["salamat", 4], ["maraming", 2],
      ["nakakagandiyami", 3]
    ],
    excited: [
      ["excited", 4], ["amazing", 4], ["awesome", 4], ["incredible", 4],
      ["yay", 4], ["finally", 3], ["kilig", 4], ["masaya", 3], ["carig", 3],
      ["bayong", 3], ["kalingag", 4],
      /* Punctuation alone was not enough: "OMG it works!!!" carries no
         dictionary word at all, and three exclamation marks are not
         evidence of anything on their own. The abbreviation is. */
      ["omg", 4], ["wow", 3], ["woohoo", 4], ["yesss", 3], ["yayyy", 3]
    ],
    happy: [
      ["happy", 4], ["glad", 3], ["great", 3], ["love", 3], ["enjoy", 3],
      ["satisfied", 3], ["masaya", 4], ["maligaya", 4]
    ],
    confused: [
      ["confused", 4], ["unclear", 3], ["puzzled", 4], ["huh", 3],
      ["bali", 2], ["muddled", 4], ["kamatong", 3], ["unsa", 2]
    ]
  };

  /* Kept out of the tables on purpose: too weak to be evidence alone.
     "good" on its own is usually "good question", which is a courtesy
     rather than a mood - and reading that as happiness is the single
     most common way a system like this becomes insufferable. */
  var NEUTRAL_WORDS = { good: 1, okay: 1, ok: 1, fine: 1, like: 1, right: 1 };

  /* Tone from punctuation and emphasis, which is often the loudest
     signal a person has: "ok" and "OK!!!" are different states. */
  function signals(text) {
    var t = String(text || "");
    var out = { intensity: 0, trailing: 0, caps: false, elongation: 0 };
    var bangs = (t.match(/!/g) || []).length;
    if (bangs >= 3) out.intensity = 3;
    else if (bangs === 2) out.intensity = 2;
    else if (bangs === 1) out.intensity = 1;

    var dots = (t.match(/\.{3,}/g) || []).length;
    if (dots) { out.trailing = 2; out.intensity = Math.max(out.intensity, 1); }

    var letters = (t.match(/[a-zA-Z]/g) || []).length;
    var upper = (t.match(/[A-Z]/g) || []).length;
    if (letters > 4 && upper / letters > 0.6) { out.caps = true; out.intensity = 3; }

    if (t.match(/([a-zA-Z])\1{2,}/)) out.elongation = 2;
    return out;
  }

  /* Whole-word match, so "sad" does not fire inside "saddle" and
     "mad" does not fire inside "made". Substring search is the kind
     of thing that looks fine until someone types a normal sentence. */
  function hasWord(text, word) {
    var at = text.indexOf(word);
    while (at !== -1) {
      var before = at === 0 ? " " : text.charAt(at - 1);
      var after = at + word.length >= text.length ? " " : text.charAt(at + word.length);
      if (!/[a-z]/.test(before) && !/[a-z]/.test(after)) return true;
      at = text.indexOf(word, at + 1);
    }
    return false;
  }

  /* Returns { mood, confidence, strength, signals, evidence }.
     `mood` is "neutral" when nothing cleared the bar, and `evidence`
     names the words that decided it, so a wrong reading can be
     debugged instead of guessed at. */
  function detect(text) {
    var t = String(text || "").toLowerCase();
    var sig = signals(text);
    var scores = Object.create(null);
    var evidence = Object.create(null);

    var moods = Object.keys(MOODS);
    for (var m = 0; m < moods.length; m++) {
      var table = MOODS[moods[m]];
      for (var i = 0; i < table.length; i++) {
        var word = table[i][0], w = table[i][1];
        if (!word || NEUTRAL_WORDS[word]) continue;
        if (!hasWord(t, word)) continue;
        scores[moods[m]] = (scores[moods[m]] || 0) + w;
        (evidence[moods[m]] || (evidence[moods[m]] = [])).push(word + "+" + w);
      }
    }

    var best = null, bestScore = 0, total = 0;
    for (var k in scores) {
      if (!Object.prototype.hasOwnProperty.call(scores, k)) continue;
      total += scores[k];
      if (scores[k] > bestScore) { bestScore = scores[k]; best = k; }
    }

    /* Punctuation nudges an existing reading; it never invents one.
       "!!!" is excitement or anger depending on everything else that
       was said, and on its own it says nothing about which. */
    var strength = bestScore;
    if (best && sig.intensity > 0) {
      if (best === "sad" || best === "tired" || best === "confused") {
        if (sig.trailing) strength += 1;
      } else {
        strength += sig.intensity;
      }
    }
    if (best === "angry" && (sig.caps || sig.elongation)) strength += 1;

    if (!best || strength < 3) {
      return { mood: "neutral", confidence: 0, strength: strength, signals: sig, evidence: [] };
    }
    return {
      mood: best,
      /* How much of the signal this one mood owns. Two moods close
         together is a genuinely mixed state, and reporting low
         confidence there is more honest than picking a winner. */
      confidence: total ? Math.round((bestScore / total) * 100) / 100 : 1,
      strength: strength,
      signals: sig,
      evidence: evidence[best] || []
    };
  }

  return { detect: detect, signals: signals, MOODS: MOODS, NEUTRAL: NEUTRAL_WORDS };
});

