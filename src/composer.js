/* ============================================================
   bokskie-v1 - composer.js   ·   THE ENGINE

   Writing 7,000 unique replies by hand is not realistic, and
   filler that size is worse than a small amount of good material.
   So this composes replies instead:

     15 topics x 3 languages x openers x bodies x closers

   Each block is a complete, useful thought written by hand. Because
   the three stages are independent, the same body lands under many
   different openers, so the output reads varied rather than like a
   template filled in 70,000 times. Adding replies means adding
   blocks, not writing replies.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BokskieComposer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Node: require the banks. Browser: the UMD bank files already put
     themselves on window.BokskieBank, so nothing needs loading and no
     bundler is involved. */
  var banks;
  if (typeof module === "object" && module.exports) {
    banks = {
      bisaya: require("./banks/bisaya.js"),
      tagalog: require("./banks/tagalog.js"),
      english: require("./banks/english.js")
    };
  } else {
    banks = (typeof globalThis !== "undefined" && globalThis.BokskieBank) ||
            (typeof root !== "undefined" && root.BokskieBank) || {};
  }

  var LANGUAGES = ["bisaya", "tagalog", "english"];

  /* A deterministic PRNG, so a session can be reproduced from a seed.
     Math.random() would answer the same question differently on every
     reload, which is annoying when you are checking whether it works. */
  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function pick(rnd, arr) {
    if (!arr || !arr.length) return "";
    return arr[Math.floor(rnd() * arr.length) % arr.length];
  }

  /* ============================================================
     "Do not say the same thing twice in a row."

     Picking at random is not enough. A topic has only a handful of
     bodies, so the opener and closer rotate and the reply *looks*
     varied, while the part you actually read - the body - repeats
     every few turns. That is what made "hi" feel like a canned
     answer no matter how large the headline number was.

     So keep a short memory of what was just used, per topic, and
     choose from whatever is left. Once everything has been used, the
     memory is dropped and it starts over, so the pool still cycles
     rather than dead-ending.
     ============================================================ */

  var recent = {};
  var RECENT_MAX = 8;

  function remember(key, value) {
    if (!key || !value) return;
    var used = recent[key] || (recent[key] = []);
    var at = used.indexOf(value);
    if (at !== -1) used.splice(at, 1);
    used.push(value);
    while (used.length > RECENT_MAX) used.shift();
  }

  function pickFresh(rnd, arr, key) {
    if (!arr || !arr.length) return "";
    if (key && arr.length > 1) {
      var used = recent[key] || [];
      if (used.length) {
        var pool = [];
        for (var i = 0; i < arr.length; i++) {
          if (used.indexOf(arr[i]) === -1) pool.push(arr[i]);
        }
        if (pool.length) {
          var chosen = pool[Math.floor(rnd() * pool.length) % pool.length];
          remember(key, chosen);
          return chosen;
        }
      }
    }
    var any = arr[Math.floor(rnd() * arr.length) % arr.length];
    remember(key, any);
    return any;
  }

  /** Wipe the memory. Called by the tests, and useful on a new chat. */
  function resetRecent() { recent = {}; }

  function labelFor(lang) {
    return { bisaya: "Bisaya", tagalog: "Tagalog", english: "English" }[lang] || lang;
  }

  /* How many distinct replies a language can currently produce. Any topic
     can borrow any opener and any closer, so the ceiling is all bodies
     times all openers times all closers. */
  function capacity(lang) {
    var b = banks[lang];
    if (!b) return 0;
    var bodies = 0, closers = 0;
    Object.keys(b.topics).forEach(function (t) {
      bodies += b.topics[t].bodies.length;
      closers += b.topics[t].closers.length;
    });
    return bodies * b.openers.length * Math.max(closers, 1);
  }

  function totals() {
    return { bisaya: capacity("bisaya"), tagalog: capacity("tagalog"), english: capacity("english") };
  }

  /* Pick the best topic: keyword hits win, then word overlap, then small
     talk as the honest fallback. */
  function matchTopic(lang, text) {
    var b = banks[lang];
    if (!b) return "smalltalk";
    var t = String(text || "").toLowerCase();
    var names = Object.keys(b.topics);
    var best = null, bestScore = 0;

    names.forEach(function (name) {
      var score = 0;
      (b.topics[name].keywords || []).forEach(function (k) {
        if (t.indexOf(k) !== -1) score += (k.indexOf(" ") === -1 ? 2 : 3);
      });
      if (score > bestScore) { bestScore = score; best = name; }
    });
    if (best) return best;

    var words = t.split(/[^a-z0-9'\-]+/).filter(function (w) { return w.length > 2; });
    words.forEach(function (w) {
      if (bestScore >= 1) return;
      names.forEach(function (name) {
        (b.topics[name].keywords || []).forEach(function (k) {
          if (k.indexOf(w) !== -1 && bestScore < 1) { bestScore = 1; best = name; }
        });
      });
    });
    return best || "smalltalk";
  }

  /* Detect the question's language. Short greetings are the hard part, so
     callers can force a language when the detector is unsure. */
  function detectLanguage(text) {
    var t = String(text || "").toLowerCase();
    var scores = { bisaya: 0, tagalog: 0, english: 0 };
    [
      ["bisaya", /\b(kaayo|ayo|imo|nimo|namuna|usab|pod|kini|kadto|ndi|mao|unsa|kinsa|ngano|asa|gyud|okay)\b/g],
      ["tagalog", /\b(ako|ikaw|kayo|natin|ninyo|mag|mang|nag|sana|hindi|paano|bakit|ano|kailan|saan|po|ba|ng)\b/g],
      ["english", /\b(the|is|are|what|how|why|when|where|who|please|thanks|hello|hi|can|could|would|should|about)\b/g]
    ].forEach(function (pair) {
      var m, re = new RegExp(pair[1].source, pair[1].flags);
      while ((m = re.exec(t))) scores[pair[0]]++;
    });
    var top = "english", topScore = scores.english;
    if (scores.bisaya > topScore) { top = "bisaya"; topScore = scores.bisaya; }
    if (scores.tagalog > topScore) { top = "tagalog"; topScore = scores.tagalog; }
    /* One marker is enough, and it has to beat English. "Ano ang
       pinakamahusay na pelikula" carries exactly one Tagalog word, and
       demanding two answered a clear Tagalog question in English. These
       lists hold words that are not English, so one hit is evidence. */
    return top !== "english" && topScore >= 1 ? top : "english";
  }

  /**
   * Compose one reply.
   * @param {string} text  the user's message
   * @param {object} opts  { lang, seed, topic, translate }
   */
  function reply(text, opts) {
    opts = opts || {};
    var lang = opts.lang;
    if (LANGUAGES.indexOf(lang) === -1) lang = detectLanguage(text);

    var bank = banks[lang] || banks.english;
    if (!bank) throw new Error("bokskie-v1: no bank loaded for " + lang);

    var seed = opts.seed === undefined ? hash(String(text || "") + Date.now()) : opts.seed;
    var rnd = seeded(seed);

    var topicName = opts.topic && bank.topics[opts.topic] ? opts.topic : matchTopic(lang, text);
    var topic = bank.topics[topicName] || bank.topics.smalltalk;

    var out = [pick(rnd, bank.openers), pickFresh(rnd, topic.bodies, lang + ":" + topicName + ":b"),
               pickFresh(rnd, topic.closers, lang + ":" + topicName + ":c")]
      .filter(Boolean).join("\n\n");

    /* Translations are opt-in. On by default they tripled every reply with
       two near-identical copies, which read as far more repetitive than
       the reply actually was. Ask for them when you want them. */
    if (opts.translate === true) {
      LANGUAGES.forEach(function (other) {
        if (other === lang || !banks[other]) return;
        var ob = banks[other].topics[topicName] || banks[other].topics.smalltalk;
        var oRnd = seeded(seed ^ hash(other));
        out += "\n\n---\n\n**" + labelFor(other) + "**\n\n" +
               [pick(oRnd, banks[other].openers),
                pickFresh(oRnd, ob.bodies, other + ":" + topicName + ":b"),
                pickFresh(oRnd, ob.closers, other + ":" + topicName + ":c")]
                 .filter(Boolean).join("\n\n");
      });
    }

    return {
      text: out,
      language: lang,
      topic: topicName,
      seed: seed,
      variants: bank.openers.length * topic.bodies.length * topic.closers.length
    };
  }

  return {
    reply: reply,
    resetRecent: resetRecent,
    totals: totals,
    capacity: capacity,
    detectLanguage: detectLanguage,
    matchTopic: matchTopic,
    labelFor: labelFor,
    languages: LANGUAGES.slice(),
    version: "1.0.0"
  };
});
