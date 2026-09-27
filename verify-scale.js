/* ============================================================
   bokskie-v1 · verify-scale.js
   ------------------------------------------------------------
       node bokskie-v1/verify-scale.js
       node bokskie-v1/verify-scale.js 90000

   Requirement: growing the bank must not slow the engine down, and
   must not quietly loosen it. Both are checked here, because both are
   the kind of regression that shows up as "the bot got vaguer" months
   later with nothing in the logs.

   The synthetic rows are deliberately the WORST case for retrieval,
   not a flattering one: every row shares the same vocabulary, and the
   query words are chosen to match thousands of them at once. That is
   the scenario that breaks an inverted index with a large posting
   list, and it is the reason candidate generation exists. A scale
   test made of easy queries proves nothing.
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
function section(t) { console.log("\n" + t + "\n" + new Array(58, "-").join("-")); }
function pad(n) {
  var s = String(n);
  while (s.length < 8) s += " ";
  return s;
}

var K = require(path.join(ROOT, "engine/kb.js"));
var T = require(path.join(ROOT, "engine/tokenizer.js"));
var G = require(path.join(ROOT, "engine/generator.js"));

var TARGET = parseInt(process.argv[2], 10) || 90000;

/* Shared vocabulary on purpose. Every row mentions the same two dozen
   common words plus one unique token, so a query for a common word
   lands in a posting list of tens of thousands. */
var COMMON = ("the of and to a in is it for on with that as was by at from this " +
              "system network data value object result type entry table field " +
              "index query record process method level state node graph").split(" ");

function makeKB(n) {
  var kb = new K.KB();
  for (var i = 0; i < n; i++) {
    var words = [];
    for (var c = 0; c < COMMON.length; c++) words.push(COMMON[c]);
    words.push("unique" + i, "concept" + i);
    kb.add({
      id: "sc-" + i,
      topic: (i % 4 === 0) ? "programming" : (i % 4 === 1) ? "science" :
             (i % 4 === 2) ? "geography" : "health",
      intent: "definition",
      keywords: ["unique" + i, "concept" + i, COMMON[i % COMMON.length]],
      patterns: ["what is concept" + i],
      answer: words.join(" ") + ". This row exists to measure the cost of a large bank " +
              "rather than to teach anything. It repeats shared vocabulary on purpose so " +
              "that a common query matches many rows at once."
    });
  }
  return kb;
}

console.log("\nbokskie.v1 scale check - target " + TARGET.toLocaleString() + " entries\n" +
            new Array(58, "=").join("="));

section("1. index build time (once, at load)");
var t0 = Date.now();
var kb = makeKB(TARGET);
var addMs = Date.now() - t0;
t0 = Date.now();
kb.build();
var buildMs = Date.now() - t0;
var stats = kb.stats();

console.log("  add()   " + pad(addMs) + " ms");
console.log("  build()  " + pad(buildMs) + " ms   (" + stats.tokens.toLocaleString() +
            " index keys, " + stats.entries.toLocaleString() + " entries)");
/* A slow build is a slow first message. Generous, because a slow
   machine is not a broken machine - but an accidental O(n squared)
   shows up here and nowhere else. */
ok("index builds in under 20s", buildMs < 20000, buildMs + "ms");
ok("every entry made it into the index", stats.entries === TARGET, stats.entries);

section("2. query time (worst case: a term shared by every row)");
/* "data" and "system" appear in all of them, so the posting list is
   the entire bank. This is the query that decides whether the
   inverted index is doing its job. */
var worst = T.tokenize("what is the data in this system").tokens;
var iterations = 200;
var t1 = Date.now();
for (var q = 0; q < iterations; q++) {
  kb.search({ text: "data system", tokens: worst, topic: "programming" });
}
var worstMs = (Date.now() - t1) / iterations;
console.log("  worst-case query  " + worstMs.toFixed(2) + " ms  (posting list = all " +
            TARGET.toLocaleString() + " rows)");

var rare = T.tokenize("what is concept4242").tokens;
t1 = Date.now();
for (q = 0; q < iterations; q++) {
  kb.search({ text: "what is concept4242", tokens: rare, topic: "programming" });
}
var rareMs = (Date.now() - t1) / iterations;
console.log("  typical query     " + rareMs.toFixed(2) + " ms  (posting list = 1 row)");

/* A human waiting is roughly 100ms of perceived lag. The point of the
   index is that the worst case is not thousands of times the
   typical one. */
ok("worst-case query stays interactive (<100ms)", worstMs < 100, worstMs.toFixed(2) + "ms");
ok("typical query is not slower than the worst case", rareMs < worstMs,
   "typical=" + rareMs.toFixed(2) + " worst=" + worstMs.toFixed(2));

section("3. the refusal guarantee did not move");
var gen = new G.Generator();
/* A query sharing nothing with the bank. With a huge vocabulary of
   shared words this is exactly the case that starts producing
   confident nonsense if coverage is allowed to drift. */
var nothing = T.tokenize("qwertyuiop asdfghjkl zxcvbnm").tokens;
var hits = kb.search({ text: "qwertyuiop asdfghjkl", tokens: nothing, topic: "programming" });
var out = gen.generate({ results: hits, analysis: { topic: "programming", intent: "definition" },
                         language: "english", seed: 1 });
ok("an unmatched query still refuses at scale", out.known === false,
   "known=" + out.known + " score=" + out.confidence.toFixed(3));
ok("and the refusal is a real sentence",
   /do not have anything|outside what I actually know/i.test(out.text), out.text.slice(0, 60));

/* And a genuine hit must still clear the same bar it always did. */
var good = T.tokenize("what is concept4242").tokens;
var gHits = kb.search({ text: "what is concept4242", tokens: good, topic: "programming" });
var gOut = gen.generate({ results: gHits, analysis: { topic: "programming", intent: "definition" },
                          language: "english", seed: 1 });
ok("a genuine match still answers at scale", gOut.known === true,
   "known=" + gOut.known + " score=" + gOut.confidence.toFixed(3));
ok("and it is the RIGHT row, not merely a confident one", gOut.entryId === "sc-4242", gOut.entryId);

/* The bar itself. If either of these numbers moves, every threshold
   tuned by hand against a 55-row bank is now wrong, and nothing else
   in the system will say so. */
eq("the accept threshold has not moved", G.ACCEPT, 0.34);
eq("the weak threshold has not moved", G.WEAK, 0.24);

console.log("\n" + new Array(58, "=").join("="));
console.log("  bokskie.v1 scale:  " + pass + " passed, " + fail + " failed  @ " +
            TARGET.toLocaleString() + " entries");
console.log(new Array(58, "=").join("=") + "\n");
process.exit(fail === 0 ? 0 : 1);

