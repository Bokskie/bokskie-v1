/* ============================================================
   bokskie-v1 · engine/context.js
   ------------------------------------------------------------
   Conversation memory. Deliberately small and deliberately honest.

   What it remembers:
     - the last N turns, so a follow-up question makes sense
     - the topic we were just in, so "how about the other one?"
       does not restart from nothing
     - the last entities asked about, so "tell me more" has
       something to point at

   What it deliberately does NOT do: pretend to learn. There is no
   weight update here, no "I'll remember that" that writes nothing
   down. The only store is this object, it is inspectable, and it
   dies with the page. A memory that lies about itself is worse
   than no memory.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BokskieContext = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MAX_TURNS = 12;
  var MAX_ENTITIES = 8;

  function Context(opts) {
    opts = opts || {};
    this.maxTurns = opts.maxTurns || MAX_TURNS;
    this.maxEntities = opts.maxEntities || MAX_ENTITIES;
    this.turns = [];
    this.entities = [];
    this.topic = null;
    this.language = null;
    this.said = [];        /* anti-repeat memory of what we answered */
    this.unknownCount = 0;
    this.userName = null;  /* learned from what they said, never asked for */
    this.greetCount = 0;   /* how many greetings given, so they vary */
  }

  /* One turn in. Called after we know the topic, so the topic we
     were just in is available to the *next* question. */
  Context.prototype.push = function (turn) {
    this.turns.push({
      user: String(turn.user || ""),
      reply: String(turn.reply || ""),
      topic: turn.topic || null,
      intent: turn.intent || null,
      /* Which entry actually answered, and what it was about. Storing
         these is what lets "do you remember our last topic" be answered
         from the transcript instead of guessed from the shelf name: the
         shelf is "health", but the subject is "sleep", and only the
         second one answers the question the user actually asked. */
      entryId: turn.entryId || null,
      subject: turn.subject || null,
      lang: turn.language || null,
      entities: turn.entities || [],
      unknown: !!turn.unknown
    });
    if (this.turns.length > this.maxTurns) this.turns.shift();
    if (turn.topic) this.topic = turn.topic;
    if (turn.language) this.language = turn.language;
    if (turn.entities) {
      for (var i = 0; i < turn.entities.length; i++) {
        var e = turn.entities[i];
        if (!e) continue;
        var at = this.entities.indexOf(e);
        if (at !== -1) this.entities.splice(at, 1);
        this.entities.push(e);
      }
      while (this.entities.length > this.maxEntities) this.entities.shift();
    }
    if (turn.unknown) this.unknownCount++;
    return this;
  };

  /* A follow-up is a short message that leans on what came before:
     "more", "tell me about that", "and the first one". These cannot
     be understood on their own, so the previous topic has to be
     folded into the query before retrieval, not after.

     Only the FIRST token is tested. Scanning every word meant a long
     real question containing "how" or "and" was mistaken for a
     follow-up and dragged the previous topic into a fresh question. */
  Context.prototype.isFollowUp = function (words) {
    if (!this.turns.length) return false;
    if (!words || !words.length || words.length > 4) return false;
    var FOLLOWR = /^(more|and|also|what|tell|go|continue|next|why|how|really|ok|okay|sure|then|that|the|it|explain|give)$/;
    /* Only the first word decides. Scanning every word meant a real
       question containing "how" or "and" was mistaken for a
       follow-up and dragged the previous topic into a fresh one. */
    return FOLLOWR.test(words[0]);
  };

  /* The words worth carrying forward into the next retrieval. */
  Context.prototype.contextTokens = function () {
    if (!this.turns.length) return [];
    var last = this.turns[this.turns.length - 1];
    var out = [];
    for (var i = 0; i < last.entities.length; i++) out.push(last.entities[i]);
    return out;
  };

  /* The turn "do you remember our last topic" is asking about.

     Scans backwards, and deliberately skips turns that had no topic. A
     bare "ok thanks" after a health question must not hide the health
     question - the most recent *substantive* turn is what the user
     means by "last topic", not the most recent turn of any kind.

     The distinction matters more than it looks. Returning the greeting
     would make the engine confidently confirm that "conversation" was
     the previous topic, which is technically true of the transcript and
     completely useless as an answer. */
  Context.prototype.recalled = function () {
    for (var i = this.turns.length - 1; i >= 0; i--) {
      var t = this.turns[i];
      if (!t.topic) continue;
      return {
        topic: t.topic,
        intent: t.intent || null,
        entryId: t.entryId || null,
        /* The subject, with the shelf as a last resort. "health" is a
           category, not a subject; "sleep" is what the user recognises
           as the topic they were discussing. */
        subject: t.subject || (t.entities && t.entities.length ? t.entities[0] : null) || t.topic,
        user: t.user,
        reply: t.reply,
        lang: t.lang || null,
        at: i
      };
    }
    return null;
  };

  /* The same thing as plain data, for callers that want to inspect
     memory without rendering a sentence. Keys are named after the
     question being asked, not after the fields they happen to come
     from - this is the shape an app or a log wants to read. */
  Context.prototype.recallSnapshot = function () {
    var r = this.recalled();
    if (!r) {
      return {
        previous_topic: null,
        previous_intent: null,
        previous_entry: null,
        previous_user_message: null,
        previous_reply: null,
        turns: this.turns.length
      };
    }
    return {
      previous_topic: r.subject,
      previous_shelf: r.topic,
      previous_intent: r.intent,
      previous_entry: r.entryId,
      previous_user_message: r.user,
      previous_reply: r.reply,
      turns: this.turns.length
    };
  };

  /* ---------- the user's name ----------

     Learned, not asked for. There is no name prompt anywhere in the
     flow: if a person says "my name is Juan" or "ako si Maria" it is
     noticed, and if they never say one, the bot simply greets without
     a name. Asking for a name in order to store it would be the
     intrusive choice, and there is no version of this that is not a
     form.

     Session-scoped and honestly so. It lives in this object, which
     dies with the page, exactly like the conversation itself. It is
     not written to storage and it is not sent anywhere. */
  Context.prototype.learnName = function (text) {
    var found = extractName(String(text || ""));
    if (!found) return this.userName || null;
    /* First one wins. A later "i am a developer" must not overwrite
       the name with the word "developer" - the NOT_A_NAME guard stops
       that particular one, and this stops every other later phrase. */
    if (this.userName) return this.userName;
    this.userName = found;
    return found;
  };

  /* Said the name, and wants it gone. */
  Context.prototype.forgetName = function () {
    if (!this.userName) return false;
    this.userName = null;
    return true;
  };

  /* Answerable once it is known, and an honest null before that. */
  Context.prototype.nameOf = function () { return this.userName || null; };

  /* Words that look like names in the patterns above and are not. */
  var NOT_A_NAME = {
    a: 1, an: 1, the: 1, not: 1, no: 1, so: 1, just: 1, still: 1, also: 1,
    trying: 1, working: 1, looking: 1, coming: 1, going: 1, doing: 1,
    fine: 1, ok: 1, okay: 1, good: 1, bad: 1, tired: 1, busy: 1, here: 1,
    developer: 1, student: 1, teacher: 1, doctor: 1, engineer: 1,
    beginner: 1, learner: 1, human: 1, bot: 1, user: 1, guy: 1, girl: 1,
    boy: 1, man: 1, woman: 1, person: 1, filipino: 1, happy: 1, sad: 1,
    angry: 1, tired: 1, ready: 1, done: 1, back: 1, really: 1, very: 1
  };

  function cleanName(raw) {
    if (!raw) return null;
    var parts = String(raw).trim().split(/\s+/).slice(0, 2);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i].replace(/[^A-Za-z\u00C0-\u024F'-]/g, "");
      if (!w || w.length < 2) continue;
      if (NOT_A_NAME[w.toLowerCase()]) return null;
      out.push(w);
    }
    if (!out.length) return null;
    var name = out.join(" ");
    return name.length > 24 ? null : name;
  }

  /* Patterns that actually introduce a name, in three languages.
     Deliberately narrow - the NOT_A_NAME guard is what stops "i am a
     developer" from teaching the bot to call everyone "Developer". */
  function extractName(text) {
    var t = String(text || "");
    var patterns = [
      /\bmy name(?:'s| is)\s+([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F' -]{0,22})/i,
      /\bcall me\s+([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F' -]{0,22})/i,
      /\bi(?:'m| am)\s+([A-Z][A-Za-z\u00C0-\u024F' -]{0,22})/,
      /\bthis is\s+([A-Z][A-Za-z\u00C0-\u024F' -]{0,22})/,
      /\bako(?:ng| si)\s+([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F' -]{0,22})/i,
      /\bnag[- ]ako(?:ng| si)\s+([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F' -]{0,22})/i,
      /\baka(?:ng| si)\s+([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F' -]{0,22})/i,
      /\bgit(?:a| akong) ngalan\s+(?:ako|niya|ng)\s+([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F' -]{0,22})/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = patterns[i].exec(t);
      if (!m) continue;
      /* Stop at a sentence boundary, so "my name is Juan. How are you"
         does not try to learn "Juan How Are You". */
      var name = cleanName(m[1].split(/[.?!,;]/)[0]);
      if (name) return name;
    }
    return null;
  }

  /* Anti-repeat, same idea as the old composer: remember what we just
     said so the next answer is not the same answer. */
  Context.prototype.rememberSaid = function (text) {
    var t = String(text || "");
    if (t) this.said.push(t);
    while (this.said.length > 10) this.said.shift();
  };

  Context.prototype.saidRecently = function (text) {
    return this.said.indexOf(String(text || "")) !== -1;
  };

  /* Did we already tell them we do not know? If so, do not keep
     saying it - offer the honest next step instead. */
  Context.prototype.beenIgnorant = function () {
    return this.unknownCount > 0;
  };

  Context.prototype.reset = function () {
    this.turns = [];
    this.entities = [];
    this.topic = null;
    this.language = null;
    this.said = [];
    this.unknownCount = 0;
    this.greetCount = 0;
    /* The name goes with the rest. It was learned from this
       conversation, so it should not outlive it - and a shared screen
       should not greet the next person by name. */
    this.userName = null;
    return this;
  };

  Context.prototype.snapshot = function () {
    return {
      turns: this.turns.length,
      topic: this.topic,
      language: this.language,
      entities: this.entities.slice(),
      unknowns: this.unknownCount
    };
  };

  return { Context: Context, MAX_TURNS: MAX_TURNS };
});
