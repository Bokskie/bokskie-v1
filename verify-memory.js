/* ============================================================
   bokskie-v1 · verify-memory.js
   ------------------------------------------------------------
   Tests for the context resolver and the multilingual lexicon.

       node bokskie-v1/verify-memory.js

   These two are tested together on purpose, because they are one
   mechanism seen from two sides: the lexicon decides what words the
   engine can understand, and the context resolver decides what it can
   remember about them. Testing either alone misses exactly the
   interesting failures - a lexicon that works but whose subject is
   unreportable, or memory that works but recalls a shelf name
   instead of a subject.

   The section that matters most is 6. Everything else proves the
   plumbing works; that one proves the engine will not invent a
   memory, and an invented memory is the one failure a user genuinely
   cannot detect on their own.
   ============================================================ */

"use strict";

var path = require("path");
var ROOT = __dirname;
var pass = 0, fail = 0;

function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra !== undefined ? "  -> " + extra : "")); }
}
function eq(name, got, want) {
  ok(name, got === want, "got " + JSON.stringify(got) + ", want " + JSON.stringify(want));
}
function section(n, t) { console.log("\n" + n + ". " + t + "\n" + new Array(58, "-").join("-")); }

var T = require(path.join(ROOT, "engine/tokenizer.js"));
var I = require(path.join(ROOT, "engine/intent.js"));
var C = require(path.join(ROOT, "engine/context.js"));
var K = require(path.join(ROOT, "engine/kb.js"));
var G = require(path.join(ROOT, "engine/generator.js"));
var E = require(path.join(ROOT, "engine/index.js"));

/* ============================================================
   1. THE LEXICON BRIDGE
   ============================================================ */
section(1, "the lexicon bridge");

var added = T.registerLexicon({ "tulog": "sleep", "katulog": "sleep", "pising": "urination" });
ok("registerLexicon reports what it attached", added === 3, "added=" + added);

eq("a Tagalog word folds onto the concept", T.canonical("tulog"), "sleep");
eq("a Bisaya word folds onto the same concept", T.canonical("katulog"), "sleep");
eq("both reach the same index token", T.tokenize("tulog").tokens[0], T.tokenize("katulog").tokens[0]);

/* The whole point: one English entry, reachable from three languages.
   Built on a scratch KB, so this tests the bridge and not the shipped
   bank - a bridge that only works because a particular entry happens
   to exist is not a bridge. */
var scratch = new K.KB();
scratch.add({ id: "x-sleep", topic: "health", intent: "definition",
              keywords: ["sleep", "tulog", "katulog"], answer: "Sleep is rest." });
scratch.build();
var hit = scratch.search({ text: "unsa ang katulog", tokens: T.tokenize("unsa ang katulog").tokens, topic: "health" });
ok("a Bisaya question reaches an English-keyworded entry", hit.length > 0 && hit[0].id === "x-sleep",
   "top=" + (hit[0] && hit[0].id));
ok("and clears the accept bar", hit.length > 0 && hit[0].score >= 0.34,
   hit.length ? hit[0].score.toFixed(3) : "none");

/* Typos are the fuzzy matcher's job, and must not be pre-empted. */
eq("a typo is not folded in by the lexicon", T.canonical("tulig"), "tulig");

/* A phrase can never be a token, so accepting one as a key would
   create an index entry nothing can ever reach. */
eq("multi-word keys are rejected", T.registerLexicon({ "ano ang tulog": "sleep" }), 0);

/* Curated orthography outranks bulk data. */
eq("a hand-curated spelling is not overwritten", T.registerLexicon({ "kumusta": "something-else" }), 0);
eq("and the curated rule still holds", T.canonical("kumusta"), "kamusta");

/* ============================================================
   2. CROSS-LANGUAGE TOPIC ROUTING
   ============================================================ */
section(2, "cross-language topic routing");

/* A question containing no English word must still reach the right
   shelf, or the 0.55x topic penalty lands on the right answer and a
   good match is thrown away. */
[["unsa ang katulog", "health"], ["ano ang tulog", "health"],
 ["unsa ang gravity", "science"], ["ano ang prime number", "mathematics"],
 ["magkano ang pera", "money"], ["ano ang encryption", "technology"],
 ["ano ang kasaysayan", "history"], ["saan ang pilipinas", "geography"],
 ["ano ang javascript", "programming"]
].forEach(function (c) {
  eq("routes: " + c[0], I.analyse(c[0], T.tokenize(c[0]).tokens).topic, c[1]);
});

/* ============================================================
   3. MEMORY REFERENCE IS AN INTENT, NOT A SEARCH
   ============================================================ */
section(3, "memory reference intent");

[["do you remember our last topic", "memory_reference"],
 ["you remember what we talked about", "memory_reference"],
 ["naalala mo ba ang last topic", "memory_reference"],
 ["unsa ang pinag-usapan natin", "memory_reference"],
 ["what did we discuss", "memory_reference"],
 ["previous question", "memory_reference"]
].forEach(function (c) {
  eq("intent: " + c[0], I.analyse(c[0], T.tokenize(c[0]).tokens).intent, c[1]);
});

/* It must outrank whatever it competes with, or it gets routed into
   ordinary knowledge search - the bug it exists to fix. */
eq("beats the intents it competes with",
   I.analyse("you remember our last topic about sleep",
             T.tokenize("you remember our last topic about sleep").tokens).intent,
   "memory_reference");

/* And it must not fire on ordinary questions. That is the other half:
   a matcher this broad turns half the bank into "do you remember?". */
["what is javascript", "how do i fix a bug", "kumusta ka", "anong oras",
 "tell me more", "what is the capital of france", "salamat"].forEach(function (q) {
  var a = I.analyse(q, T.tokenize(q).tokens);
  ok("not a memory reference: " + q, a.intent !== "memory_reference", a.intent);
});

/* ============================================================
   4. CONTEXT REMEMBERS THE SUBJECT, NOT THE SHELF
   ============================================================ */
section(4, "what memory actually stores");

var ctx = new C.Context();
eq("nothing to recall yet", ctx.recalled(), null);
eq("and the snapshot says so honestly", ctx.recallSnapshot().previous_topic, null);

ctx.push({ user: "bro ano ang sleep?", reply: "...", topic: "health", intent: "howto",
           entryId: "health-sleep", subject: "sleep", entities: ["sleep"] });
var rec = ctx.recalled();
eq("the shelf is remembered", rec.topic, "health");
eq("the subject is remembered", rec.subject, "sleep");
eq("the answering entry is remembered", rec.entryId, "health-sleep");

var snap = ctx.recallSnapshot();
eq("snapshot: previous_topic is the subject", snap.previous_topic, "sleep");
eq("snapshot: previous_shelf is the category", snap.previous_shelf, "health");
eq("snapshot: previous_intent", snap.previous_intent, "howto");
eq("snapshot: previous_entry", snap.previous_entry, "health-sleep");
eq("snapshot: previous_user_message", snap.previous_user_message, "bro ano ang sleep?");

/* A bare acknowledgement has no topic and must not hide the real
   subject behind it: true of the transcript, useless as an answer. */
ctx.push({ user: "ok thanks", reply: "welcome", topic: null, intent: "gratitude" });
eq("a topicless turn does not hide the subject", ctx.recalled().subject, "sleep");

/* ============================================================
   5. THE GENERATOR RENDERS RECALL HONESTLY
   ============================================================ */
section(5, "recall rendering");

var gen = new G.Generator();
var def = {
  id: "conv-memory-reference", topic: "conversation", intent: "memory_reference",
  answer: "x",
  memory: {
    recall: { english: ["Yes - our last topic was {subject}."], tagalog: ["Oo - {subject}."], bisaya: ["Oo - {subject}."] },
    empty:  { english: ["No, this is the first thing we have talked about."], tagalog: ["Wala pa."], bisaya: ["Wala pa."] }
  }
};
var kbk = new K.KB();
kbk.add(def); kbk.build();
eq("the bank defines the behaviour", kbk.defines("memory_reference").id, "conv-memory-reference");

var withHist = gen.memory({ recalled: rec, templates: def.memory, language: "english", seed: 1 });
ok("the subject is named", withHist.text.indexOf("sleep") !== -1, withHist.text);
eq("it is marked as a recall", withHist.recall, true);
eq("recall is not hedged", withHist.weak, false);
eq("recall carries no doubt", withHist.confidence, 1);

var noHist = gen.memory({ recalled: null, templates: def.memory, language: "english", seed: 1 });
ok("an empty transcript is answered as empty", noHist.text.indexOf("first thing") !== -1, noHist.text);
eq("and it reports no history", noHist.hadHistory, false);

/* The one thing this feature must never do. */
ok("no history never produces a subject",
   noHist.text.indexOf("sleep") === -1 && noHist.topic === null, noHist.text);

eq("renders in tagalog", gen.memory({ recalled: rec, templates: def.memory, language: "tagalog", seed: 1 }).answerLang, "tagalog");
eq("renders in bisaya", gen.memory({ recalled: rec, templates: def.memory, language: "bisaya", seed: 1 }).answerLang, "bisaya");

/* A bank with no templates must still answer rather than claim
   ignorance about its own transcript. */
ok("works with no templates at all",
   gen.memory({ recalled: rec, templates: {}, language: "english", seed: 1 }).text.indexOf("sleep") !== -1);

/* ============================================================
   6. END TO END, THROUGH THE SHIPPED BANK
   ============================================================ */
section(6, "end to end, through the shipped bank");

E.Engine.load({ basePath: path.join(ROOT, "data") + "/" }).then(function (e) {
  var s = e.stats();
  ok("the lexicon actually attached", s.lexicon > 0, "lexicon=" + s.lexicon);
  ok("the bank is larger than the lexicon alone", s.entries > 12, "entries=" + s.entries);

  /* One concept, three languages, one entry - the whole design. */
  [["what is sleep", "english"], ["ano ang tulog", "tagalog"],
   ["unsa ang katulog", "bisaya"]].forEach(function (c) {
    var r = e.reply(c[0], { useContext: false });
    ok("answers: " + c[0], r.known, "score=" + r.confidence.toFixed(3));
    eq("  ...in the right language: " + c[0], r.lang, c[1]);
  });

  /* The discourse-particle bug, pinned. "bro" alone once dropped a
     0.78 match to 0.23 and turned a clear question into a refusal. */
  var bro = e.reply("bro ano ang sleep?", { useContext: false });
  ok("a discourse particle does not break retrieval", bro.known,
     "score=" + bro.confidence.toFixed(3));

  /* Recall through the real pipeline. */
  e.reset();
  e.reply("bro ano ang sleep?");
  var asked = e.reply("bro you remember our last topic?");
  eq("recall names the subject", asked.recall.previous_topic, "sleep");
  ok("the subject appears in the answer", asked.text.indexOf("sleep") !== -1, asked.text);

  /* Asking twice must not let the answer drift onto the question
     itself - the snapshot is taken before the turn is recorded. */
  eq("repeat recall still names the subject",
     e.reply("do you remember?").recall.previous_topic, "sleep");

  /* The recall turn must not overwrite the topic, or the next genuine
     follow-up inherits "conversation" and drags these very sentences
     into an unrelated question. */
  /* The expected topic is the SHELF, not the old flat group: the sleep
     entry is filed under health-education in the tree, so that is what a
     correct answer reports. What this test is really about is unchanged -
     after a recall turn the stored topic must still be the sleep
     question's own subject and not "conversation". */
  eq("memory reference did not overwrite the topic", e.ctx.topic, "health-education");
  eq("a follow-up still resolves to the real subject", e.reply("tell me more").topic, "health-education");

  /* No history is the honest path. */
  e.reset();
  var empty = e.reply("do you remember our last topic?");
  eq("with no history, recall reports none", empty.recall.previous_topic, null);
  ok("and says so in words", /first thing|no earlier topic|nothing before/i.test(empty.text), empty.text);
  ok("without inventing a topic", empty.text.indexOf("sleep") === -1, empty.text);

  /* Out of scope still refuses. The multilingual work must not have
     quietly lowered the bar - that is the whole project's promise. */
  ["asdfghjkl qwerty", "what is the meaning of life",
   "sino ang nanalo ng 2019 basketball world",
   "ano ang presyo ng stock ng tesla"].forEach(function (q) {
    ok("still refuses: " + q, !e.reply(q, { useContext: false }).known);
  });

  /* Uncertainty must reach the user, not sit in the data unread.
     The id is the builder's predictable prefix-NNNNNN form, so this also
     pins that the source pipeline produces stable ids. */
  var hedged = e.reply("do cold medicines work", { useContext: false });
  if (hedged.known && /^hea-[a-z0-9-]+-\d{6}$/.test(String(hedged.entryId))) {
    ok("an uncertain entry is hedged in the answer", hedged.weak, hedged.text.slice(0, 60));
    ok("and the hedge is actually stated",
       /not firmly established|unsettled/i.test(hedged.text), hedged.text.slice(0, 90));
  } else {
    ok("uncertain entry is reachable", false, "entry=" + hedged.entryId);
  }

  /* A missing translation must be reported as English, never guessed. */
  eq("a missing translation is reported as english",
     e.reply("what is a prime number", { useContext: false }).lang, "english");

  console.log("\n" + new Array(58, "=").join("="));
  console.log("  bokskie.v1 memory + lexicon:  " + pass + " passed, " + fail + " failed");
  console.log(new Array(58, "=").join("="));
  process.exit(fail === 0 ? 0 : 1);
}, function (err) {
  console.error("engine failed to load: " + (err && err.message));
  process.exit(1);
});