/* ============================================================
   bokskie-v1 · tools/build-kb.js
   ------------------------------------------------------------
   Turns tools/source/*.kb into data/*.json.

     node bokskie-v1/tools/build-kb.js              # build every shelf
     node bokskie-v1/tools/build-kb.js geography     # build one shelf
     node bokskie-v1/tools/build-kb.js --check      # report, write nothing

   WHY A GENERATOR INSTEAD OF HAND-WRITTEN JSON
   --------------------------------------------
   A thousand entries per shelf is not a file anyone can maintain by
   hand, and hand-maintaining one invites the exact failure this whole
   project is built to avoid: near-duplicate rows that look like
   coverage and quietly lower precision until the refusal threshold
   stops meaning anything.

   So the knowledge lives in tools/source/<shelf>.kb as one dense line
   per genuinely distinct fact, and this expands it. One line in, one
   entry out - which makes "are these actually different?" a question
   you answer by counting lines.

   SOURCE FORMAT - pipe-separated, '#' starts a comment

     concept | intent | answer | keywords | patterns | tl | bis

     1 concept  the subject. Also the primary retrieval keyword, and
                what conversation memory reports back as "the topic
                you were discussing" - so write it the way a person
                would name the thing, not the way a database would.
     2 intent   definition | howto | why | compare | price | list.
                Defaults to definition when the field is empty.
     3 answer   the knowledge, and the only field that carries facts.
                Write every sentence to be true standing on its own,
                because `variations` is built by re-entering the same
                facts from a different first sentence (see below).
     4 keywords comma-separated extras. Single words only - a phrase
                can never match a token, so phrases belong in patterns.
     5 patterns comma-separated real questions. "what is X" and
                friends are generated for you; add the phrasings a
                person would actually type.
     6 tl       Tagalog word for the concept, when there is one. This
                is a bridge, not decoration: it lets a Tagalog question
                reach an entry whose keywords are English.
     7 bis      Bisaya word for the concept, likewise.
     8 tlAnswer the same answer written in Tagalog. No pipes.
     9 bisAnswer the same answer written in Bisaya. No pipes.
    10 confidence  below 1 makes the generator prepend a caveat instead
                of asserting the claim. Use it when the evidence really
                is mixed; a shelf where everything is 1.0 is metadata
                that looks like curation and is not.
    11 source   where the claim comes from. Required to be meaningful on
                health rows, good practice everywhere else.
   ============================================================ */

"use strict";

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "source");
var OUT = path.join(__dirname, "..", "data");

/* The shelf list is DATA, in tools/shelves.js, and shared with the
   validator and the router. It used to be duplicated in three files,
   which meant adding a category meant editing all three and a miss
   produced a shelf that built fine and could never be routed to. */
var REG = require("./shelves.js");
var SHELVES = Object.create(null);
REG.shelves.forEach(function (s) {
  SHELVES[s.id] = {
    prefix: s.prefix, topic: s.topic, group: s.group, sub: s.sub,
    lang: s.lang, title: s.title, groupTitle: s.groupTitle
  };
});


/* Words that carry no retrieval signal. Mirrors the tokenizer's own
   stop list closely enough for keyword extraction, without importing
   it - the builder runs before the engine is loaded, and a stale copy
   that silently drifted would be worse than a slightly wider one. */
var NOISE = {
  a: 1, an: 1, the: 1, is: 1, are: 1, was: 1, were: 1, be: 1, been: 1, of: 1,
  to: 1, in: 1, on: 1, at: 1, for: 1, with: 1, about: 1, from: 1, and: 1, or: 1,
  but: 1, if: 1, so: 1, as: 1, it: 1, its: 1, this: 1, that: 1, these: 1,
  those: 1, i: 1, you: 1, he: 1, she: 1, we: 1, they: 1, me: 1, my: 1, your: 1,
  do: 1, does: 1, did: 1, can: 1, could: 1, would: 1, should: 1, will: 1,
  may: 1, might: 1, have: 1, has: 1, had: 1, there: 1, here: 1, what: 1,
  which: 1, who: 1, when: 1, where: 1, why: 1, how: 1, all: 1, any: 1, some: 1,
  each: 1, more: 1, most: 1, other: 1, such: 1, no: 1, not: 1, only: 1, own: 1,
  same: 1, too: 1, very: 1, just: 1, get: 1, got: 1, tell: 1, please: 1,
  thanks: 1, than: 1, then: 1, also: 1, into: 1, out: 1, up: 1, down: 1,
  over: 1, under: 1, through: 1, by: 1, their: 1, them: 1, his: 1, her: 1,
  whom: 1, whose: 1,
  /* Generic verbs and filler that survive the first pass and end up as
     keywords nobody searches for. "made", "called", "known" were being
     harvested straight out of the answers. */
  made: 1, make: 1, making: 1, often: 1, usually: 1, called: 1, known: 1,
  among: 1, between: 1, during: 1, while: 1, although: 1, however: 1,
  because: 1, though: 1, still: 1, even: 1, much: 1, many: 1, less: 1,
  least: 1, well: 1, way: 1, thing: 1, things: 1, part: 1, parts: 1,
  kind: 1, sort: 1, form: 1, case: 1, point: 1, used: 1, using: 1,
  based: 1, set: 1, put: 1, like: 1, need: 1, needs: 1, come: 1, came: 1,
  goes: 1, went: 1, say: 1, said: 1, see: 1, seen: 1, take: 1, took: 1,
  give: 1, given: 1, find: 1, found: 1, keep: 1, kept: 1, let: 1, lets: 1
};

var INTENTS = {
  definition: 1, howto: 1, why: 1, compare: 1, price: 1, list: 1,
  location: 1, time: 1, person: 1
};

/* Concepts that contain a space. Reported after every build rather than
   rejected, because a two-word subject is sometimes genuinely the right
   name - it just needs a single distinctive word in `keywords` to index
   and report on. */
var MULTIWORD = [];

/* ---- source parsing ------------------------------------------ */

function splitFields(line) {
  var out = [], cur = "";
  for (var i = 0; i < line.length; i++) {
    if (line[i] === "|") { out.push(cur.trim()); cur = ""; }
    else cur += line[i];
  }
  out.push(cur.trim());
  return out;
}

function readSource(shelf) {
  /* source/<group>/<sub>.kb - one directory per group, so the source
     tree looks the same as the tree it becomes. */
  var p = path.join(SRC, shelf.group, shelf.sub + ".kb");
  if (!fs.existsSync(p)) return null;
  var lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
  var rows = [], n = 0;
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i].trim();
    if (!raw || raw.charAt(0) === "#") continue;
    n++;
    var f = splitFields(raw);
    var concept = f[0];
    var intent = (f[1] || "definition").toLowerCase();
    var answer = f[2] || "";
    if (!concept) { rows.push({ _error: "line " + n + ": no concept" }); continue; }
    if (!INTENTS[intent]) intent = "definition";
    if (!answer) { rows.push({ _error: "line " + n + " (" + concept + "): no answer" }); continue; }
    if (answer.length < 40) {
      rows.push({ _error: "line " + n + " (" + concept + "): answer is " + answer.length +
                            " chars - too thin to be worth indexing" });
      continue;
    }
    rows.push({
      concept: concept,
      intent: intent,
      answer: answer,
      keywords: f[3] ? f[3].split(",").map(function (x) { return x.trim(); }).filter(Boolean) : [],
      patterns: f[4] ? f[4].split(",").map(function (x) { return x.trim(); }).filter(Boolean) : [],
      tl: f[5] || "",
      bis: f[6] || "",
      /* The answer in the other two languages. Worth writing, because
         without it the engine serves English to someone who asked in
         Tagalog, and `answerLang` then honestly reports "english" -
         accurate, and still not much use to the person asking. */
      langs: (f[7] || f[8]) ? { tagalog: f[7] || undefined, bisaya: f[8] || undefined } : null,
      /* Author confidence. Below 1 makes the generator prepend a caveat
         instead of stating the claim as fact, which is how an honestly
         uncertain entry stays uncertain all the way to the user
         instead of only in the data. */
      confidence: (f[9] !== undefined && f[9] !== "") ? parseFloat(f[9]) : 1,
      source: f[10] || ""
    });
  }
  return rows;
}

/* ---- entry construction -------------------------------------- */

function significantWords(text, limit) {
  var seen = Object.create(null), out = [];
  var parts = String(text).toLowerCase().split(/[^a-z0-9'\u00C0-\u024F]+/);
  for (var i = 0; i < parts.length; i++) {
    var w = parts[i].replace(/^'+|'+$/g, "");
    if (w.length < 4 || NOISE[w] || seen[w]) continue;
    seen[w] = 1;
    out.push(w);
    if (limit && out.length >= limit) break;
  }
  return out;
}

/* Questions a person actually types about a thing. Deliberately few
   and genuinely natural - a pile of templated variations would add
   index weight without adding a single reachable phrasing. */
function defaultPatterns(concept) {
  var c = concept.toLowerCase();
  return ["what is " + c, c, "explain " + c, "definition of " + c, c + " meaning"];
}

/* Re-enter the same facts from a different first sentence.

   Same knowledge, different entry point. Capped at two, and skipped
   for a short single-sentence answer, because a one-line "variation"
   that repeats the answer verbatim is worse than none: it inflates the
   entry count without adding a reachable phrasing. */
function buildVariations(answer) {
  var m = answer.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!m) return [];
  var flat = m.map(function (s) { return s.trim(); }).filter(Boolean);
  if (flat.length < 2) return [];
  var body = flat.join(" ");
  if (body.length < 160) return [];
  var out = [];
  for (var i = 1; i < flat.length && out.length < 2; i++) {
    var rotated = [flat[i]].concat(flat.slice(0, i), flat.slice(i + 1)).join(" ");
    if (rotated !== body) out.push(rotated);
  }
  return out;
}

function buildEntry(row, shelf, index) {
  var idNum = String(index + 1);
  while (idNum.length < 6) idNum = "0" + idNum;

  var keywords = [];
  var autoSet = Object.create(null);   /* harvested, not authored */
  function add(w, auto) {
    if (!w) return;
    w = String(w).trim();
    if (!w) return;
    for (var i = 0; i < keywords.length; i++) {
      if (keywords[i].toLowerCase() === w.toLowerCase()) return;
    }
    keywords.push(w);
    if (auto) autoSet[w.toLowerCase()] = 1;
  }

  add(row.concept);
  for (var k = 0; k < row.keywords.length; k++) add(row.keywords[k]);
  if (row.tl) add(row.tl);
  if (row.bis) add(row.bis);
  /* A few content words from the answer itself. These are the words a
     user reaches for when they cannot name the concept, and they cost
     little in precision because TF-IDF keeps a term shared by hundreds
     of entries from carrying a query on its own.

     Marked `auto` so pruneCommonKeywords can drop the ones that turn out
     to be shared, which is the case this actually needed. */
  var extra = significantWords(row.answer, 6);
  for (var e = 0; e < extra.length; e++) add(extra[e], true);

  /* A phrase can never match a token, so a multi-word keyword is an
     index key that nothing can ever hit - kb.add() drops it silently.
     Better to refuse it here, where the author can see why their
     carefully written phrase is doing nothing, and move it to
     patterns where it will actually match something.

     Index 0 is EXEMPT, and that exemption is load-bearing. This filter
     originally ran over the whole list, which quietly deleted any
     multi-word concept and promoted whatever keyword happened to be
     next into first place. Five history rows ended up with "japan" or
     "paris" as their subject - a collision with the geography shelf,
     and a wrong answer to "what were we discussing". Worse, it was
     invisible: the entry still worked, it just answered as the wrong
     thing. */
  keywords = keywords.filter(function (w, i) { return i === 0 || !/\s/.test(w); });


  /* And say so, because a multi-word concept is a design mistake even
     though it is now survivable: it cannot be a bridge target, and
     conversation memory reports it as the topic the user was
     discussing, where "the treaty of paris" is useful and "paris" is
     not. */
  if (/\s/.test(keywords[0])) MULTIWORD.push(row.concept);

  /* Which of these were harvested rather than authored, so the shelf-wide
     pass in build() can drop the ones that turn out to be background
     words. Computed here because `keywords` is final only after the
     phrase filter above. */
  var autoWords = keywords.filter(function (w) { return autoSet[w.toLowerCase()]; });

  var patterns = defaultPatterns(row.concept);
  for (var p = 0; p < row.patterns.length; p++) {
    if (patterns.indexOf(row.patterns[p]) === -1) patterns.push(row.patterns[p]);
  }
  /* Ask it the way a Filipino or Bisaya speaker would, when we know
     the word. The tokenizer's bridge is what makes these reachable. */
  if (row.tl) patterns.push("ano ang " + row.tl);
  if (row.bis) patterns.push("unsa ang " + row.bis);

  var entry = {
    id: shelf.prefix + "-" + idNum,
    topic: shelf.topic,
    intent: row.intent,
    /* The concept, carried on the entry as well as implied by keywords[0].
       Ids are positional: insert a line at the top of the .kb file and
       every id below it renumbers. Tests that assert on an id then break
       for no reason and get "fixed" by hardcoding the new number, which
       is how a test suite slowly becomes a liability. `concept` is
       stable under reordering, so it is what anything outside the
       builder should assert on. */
    concept: row.concept,
    keywords: keywords,
    patterns: patterns,
    answer: row.answer,
    variations: buildVariations(row.answer)
  };
  if (row.tl) entry.tl = row.tl;
  if (row.bis) entry.bis = row.bis;
  entry._auto = autoWords;
  if (row.langs) {
    entry.langs = {};
    if (row.langs.tagalog) entry.langs.tagalog = row.langs.tagalog;
    if (row.langs.bisaya) entry.langs.bisaya = row.langs.bisaya;
    if (!entry.langs.tagalog && !entry.langs.bisaya) entry.langs = null;
  }
  if (row.source) entry.source = row.source;
  if (row.confidence !== 1) entry.confidence = row.confidence;
  return entry;
}

/* ---- duplicate detection -------------------------------------- */

function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/* Catches the two ways a bank rots: the same concept twice under two
   ids, and the same knowledge reworded enough that neither an id check
   nor a human skimming the file would notice. Both compare on a
   normalised form, because "the Philippines" and "Philippines" must
   collide - and so must two entries that answer the same question in
   different words. */
/* Drop harvested keywords that turn out to be shared across the shelf.

   An auto-harvested keyword is a word the author did not choose, and
   most are good: they are the words a person reaches for when they
   cannot name the concept. But some are background vocabulary that
   happens to be in the sentence, and those are actively harmful.

   The concrete case: the new `cell` entry says "a cell is the smallest
   unit of life", so `life` was harvested as a keyword. A query for
   "what is the meaning of life" then matched it on that one shared
   abstract word and scored 0.349 - over the 0.34 bar - and the engine
   answered a question about existence with a definition of a cell.
   Growing the bank made that possible, which is the risk the refusal
   threshold exists to manage.

   A word appearing in a large share of a shelf is background, not a
   discriminator, so harvested instances of it get dropped. Authored
   keywords are never touched: if someone typed `life` deliberately on a
   health row, that is a decision and not an accident. */
function pruneCommonKeywords(entries, maxShare) {
  if (entries.length < 6) return 0;
  var df = Object.create(null);
  for (var i = 0; i < entries.length; i++) {
    var auto = entries[i]._auto || [];
    for (var j = 0; j < auto.length; j++) {
      var w = auto[j].toLowerCase();
      df[w] = (df[w] || 0) + 1;
    }
  }
  var limit = Math.max(2, Math.round(entries.length * (maxShare || 0.25)));
  var dropped = 0;
  for (i = 0; i < entries.length; i++) {
    var e = entries[i];
    var mine = Object.create(null);
    e._auto.forEach(function (w) { mine[w.toLowerCase()] = 1; });
    e.keywords = e.keywords.filter(function (w) {
      /* Only a word THIS entry harvested can be dropped, never one
         this entry was given. The old test was the df threshold alone,
         and df is pooled across the whole shelf - so a word that other
         rows happened to harvest also removed it from the row that
         authored it as its subject. `database` is harvested by four
         rows of the sql shelf, which dropped it from the `database`
         entry itself and promoted `sql` into keywords[0], so that
         entry then answered as though it were about SQL. This is the
         same failure the multi-word filter documents above: a wrong
         subject is a wrong answer, and memory reports the wrong topic. */
      if (mine[w.toLowerCase()] === undefined) return true;
      if (df[w.toLowerCase()] > limit) { dropped++; return false; }
      return true;
    });
  }
  return dropped;
}

function findDuplicates(entries) {
  var byId = Object.create(null);
  var byConcept = Object.create(null);
  var byAnswer = Object.create(null);
  var dupIds = [], dupConcepts = [], dupAnswers = [];

  entries.forEach(function (e) {
    if (byId[e.id]) dupIds.push(e.id);
    byId[e.id] = 1;

    var c = norm(e.concept || (e.keywords && e.keywords[0]) || "");
    if (c && byConcept[c]) dupConcepts.push(e.id + " == " + byConcept[c] + "  (" + c + ")");
    else byConcept[c] = e.id;

    var sig = significantWords(e.answer, 10).sort().join(" ");
    if (sig && byAnswer[sig]) dupAnswers.push(e.id + " == " + byAnswer[sig]);
    else byAnswer[sig] = e.id;
  });
  return { ids: dupIds, concepts: dupConcepts, answers: dupAnswers };
}

/* ---- main ----------------------------------------------------- */

function build(name) {
  var shelf = SHELVES[name];
  if (!shelf) { console.error("unknown shelf: " + name); return { name: name, status: "error" }; }
  MULTIWORD = [];
  var rows = readSource(shelf);
  if (!rows) {
    /* A declared shelf with no .kb yet is NOT a build failure. The
       registry describes the whole tree - 148 categories - and most
       of them are written gradually; treating an unwritten one as an
       error meant `build-kb.js` exited 1 and reported 98 failures on
       a perfectly healthy bank, so nobody could tell a real problem
       from an empty shelf. The engine is fine with this: the shelf
       routes, finds nothing, and refuses honestly. Use --strict when
       you want the tree fully written. */
    return { name: name, status: "empty", count: 0, kb: 0 };
  }

  var errors = rows.filter(function (r) { return r._error; });
  var good = rows.filter(function (r) { return !r._error; });
  errors.forEach(function (r) { console.error("  " + name + ": " + r._error); });
  if (errors.length) {
    console.error("  " + name + ": " + errors.length + " bad source lines, shelf not written");
    return null;
  }

  var entries = good.map(function (r, i) { return buildEntry(r, shelf, i); });
  var pruned = pruneCommonKeywords(entries);
  for (var pz = 0; pz < entries.length; pz++) delete entries[pz]._auto;
  if (pruned) {
    console.log("  " + name + ": dropped " + pruned + " background keyword(s) shared by over 25% of the shelf");
  }
  if (MULTIWORD.length) {
    console.warn("  note: " + MULTIWORD.length + " multi-word concept(s) in " + name +
                 " - they cannot be a bridge target and memory reports them verbatim:");
    MULTIWORD.forEach(function (m) { console.warn("        " + m); });
  }
  var dups = findDuplicates(entries);
  if (dups.ids.length || dups.concepts.length || dups.answers.length) {
    dups.ids.forEach(function (x) { console.error("  " + name + ": duplicate id " + x); });
    dups.concepts.forEach(function (x) { console.error("  " + name + ": duplicate concept " + x); });
    dups.answers.forEach(function (x) { console.error("  " + name + ": near-duplicate " + x); });
    console.error("  " + name + ": refusing to write a shelf with duplicates");
    return null;
  }

  var doc = { topic: shelf.topic, entries: entries };
  /* `lang`, `group` and `sub` go into the file so the browser and the
     validator can tell a Bisaya shelf from an English one without
     consulting tools/shelves.js, which does not load in a browser. */
  doc.lang = shelf.lang || "english";
  doc.group = shelf.group || null;
  doc.sub = shelf.sub || null;
  /* The display names travel too, so the tree in tools/shelves.js can be
     rendered by a UI without hardcoding a second copy of every label. */
  doc.title = shelf.title || null;
  doc.groupTitle = shelf.groupTitle || null;
  var text = JSON.stringify(doc, null, 2) + "\n";
  /* Written as valid JSON or not at all. A truncated write is how a
     bank quietly loses 900 entries and nobody notices for a month. */
  JSON.parse(text);
  /* data/<group>/<sub>.json. The directory is created on demand, so
     adding a shelf needs no mkdir and no .gitkeep. */
  var dir = path.join(OUT, shelf.group);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, shelf.sub + ".json"), text);
  return { name: name, count: entries.length, kb: Math.round(text.length / 1024) };
}

var args = process.argv.slice(2).filter(function (a) { return a.charAt(0) !== "-"; });
var checkOnly = process.argv.indexOf("--check") !== -1;
/* Fail the build when a declared shelf has no source yet. Off by
   default, because the registry is the full tree and is meant to be
   filled in gradually; on when a release should not ship with empty
   categories. */
var STRICT = process.argv.indexOf("--strict") !== -1;
var targets = args.length ? args : Object.keys(SHELVES);

var total = 0, totalKB = 0, built = 0, failed = [], empty = [];

function pad(s, n) {
  s = String(s);
  while (s.length < n) s += " ";
  return s;
}

targets.forEach(function (name) {
  if (checkOnly) {
    var s = SHELVES[name];
    var p = path.join(OUT, s.group, s.sub + ".json");
    if (!fs.existsSync(p)) { empty.push(name); return; }
    var doc = JSON.parse(fs.readFileSync(p, "utf8"));
    total += doc.entries.length; built++;
    console.log("  " + pad(name, 34) + pad(String(doc.entries.length), 7) + " entries");
    return;
  }
  var r = build(name);
  if (r.status === "error") { failed.push(name); return; }
  if (r.status === "empty") { empty.push(name); return; }
  total += r.count; totalKB += r.kb; built++;
  console.log("  " + pad(r.name, 34) + pad(String(r.count), 7) + " entries" + pad((r.kb + " KB"), 11));
});

console.log("");
if (checkOnly) {
  console.log("  TOTAL " + total + " entries across " + built + " written shelves, " +
              empty.length + " empty");
} else {
  console.log("  wrote " + total + " entries (" + Math.round(totalKB / 1024) + " MB) across " +
              built + " shelves");
  if (empty.length) {
    console.log("  " + empty.length + " declared shelf(es) have no source yet - they route and");
    console.log("  refuse honestly, they just cannot answer yet:");
    console.log("    " + empty.slice(0, 12).join(", ") + (empty.length > 12 ? ", ..." : ""));
  }
  if (failed.length) { console.error("  FAILED: " + failed.join(", ")); process.exit(1); }
  if (empty.length && STRICT) {
    console.error("  --strict: " + empty.length + " empty shelf(s) treated as a failure");
    process.exit(1);
  }
  console.log("  now run: node bokskie-v1/tools/build-data.js");
}
