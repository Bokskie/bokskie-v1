/* ============================================================
   bokskie-v1 · tools/build-tree.js
   ------------------------------------------------------------
   Emits bokskie-v1/knowledge-base.json: THE TREE, as data.

       node bokskie-v1/tools/build-tree.js          rebuild
       node bokskie-v1/tools/build-tree.js --check   verify only

   WHY A SEPARATE FILE, AND WHY NOT IN data/
   -------------------------------------------
   The registry (tools/shelves.js) is the shape of the bank. This
   is the same shape as something a UI, a docs page or a linter can
   read without executing a build tool, and it adds the one thing
   the registry cannot know: how much of each shelf is actually
   filled in. A tree that says "148 shelves" and a tree that says
   "148 shelves, 45 of them holding content" are very different
   facts, and only the second one is true.

   It deliberately does NOT live in data/. Every file in data/ is an
   entry document, and verify-kb.js rejects anything without an
   `entries` array as malformed - so a manifest parked there would
   fail the integrity gate on sight. One job, one place.

   NO TIMESTAMP. --check has to be reproducible, and a "generated at"
   field makes every run differ, which turns a drift check into a
   coin flip.
   ============================================================ */

"use strict";

var fs = require("fs");
var path = require("path");
var REG = require("./shelves.js");

var DATA = path.join(__dirname, "..", "data");
var OUT = path.join(__dirname, "..", "knowledge-base.json");

/* How many concepts to list per shelf. Enough to recognise a shelf
   from its contents without turning the manifest into a copy of the
   bank - which would be a second source of truth to drift. */
var SAMPLE = 8;

/* Every entry document, at any depth. The bank is a tree on disk
   (data/<group>/<sub>.json), so this has to recurse - a flat readdir
   would check the handful of files at the top and report the whole
   bank as clean. */
function walk(dir, prefix, out) {
  fs.readdirSync(dir).sort().forEach(function (name) {
    var full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full, prefix ? prefix + "/" + name : name, out);
      return;
    }
    if (/\.json$/.test(name)) out.push(prefix ? prefix + "/" + name : name);
  });
  return out;
}

function readDocs() {
  var docs = {};
  walk(DATA, "", []).forEach(function (f) {
    var doc;
    try { doc = JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")); }
    catch (e) { doc = null; }
    if (doc && Array.isArray(doc.entries)) docs[f.replace(/\.json$/, "")] = doc;
  });
  return docs;
}

function build() {
  var docs = readDocs();
  var totals = {
    groups: 0, shelves: 0, files: 0, entries: 0,
    shelvesWithEntries: 0, emptyShelves: 0, lines: 0
  };

  var groups = REG.groups.map(function (g) {
    totals.groups++;
    /* Built before the subs are mapped: incrementing group.entryCount
       from inside that map would be a temporal dead zone, because the
       `group` binding does not exist until this expression finishes. */
    var group = {
      id: g.id,
      title: g.title,
      lang: g.lang,
      extra: g.extra,
      shelfCount: g.subs.length,
      entryCount: 0,
      subs: []
    };
    g.subs.forEach(function (sub) {
      var name = sub.shelf;                 /* cebuano-basic-words  */
      var shelf = REG.byId[name] || {};
      /* `docs` is keyed by the path on disk, "cebuano/basic-words",
         which is NOT the shelf id. Keying one by the other is the kind
         of mismatch that reports every shelf as empty while the files
         sit right there. */
      var doc = docs[shelf.rel || name];
      var entries = doc ? doc.entries : [];
      totals.shelves++;
      if (doc) totals.files++;
      totals.entries += entries.length;
      if (entries.length) totals.shelvesWithEntries++; else totals.emptyShelves++;
      group.entryCount += entries.length;
      group.subs.push({
        slug: sub.slug,
        title: sub.title,
        shelf: name,
        topic: sub.topic,
        file: shelf.file || (name + ".json"),
        lang: g.lang,
        keys: shelf.keys || [],
        entryCount: entries.length,
        concepts: entries.slice(0, SAMPLE).map(function (e) {
          return e.concept || (e.keywords && e.keywords[0]) || e.id;
        })
      });
    });
    return group;
  });

  /* Entry documents that are NOT shelves. conversation.json is
     hand-written behaviour - greeting, identity, the memory
     templates - and predates the registry, so it has no row here.
     Listing it keeps the manifest honest about everything the engine
     will actually load.

     `known` is keyed by the PATH, because `docs` is keyed by the path
     ("cebuano/basic-words"), not by the shelf id. Keying it by id made
     every real file look unregistered, and the totals below then
     counted the whole bank twice: 398 entries from a 203-entry bank. */
  var known = Object.create(null);
  REG.shelves.forEach(function (s) { known[s.rel || s.id] = 1; });
  var unregistered = Object.keys(docs).filter(function (n) { return !known[n]; })
    .sort().map(function (n) {
      return { file: n + ".json", topic: docs[n].topic, entryCount: docs[n].entries.length };
    });
  unregistered.forEach(function (u) { totals.files++; totals.entries += u.entryCount; });

  return {
    version: 1,
    totals: totals,
    groups: groups,
    unregistered: unregistered
  };
}

function render(doc) {
  return JSON.stringify(doc, null, 2) + "\n";
}

var want = render(build());
var check = process.argv.indexOf("--check") !== -1;
var have = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";

if (check) {
  if (have !== want) {
    console.error("knowledge-base.json is out of date - run: node bokskie-v1/tools/build-tree.js");
    process.exit(1);
  }
  console.log("knowledge-base.json is in sync");
} else {
  fs.writeFileSync(OUT, want);
  var t = build().totals;
  console.log("wrote " + path.relative(process.cwd(), OUT));
  console.log("  " + t.groups + " groups, " + t.shelves + " shelves, " + t.files + " files, " +
              t.entries + " entries");
  console.log("  " + t.shelvesWithEntries + " shelves have content, " +
              t.emptyShelves + " are still empty");
  if (t.emptyShelves) {
    console.log("  an empty shelf is a declared category with no .kb source yet -");
    console.log("  it routes correctly and refuses honestly, it just cannot answer.");
  }
}
