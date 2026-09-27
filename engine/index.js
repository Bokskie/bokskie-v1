/* ============================================================
   bokskie-v1 · engine/index.js
   ------------------------------------------------------------
   The public API. One call, one answer:

       var engine = await BokskieEngine.load();
       engine.reply("what is javascript");

   The pipeline it runs, in order:

       1. normalize + tokenize
       2. detect language, intent and topic
       3. fold in conversation memory for follow-ups
       4. retrieve from the inverted index
       5. generate - or refuse, if nothing cleared the bar
       6. write the turn back into memory

   Loading differs by host and nothing else: node reads data/*.json
   off disk, the browser fetches them. Same engine, same answers.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./tokenizer.js"), require("./similarity.js"),
                           require("./intent.js"), require("./context.js"),
                           require("./kb.js"), require("./generator.js"),
                           require("./mood.js"));
  } else {
    root.BokskieEngine = factory(root.BokskieTokenizer, root.BokskieSimilarity,
                                root.BokskieIntent, root.BokskieContext,
                                root.BokskieKB, root.BokskieGenerator,
                                root.BokskieMood);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (T, SIM, I, C, K, G, M) {
  "use strict";

  /* LEGACY FALLBACK - the shelf tree has outgrown it. Left in place
     rather than deleted because the two real load paths do not need
     it: the browser uses the generated bundle (which lists the shelf
     declarations itself), and node reads the data/ directory and
     picks up whatever is in it. This list is only reached by a
     browser that loaded neither.

     It is now wrong, and wrong in a quiet way: these names were the
     old flat topics, so every fetch 404s, the failures are swallowed
     into empty documents, and the page shows a working bot with an
     empty bank. Paths are relative to data/ and follow the tree, so
     "cebuano/basic-words" not "cebuano-basic-words". Regenerate it
     from tools/shelves.js, or load data/bundle.js, rather than
     trusting it. */
  var DATA_FILES = [
    "conversation"
  ];

  /* Flatten entries into a surface -> concept map.

     This reads tl/bis off EVERY entry rather than from a separate
     vocabulary file, and that is deliberate. A separate lexicon file
     means every concept exists twice - once as a knowledge entry and
     once as a vocabulary row - and the two copies drift, the duplicate
     competes with the original for the same query, and the integrity
     gate reports the collision every single build. One source of truth
     per concept is the only version that survives contact with a large
     bank.

     A vocabulary file is still accepted, for rows that are a word with
     no article attached to them. It is additive, never the main path. */
  function conceptOf(e) {
    return e.concept || (e.keywords && e.keywords[0]) || null;
  }

  function lexiconMap(entries) {
    var map = Object.create(null);
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e) continue;
      var concept = conceptOf(e);
      if (!concept || /\s/.test(concept)) continue;   /* a token never has a space */
      var surfaces = [];
      if (e.en) surfaces.push(e.en);
      if (e.syn) for (var s = 0; s < e.syn.length; s++) surfaces.push(e.syn[s]);
      if (e.tl) surfaces.push(e.tl);
      if (e.bis) surfaces.push(e.bis);
      for (var k = 0; k < surfaces.length; k++) {
        var w = T.normalize(String(surfaces[k]));
        /* Skip identity. A word that already IS the concept needs no
           bridge, and adding one would only make the map look fuller
           than the coverage it actually provides. */
        if (!w || w === concept) continue;
        /* First writer wins, deterministically. Two concepts claiming
           one surface is a data bug; picking the first keeps the result
           stable instead of dependent on file iteration order. */
        if (!map[w]) map[w] = concept;
      }
    }
    return map;
  }

  function Engine(opts) {
    opts = opts || {};
    this.kb = new K.KB();
    this.gen = new G.Generator(opts);
    this.ctx = new C.Context(opts);
    this.basePath = opts.basePath || "bokskie-v1/data/";
    this.loaded = false;
    this.files = [];
    this.lexiconCount = 0;
  }

  /* ---- loading ------------------------------------------------ */

  /* Browser loading, in order of preference:
       1. window.BokskieData - the generated <script>-tag bundle. Works
          from file://, where fetch() of a local JSON file is blocked.
       2. fetch() of data/*.json - fine over http, and keeps the JSON
          files authoritative at runtime.
     A file that fails in one path is still tried in the other, and
     only the ones that fail everywhere are reported. */
  function fromGlobal(engine) {
    var g = (typeof globalThis !== "undefined" && globalThis.BokskieData) ||
            (typeof root !== "undefined" && root.BokskieData);
    return g && g.entries && g.entries.length ? g : null;
  }

  /* Add a whole bank, in the one order that works.

     The lexicon MUST be registered before the first entry is added, and
     this is the only place that ordering is decided. kb.add() stems and
     canonicalises every keyword as it indexes it; the query side is
     canonicalised by the tokenizer at tokenize() time. Register the
     lexicon after the fact and the two sides get normalised differently
     - a Tagalog keyword indexed under its own surface, the same word in
     a question folded onto the English concept - and then the two
     languages can never meet, no matter how many entries exist.

     Cheap to get wrong and invisible in testing: the bank still answers
     English questions perfectly, and only the non-English ones fail. */
  function addEntries(engine, entries, lexicon) {
    /* The vocabulary file, if there is one, goes in as well. It is
       additive: a row that is a bare word with no article attached. */
    var extra = lexicon || [];
    for (var x = 0; x < extra.length; x++) entries.push(extra[x]);
    engine.lexiconCount = T.registerLexicon(lexiconMap(entries));
    for (var j = 0; j < entries.length; j++) engine.kb.add(entries[j]);
    return engine;
  }

  /* Register the shelf declarations that shipped with the bank.

     Done at load rather than compiled in, because the bank is data and
     the router must follow it: adding a shelf to tools/shelves.js
     should make that shelf routable without anyone editing the engine.
     Idempotent - a topic that already exists is left alone, so a
     hand-tuned weight on a built-in topic is never overwritten. */
  function registerShelves(engine, list) {
    if (engine._shelvesRegistered) return 0;
    engine._shelvesRegistered = true;
    return I.registerShelves(list || []);
  }

  /* Kept as a method too: anything that builds a bank by hand (the
     tests do) reaches for engine.addEntries, and losing it there is a
     confusing "not a function" rather than an obvious omission. */
  Engine.prototype.addEntries = function (entries, lexicon) {
    return addEntries(this, entries, lexicon);
  };

  /* Attach the bank to an engine. Every load path funnels through here
     so that the shelf declarations are registered exactly once, before
     any query runs - a router that does not know a shelf yet will
     silently file that shelf's questions under something else. */
  function attach(engine, entries, lexicon, shelves) {
    addEntries(engine, entries, lexicon);
    engine.shelfCount = registerShelves(engine, shelves);
    return engine;
  }

  function loadAsync(engine) {
    var g = fromGlobal(engine);
    if (g) {
      attach(engine, g.entries, g.lexicon, g.shelves);
      engine.files = ["bundle.js"];
      engine.kb.build();
      engine.loaded = true;
      return Promise.resolve(engine);
    }

    var names = engine.files && engine.files.length ? engine.files : DATA_FILES;
    var jobs = names.map(function (name) {
      return fetch(engine.basePath + name + ".json")
        .then(function (r) {
          if (!r.ok) throw new Error(name + ".json -> HTTP " + r.status);
          return r.json();
        })
        .catch(function (e) {
          if (typeof console !== "undefined") console.warn("[bokskie] skipped " + name + ": " + e.message);
          return { entries: [] };
        });
    });
    return Promise.all(jobs).then(function (docs) {
      var all = [], lex = [];
      for (var i = 0; i < docs.length; i++) {
        var list = docs[i].entries || [];
        if (docs[i].topic === "lexicon") lex = lex.concat(list);
        for (var j = 0; j < list.length; j++) all.push(list[j]);
      }
      /* The JSON fallback has no bundle, so the declarations come from
         the registry directly. require() is safe here: this branch only
         runs under node, and the browser always takes the bundle. */
      var reg = null;
      try { reg = require("../tools/shelves.js").shelves; } catch (e) { /* no registry */ }
      attach(engine, all, lex, reg);
      engine.loaded = true;
      return engine;
    });
  }

  /* Node prefers the bundle when it is present so that tests exercise
     the exact bytes the browser gets, then falls back to the JSON on
     disk. Either path must produce the same bank, and the test suite
     checks that they do. */
  function loadSync(engine) {
    var bundle = null;
    try { bundle = require("../data/bundle.js"); } catch (e) { /* not built yet */ }

    if (bundle && bundle.entries && bundle.entries.length) {
      attach(engine, bundle.entries, bundle.lexicon, bundle.shelves);
      engine.files = ["bundle.js"];
    } else {
      var fs = require("fs");
      var path = require("path");
      var dir = path.join(__dirname, "..", "data");
      /* Recursive, because the bank is a tree on disk: data/<group>/
         <sub>.json. A flat readdir here found only the hand-written
         documents sitting at the top of data/ and loaded a bank with
         almost nothing in it - no error, just an assistant that
         suddenly could not answer anything. */
      var files = (function walk(d, prefix, acc) {
        fs.readdirSync(d).sort().forEach(function (name) {
          var full = path.join(d, name);
          if (fs.statSync(full).isDirectory()) {
            walk(full, prefix ? prefix + "/" + name : name, acc);
            return;
          }
          if (/\.json$/.test(name)) acc.push(prefix ? prefix + "/" + name : name);
        });
        return acc;
      })(dir, "", []);
      engine.files = files;
      var all = [], lex = [];
      for (var f = 0; f < files.length; f++) {
        var raw = JSON.parse(fs.readFileSync(path.join(dir, files[f]), "utf8"));
        var list = raw.entries || [];
        if (raw.topic === "lexicon") lex = lex.concat(list);
        for (var j = 0; j < list.length; j++) all.push(list[j]);
      }
      engine.addEntries(all, lex);
    }
    engine.kb.build();   /* index once, here, not lazily per query */
    engine.loaded = true;
    return engine;
  }

  Engine.load = function (opts) {
    var e = new Engine(opts);
    if (typeof module === "object" && module.exports) return Promise.resolve(loadSync(e));
    return loadAsync(e);
  };

  /* ---- the answer --------------------------------------------- */

  /* opts: { seed, lang, useContext, explain } */
  Engine.prototype.reply = function (text, opts) {
    opts = opts || {};
    if (!this.loaded) this.kb.build();

    var useCtx = opts.useContext !== false;
    var raw = String(text == null ? "" : text);

    /* 1-2. understand */
    var tok = T.tokenize(raw);
    var analysis = I.analyse(raw, tok.tokens);
    var lang = opts.lang || analysis.language;

    /* 1c. the person, not the question.

       Two things are learned here and both are things they chose to
       say, never things the app asked for: their name, and the tone
       they are writing in. `learnName` returns the existing name when
       the message does not introduce one, so a later "i am a developer"
       cannot overwrite it - the NOT_A_NAME guard catches the obvious
       case and "first one wins" catches the rest. */
    var learnedName = useCtx ? this.ctx.learnName(raw) : null;
    var justLearned = learnedName && !opts._knownName;
    var moodRead = M.detect(raw);
    var mood = moodRead.mood === "neutral" ? null : moodRead.mood;

    /* 1d. greeting uses the name, when there is one.

       Handled before search because a greeting is not a retrieval
       question: "hi" shares almost no vocabulary with anything, so
       retrieval would pick whichever entry happens to drift nearest.
       The bank supplies the wording, the context supplies the name. */
    if (analysis.intent === "greeting" && useCtx) {
      var def = this.kb.defines("greeting");
      if (def && def.greet) {
        return this.greetingReply(raw, def, lang, useCtx, opts, moodRead, justLearned);
      }
    }

    /* 2b. memory reference, handled before any search happens.

       "Do you remember our last topic about sleep?" must never reach
       the knowledge bank. Its content words - "remember", "last",
       "topic" - appear in no entry, so retrieval would score every
       candidate near zero, sort them by noise, and hand back whichever
       shelf happened to drift highest. The engine would then answer
       that question by confidently describing some unrelated subject,
       which is the exact failure this project exists to prevent.

       The answer is already here, in the transcript. So this path reads
       memory and touches the bank only for the wording, which lives in
       data/conversation.json as a `memory` block - three languages of
       it - so the sentences can be edited without touching code. */
    if (analysis.intent === "memory_reference") {
      return this.memoryReply(raw, lang, useCtx, opts);
    }

    /* 3. memory: only a genuine follow-up inherits the last topic.
       Requiring isFollowUp() rather than "no topic found" is the
       whole point - a bare "kumusta ka" has no topic of its own, and
       treating that as a follow-up dragged the previous question's
       subject into it, so a greeting after a history question got
       answered with the history entry. An unrelated question is not a
       follow-up just because it is silent about its topic. */
    var searchTokens = tok.tokens.slice();
    var searchTopic = analysis.topic;
    /* The follow-up test runs on the raw words, not the filtered
       tokens. "tell me more" is three stopwords, so after filtering
       there is nothing left to test and it stopped being recognised
       as a follow-up at all. A follow-up is made of filler words by
       definition - that is the whole problem it solves. */
    var followUp = useCtx && this.ctx.turns.length > 0 && this.ctx.isFollowUp(tok.all);
    if (followUp) {
      var carried = this.ctx.contextTokens();
      for (var i = 0; i < carried.length; i++) {
        if (searchTokens.indexOf(carried[i]) === -1) searchTokens.push(carried[i]);
      }
      if (!searchTopic) searchTopic = this.ctx.topic;
    }

    /* 4. retrieve */
    var results = this.kb.search({
      text: raw,
      tokens: searchTokens,
      topic: searchTopic,
      intent: analysis.intent
    });

    /* 5. generate, or refuse */
    var out = this.gen.generate({
      results: results,
      analysis: analysis,
      language: lang,
      followUp: followUp,
      context: useCtx ? this.ctx : null,
      /* null unless a mood cleared the bar, so an ordinary question is
         never decorated with an opening line it did not need. */
      mood: mood,
      seed: opts.seed
    });

    /* Report the language of the text we are actually returning, not
       the language of the request. They differ: refusals are written in
       all three languages, but the knowledge bank is English, so a
       Bisaya question still gets an English answer. Claiming "bisaya"
       over an English paragraph would be a small lie in the metadata
       that anything downstream would reasonably trust. */
    out.lang = out.answerLang || "english";
    out.requestLang = lang;
    /* Exposed so an app can show or act on the read without parsing the
       text. Null when nothing cleared the detection bar, which is the
       common case and is deliberately not a guess. */
    out.mood = mood;
    out.moodConfidence = moodRead.confidence;
    out.userName = useCtx ? this.ctx.nameOf() : null;

    /* 6. remember */
    if (useCtx) {
      this.ctx.push({
        user: raw, reply: out.text, topic: out.topic,
        intent: out.intent,
        /* The subject and the entry that answered. Storing the shelf
           alone is not enough to answer "our last topic" later: the user
           remembers the thing, not the category it was filed under. */
        subject: this.subjectOf(results),
        entryId: out.entryId || null,
        language: lang,
        entities: this.extractEntities(results),
        unknown: !out.known
      });
      this.ctx.rememberSaid(out.text);
    }

    if (opts.explain) {
      out.debug = {
        tokens: tok.tokens,
        language: analysis.language,
        intent: analysis.intent,
        topic: analysis.topic,
        topicRank: analysis.topicRank.slice(0, 3),
        candidates: this.kb.candidates(searchTokens, 5).length,
        topScore: results.length ? results[0].score : 0,
        hits: results.slice(0, 3).map(function (r) { return r.id + " " + r.score.toFixed(3); })
      };
    }
    return out;
  };

  /* ---- memory reference --------------------------------------- */

  /* "Do you remember our last topic?"

     The one question the knowledge bank cannot answer, because the
     knowledge bank is not where the answer is. It is in the transcript,
     so this reads memory and uses the bank only for phrasing.

     Two details that are easy to get wrong and expensive when they are:

     1. The snapshot is taken BEFORE the turn is recorded. Once this
        turn is pushed it becomes the most recent turn with a topic, and
        "our last topic" would start answering with the question rather
        than the subject - which turns a correct answer into a wrong one
        on the very next repeat.

     2. The recorded topic is the RECALLED one, not this question's.
        This message's own detected topic is "conversation", and storing
        that would overwrite the real subject. The damage is delayed and
        hard to trace: the next genuine follow-up would inherit
        "conversation" as its subject and drag the shelf holding these
        very sentences into an unrelated question. */
  Engine.prototype.memoryReply = function (raw, lang, useCtx, opts) {
    opts = opts || {};
    var rec = useCtx ? this.ctx.recalled() : null;
    /* Taken first, deliberately. See note 1 above. */
    var snapshot = this.ctx.recallSnapshot();

    var def = this.kb.defines("memory_reference");
    var out = this.gen.memory({
      recalled: rec,
      templates: (def && def.memory) || {},
      entryId: def ? def.id : null,
      language: lang,
      seed: opts.seed
    });

    out.lang = out.answerLang || lang;
    out.requestLang = lang;
    out.recall = snapshot;

    if (useCtx) {
      this.ctx.push({
        user: raw,
        reply: out.text,
        topic: rec ? rec.topic : null,
        intent: "memory_reference",
        subject: rec ? rec.subject : null,
        entryId: rec ? rec.entryId : null,
        entities: rec && rec.subject ? [rec.subject] : [],
        language: lang,
        unknown: false
      });
      this.ctx.rememberSaid(out.text);
    }

    if (opts.explain) {
      out.debug = {
        intent: "memory_reference",
        bypassedSearch: true,
        hadHistory: !!rec,
        recalledTopic: rec ? rec.topic : null,
        recalledSubject: rec ? rec.subject : null,
        templatesFrom: def ? def.id : null
      };
    }
    return out;
  };

  /* ---- greeting ---------------------------------------------- */

  /* "hi" is not a retrieval question. It shares almost no vocabulary
     with anything in the bank, so searching for it returns whatever
     entry drifts nearest, which is how a greeting can produce a
     paragraph about encryption. The wording comes from the bank and
     the name from the context, and neither is inferred.

     When no name is known the slot is removed rather than filled with
     "there" - a greeting that says "Hello, there" to someone who never
     gave a name reads as a bug, and so does a dangling comma. */
  Engine.prototype.greetingReply = function (raw, def, lang, useCtx, opts, moodRead, justLearned) {
    var name = useCtx ? this.ctx.nameOf() : null;
    var lines = (def.greet && (def.greet[lang] || def.greet.english)) || [];

    /* Rotate through the greeting lines rather than seeding a pick, so
       a fixed seed still varies. See generator.greet for why the seed
       alone was not enough. */
    var text = this.gen.greet({
      name: name,
      lines: lines,
      seed: opts.seed,
      nudge: useCtx ? this.ctx.greetCount : 0
    });

    /* A mood on the greeting itself - "hi :(" - is worth answering,
       and it is the one place where the opener replaces nothing,
       because there is no answer to lose. */
    var lead = this.gen.empathise({ mood: moodRead.mood, language: lang, seed: opts.seed });
    if (lead) text = lead + " " + text;

    if (useCtx) {
      this.ctx.greetCount++;
      this.ctx.push({
        user: raw, reply: text, topic: "conversation", intent: "greeting",
        subject: name || "greeting", language: lang, entities: [], unknown: false
      });
      this.ctx.rememberSaid(text);
    }

    return {
      text: text,
      entryId: def.id,
      concept: def.concept || "greeting",
      confidence: 1,
      known: true,
      weak: false,
      topic: "conversation",
      intent: "greeting",
      answerLang: lang,
      requestLang: lang,
      /* What the app can show or act on, without re-parsing the text. */
      userName: name,
      justLearnedName: justLearned ? name : null,
      mood: moodRead.mood,
      moodConfidence: moodRead.confidence,
      hint: null
    };
  };

  /* What the engine currently remembers, as plain data.

     This is the read-only view - the same object shape the design calls
     for, and it never invents a topic. `previous_topic` is null when
     nothing substantive has been discussed, which is the answer, not a
     failure to find one. */
  Engine.prototype.recall = function () {
    return this.ctx.recallSnapshot();
  };

  /* What the last answer was actually about.

     `concept` when the entry declares one, because that is the curated
     name for the subject; otherwise the entry's first keyword. Never the
     shelf: "health" is where the entry was filed, not what it says, and
     telling someone their last topic was "health" when they were asking
     about sleep is technically accurate and practically useless. */
  Engine.prototype.subjectOf = function (results) {
    if (!results.length || !results[0].entry) return null;
    var e = results[0].entry;
    if (e.concept) return e.concept;
    return (e.keywords && e.keywords.length) ? e.keywords[0] : null;
  };

  /* The entry's own keywords are a better guess at the subject than
     grabbing any noun out of the sentence. */
  Engine.prototype.extractEntities = function (results) {
    var out = [];
    if (results.length && results[0].entry) {
      var e = results[0].entry;
      for (var i = 0; i < e.keywords.length && out.length < 3; i++) {
        if (/[\s]/.test(String(e.keywords[i]))) continue;
        out.push(T.stem(String(e.keywords[i]).toLowerCase()));
      }
    }
    return out;
  };

  Engine.prototype.reset = function () { this.ctx.reset(); return this; };
  Engine.prototype.stats = function () {
    var s = this.kb.stats();
    s.files = this.files.length;
    /* Surface forms attached, not concepts. This is the number that says
       "how many words does it understand", which is the question people
       actually ask about a multilingual bank. */
    s.lexicon = this.lexiconCount;
    return s;
  };
  Engine.prototype.topics = function () { return Object.keys(this.kb.topics); };

  return { Engine: Engine, DATA_FILES: DATA_FILES, MOOD: M };
});
