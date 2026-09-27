/* ============================================================
   bokskie-v1 - provider.js
   ------------------------------------------------------------
   The bridge between bokskie.ai and the understanding engine.
   Exposes the shape the app expects from any provider:

       reply(text, opts)  -> Promise
       stream(text, opts) -> async generator of chunks
       ready()            -> Promise, so the app waits for the bank
                             instead of guessing whether it is there

   The engine loads asynchronously, so every entry point waits on
   ready(). If loading fails, ready() resolves null and every call
   returns a clear error - a provider that answers "hello" while its
   knowledge base silently failed to load is the worst outcome.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../engine/index.js"),
                             require("../engine/tokenizer.js"),
                             require("../engine/intent.js"));
  } else {
    root.BokskieLocal = factory(root.BokskieEngine, root.BokskieTokenizer, root.BokskieIntent);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (E, T, I) {
  "use strict";

  var PROVIDER_ID = "bokskie-local";

  var info = {
    id: PROVIDER_ID,
    label: "bokskie.ai (offline)",
    base: "",
    keyUrl: "",
    keyHint: "No key needed - it runs entirely on this machine.",
    auth: "none",
    dialect: "openai",
    cost: "local",
    note: "An offline retrieval engine, not a language model. It looks your question " +
          "up in a hand-written knowledge bank and returns the closest real answer - " +
          "and when nothing is close enough it says so instead of guessing. " +
          "Correct for what it covers, honest about the rest. Use Gemini for real AI."
  };

  var MODELS = [
    { id: "bokskie.v1", label: "bokskie.v1", sub: "Offline \u00b7 answers from its knowledge bank", tag: "Free" },
    { id: "bokskie.v1-verbose", label: "bokskie.v1 + translations", sub: "Adds the other two languages" }
  ];

  var engine = null, loadError = null, pending = null;

  /* Resolve the engine at CALL time, not at load time.
     Reading root.BokskieEngine inside the factory meant a script-order
     mistake - provider.js loaded before the engine - killed the whole
     provider before it could report anything useful.

     Careful here: the UMD factory's parameters are (E, T, I). There is
     no `root` in scope in here - it belongs to the outer IIFE - so
     referring to it is a ReferenceError in strict mode, which throws
     before `root.BokskieLocal` is ever assigned and leaves the page
     with no provider at all. Use globalThis, which always exists. */
  function engineModule() {
    if (E) return E;
    var g = (typeof globalThis !== "undefined") ? globalThis.BokskieEngine : null;
    return g || null;
  }

  function ready() {
    if (pending) return pending;
    var mod = engineModule();
    if (!mod || typeof mod.Engine === "undefined") {
      loadError = "the engine did not load. bokskie-v1/engine/*.js must be in the page " +
                  "before src/provider.js.";
      pending = Promise.resolve(null);
      return pending;
    }
    try {
      pending = Promise.resolve(mod.Engine.load({ basePath: "bokskie-v1/data/" }))
        .then(function (e) {
          engine = e;
          if (!e.kb.entries.length) loadError = "the knowledge bank came back empty";
          return engine;
        })
        .catch(function (err) {
          loadError = (err && err.message) ? err.message : String(err);
          return null;
        });
    } catch (err) {
      loadError = (err && err.message) ? err.message : String(err);
      pending = Promise.resolve(null);
    }
    return pending;
  }

  function failText() {
    return "bokskie.v1 could not load: " + (loadError || "the engine files are missing") +
           ". Check that bokskie-v1/engine/*.js and data/bundle.js are in the page.";
  }

  var LANG_NAME = { english: "English", tagalog: "Tagalog", bisaya: "Bisaya" };

  function ask(e, text, opts, lang) {
    return e.reply(text, { seed: opts.seed, lang: lang, useContext: opts.useContext !== false });
  }

  function reply(text, opts) {
    opts = opts || {};
    return ready().then(function (e) {
      if (!e) return { text: failText(), known: false, entryId: null, confidence: 0 };
      if (!opts.translate) return ask(e, text, opts, opts.lang);

      /* Verbose mode: run the question once per language and stack the
         results. The first call is the real one and carries the memory;
         the others are pure lookups, or the context would advance three
         times per message. */
      var primary = ask(e, text, opts, opts.lang);
      if (!primary.text) return primary;
      /* Label by the language the REQUEST came in, not the answer.
         Each section below is the same question routed as though it had
         been asked in that language, so the request language is the
         meaningful axis - the heading says which routing produced it.

         But the note has to follow the ANSWER, and this is where the
         old text stopped being true. It said "knowledge bank is in
         English" unconditionally, which was accurate when every entry
         was English-only and became a lie the moment entries started
         carrying real Tagalog and Bisaya bodies - it would have denied
         a genuine translation that was right there. So the note appears
         only when the bank actually had to substitute. */
      var used = primary.requestLang || opts.lang || "english";
      var actual = primary.lang || used;
      var note = (actual === used)
        ? ""
        : " _(no " + (LANG_NAME[used] || used) + " version in the bank - " +
          "showing the " + (LANG_NAME[actual] || actual) + " one)_";
      var parts = ["**" + (LANG_NAME[used] || "Answer") + "**" + note + "\n" + primary.text];
      ["english", "tagalog", "bisaya"].forEach(function (l) {
        if (l === used) return;
        var alt = ask(e, text, { seed: (opts.seed || 1) + 7, useContext: false }, l);
        if (alt.text) parts.push("**" + LANG_NAME[l] + "**\n" + alt.text);
      });
      primary.text = parts.join("\n\n");
      return primary;
    });
  }

  /* ---------- how the reply is delivered ----------

     The app renders every provider through one streaming path, so the
     feel of this reply is decided right here. Equal-sized chunks at one
     fixed delay read as text teleporting, not as someone typing: real
     output arrives in uneven bursts and breathes at the punctuation.

     So the text is split on word boundaries - never mid-word, because a
     half word appearing on its own is the clearest possible tell - and
     each burst carries the whitespace that follows it, so the chunks
     still rejoin into the original string exactly. Correct markdown
     depends on that, and so does section 7 of verify-provider.js.

     The pace after a burst depends on what it ended with. Punctuation
     is the cue the eye actually reads: a full stop is a real pause, a
     comma is a breath.

     Burst sizes and pauses come from a hash of the text, never from
     Math.random(). That is what keeps a seeded reply reproducible from
     end to end, and it is what makes this testable: the same question
     always types at the same speed. */

  var PACE = {
    word:  34,     /* after a burst ending on an ordinary word */
    comma: 110,    /* after , ; : - or a line break - a short breath */
    stop:  220,    /* after . ! ? - the long one */
    swing: 18      /* +/- so the rhythm never becomes a metronome */
  };

  /* FNV-1a. It only has to spread neighbouring bursts apart - it is not
     meant to be cryptographic. Math.imul keeps the multiply in 32-bit
     so the result is identical everywhere. */
  function hashStep(key, step) {
    var s = key + ":" + step;
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function pauseAfter(burst, key, step) {
    var tail = burst.replace(/\s+$/, "").slice(-1);
    var wait = PACE.word;
    if (tail === "." || tail === "!" || tail === "?") wait = PACE.stop;
    else if (tail === "," || tail === ";" || tail === ":" ||
             tail === "-" || tail === "\n") wait = PACE.comma;
    return Math.max(0, wait + (hashStep(key, step) % (PACE.swing * 2 + 1)) - PACE.swing);
  }

  function* typeBursts(text, key) {
    /* \S+\s* keeps each word with the space that follows it. */
    var words = text.match(/\S+\s*/g) || [];
    var i = 0, step = 0;
    while (i < words.length) {
      /* One to three words per burst. A fixed size reads as a machine;
         a person types in uneven clumps. */
      var burst = "";
      var span = 1 + (hashStep(key, step) % 3);
      for (var k = 0; k < span && i < words.length; k++) burst += words[i++];
      /* A burst too small to paint anything is wasted work, so top it
         up - unless that was the last word, in which case send it. */
      if (burst.replace(/\s+$/, "").length < 3 && i < words.length) burst += words[i++];
      yield burst;
      step++;
    }
  }

  /* Chunked, so the UI uses the same streaming path it uses for a real
     provider and the bubble grows instead of appearing at once. */
  async function* stream(text, opts) {
    opts = opts || {};
    var out = await reply(text, opts);
    var bursts = Array.from(typeBursts(out.text, out.text));
    for (var i = 0; i < bursts.length; i++) {
      if (opts.signal && opts.signal.aborted) return;
      yield bursts[i];
      if (i === bursts.length - 1) break;   /* no pointless timer after the last one */
      var wait = pauseAfter(bursts[i], out.text, i);
      if (wait) await new Promise(function (r) { setTimeout(r, wait); });
    }
  }

  /* Synchronous best-effort stats for the settings panel. Reports zeroes
     before the bank is in rather than throwing, so the panel renders
     either way. */
  function stats() {
    if (!engine) {
      return { id: PROVIDER_ID, entries: 0, topics: [], topicsCount: 0, ready: false, error: loadError };
    }
    var s = engine.stats();
    return {
      id: PROVIDER_ID, entries: s.entries, tokens: s.tokens,
      topics: engine.topics(), topicsCount: s.topics, files: s.files,
      ready: true, error: null
    };
  }

  /* Start loading as soon as the provider exists, so the bank is warm
     by the time the first message is sent. */
  ready();

  return {
    id: PROVIDER_ID,
    info: info,
    providerInfo: function () { return info; },
    models: MODELS,
    modelsFor: function () { return MODELS; },
    defaultModel: "bokskie.v1",
    topics: function () { return engine ? engine.topics() : []; },
    ready: ready,
    isReady: function () { return !!engine; },
    reply: reply,
    stream: stream,
    stats: stats,
    reset: function () { if (engine) engine.reset(); },
    _engine: function () { return engine; },
    /* Test hook: how long the typer would pause after this chunk. Exposed
       so the punctuation rule can be asserted directly, instead of through
       a wall-clock timing test that would be flaky on a loaded machine. */
    _pauseAfter: function (burst, key, step) { return pauseAfter(burst, key, step); },
    version: "2.0.0"
  };
});
