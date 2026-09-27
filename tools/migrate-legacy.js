/* ============================================================
   bokskie-v1 · tools/migrate-legacy.js
   ------------------------------------------------------------
   One-time: converts the hand-written data/*.json shelves into
   tools/source/*.kb, so every knowledge shelf goes through
   build-kb.js like everything else.

     node bokskie-v1/tools/migrate-legacy.js
     node bokskie-v1/tools/migrate-legacy.js --dry-run

   WHY THIS HAD TO HAPPEN
   ----------------------
   The old shelves had readable ids like `math-prime` and phrase
   keywords like "prime number". Both are wrong for the large bank:

   - Ids are now prefix-NNNNNN, so that a row is traceable to its
     source line and `geo-000042` means the same thing in every build.
   - A phrase keyword is an index key that nothing can ever hit, because
     no query token contains a space. kb.add() drops it without
     complaint, which is exactly the failure mode nobody notices: the
     author wrote a carefully chosen phrase and it has been doing
     nothing for months.

   The phrases are not thrown away, they are MOVED to `patterns`, where
   a literal match is the strongest signal the ranker has and the
   phrase is actually reachable.

   `conversation.json` is deliberately NOT migrated. It holds behaviour
   definitions - greeting, identity, and the memory templates - which
   have fields the source format cannot express. It stays hand-written,
   and verify-kb.js exempts it from the id check for that reason.
   ============================================================ */

"use strict";

var fs = require("fs");
var path = require("path");

var DATA = path.join(__dirname, "..", "data");
var SRC = path.join(__dirname, "source");
var DRY = process.argv.indexOf("--dry-run") !== -1;

var SHELVES = ["programming", "science", "mathematics", "technology",
               "geography", "history", "health", "money"];

function oneLine(s) {
  return String(s || "").replace(/\s+/g, " ").replace(/\|/g, "-").trim();
}

var totalRows = 0, movedPhrases = 0, droppedPhrases = [];

SHELVES.forEach(function (name) {
  var p = path.join(DATA, name + ".json");
  if (!fs.existsSync(p)) return;
  var src = path.join(SRC, name + ".kb");
  if (fs.existsSync(src)) {
    console.log("  " + name + ": source already exists, skipping (it is now hand-maintained)");
    return;
  }

  var doc = JSON.parse(fs.readFileSync(p, "utf8"));
  var lines = [
    "# " + name + ".kb",
    "# MIGRATED from the hand-written " + name + ".json by tools/migrate-legacy.js.",
    "# Edit this file, then run: node bokskie-v1/tools/build-kb.js " + name,
    "#",
    "# Phrase keywords were moved to patterns, where a literal match is",
    "# reachable. A phrase can never match a token.",
    ""
  ];

  doc.entries.forEach(function (e) {
    var kw = e.keywords || [];
    /* The subject. keywords[0] is the name the author chose, which is
       what memory should report back as "the topic we discussed". */
    var concept = e.concept || kw[0];
    if (!concept) { droppedPhrases.push(name + "/" + e.id + ": no concept"); return; }

    var words = [], phrases = [];
    kw.forEach(function (k) {
      if (/\s/.test(String(k))) { phrases.push(k); movedPhrases++; }
      else if (words.indexOf(k) === -1) words.push(k);
    });
    (e.patterns || []).forEach(function (p) { if (phrases.indexOf(p) === -1) phrases.push(p); });

    /* tl/bis were merged in from the old lexicon file; carry them over
       so the cross-language bridge survives the migration. */
    var f = [oneLine(concept), e.intent || "definition", oneLine(e.answer)];
    f.push(oneLine(words.filter(function (w) { return w !== concept; }).join(", ")));
    f.push(oneLine(phrases.join(", ")));
    f.push(oneLine(e.tl || ""));
    f.push(oneLine(e.bis || ""));
    if (e.langs && e.langs.tagalog) f.push(oneLine(e.langs.tagalog));
    if (e.langs && e.langs.bisaya) f.push(oneLine(e.langs.bisaya));
    if (typeof e.confidence === "number" && e.confidence !== 1) f.push(f.length === 7 ? "" : "", String(e.confidence));
    if (e.source) f.push(oneLine(e.source));
    /* Trailing empty fields are harmless: splitFields pads them. */
    while (f.length > 7 && f[f.length - 1] === "") f.pop();

    lines.push(f.join(" | "));
    totalRows++;
  });

  if (!DRY) fs.writeFileSync(src, lines.join("\n") + "\n");
  console.log("  " + name + ": " + doc.entries.length + " entries -> tools/source/" + name + ".kb");
});

console.log("");
console.log("  " + totalRows + " rows migrated, " + movedPhrases + " phrase keywords moved to patterns");
if (droppedPhrases.length) {
  console.log("  WARNING - could not migrate:");
  droppedPhrases.forEach(function (d) { console.log("    " + d); });
}
if (DRY) console.log("  (dry run - nothing written)");
else console.log("  now run: node bokskie-v1/tools/build-kb.js");
