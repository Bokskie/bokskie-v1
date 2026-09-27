/* ============================================================
   bokskie-v1 · tools/append-lexicon.js
   ------------------------------------------------------------
   Appends concept rows to data/lexicon.json.

   Why a tool for this: lexicon.json is large, hand-written data, and
   hand-editing it in place is how you end up with a file that is
   missing a comma, silently one entry short, or whose _readme block
   has been edited into. A merge tool either works or throws, and it
   never reorders or reformats what is already there.

     node bokskie-v1/tools/append-lexicon.js <fragment.json>
     node bokskie-v1/tools/append-lexicon.js --check

   The fragment is a plain JSON array of entries, same shape as the
   entries in lexicon.json. Duplicate ids are refused rather than
   appended twice - a second row with the same id would shadow the
   first in the index with no warning anywhere.
   ============================================================ */

"use strict";

var fs = require("fs");
var path = require("path");

var DATA = path.join(__dirname, "..", "data");
var LEX = path.join(DATA, "lexicon.json");

var REQUIRED = ["id", "topic", "concept", "answer"];

function fail(msg) {
  console.error("append-lexicon: " + msg);
  process.exit(1);
}

function load() {
  if (!fs.existsSync(LEX)) fail("data/lexicon.json does not exist");
  var doc;
  try { doc = JSON.parse(fs.readFileSync(LEX, "utf8")); }
  catch (e) { fail("data/lexicon.json is not valid JSON - " + e.message); }
  if (!Array.isArray(doc.entries)) fail("data/lexicon.json has no entries array");
  return doc;
}

/* Validate before writing anything. A fragment that is wrong should
   leave the bank exactly as it was, not half-appended. */
var MULTIWORD = [];

function validate(list, existing) {
  if (!Array.isArray(list)) fail("the fragment must be a JSON array of entries");
  var seen = Object.create(null);
  for (var i = 0; i < existing.length; i++) seen[existing[i].id] = true;
  var ids = Object.create(null);
  list.forEach(function (e, n) {
    if (!e || typeof e !== "object") fail("entry " + n + " is not an object");
    REQUIRED.forEach(function (k) {
      if (!e[k]) fail("entry " + n + " (" + (e.id || "?") + ") is missing `" + k + "`");
    });
    if (seen[e.id]) fail("id already in lexicon.json: " + e.id);
    if (ids[e.id]) fail("duplicate id inside the fragment: " + e.id);
    ids[e.id] = true;
    /* A Tagalog or Bisaya surface is the entire point of the file.
       A row with neither is just a knowledge entry, and it belongs in
       its topic file instead. */
    if (!e.tl && !e.bis) {
      fail("entry " + e.id + " has no `tl` and no `bis` surface - " +
           "put it in its topic file instead of the lexicon");
    }
    /* A multi-word `concept` is allowed - some subjects really are two
       words, and it is the right thing to show the user when they ask
       what they were discussing. But it cannot be a bridge TARGET,
       because a token never contains a space, so every surface on the
       row silently fails to register. That failure is invisible: the
       row still works in English and the other languages simply never
       reach it. Report it rather than letting it pass. */
    if (/[\s]/.test(e.concept)) MULTIWORD.push(e.id);
  });
}

function report(doc) {
  var byTopic = Object.create(null);
  var surfaces = 0;
  doc.entries.forEach(function (e) {
    byTopic[e.topic] = (byTopic[e.topic] || 0) + 1;
    if (e.en) surfaces++;
    if (e.syn) surfaces += e.syn.length;
    if (e.tl) surfaces++;
    if (e.bis) surfaces++;
  });
  console.log("lexicon: " + doc.entries.length + " concepts, " + surfaces + " word surfaces");
  Object.keys(byTopic).sort().forEach(function (t) {
    console.log("  " + t + ": " + byTopic[t]);
  });
}

var check = process.argv.indexOf("--check") !== -1;
if (check) {
  report(load());
} else {
  var src = process.argv[2];
  if (!src) fail("usage: node bokskie-v1/tools/append-lexicon.js <fragment.json>");
  var list;
  try { list = JSON.parse(fs.readFileSync(src, "utf8")); }
  catch (e) { fail("cannot read " + src + " - " + e.message); }

  var doc = load();
  validate(list, doc.entries);
  doc.entries = doc.entries.concat(list);
  fs.writeFileSync(LEX, JSON.stringify(doc, null, 2) + "\n");
  console.log("appended " + list.length + " -> data/lexicon.json");
  report(doc);

  if (MULTIWORD.length) {
    console.warn("");
    console.warn("NOTE: these rows have a multi-word `concept`, so they cannot act as a");
    console.warn("      bridge target and contribute no cross-language surfaces:");
    MULTIWORD.forEach(function (id) { console.warn("      " + id); });
    console.warn("      Fine when the subject really is two words and its keywords");
    console.warn("      already route. Worth fixing when a single word would do.");
  }
}