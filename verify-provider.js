/* ============================================================
   bokskie-v1 · verify-provider.js
   ------------------------------------------------------------
   Integration tests: the provider object bokskie.ai actually calls,
   not the engine underneath it.

     node bokskie-v1/verify-provider.js

   The engine has its own suite. This one guards the seam between
   them - a provider that loads the wrong thing, mislabels a
   language, or answers while its bank failed to load would pass
   every engine test and still break the app.
   ============================================================ */

"use strict";

var path = require("path");
var fs = require("fs");
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

var provider = require(path.join(ROOT, "src/provider.js"));
var ask = function (q, o) { return provider.reply(q, o); };

/* stream() is an async generator; drain it into an array. */
function streamAll(gen) {
  var out = [];
  function pump() {
    return gen.next().then(function (step) {
      if (step.done) return out;
      out.push(step.value);
      return pump();
    });
  }
  return pump();
}

section(1, "shape the app depends on");
eq("provider id", provider.id, "bokskie-local");
eq("needs no key", provider.providerInfo().auth, "none");
eq("no base url", provider.providerInfo().base, "");
eq("default model", provider.defaultModel, "bokskie.v1");
ok("has reply()", typeof provider.reply === "function");
ok("has stream()", typeof provider.stream === "function");
ok("has ready()", typeof provider.ready === "function");
ok("has stats()", typeof provider.stats === "function");
eq("two models", provider.models.length, 2);
eq("verbose model id", provider.models[1].id, "bokskie.v1-verbose");

section(2, "the bank really loaded");

provider.ready().then(function (eng) {
  ok("ready() resolves with an engine", !!eng);
  var st = provider.stats();
  ok("stats report ready", st.ready === true, st.error || "not ready");
  ok("it has entries", st.entries >= 50, st.entries);
  ok("it has topics", st.topicsCount >= 9, st.topicsCount);
  ok("topics are listed", provider.topics().indexOf("programming") !== -1, provider.topics().join(","));

  section(3, "it answers, correctly");
  return ask("what is javascript", { seed: 1, useContext: false }).then(function (r) {
    eq("javascript -> javascript entry", r.concept, "javascript");
    ok("with a real answer", /language that runs in web browsers/i.test(r.text));
    eq("known is true", r.known, true);
    return ask("how does gravity work", { seed: 1, useContext: false });
  }).then(function (r) {
    eq("gravity -> gravity entry", r.concept, "gravity");
    return ask("how do i save money", { seed: 1, useContext: false });
  }).then(function (r) {
    eq("money -> money entry", r.concept, "budget");
    return ask("kumusta ka", { seed: 1, useContext: false });
  }).then(function (r) {
    eq("greeting -> greeting entry", r.concept, "greeting");
    eq("Bisaya detected", r.requestLang, "bisaya");
  });

}).then(function () {

  section(4, "and it refuses rather than inventing");
  return ask("who won the 2019 basketball world cup", { seed: 1, useContext: false }).then(function (r) {
    eq("out of scope is not answered", r.known, false);
    eq("a refusal carries no entry", r.entryId, null);
    ok("the refusal is a real sentence", r.text.length > 40, r.text.slice(0, 40));
    ok("and admits the limit", /do not have|outside what i know/i.test(r.text));
  });

}).then(function () {

  section(5, "honest metadata");
  /* The bank is English. Reporting the request language over an
     English paragraph would be a small lie downstream code trusts. */
  return ask("kumusta ka", { seed: 1, useContext: false }).then(function (r) {
    eq("a Bisaya question is detected as Bisaya", r.requestLang, "bisaya");
    eq("but the English answer is reported as English", r.lang, "english");
  });

}).then(function () {

  section(6, "the verbose model");
  return ask("kumusta ka", { seed: 1, translate: true, useContext: false }).then(function (r) {
    ok("labels the real language first", /^\*\*Bisaya\*\*/.test(r.text), r.text.slice(0, 40));
    ok("adds English", /\*\*English\*\*/.test(r.text));
    ok("adds Tagalog", /\*\*Tagalog\*\*/.test(r.text));
  });

}).then(function () {

  section(7, "streaming");
  return streamAll(provider.stream("what is javascript", { seed: 1, useContext: false })).then(function (chunks) {
    ok("it yields several chunks", chunks.length > 3, chunks.length);
    ok("they rejoin into the answer", chunks.join("").indexOf("JavaScript") !== -1);
    ok("no chunk is empty", chunks.every(function (c) { return c.length > 0; }));

    /* The typing animation. These used to be fixed 18-character slabs at a
       fixed 8ms, which painted the whole reply in under a tenth of a
       second - text teleporting, with nothing that read as typing. */
    return ask("what is javascript", { seed: 1, useContext: false }).then(function (r) {
      eq("chunks rejoin into the exact answer", chunks.join(""), r.text);

      /* Never split mid-word: a half word arriving alone is the clearest
         possible tell that output is a slab, not a person typing. */
      var pos = 0, midWord = [];
      chunks.forEach(function (c) {
        if (pos > 0 && !/\s/.test(r.text.charAt(pos - 1))) midWord.push(pos);
        pos += c.length;
      });
      eq("no split lands inside a word", midWord.length, 0);

      /* Granularity. A 53-word answer as 25 bursts is a readable rhythm;
       the same text as one or two chunks is a paste. */
      var words = r.text.trim().split(/\s+/).length;
      ok("it types in many small bursts, not one slab",
         chunks.length >= Math.ceil(words / 4), chunks.length + " chunks for " + words + " words");
      ok("no burst is a whole paragraph",
         chunks.every(function (c) { return c.length <= 60; }),
         Math.max.apply(null, chunks.map(function (c) { return c.length; })));

      /* Punctuation has to change the rhythm, or it is not typing. Asserted
         through the pure helper so the result is exact, not timed. */
      var p = provider._pauseAfter;
      ok("a full stop pauses longest",
         p("end. ", "k", 0) > p("end ", "k", 0) + 80,
         p("end. ", "k", 0) + " vs " + p("end ", "k", 0));
      ok("a comma pauses more than a plain word",
         p("end, ", "k", 0) > p("end ", "k", 0) + 30,
         p("end, ", "k", 0) + " vs " + p("end ", "k", 0));
      ok("no pause is ever negative", p("x ", "k", 7) >= 0, p("x ", "k", 7));

      /* The rhythm varies, but reproducibly - a seeded reply must not turn
         into a different one because of Math.random(). */
      var pauses = [];
      for (var s = 0; s < 12; s++) pauses.push(p("word ", "seed-key", s));
      ok("pauses vary between bursts", new Set(pauses).size > 1, pauses.join(","));
      var again = [];
      for (var s2 = 0; s2 < 12; s2++) again.push(p("word ", "seed-key", s2));
      eq("and repeat exactly for the same text", again.join(","), pauses.join(","));

      /* The Stop button passes a signal through; a reply that ignores it
         keeps typing after the user has already given up on it. */
      var ac = new AbortController();
      var seen = 0;
      var it = provider.stream("what is javascript", { seed: 1, useContext: false, signal: ac.signal });
      return (function pump() {
        return it.next().then(function (step) {
          if (step.done) return seen;
          seen++;
          ac.abort();
          return pump();
        });
      })().then(function (got) {
        ok("it stops when the signal aborts", got <= 3, "kept going for " + got + " chunks after abort");
      });
    });
  });

}).then(function () {

  section(8, "context does not leak");
  /* A greeting asked right after a history question used to come back
     with the history entry, because an unrelated question was being
     treated as a follow-up. */
  provider.reset();
  return ask("when did the philippines get independence", { seed: 1 })
    .then(function () { return ask("kumusta ka", { seed: 1 }); })
    .then(function (r) {
      eq("an unrelated question ignores the last topic", r.entryId, "conv-greeting");
      provider.reset();
      return ask("what is javascript", { seed: 1 });
    })
    .then(function () { return ask("tell me more", { seed: 1 }); })
    .then(function (r) {
      ok("but a real follow-up keeps it", r.known === true, r.text.slice(0, 50));
      provider.reset();
    });

}).then(function () {

  section(9, "the wiring in index.html");
  var chk = require("child_process").spawnSync(
    process.execPath, [path.join(ROOT, "tools/build-data.js"), "--check"], { encoding: "utf8" });
  ok("data/bundle.js matches data/*.json", chk.status === 0, (chk.stdout || chk.stderr || "").trim());

  /* Existence, not substrings. A tag in index.html is only meaningful
     if the file behind it is there, and "is the file there" is the
     half that actually breaks. (String-matching the HTML also proved
     unreliable here: the same file read two different ways disagreed
     about which lines it contained, which is worth knowing and not
     worth a test.) */
  var need = ["bokskie-v1/data/bundle.js", "bokskie-v1/engine/tokenizer.js",
              "bokskie-v1/engine/similarity.js", "bokskie-v1/engine/intent.js",
              "bokskie-v1/engine/context.js", "bokskie-v1/engine/kb.js",
              "bokskie-v1/engine/generator.js", "bokskie-v1/engine/index.js",
              "bokskie-v1/src/provider.js"];
  var missing = need.filter(function (rel) {
    return !fs.existsSync(path.join(ROOT, "..", rel.replace(/\//g, path.sep)));
  });
  eq("every file the page needs exists", missing.length, 0);
  if (missing.length) console.log("        missing: " + missing.join(", "));

  var html = fs.readFileSync(path.join(ROOT, "..", "index.html"), "utf8");
  ok("index.html no longer loads the old banks", html.indexOf("src/banks/") === -1);
  ok("index.html no longer loads the composer", html.indexOf("src/composer.js") === -1);

  console.log("\n" + new Array(62, "=").join("="));
  console.log("  bokskie.v1 provider:  " + pass + " passed, " + fail + " failed");
  console.log(new Array(62, "=").join("="));
  process.exit(fail ? 1 : 0);

  console.log("ERROR " + (err && err.stack ? err.stack : err));
  process.exit(1);
});
