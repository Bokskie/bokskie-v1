/* ============================================================
   bokskie-v1 · verify-engine.js
   ------------------------------------------------------------
   Tests for the understanding engine (engine/ + data/).

     node bokskie-v1/verify-engine.js

   The test that matters most is section 6. Everything else proves
   the machinery works; that one proves the system prefers to admit
   ignorance rather than answer wrongly, which is the entire reason
   this engine exists.
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
var SIM = require(path.join(ROOT, "engine/similarity.js"));
var I = require(path.join(ROOT, "engine/intent.js"));
var C = require(path.join(ROOT, "engine/context.js"));
var K = require(path.join(ROOT, "engine/kb.js"));
var G = require(path.join(ROOT, "engine/generator.js"));
/* engine/index.js exports { Engine, DATA_FILES }, so the loader is on
   Engine - reaching for E.load() looks right and is not. */
var E = require(path.join(ROOT, "engine/index.js"));
var load = E.Engine.load;

/* ============================================================
   1. TOKENIZER
   ============================================================ */
section(1, "tokenizer");

eq("lowercases", T.normalize("  HeLLo  "), "hello");
eq("curly quotes become plain", T.normalize("don\u2019t"), "don't");
eq("strips punctuation", T.words("hi, there!").length, 2);
eq("keeps contractions whole", T.words("don't stop")[0], "don't");

var t1 = T.tokenize("what is javascript");
eq("drops stopwords", t1.tokens.indexOf("what"), -1);
eq("keeps content words", t1.tokens.indexOf("javascript") !== -1, true);

/* The prefix list is deliberately conservative. A two-letter prefix
   looked harmless and quietly turned "kamusta" into "musta". */
eq("kamusta survives stemming", T.tokenize("kumusta").tokens[0], "kamusta");
eq("maayo survives stemming", T.tokenize("maayo").tokens[0], "maayo");
eq("naglaro strips nag-", T.tokenize("naglaro").tokens[0], "laro");
eq("kumusta and musta unify", T.tokenize("kumusta").tokens[0], T.tokenize("musta").tokens[0]);
eq("bigrams over a string", T.bigrams("ab").length, 3);

/* ============================================================
   2. SIMILARITY
   ============================================================ */
section(2, "similarity");

eq("identical strings", SIM.levRatio("javascript", "javascript"), 1);
ok("typo still scores high", SIM.levRatio("javascript", "javascrip") >= 0.9, SIM.levRatio("javascript", "javascrip"));
eq("empty is zero", SIM.cosine({}, {}), 0);
ok("jaccard rewards overlap", SIM.jaccard({ a: 1, b: 1 }, { a: 1, b: 1, c: 1 }) > 0.6);
ok("dice rewards shared bigrams", SIM.dice(["pr", "ro"], ["pr", "ro", "og"]) > 0.7);

/* ============================================================
   3. INTENT
   ============================================================ */
section(3, "intent, topic, language");

[["hi", "greeting"], ["kumusta ka", "greeting"], ["goodbye", "farewell"],
 ["salamat", "gratitude"], ["who are you", "identity"],
 ["what can you do", "capability"], ["how do i fix a bug", "howto"],
 ["what is gravity", "definition"], ["how much is it", "price"],
 ["bakit mahal", "why"], ["saan ito", "where"], ["sino ito", "who"]
].forEach(function (c) {
  var a = I.analyse(c[0], T.tokenize(c[0]).tokens);
  eq("intent: " + c[0], a.intent, c[1]);
});

eq("topic: javascript", I.analyse("what is javascript", T.tokenize("what is javascript").tokens).topic, "programming");
eq("topic: gravity", I.analyse("tell me about gravity", T.tokenize("tell me about gravity").tokens).topic, "science");
eq("topic: nothing relevant", I.analyse("asdfghjkl", T.tokenize("asdfghjkl").tokens).topic, null);
eq("language: bisaya", I.language("kumusta ka unsa sayon"), "bisaya");
eq("language: tagalog", I.language("magandang araw sa inyo"), "tagalog");
eq("language: english", I.language("what is the weather today"), "english");

/* ============================================================
   3b. DEAD ROUTER KEYS
   ============================================================
   The router matches against tokens, and tokens are stemmed. So a key
   that is not itself stemmed is a key nothing can ever produce - a line
   of configuration that looks load-bearing and does nothing.

   Five of these shipped: `programming` (the stemmer yields "programm"),
   `coding` ("cod"), `process` ("proces"), `thread` and `vpn`. The first
   is the one that hurt, because a bare "lets talk about programming"
   routes to no topic at all, takes the 0.55x off-topic penalty on the
   right answer, and refuses instead of answering.

   It survived this long because every earlier test asked a longer
   question that happened to contain some other keyword, so the dead
   key never had to carry the query by itself. */
var STEMMABLE = ("javascript python java code coding program programming function variable " +
  "array loop method object bug debug error syntax api json framework library node react " +
  "vue angular typescript database sql server deploy git github algorithm php golang rust " +
  "kotlin swift frontend backend software cpu ram ssd binary cache process thread http " +
  "cookie localstorage encryption firewall router dns vpn latency packet subnet ethernet " +
  "storage directory graphics motherboard processor memory disk file monitor keyboard " +
  "mouse windows linux operating manifest browser domain stylesheet").split(" ");

var deadKeys = [];
STEMMABLE.forEach(function (w) {
  var stem = T.stem(T.canonical(w));
  if (stem === w) return;                    /* already stemmed, fine */
  for (var topic in I.TOPICS) {
    if (!I.TOPICS.hasOwnProperty(topic)) continue;
    if (I.TOPICS[topic].keys[stem] !== undefined) return;
  }
  deadKeys.push(w + " -> \"" + stem + "\"");
});

ok("no dead router keys (" + STEMMABLE.length + " words audited)", deadKeys.length === 0,
   deadKeys.join(", "));

/* Framing words must not outvote the subject. Every one of these
   phrases names exactly one content word, and each of them used to
   refuse because the framing leaked into the query vector and diluted
   the real subject below the accept bar. "alam" and "kaba" are the
   clearest: "may alam kaba about programming" carries no information
   except the word "programming". */
[["may alam kaba about programming", ["programm"]],
 ["lets talk about programming", ["programm"]],
 ["what framework you suggest to use in frontend", ["framework", "frontend"]],
 ["magkano ang pera", ["pera"]],
 ["i want to learn about python", ["python"]]
].forEach(function (c) {
  eq("framing is stripped: " + c[0], T.tokenize(c[0]).tokens.join(" "), c[1].join(" "));
});

/* The other half, and the one that matters more: a language shelf's
   own concept words must NOT be stopped, or "unsa ang kaayo" becomes
   unanswerable while fixing the case above. */
[["unsa ang kaayo", true], ["ano ang mahal", true], ["unsa meaning nga dako", true],
 ["ano ang kulang", true], ["unsa ang ikaw", true], ["ano ang sobra", true],
 ["unsa ang dili", true], ["ano ang kumusta", true], ["bakit grumpy", true]
].forEach(function (c) {
  var survived = T.tokenize(c[0]).tokens.length > 0;
  eq("concept survives stopwords: " + c[0], survived, c[1]);
});

/* And the specific pre-existing bug this section exists for: every
   word in "unsa ang kaayo" used to be a stopword, so the query
   tokenised to nothing and the Cebuano entry was unreachable in
   Cebuano. The topic word itself must now survive. */
ok("kaayo survives tokenization", T.tokenize("unsa ang kaayo").tokens.indexOf("kaayo") !== -1,
   JSON.stringify(T.tokenize("unsa ang kaayo").tokens));
ok("ikaw survives tokenization", T.tokenize("unsa ang ikaw").tokens.indexOf("ikaw") !== -1,
   JSON.stringify(T.tokenize("unsa ang ikaw").tokens));

/* And the case that actually broke, pinned so it cannot regress. */
eq("a bare topic word routes on its own",
   I.analyse("programming", T.tokenize("programming").tokens).topic, "programming");
eq("a framed request still routes",
   I.analyse("lets talk about programming", T.tokenize("lets talk about programming").tokens).topic,
   "programming");

/* ============================================================
   4. CONTEXT
   ============================================================ */
section(4, "conversation memory");

var ctx = new C.Context();
eq("a fresh context has no topic", ctx.topic, null);
ctx.push({ user: "what is javascript", reply: "...", topic: "programming", entities: ["javascript"] });
eq("topic is remembered", ctx.topic, "programming");
eq("entities are remembered", ctx.entities[0], "javascript");
ok("a short vague follow-up is recognised", ctx.isFollowUp(["more"]));
ok("a full question is not a follow-up", !ctx.isFollowUp(["how", "does", "gravity", "actually", "work", "properly"]));

for (var i = 0; i < 40; i++) ctx.push({ user: "x" + i, reply: "y" + i, topic: "science" });
eq("turn count is bounded", ctx.turns.length, ctx.maxTurns);

ctx.rememberSaid("a"); ctx.rememberSaid("b");
ok("said-text is remembered", ctx.saidRecently("a"));
ok("stranger is not remembered", !ctx.saidRecently("zzz"));
ctx.reset();
eq("reset clears everything", ctx.turns.length, 0);

/* ============================================================
   5. KNOWLEDGE BASE + INDEX
   ============================================================ */
section(5, "knowledge base and index");

var kb = new K.KB();
kb.add({ id: "a", topic: "t1", keywords: ["alpha"], answer: "Alpha is the first letter." });
kb.add({ id: "b", topic: "t2", keywords: ["beta"], answer: "Beta is the second letter." });
kb.build();

eq("two entries", kb.entries.length, 2);
ok("the index is populated", Object.keys(kb.index).length > 0);
eq("index is a real index, not a scan", kb.candidates(["alpha"], 10).length, 1);
eq("unknown token finds nothing", kb.candidates(["zzzzz"], 10).length, 0);
ok("fuzzy match finds a near miss", kb.candidates(["alpga"], 10).length > 0);

/* The whole point of the index: a query must not score the whole
   bank, or the 1M-entry plan collapses back into a linear scan. */
var big = new K.KB();
for (var n = 0; n < 5000; n++) {
  big.add({
    id: "e" + n, topic: "t" + (n % 10), keywords: ["word" + n, "common"],
    answer: "Entry " + n + " about topic " + (n % 10) + " and filler so the vector is not degenerate."
  });
}
big.build();
var t0 = Date.now();
for (var q = 0; q < 100; q++) big.search({ tokens: ["word4242"], text: "word4242" });
var elapsed = Date.now() - t0;
ok("100 queries over 5000 entries under 2s", elapsed < 2000, elapsed + "ms");
eq("and it found the right one", big.search({ tokens: ["word4242"], text: "word4242" })[0].id, "e4242");

load().then(function (engine) {
  var st = engine.stats();
  ok("engine loaded a real bank", st.entries >= 50, st.entries + " entries");
  ok("index has many tokens", st.tokens > 500, st.tokens + " tokens");
  ok("all nine topics present", engine.topics().length >= 9, engine.topics().join(","));

  /* ============================================================
     6. THE TEST THAT MATTERS: correct entry, or honest refusal
     ============================================================ */
  section(6, "right answer, or honest refusal");

  /* Asserted on `concept`, not `entryId`. Ids are positional: adding a
     line near the top of a .kb source file renumbers everything below
     it, and a test that breaks for that reason gets "fixed" by
     hardcoding the new number. `concept` is the name the author chose
     and survives reordering, which is the only thing worth depending
     on. */
  [[ "what is javascript", "javascript"],
   ["how does gravity work", "gravity"],
   ["what is compound interest", "interest"],
   ["tell me about quantum physics", "quantum"],
   ["who are you", "identity"],
   ["kumusta ka", "greeting"],
   ["salamat", "gratitude"],
   ["goodbye", "farewell"],
   ["what can you do", "capability"],
   ["what is the pythagorean theorem", "pythagorean"],
   ["how do i fix a javascript bug", "bug"],
   ["when did the philippines get independence", "commonwealth"],
   ["how do i save money", "budget"],
   ["what is photosynthesis", "photosynthesis"],
   ["what is a quadratic equation", "quadratic"],
   ["what is dna", "dna"],
   ["how much emergency fund", "emergency"]
  ].forEach(function (c) {
    var r = engine.reply(c[0], { seed: 7, useContext: false });
    ok("answers: " + c[0], r.known && r.concept === c[1],
       (r.known ? r.concept : "refused") + " (want " + c[1] + ")");
  });

  /* The honest-failure half. A system with 1M entries still has gaps,
     and the only acceptable response to a gap is to admit it. */
  section(7, "out of scope is refused, not invented");
  ["who won the 2019 basketball world cup", "asdfghjkl qwerty",
   "what is the meaning of life", "how to bake sourdough bread",
   "what is the price of tesla stock today"
  ].forEach(function (q) {
    var r = engine.reply(q, { seed: 7, useContext: false });
    ok("refuses: " + q.substring(0, 34), r.known === false && r.entryId === null && r.text.length > 30,
       r.known ? "invented -> " + r.entryId : "too short");
  });

  section(8, "conversation and reproducibility");
  return load().then(function (e2) {
    var seen = {}, unique = 0;
    for (var i2 = 0; i2 < 6; i2++) {
      var r = e2.reply("kumusta ka", { seed: i2 + 1 });
      if (!seen[r.text]) { seen[r.text] = 1; unique++; }
    }
    ok("repeated greetings do not repeat verbatim", unique >= 2, unique + " unique of 6");

    e2.reset();
    var first = e2.reply("what is javascript", { seed: 5 });
    ok("first answer is about javascript", /javascript/i.test(first.text));
    eq("a contentless follow-up still answers", e2.reply("tell me more", { seed: 5 }).known, true);

    e2.reset();
    eq("reset makes it reproducible", e2.reply("what is javascript", { seed: 5 }).text, first.text);

    section(9, "the generator refuses by default");
    var gen = new G.Generator();
    ok("the accept threshold is above zero", gen.accept > 0.3, gen.accept);
    eq("no hits means known=false", gen.generate({ results: [], analysis: {}, language: "english" }).known, false);
    ok("every language has a real refusal line", ["english", "tagalog", "bisaya"].every(function (l) {
      return gen.generate({ results: [], analysis: {}, language: l }).text.length > 40;
    }));
    ok("confidence is always a number", typeof engine.reply("hi", { seed: 3, useContext: false }).confidence === "number");

    console.log("\n" + new Array(62, "=").join("="));
    console.log("  bokskie.v1 engine:  " + pass + " passed, " + fail + " failed");
    console.log(new Array(62, "=").join("="));
    process.exit(fail ? 1 : 0);
  });
}).catch(function (err) {
  console.log("ERROR " + (err && err.stack ? err.stack : err));
  process.exit(1);
});
