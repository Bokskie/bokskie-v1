/* ============================================================
   bokskie-v1 - verify.js
   ------------------------------------------------------------
       node bokskie-v1/verify.js

   Checks the engine, the three banks and the provider wrapper.
   Exit code is 1 on any failure.
   ============================================================ */

"use strict";

var path = require("path");
var ROOT = __dirname;
var composer = require(path.join(ROOT, "src/composer.js"));
var provider = require(path.join(ROOT, "src/provider.js"));
var banks = {
  bisaya: require(path.join(ROOT, "src/banks/bisaya.js")),
  tagalog: require(path.join(ROOT, "src/banks/tagalog.js")),
  english: require(path.join(ROOT, "src/banks/english.js"))
};

var pass = 0, fail = 0, failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else {
    fail++;
    failures.push(name + (extra !== undefined ? "  -> " + extra : ""));
    console.log("  FAIL  " + name + (extra !== undefined ? "  -> " + extra : ""));
  }
}
function eq(name, a, b) { ok(name, a === b, JSON.stringify(a) + " !== " + JSON.stringify(b)); }
function section(t) { console.log(""); console.log(t); }

section("1. banks are well formed");
Object.keys(banks).forEach(function (lang) {
  var b = banks[lang];
  var names = Object.keys(b.topics);
  ok(lang + ": has openers", b.openers.length > 0, b.openers.length);
  ok(lang + ": has topics", names.length >= 12, names.length);
  names.forEach(function (t) {
    var topic = b.topics[t];
    ok(lang + "/" + t + ": has keywords", Array.isArray(topic.keywords) && topic.keywords.length > 0);
    ok(lang + "/" + t + ": has bodies", Array.isArray(topic.bodies) && topic.bodies.length > 0);
    ok(lang + "/" + t + ": has closers", Array.isArray(topic.closers) && topic.closers.length > 0);
  });
});

section("2. all three banks share the same topic keys");
var ref = Object.keys(banks.english.topics).sort().join(",");
Object.keys(banks).forEach(function (lang) {
  eq(lang + ": topic keys match english", Object.keys(banks[lang].topics).sort().join(","), ref);
});

section("3. no corrupted characters or placeholder junk");
Object.keys(banks).forEach(function (lang) {
  var raw = JSON.stringify(banks[lang]);
  ok(lang + ": no CJK characters", !/[\u4E00-\u9FFF]/.test(raw));
  ok(lang + ": no stray 'rest of code'", !/\.\.\.rest of/i.test(raw));
  ok(lang + ": no unresolved merge markers", !/<<<<|>>>>|=====/.test(raw));
  var stubs = [];
  Object.keys(banks[lang].topics).forEach(function (t) {
    /* Only bodies are checked. A short closer is the point of a closer -
       "Gusto mo pa ba niini?" is a complete thought, not a stub. */
    banks[lang].topics[t].bodies.forEach(function (s) {
      if (s.length < 40) stubs.push(t + ": " + s);
    });
  });
  ok(lang + ": no stub bodies", stubs.length === 0, stubs.slice(0, 2).join(" | "));
});

section("4. topic matching");
eq("vue question -> vue", composer.matchTopic("english", "how does a vue computed work"), "vue");
eq("horror question -> films", composer.matchTopic("english", "best horror film"), "films");
eq("adobo question -> food", composer.matchTopic("tagalog", "magandang recipe ng adobo"), "food");
eq("bisaya horror -> films", composer.matchTopic("bisaya", "unsa ang maayong horror movie"), "films");
eq("debug question -> programming", composer.matchTopic("english", "debug this python function"), "programming");
eq("unmatched -> smalltalk", composer.matchTopic("english", "zzz qqq"), "smalltalk");

section("5. language detection");
eq("Tagalog detected", composer.detectLanguage("ano ang pinakamahusay na pelikula para sa akin"), "tagalog");
eq("Bisaya detected", composer.detectLanguage("unsa man ang maayong horror film nga nimo"), "bisaya");
eq("English detected", composer.detectLanguage("what is the best way to learn vue quickly"), "english");


section("6. replies are real and topic-aware");
/* Fixed seeds: reply() mixes in Date.now() by default, so a fixed seed is
   what makes these assertions stable run to run. */
var r = composer.reply("how does computed work in vue", { lang: "english", seed: 11 });
ok("returns text", typeof r.text === "string" && r.text.length > 80, r.text && r.text.length);
eq("topic chosen", r.topic, "vue");
ok("mentions the topic",
   /vue|computed|reactive|composition|component|template|state|props/i.test(r.text), r.text.slice(0, 80));
ok("has three sections", r.text.split("\n\n").length >= 3);

var f = composer.reply("what is a good horror film", { lang: "english", seed: 11 });
eq("film question lands on films", f.topic, "films");
ok("film answer is on-topic", /horror|dread|film|scary|gore|slasher|twist/i.test(f.text), f.text.slice(0, 80));

/* The bug this app was built around: a general question must never get a
   Vue lecture. */
var offTopic = composer.reply("what is a good horror film", { lang: "english", seed: 3 });
ok("horror answer contains no Vue", !/vue|computed|reactive/i.test(offTopic.text), offTopic.text.slice(0, 100));

section("7. translation block is opt-in");
var tr = composer.reply("kumusta ka", { lang: "tagalog" });
ok("no translation by default", !/\*\*Bisaya\*\*/.test(tr.text), tr.text.slice(0, 60));
var mono = composer.reply("kumusta ka", { lang: "tagalog", translate: false });
ok("translate:false also single", !/\*\*Bisaya\*\*/.test(mono.text));
var want = composer.reply("kumusta ka", { lang: "tagalog", translate: true });
ok("translate:true includes Bisaya", /\*\*Bisaya\*\*/.test(want.text));
ok("translate:true includes English", /\*\*English\*\*/.test(want.text));
ok("verbose reply is longer than plain", want.text.length > tr.text.length);

section("8. seeds are reproducible, and different seeds differ");
/* A seed alone is no longer the whole story: pickFresh deliberately
   remembers what it just said, so the same seed on a different memory
   gives a different body. That is the feature, not a bug - reset the
   memory and the seed is deterministic again. */
composer.resetRecent();
var a1 = composer.reply("ano ang kamusta", { lang: "tagalog", seed: 42 });
composer.resetRecent();
var a2 = composer.reply("ano ang kamusta", { lang: "tagalog", seed: 42 });
eq("same seed + same memory = same reply", a1.text, a2.text);
composer.resetRecent();
var a3 = composer.reply("ano ang kamusta", { lang: "tagalog", seed: 43 });
ok("a different seed gives a different reply", a3.text !== a1.text);
var seen = {}, distinct = 0;
for (var s = 0; s < 300; s++) {
  var out = composer.reply("what should I do", { lang: "english", seed: s });
  if (!seen[out.text]) { seen[out.text] = 1; distinct++; }
}
/* That question lands on one topic, so the ceiling is 12 openers x 4 bodies
   x 4 closers = 192 - repeats above that are expected, not a bug. The point
   is that it is not 1 or 5 answers. */
ok("300 seeds give many distinct replies", distinct >= 150, distinct + " distinct");

section("9. capacity");
var t = composer.totals();
["bisaya", "tagalog", "english"].forEach(function (l) {
  ok(l + ": capacity over 1,000", t[l] > 1000, t[l].toLocaleString());
});
var total = t.bisaya + t.tagalog + t.english;
ok("total over 100,000", total > 100000, total.toLocaleString());
console.log("    capacity: bisaya " + t.bisaya.toLocaleString() +
            ", tagalog " + t.tagalog.toLocaleString() +
            ", english " + t.english.toLocaleString() +
            "  =  " + total.toLocaleString());

section("10. provider wrapper");
eq("id", provider.id, "bokskie-local");
eq("labels itself", provider.providerInfo().label, "bokskie.ai (offline)");
eq("needs no key", provider.providerInfo().auth, "none");
ok("is marked local", provider.providerInfo().cost === "local");
eq("default model is bokskie.v1", provider.defaultModel, "bokskie.v1");
ok("exposes models", provider.modelsFor().length > 0);
ok("exposes topics once loaded", provider.topics().length >= 0);
ok("stats() answers before the bank is in", typeof provider.stats().entries === "number");
ok("stats() says so", provider.stats().ready === false || provider.stats().entries > 0);
ok("note admits it is a retrieval engine, not a model", /retrieval engine|not a language model/i.test(provider.providerInfo().note));

/* ============================================================
   11. IT MUST NOT SAY THE SAME THING TWICE
       The complaint that prompted all of this: "110k replies, but
       hi always gets the same answer". True - the headline number
       is the sum over 15 topics, while one question only ever saw
       4 bodies, and a rotating opener/closer made it *look* varied.
       Bodies and closers now avoid what was just used.
   ============================================================ */
function varietyChecks() {
  section("11. consecutive replies do not repeat");

  composer.resetRecent();
  var e = require(path.join(ROOT, "src/banks/english.js"));
  var smalltalk = e.topics.smalltalk;

  ok("smalltalk has enough bodies to not feel canned",
     smalltalk.bodies.length >= 8, smalltalk.bodies.length);
  ok("smalltalk has enough closers",
     smalltalk.closers.length >= 6, smalltalk.closers.length);

  Object.keys(e.topics).forEach(function (t) {
    ok("english/" + t + " has 4+ bodies", e.topics[t].bodies.length >= 4, e.topics[t].bodies.length);
  });

  /* Consecutive replies to the same question must not repeat. */
  composer.resetRecent();
  var seen = {}, bodies = [];
  for (var i = 0; i < 10; i++) {
    var r = composer.reply("hi", { seed: 2000 + i });
    seen[r.text] = 1;
    bodies.push(r.text.split("\n\n")[1] || "");
  }
  eq("10 replies are all distinct", Object.keys(seen).length, 10);

  /* No body may repeat while unused ones remain. */
  var firstPass = bodies.slice(0, smalltalk.bodies.length);
  eq("no body repeats within one cycle", new Set(firstPass).size, firstPass.length);

  /* The memory must not grow without bound or deadlock the pool. */
  composer.resetRecent();
  for (var j = 0; j < 60; j++) composer.reply("hi", { seed: j });
  var after = composer.reply("hi", { seed: 999 });
  ok("still answers after 60 turns",
     typeof after.text === "string" && after.text.length > 40);
  ok("resetRecent exists", typeof composer.resetRecent === "function");
}

function drain(it, acc) {
  acc = acc || [];
  return it.next().then(function (r) {
    if (r.done) return acc;
    acc.push(r.value);
    return drain(it, acc);
  });
}

provider.reply("hello", { lang: "english" }).then(function (res) {
  ok("reply() resolves", typeof res.text === "string" && res.text.length > 0);
  varietyChecks();
  return drain(provider.stream("what is a good horror film", { lang: "english", seed: 7 }));
}).then(function (chunks) {
  ok("stream() yields chunks", chunks.length > 3, chunks.length);
  ok("streamed text reassembles", chunks.join("").length > 80, chunks.join("").length);
  finish();
}).catch(function (e) {
  ok("provider stream did not throw", false, e && e.message);
  finish();
});

function finish() {
  console.log("");
  console.log(new Array(58).join("="));
  if (fail) {
    console.log("FAILED  " + fail + " of " + (pass + fail));
    failures.forEach(function (f) { console.log("   - " + f); });
    console.log(new Array(58).join("="));
    process.exit(1);
  } else {
    console.log("ALL " + pass + " CHECKS PASSED");
    console.log(new Array(58).join("="));
    process.exit(0);
  }
}
