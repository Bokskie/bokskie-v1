/* ============================================================
   bokskie-v1 · engine/generator.js
   ------------------------------------------------------------
   Turns a ranked hit into an answer, or refuses to.

   The refusal is the important part. Search always returns
   *something* - the highest scoring entry, however bad. Answer
   with whatever came back and the system confidently explains
   quantum mechanics when you asked about a bicycle, because
   "about" and "is" scored well enough. That is the exact failure
   this whole project exists to stop.

   So the top hit must clear a bar. Under the bar we say we do not
   know, and we say what we did understand. An honest miss is
   recoverable; a confident invention is not.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./tokenizer.js"));
  else root.BokskieGenerator = factory(root.BokskieTokenizer);
})(typeof globalThis !== "undefined" ? globalThis : this, function (T) {
  "use strict";

  /* Tuned against the shipped bank. Low enough that a real question
     clears it, high enough that a coin-flip match does not. The
     margin matters more than the exact number. */
  var ACCEPT = 0.34;
  var WEAK = 0.24;

  /* The honest-failure lines, in all three languages. These are the
     most load-bearing strings in the whole project. */
  var SLOTS = {
    english: {
      unknown: [
        "I do not have anything about that in my knowledge bank, and I would rather say so than guess. I answer only from things written down in advance - I cannot look anything up, and I do not know what is in the room.",
        "That is outside what I actually know. My bank is hand-written and finite, so I miss plenty. Tell me the topic and I will give you what I do have."
      ],
      weak: [
        "I am not certain this is the right entry. My best match is below - treat it as a rough guess, not a fact.",
        "This is the closest thing I have, and I am not confident. Read it as a hint rather than an answer."
      ],
      uncertain: [
        "This one is not firmly established, so I will not state it as settled:",
        "I have this marked as unsettled evidence rather than fact. Here it is, with that caveat:"
      ],
      /* Mood-matched openers, keyed by detected mood. Short, and never
         a substitute for the answer - these sit in front of it. */
      mood: {
        sad: ["That sounds heavy.", "I'm sorry it feels like that.", "That sounds like a rough day."],
        angry: ["That sounds frustrating.", "Fair enough to be annoyed.", "Okay, let's find the actual cause."],
        anxious: ["That sounds worrying.", "It's reasonable to be unsure here.", "Let's take it one piece at a time."],
        tired: ["You sound worn down.", "Sounds like you need a breather.", "That's a long one."],
        grateful: ["Glad that helped.", "Happy to be useful.", "Anytime."],
        excited: ["Good energy.", "Love that.", "Let's build on that."],
        happy: ["Glad to hear it.", "That's good.", "Nice."],
        confused: ["That's a fair place to be stuck.", "Let's untangle it.", "Confusing things usually mean one of two things is wrong."]
      },
      followUp: "Going with what we were just talking about ({topic}).",
      topics: "programming, science, mathematics, geography, history, health, money, technology"
    },
    tagalog: {
      unknown: [
        "Wala akong alam tungkol dito, at mas tayo magsasabi kaysa maghaka-haka. Sinasagot ko lamang ang naunang isinulat ko - hindi ko mababasa, at hindi ko alam kung ano ang nasa silid.",
        "Hindi iyon ang saklaw ng aking kaalaman. Hand-written at limitado ang aking bank, kaya maraming nawawala. Sabihin mo lang ang topic."
      ],
      weak: [
        "Hindi ako sigurado na tama ito. Pinakamalapit lang ito, pero pagtataya lamang - hindi katotohanan.",
        "Ito ang laban sa akin, ngunit hindi lubos ang katiyakan. Pahiwat ito, hindi sagot."
      ],
      uncertain: [
        "Hindi ito ganap na matatag na impormasyon, kaya hindi ko ito sasabihin na tapos na:",
        "May tandang hindi ito ganap na nakatatatag. Narito, kasama ang pagbabala:"
      ],
      mood: {
        sad: ["Mabigat ang tingyan mo.", "Pasensya na kung ganyan ang pakiramdam mo.", "Mabigat ang araw mo."],
        angry: ["Naiintindihan ko ang pagkangalit.", "Tama ka ng magalit.", "Suyin natin tunay ang sanhi."],
        anxious: ["Nababahala ka, nauunawa ako.", "Makatuwiran ang pag-alala.", "Isa-isa natin itong lakad."],
        tired: ["Akin lamang ikaw na pagod na.", "Mukhang kailangan mo ng pahinga.", "Mababa na ang iyong bati."],
        grateful: ["Masaya akong nakatulong.", "Kahit kailan mo.", "Walang problema."],
        excited: ["Maganda ang energy mo.", "Ayoko nito, maganda.", "Tayo na ito."],
        happy: ["Masaya ako sa balita.", "Mabuti iyan.", "Ayos."],
        confused: ["Makatuwiran na malito ka.", "Ayusin natin ito.", "Kung malito, kadalasan ay may isang mali."]
      },
      followUp: "Batay ito sa pinag-usapan natin ({topic}).",
      topics: "programming, science, mathematics, geography, history, health, money, technology"
    },
    bisaya: {
      unknown: [
        "Wala ako og kabalo nga niini, ug mas maayo nga mato ako kaysa maghatol. Sila ra nga kabalo nako ang mga naa nako sa sinulat nako - dili nako mabasa, ug dili nako kabalo unsa anha.",
        "Lapis nga dili iyon ang nakaabot nako. Hand-written ug limitado ang akong bank, kay daghan nga dili nako nakat-ani. Isulat lang nga unsang topic."
      ],
      weak: [
        "Dili ako konfident nga husto ni. Pinakaduha ra nga ako, apan pagtataya lamang - dili kamatuodan.",
        "Kani na gyud ang labaw nga ako niana, apan dili pa gyud ako kasiguran. Pahiwat ni, dili tubag."
      ],
      uncertain: [
        "Dili gyud nga ma-solid ang kini, kaya dili ko siya iyangon nga tapos na:",
        "Naa kay nga dili pa gyud nakat-stand nga impormasyon niini. Ania ra, kauban ang pasabot:"
      ],
      mood: {
        sad: ["Heavy nga gib feel nimo.", "Sorry kaayo nga maa feeling nimo kana.", "Heavy nga adlaw nimo."],
        angry: ["Naa gyud nga sayop ka.", "Tama ka nga magdugtot.", "Atong hunahunanon sa unsang hinuon nga gigima."],
        anxious: ["Kahadlok nga feel nimo, naa gyud nga makatuwiron.", "Makatuwiron nga basi ka.", "Isa-isa nato nga lakad."],
        tired: ["Naghih exhaustion nimo na.", "Mukhang naa ka gyud nga kahangian.", "Long na siya nimo."],
        grateful: ["Nalipay ka nga makatabang.", "Andam nako anytime.", "Walay problema."],
        excited: ["Good nga energy nimo.", "Naa na gyud ako niana.", "Kini nato."],
        happy: ["Nalipay ako sa balita.", "Maayo nga naa.", "Ayos."],
        confused: ["Makatuwiron gyud nga ma-confused ka.", "I disentangle nato niini.", "Kung ma-confused, kasagaran naa kay sayop usa."]
      },
      followUp: "Nakabaser ni sa atong gi-chat kaniadto ({topic}).",
      topics: "programming, science, mathematics, geography, history, health, money, technology"
    }
  };

  function Generator(opts) {
    opts = opts || {};
    this.accept = typeof opts.accept === "number" ? opts.accept : ACCEPT;
    this.weak = typeof opts.weak === "number" ? opts.weak : WEAK;
  }

  /* Seeded, so a session can be reproduced from a seed. */
  function seeded(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  Generator.prototype.pick = function (arr, rnd, avoid) {
    if (!arr || !arr.length) return "";
    var start = Math.floor(rnd() * arr.length) % arr.length;
    for (var i = 0; i < arr.length; i++) {
      var at = (start + i) % arr.length;
      if (!avoid || !avoid[arr[at]]) return arr[at];
    }
    return arr[start];
  };

  /* Slots let one written answer serve many questions: {topic} is the
     shelf it came off, {entity} the word the user actually typed. */
  function fill(text, vars) {
    return String(text || "").replace(/\{(\w+)\}/g, function (whole, name) {
      return vars[name] ? vars[name] : whole;
    });
  }

  function bank(lang) { return SLOTS[lang] || SLOTS.english; }

  /* ---- the main path ------------------------------------------ */

  /* Returns { text, entryId, confidence, known, weak, topic, intent }.
     "known: false" is a first-class outcome, not an error. */
  Generator.prototype.generate = function (opts) {
    opts = opts || {};
    var B = bank(opts.language || "english");
    var results = opts.results || [];
    var analysis = opts.analysis || {};
    var ctx = opts.context || null;
    var rnd = seeded(opts.seed || 1);

    var avoid = Object.create(null);
    var i;
    if (ctx) for (i = 0; i < ctx.said.length; i++) avoid[ctx.said[i]] = 1;

    /* Take the best hit that clears the bar, not merely the best
       hit. A slightly weaker entry in the right topic beats a
       stronger one from the wrong shelf. */
    var best = null;
    for (i = 0; i < results.length && i < 6; i++) {
      if (results[i].score >= this.accept) { best = results[i]; break; }
    }

    if (!best) {
      var line = this.pick(B.unknown, rnd, avoid);
      /* Only a real follow-up gets the "we were talking about X"
         lead-in. Putting it on an unrelated question reads as if the
         engine had understood it, which is exactly the impression
         this whole design is trying to avoid. */
      if (opts.followUp && ctx && ctx.topic) {
        line = fill(B.followUp, { topic: ctx.topic }) + " " + line;
      }
      return {
        text: line,
        entryId: null,
        concept: null,
        confidence: results.length ? results[0].score : 0,
        known: false,
        weak: false,
        topic: analysis.topic || null,
        intent: analysis.intent || null,
        hint: B.topics
      };
    }

    var entry = best.entry;
    var lang = opts.language || "english";
    var pool = this.poolFor(entry, lang);
    var chosen = this.pick(pool, rnd, avoid);

    var body = fill(chosen, {
      topic: entry.topic,
      intent: analysis.intent || entry.intent,
      entity: (ctx && ctx.entities.length ? ctx.entities[ctx.entities.length - 1] : "")
              || entry.keywords[0] || entry.topic
    });

    /* Mood first, answer second - and only when a mood was actually
       detected. `opts.mood` is null unless mood.js cleared its bar, so
       an ordinary question is never decorated. */
    var lead = this.empathise({ mood: opts.mood, language: opts.language, seed: opts.seed });
    if (lead) body = lead + "\n\n" + body;

    /* Caveat and answer arrive together, not as two separate claims. */
    var isWeak = best.score < this.weak;
    if (isWeak) body = this.pick(B.weak, rnd, avoid) + "\n\n" + body;

    /* A second, different reason to hedge: the entry itself is marked
       less than certain. Retrieval confidence and author confidence are
       different axes, and a perfect keyword match against a shaky entry
       is still a shaky answer - so it gets the same treatment. This is
       what lets a health claim be marked "not fully established" in
       the data and have that reach the user, instead of the metadata
       being decoration nobody reads. */
    var uncertain = typeof entry.confidence === "number" && entry.confidence < 1;
    if (uncertain && !isWeak) {
      body = this.pick(B.uncertain, rnd, avoid) + "\n\n" + body;
    }

    return {
      text: body,
      entryId: entry.id,
      /* The stable name of what answered. Ids are positional and
         renumber whenever a source file gains a line near the top, so
         this is what callers and tests should assert on - it survives
         reordering, which is the only property worth depending on. */
      concept: entry.concept || entry.keywords[0] || null,
      confidence: best.score,
      known: true,
      weak: isWeak || uncertain,
      topic: entry.topic,
      intent: analysis.intent || entry.intent,
      /* The language of the answer text itself, which is not the
         language that was asked in. An entry can carry a real Tagalog
         or Bisaya body; when it does not, the honest report is English,
         so the caller labels the paragraph for what it is rather than
         for what was requested. */
      answerLang: (entry.langs && entry.langs[lang]) ? lang
                : (entry.lang && entry.lang !== "any") ? entry.lang : null,
      source: entry.source || null,
      entryConfidence: (typeof entry.confidence === "number") ? entry.confidence : 1,
      hint: B.topics
    };
  };

  /* Which wording to say, in which language.

     An entry may carry the same answer in all three languages under
     `langs`. When the question came in Bisaya and a Bisaya body really
     exists, that is the answer to give - not an English paragraph with
     a Bisaya question taped to the top of it.

     When it does not exist, the English body is used, and only English
     is used. Mixing the two pools would let an English answer surface
     as a random "variation" of a Tagalog one, which is worse than
     either: the text would look translated when it was not. */
  Generator.prototype.poolFor = function (entry, lang) {
    var L = entry.langs;
    if (L && L[lang]) {
      var native = typeof L[lang] === "string" ? [L[lang]] : L[lang];
      if (native.length) return native;
    }
    return [entry.answer].concat(entry.variations || []);
  };

  /* ---- memory reference --------------------------------------- */

  /* "Do you remember our last topic?"

     The answer is not in the knowledge bank - it is in the transcript.
     That is the whole reason this is a separate path instead of another
     intent: the question's words ("you", "remember", "topic") share no
     vocabulary with the entry that would hold the answer, so ordinary
     retrieval would return whatever drifted closest and the engine
     would confidently describe the wrong subject.

     Two cases, and they must never be blurred:

       we had a topic  -> say which one, and quote what was asked
       we had nothing -> say there was nothing

     The second case is the one that matters. A system that answers
     "yes, we were discussing sleep" when the transcript is empty has
     invented a memory, and an invented memory is worse than no memory
     at all - the user has no way to tell it apart from a real one. So
     the empty branch has its own lines and there is no path from one
     to the other. */
  Generator.prototype.memory = function (opts) {
    opts = opts || {};
    var lang = opts.language || "english";
    var tpl = opts.templates || {};
    var rec = opts.recalled || null;
    var rnd = seeded(opts.seed || 1);

    var set = rec ? (tpl.recall || {}) : (tpl.empty || {});
    var lines = set[lang] || set.english || [];
    var text = lines.length
      ? this.pick(lines, rnd, null)
      /* No wording in the bank at all. Refusing to answer a question
         whose answer is sitting in the transcript would be absurd, so
         this one line is structural, not editorial - it exists so the
         feature still works if someone empties the templates. */
      : (rec
          ? "Yes - our last topic was " + rec.subject + "."
          : "This is the first thing we have talked about, so there is no earlier topic to recall.");

    text = fill(text, {
      topic: rec ? rec.topic : "",
      subject: rec ? rec.subject : "",
      intent: rec ? (rec.intent || "") : "",
      user: rec ? rec.user : ""
    });

    return {
      text: text,
      entryId: opts.entryId || null,
      /* Recall is not a guess. When the transcript holds the answer,
         hedging it would be a different kind of dishonesty - so the
         confidence here reflects certainty about OUR OWN state, which
         is 1, and it is not comparable to a retrieval score. */
      confidence: 1,
      known: true,
      weak: false,
      recall: true,
      hadHistory: !!rec,
      topic: rec ? rec.topic : null,
      intent: "memory_reference",
      answerLang: lang,
      hint: null
    };
  };

  /* Greet by name, when we know it.

     The name is learned from what the person said earlier in this
     same conversation, never prompted for and never stored beyond the
     session. When there is no name there is no slot filled in with a
     placeholder - the greeting just says hello, which is correct
     rather than a template that visibly failed. */
  Generator.prototype.greet = function (opts) {
    opts = opts || {};
    var name = opts.name || "";
    var lines = opts.lines || [];
    if (!lines.length) return "";
    /* Rotate by how many greetings have already been given, rather than
       only seeding a random pick. Seeding alone is not enough: the tests
       use a fixed seed, so every greeting in a seeded session came out
       identical - six of them, one unique. Rotation guarantees the whole
       set is used before any repeat, which is both more varied and more
       predictable than random, and it holds under a fixed seed, which is
       what a reproducibility test needs. */
    var n = typeof opts.nudge === "number" ? opts.nudge : 0;
    var start = ((n % lines.length) + lines.length) % lines.length;
    var text = lines[start];
    text = fill(text, { name: name || "there" });
    /* Only claim the name when one was actually learned. A greeting
       that says "Hello, there" after being told a name would read as
       forgetting, and one that says "Hello, " would read as broken. */
    if (!name) text = text.replace(/\s*[,!.]?\s*\{name\}\s*[,!]?\s*/i, " ").replace(/\s{2,}/g, " ");
    return text;
  };

  /* Mood-matched prefix.

     Applies only when the mood actually cleared the detection bar, and
     only ahead of the answer - never instead of it. A person who says
       "I am so tired of this bug, how do I fix it"
     gets the bug fix AND an acknowledgement. Dropping the answer to
     match the tone would be worse than useless.

     And when the bank has no entry for the question, the mood does not
     rescue it: a sympathetic paragraph in place of an answer is still a
     non-answer, and it is more disappointing than a plain refusal
     because it feels like help. */
  Generator.prototype.empathise = function (opts) {
    opts = opts || {};
    var mood = opts.mood || "neutral";
    var bank = SLOTS[opts.language || "english"] || SLOTS.english;
    var set = (bank.mood && bank.mood[mood]) || null;
    if (!set || !set.length) return "";
    return this.pick(set, seeded(opts.seed || 1), null);
  };

  return { Generator: Generator, ACCEPT: ACCEPT, WEAK: WEAK };
});
