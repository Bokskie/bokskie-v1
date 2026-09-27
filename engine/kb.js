/* ============================================================
   bokskie-v1 · engine/kb.js
   ------------------------------------------------------------
   The knowledge base and its index.

   The scaling question: with 100k entries, scanning everything on
   every message is hopeless. So entries are indexed by token:

       "javascript" -> [entry 12, entry 88, entry 431, ...]

   A query only ever scores the entries it actually shares a word
   with. That turns a linear scan of 100k into a lookup over the
   few hundred that could plausibly match, and it is the single
   design decision that makes a large bank affordable.

   Files are plain JSON under data/, loaded by the host: node reads
   the disk, the browser fetches. No bundler either way.

   Entry shape:
     {
       "id":       "prog-javascript",
       "topic":    "programming",
       "intent":   "definition",
       "keywords": ["javascript", "js", "ecmascript"],
       "patterns": ["what is javascript"],
       "answer":   "JavaScript is ... {topic} ...",
       "variations": ["...", "..."],
       "weight":   1
     }
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./tokenizer.js"));
  else root.BokskieKB = factory(root.BokskieTokenizer);
})(typeof globalThis !== "undefined" ? globalThis : this, function (T) {
  "use strict";

  function KB() {
    this.entries = [];
    this.index = Object.create(null);   /* token -> [entryId] */
    this.df = Object.create(null);      /* token -> document frequency */
    this.topics = Object.create(null);  /* topic -> [entryId] */
    this.byIntent = Object.create(null);
    this.byId = Object.create(null);     /* id -> entry, built by build() */
    this.loaded = false;
  }

  /* ---- building ---------------------------------------------- */

  KB.prototype.add = function (raw) {
    if (!raw || !raw.answer) return null;

    var entry = {
      id: raw.id || ("e" + this.entries.length),
      topic: raw.topic || "general",
      intent: raw.intent || "definition",
      keywords: raw.keywords || [],
      patterns: raw.patterns || [],
      answer: raw.answer,
      variations: raw.variations || [],
      weight: typeof raw.weight === "number" ? raw.weight : 1,
      lang: raw.lang || "any",
      /* Per-language bodies. Optional, and the bank stays valid without
         it - `answer` is always present and is the fallback. The reason
         this exists: an entry written only in English, answered to a
         Tagalog question, is a small lie about what the system can do.
         When the translation is really there, use it; when it is not,
         fall back and let `answerLang` report the substitution. */
      langs: raw.langs || null,
      /* Provenance. Required to be meaningful, not merely present: a
         health claim with no source is a rumour with a search index.
         `confidence` below 1 makes the generator hedge rather than
         assert, so an uncertain entry degrades to a caveat instead of
         being presented as settled fact. */
      source: raw.source || null,
      confidence: typeof raw.confidence === "number" ? raw.confidence : 1,
      memory: raw.memory || null,
      /* Greeting wording, keyed by language, with a {name} slot. Lives
         in the bank rather than in the generator so all three languages
         are editable as data and the engine holds no English sentences.
         Without this line the templates were silently dropped on load
         and the greeting fell back to the generic entry - which is why
         adding the data alone appeared to do nothing. */
      greet: raw.greet || null,
      concept: raw.concept || null
    };

    /* Both sides of the index have to use the same normalisation or
       nothing matches. The query is stemmed by the tokenizer, so the
       entry text has to be stemmed too - otherwise "physic" in the
       question can never find "physics" in the answer, and every
       match depends on the keyword list happening to save us. */
    var haystack = T.words(entry.answer + " " + entry.keywords.join(" ") + " " + entry.patterns.join(" "));
    var uniq = Object.create(null);
    var i;
    for (i = 0; i < haystack.length; i++) {
      var s = T.stem(haystack[i]);
      if (s && s.length >= 2) uniq[s] = 1;
    }
    for (i = 0; i < entry.keywords.length; i++) {
      var raw_kw = String(entry.keywords[i]).toLowerCase();
      /* A phrase keyword like "ano ang tulog" cannot be matched as a
         token - no query token ever contains a space - so stemming it
         as one string only ever produced a junk index key that nothing
         could ever hit. The phrase is not lost: `haystack` above ran
         it through words(), so its individual words are already
         indexed, and it still matches whole as a `patterns` entry. */
      if (/[\s]/.test(raw_kw)) continue;
      var kw = T.stem(T.canonical(raw_kw));
      if (kw && kw.length >= 2) uniq[kw] = 1;
    }

    entry.tokens = Object.keys(uniq);
    entry.set = T.toSet(entry.tokens);
    entry.bigrams = T.bigrams(T.normalize(entry.answer));
    this.entries.push(entry);
    return entry;
  };

  /* Call once after all add(). Builds the inverted index and the
     document frequencies. Cost is O(total tokens), once. */
  KB.prototype.build = function () {
    this.index = Object.create(null);
    this.df = Object.create(null);
    this.topics = Object.create(null);
    this.byIntent = Object.create(null);
    this.byId = Object.create(null);
    var i, j, t;

    for (i = 0; i < this.entries.length; i++) {
      var e = this.entries[i];
      this.byId[e.id] = e;
      for (j = 0; j < e.tokens.length; j++) {
        t = e.tokens[j];
        (this.index[t] || (this.index[t] = [])).push(e.id);
        this.df[t] = (this.df[t] || 0) + 1;
      }
      (this.topics[e.topic] || (this.topics[e.topic] = [])).push(e.id);
      (this.byIntent[e.intent] || (this.byIntent[e.intent] = [])).push(e.id);
    }
    /* Register every "-" prefix as a family, so `topics` answers the
       question a caller actually has - "does the bank cover
       programming?" - instead of the bookkeeping one, "which exact
       shelf ids exist".

       Without this, engine.topics() listed 50 shelf names and no
       group name at all, so a caller checking for "programming" was
       told the bank had never heard of programming while it held 38
       programming entries. Ids are unaffected: an entry is filed once,
       under its own shelf, and these family rows are extra keys
       pointing at the same entries. */
    var names = Object.keys(this.topics);
    for (i = 0; i < names.length; i++) {
      t = names[i];
      var cut = t.indexOf("-");
      while (cut !== -1) {
        var head = t.slice(0, cut);
        if (!this.topics[head]) this.topics[head] = this.topics[t].slice();
        cut = t.indexOf("-", cut + 1);
      }
    }

    this.loaded = true;
    this.families = null;   /* topic name -> { topic: 1 }, built on demand */
    return this;
  };

  /* The set of topics a routed name covers: the name itself when it is
     a real topic, plus every shelf filed beneath it ("programming" ->
     "programming-javascript", "programming-debugging", ...). Cached,
     because the topic list only changes when the bank does. */
  KB.prototype.topicSet = function (name) {
    if (!name) return null;
    if (!this.families) {
      var f = Object.create(null);
      var self = this;
      Object.keys(this.topics).forEach(function (t) {
        if (!f[t]) f[t] = Object.create(null);
        f[t][t] = 1;
        /* Every "-" separated prefix is also a family, so the
           two-segment group "general-knowledge" covers
           "general-knowledge-history" the same way one segment does. */
        var cut = t.indexOf("-");
        while (cut !== -1) {
          var head = t.slice(0, cut);
          if (!f[head]) f[head] = Object.create(null);
          f[head][t] = 1;
          cut = t.indexOf("-", cut + 1);
        }
      });
      this.families = f;
    }
    return this.families[name] || null;
  };

  /* TF-IDF. Rare words carry more weight, which is what stops "the"
     and "what" from dragging an unrelated entry upward. */
  KB.prototype.vectorOf = function (entry) {
    if (entry.vector) return entry.vector;
    var N = this.entries.length || 1;
    var v = Object.create(null);
    for (var i = 0; i < entry.tokens.length; i++) {
      var t = entry.tokens[i];
      v[t] = Math.log(1 + N / (1 + (this.df[t] || 0)));
    }
    entry.vector = v;
    return v;
  };

  KB.prototype.queryVector = function (tokens) {
    var N = this.entries.length || 1;
    var counts = Object.create(null);
    for (var i = 0; i < tokens.length; i++) counts[tokens[i]] = (counts[tokens[i]] || 0) + 1;
    var v = Object.create(null);
    var t;

    /* A token that matches no entry at all is not evidence for choosing
       BETWEEN entries - it says something about none of them. Left
       uncapped it gets the highest IDF in the vector, because rare means
       rare, and it then dominates coverage. "bro ano ang sleep?" scored
       0.23 against the sleep entry while "ano ang sleep" scored 0.78,
       and the entire difference was one discourse particle the bank has
       no business containing.

       So an unmatched token is capped at the weight of the strongest
       token that did match. It still dilutes the score, which is what
       keeps a genuinely off-topic question honest, but it can no longer
       outvote a real match.

       The cap only applies when something DID match. A question where
       nothing matches is left completely alone, so "asdfghjkl qwerty"
       still refuses - there is no matched weight to cap against, and a
       refusal threshold that a stray word could switch off would not be
       a threshold. Everything else in this engine exists to refuse; a
       retrieval quirk that turns good questions into refusals is the
       same failure reached from the other direction. */
    var matched = 0;
    for (t in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, t)) continue;
      if (!this.df[t]) continue;
      var w = (1 + Math.log(counts[t])) * Math.log(1 + N / (1 + this.df[t]));
      v[t] = w;
      if (w > matched) matched = w;
    }
    for (t in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, t)) continue;
      if (this.df[t]) continue;
      var u = (1 + Math.log(counts[t])) * Math.log(1 + N);
      v[t] = (matched && u > matched) ? matched : u;
    }
    return v;
  };

  /* ---- candidate generation ---------------------------------- */

  /* This is the function that makes a big bank affordable. Only
     entries that share a token with the query are ever scored. */
  KB.prototype.candidates = function (tokens, limit) {
    var seen = Object.create(null);
    var counts = Object.create(null);
    var out = [];
    var i, j;

    for (i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var posting = this.index[t];
      if (posting) {
        for (j = 0; j < posting.length; j++) {
          counts[posting[j]] = (counts[posting[j]] || 0) + 1;
          seen[posting[j]] = 1;
        }
      }
      /* No exact hit: look one edit away, so "javascrip" still lands.
         Only for tokens long enough that one edit means something, and
         discounted, because a fuzzy hit is weaker evidence. */
      if (!posting && t.length >= 5) {
        for (var key in this.index) {
          if (!Object.prototype.hasOwnProperty.call(this.index, key)) continue;
          if (key === t || key.length < 4) continue;
          if (Math.abs(key.length - t.length) > 2) continue;
          if (!this._near(t, key)) continue;
          var p2 = this.index[key];
          for (j = 0; j < p2.length; j++) {
            counts[p2[j]] = (counts[p2[j]] || 0) + 0.6;
            seen[p2[j]] = 1;
          }
        }
      }
    }
    /* `seen` has a null prototype, so it has no hasOwnProperty to call
       and every key in it is an own key. */
    for (var id in seen) out.push({ id: id, overlap: counts[id] || 0 });
    out.sort(function (a, b) { return b.overlap - a.overlap; });
    return limit ? out.slice(0, limit) : out;
  };

  /* One-edit test rather than a full Levenshtein: this runs per
     unknown token, so it has to stay cheap. */
  KB.prototype._near = function (a, b) {
    var la = a.length, lb = b.length, i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++;
      else if (lb > la) j++;
      else { i++; j++; }
    }
    if (i < la || j < lb) edits++;
    return edits <= 1;
  };

  /* ---- scoring ------------------------------------------------ */

  function cosineOf(a, b) {
    var dot = 0, na = 0, nb = 0, k;
    for (k in a) { if (Object.prototype.hasOwnProperty.call(a, k)) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; } }
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) nb += b[k] * b[k];
    return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  }
  function jaccardOf(a, b) {
    var inter = 0, total = 0, k;
    for (k in a) { if (Object.prototype.hasOwnProperty.call(a, k)) { total++; if (b[k]) inter++; } }
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k) && !a[k]) total++;
    return total ? inter / total : 0;
  }
  function diceOf(aArr, bArr) {
    if (!aArr.length || !bArr.length) return 0;
    var m = Object.create(null), i, hits = 0;
    for (i = 0; i < aArr.length; i++) m[aArr[i]] = (m[aArr[i]] || 0) + 1;
    for (i = 0; i < bArr.length; i++) if (m[bArr[i]]) { hits++; m[bArr[i]]--; }
    return (2 * hits) / (aArr.length + bArr.length);
  }

  /* Cosine is the wrong tool for a short question against a long
     answer. It divides by the document norm, so a 2-word query
     matching an 80-word entry perfectly still scores around 0.17 -
     which is why "what is javascript" looked like a near-miss
     against the JavaScript entry.

     Coverage asks the question retrieval actually cares about: what
     fraction of the query does this entry account for? It ignores
     answer length entirely, so a one-word query fully covered by an
     entry scores 1.0, and a 50-word entry that shares nothing scores 0.
  */
  function coverageOf(qVector, eVector) {
    var need = 0, have = 0, k;
    for (k in qVector) {
      if (!Object.prototype.hasOwnProperty.call(qVector, k)) continue;
      need += qVector[k];
      if (eVector[k]) have += qVector[k];
    }
    return need ? have / need : 0;
  }

  /* The full search. Returns ranked hits carrying their own score, so
     the generator can decide whether the top one is good enough to
     answer with - or honest enough to refuse. */
  KB.prototype.search = function (opts) {
    opts = opts || {};
    var tokens = opts.tokens || [];
    if (!this.loaded) this.build();

    var pool = this.candidates(tokens, opts.candidateLimit || 60);

    /* A clear intent is a candidate source, but only when retrieval
       found nothing at all. "who are you" is three stopwords, so the
       token index has no candidates - yet we know it is an identity
       question, and the bank has exactly one entry for that.

       Seeding unconditionally is worse than not seeding at all: a
       generic "what is X" would drag in every definition entry and
       hand a greeting the top spot over a real keyword match. If the
       text itself found candidates, the text wins. */
    if (!pool.length && opts.intent && this.byIntent[opts.intent]) {
      var seed = this.byIntent[opts.intent];
      for (var s2 = 0; s2 < seed.length; s2++) {
        pool.push({ id: seed[s2], overlap: 0, viaIntent: true });
      }
    }
    if (!pool.length) return [];

    /* A routed topic is a FAMILY, not a single shelf.

       The router still knows the hand-tuned group names - programming,
       health, science - because those carry carefully chosen weights
       and native-language keys. But the bank files entries under the
       shelf tree, so an entry about fixing a bug has topic
       "programming-debugging", not "programming".

       The old exact test turned that into a silent, total failure. The
       router said "programming", `this.topics["programming"]` did not
       exist, so `restrict` became null, and then NOTHING equalled
       null - every single entry, including the right one, was
       multiplied by 0.55. "how do i fix a javascript bug" found the
       bug entry as the top hit and then refused to answer it, because
       0.291 sat below the accept bar where 0.53 used to.

       So a name that is not itself a topic still counts as a match
       for every shelf beneath it. "programming" covers
       programming-javascript and programming-debugging; "health"
       covers health-symptoms. The router keeps its hand-tuned weights
       and the bank keeps its fine-grained filing, which is the point
       of the tree. */
    var restrict = this.topicSet(opts.topic);
    var qv = this.queryVector(tokens);
    var qb = T.bigrams(T.normalize(opts.text || ""));
    var qs = T.toSet(tokens);
    var norm = T.normalize(opts.text || "");
    /* Built once in build(). This used to be rebuilt here, from
       scratch, on every single query - 90,000 entry objects allocated
       and assigned per keystroke, for a map that never changes until
       the bank does. The lookup it replaced was a genuine bottleneck
       the moment the bank grew past a few hundred entries. */
    var byId = this.byId;
    var i;

    var results = [];
    for (i = 0; i < pool.length; i++) {
      var e = byId[pool[i].id];
      if (!e) continue;
      var ev = this.vectorOf(e);

      /* Topic is a preference, not a wall. A routing error should
         degrade the score, not wipe the entry out. */
      var topicFactor = (restrict && restrict[e.topic]) ? 1 : 0.55;
      var intentFactor = (opts.intent && opts.intent === e.intent) ? 1.12 : 1;

      var score = (coverageOf(qv, ev)      * 0.50
                + cosineOf(qv, ev)          * 0.25
                + jaccardOf(qs, e.set)     * 0.10
                + diceOf(qb, e.bigrams)     * 0.15)
                * topicFactor * intentFactor * e.weight;

      /* Seeded by intent with no shared words at all: the score is
         almost zero, which is honest, but the intent itself is real
         evidence. Lift it to a level that can be accepted. */
      if (pool[i].viaIntent) score = Math.max(score, 0.55);

      /* A literal pattern match is far stronger evidence than shared
         vocabulary: "what is javascript" over "tell me about the
         language browsers run". */
      for (var p = 0; p < e.patterns.length; p++) {
        if (norm.indexOf(T.normalize(e.patterns[p])) !== -1) { score *= 1.30; break; }
      }

      results.push({ entry: e, id: e.id, topic: e.topic, score: score });
    }
    results.sort(function (a, b) { return b.score - a.score; });
    return results;
  };

  /* An unbuilt KB has no index yet, so anything that reads it has to
     make sure it exists. Cheap and idempotent. */
  KB.prototype.ensure = function () {
    if (!this.loaded) this.build();
    return this;
  };

  /* The entry that defines a behaviour rather than a fact.

     Memory-reference wording lives in the bank, not in the engine, so
     the three languages can be edited as data instead of being
     hardcoded in two places that then drift. `byIntent` returns ids in
     insertion order, so the first one wins deterministically - but a
     second entry claiming the same intent is a data bug, and
     verify-memory.js asserts there is exactly one. */
  KB.prototype.defines = function (intent) {
    this.ensure();
    var ids = this.byIntent[intent];
    if (!ids || !ids.length) return null;
    return this.byId[ids[0]] || null;
  };

  KB.prototype.stats = function () {
    this.ensure();
    return {
      entries: this.entries.length,
      tokens: Object.keys(this.index).length,
      topics: Object.keys(this.topics).length
    };
  };

  return { KB: KB };
});
