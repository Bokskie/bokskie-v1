/* ============================================================
   bokskie-v1 · tools/build-data.js
   ------------------------------------------------------------
   Turns data/*.json into data/bundle.js.

   Why: the engine reads JSON, but a browser opened straight off the
   disk (file://) cannot fetch() it - every modern browser blocks that.
   The old provider got its data from <script> tags, which work
   everywhere, and losing that would be a regression.

   So the JSON files stay the source of truth and this generates a
   script-taggable copy of them. Two copies means drift, so
   verify-engine.js checks that they are identical - if you edit a
   JSON file and forget to rebuild, the test fails.

     node bokskie-v1/tools/build-data.js          rebuild
     node bokskie-v1/tools/build-data.js --check   verify only
   ============================================================ */

"use strict";

var fs = require("fs");
var path = require("path");

var DATA = path.join(__dirname, "..", "data");
var OUT = path.join(DATA, "bundle.js");

/* Every data document, at any depth. The bank is a TREE on disk -
   data/<group>/<sub>.json - so a flat readdir only ever saw the
   handful of hand-written files sitting at the top and quietly built
   a bundle with none of the real content in it. */

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

function collect() {
  var files = walk(DATA, "", []);
  var docs = [];
  files.forEach(function (f) {
    var doc = JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
    doc.__file = f;
    docs.push(doc);
  });
  return docs;
}

function render(docs) {
  var entries = 0;
  var body = docs.map(function (d) {
    entries += (d.entries || []).length;
    return "  " + JSON.stringify(d);
  }).join(",\n");

  /* The shelf declarations travel with the bank.
     engine/intent.js cannot require() tools/shelves.js in a browser,
     so without this the router would know only its eight built-in
     topics and 100 shelves would load and then be unreachable -
     which presents as a vague answer, not as a config error. Emitting
     them here means node and the browser get the identical router. */
  var REG = require("./shelves.js");
  var shelves = JSON.stringify(REG.shelves.map(function (s) {
    return {
      topic: s.topic, group: s.group, groupTitle: s.groupTitle,
      sub: s.sub, title: s.title, lang: s.lang, keys: s.keys
    };
  }));

  return [
    "/* GENERATED FILE - do not edit.",
    "   Source: bokskie-v1/data/*.json",
    "   Rebuild: node bokskie-v1/tools/build-data.js",
    "",
    "   This copy exists so the bank can be loaded with a <script> tag,",
    "   which works from file:// where fetch() of a local JSON file does",
    "   not. The JSON files are the source of truth; verify-engine.js",
    "   fails if the two drift apart. */",
    "",
    "(function (root, factory) {",
    "  if (typeof module === \"object\" && module.exports) module.exports = factory();",
    "  else root.BokskieData = factory();",
    "})(typeof globalThis !== \"undefined\" ? globalThis : this, function () {",
    "  \"use strict\";",
    "  var DOCS = [",
    body,
    "  ];",
    "  var SHELVES = " + shelves + ";",
    "  var entries = [];",
    /* The lexicon is emitted twice, and deliberately.

       It is part of `entries` because each concept is also a knowledge
       entry with its own answer - the Tagalog and Bisaya words are
       searchable keywords, not just aliases.

       It is ALSO emitted separately because the engine has to register
       the surface->concept map with the tokenizer BEFORE it indexes a
       single entry, and by the time the entries are flattened the
       association with the lexicon file is gone. Without this array the
       browser build would silently lose every cross-language bridge
       while the node build kept working - and the node build is what
       the tests run, so it would have passed while the real page was
       broken. */
    "  var lexicon = [];",
    "  for (var i = 0; i < DOCS.length; i++) {",
    "    var list = DOCS[i].entries || [];",
    "    if (DOCS[i].topic === \"lexicon\") {",
    "      for (var L = 0; L < list.length; L++) lexicon.push(list[L]);",
    "    }",
    "    for (var j = 0; j < list.length; j++) {",
    "      /* Stamp the source file so a bad answer can be traced back",
    "         to the JSON that produced it. */",
    "      if (!list[j].__source) list[j].__source = DOCS[i].__file;",
    "      entries.push(list[j]);",
    "    }",
    "  }",
    "  return { files: DOCS.length, entries: entries, count: " + entries + ",",
    "           lexicon: lexicon, concepts: lexicon.length, shelves: SHELVES };",
    "});",
    ""
  ].join("\n");
}

var docs = collect();
var want = render(docs);
var check = process.argv.indexOf("--check") !== -1;
var current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";

if (check) {
  if (current !== want) {
    console.error("bundle.js is out of date - run: node bokskie-v1/tools/build-data.js");
    process.exit(1);
  }
  console.log("bundle.js is in sync (" + docs.length + " files, " +
              (function () { var n = 0; docs.forEach(function (d) { n += (d.entries || []).length; }); return n; })() +
              " entries)");
} else {
  fs.writeFileSync(OUT, want);
  var total = 0;
  docs.forEach(function (d) { total += (d.entries || []).length; });
  console.log("wrote " + path.relative(process.cwd(), OUT) +
              "  (" + docs.length + " files, " + total + " entries)");

  /* Report how many entries carry a cross-language surface, because that
     is the one number that silently stays at zero: a missing or
     mis-spelled `tl` field produces a bank that answers English
     perfectly and every other language not at all, with nothing
     anywhere reporting an error. The bridge is built from tl/bis on the
     entries themselves, so there is no separate lexicon document to
     look for any more. */
  var bridges = 0, tlCount = 0, bisCount = 0;
  docs.forEach(function (d) {
    (d.entries || []).forEach(function (e) {
      if (e.tl) tlCount++;
      if (e.bis) bisCount++;
      if ((e.tl || e.bis) && e.keywords && e.keywords.length) bridges++;
    });
  });
  if (!bridges) {
    console.error("WARNING: no entry has a tl/bis surface. Cross-language matching is OFF.");
  } else {
    console.log("  cross-language: " + tlCount + " with `tl`, " + bisCount +
                " with `bis`, " + bridges + " bridgeable");
  }
}
