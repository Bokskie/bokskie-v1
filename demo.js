/* ============================================================
   bokskie.v1 - demo.js
   ------------------------------------------------------------
       node bokskie-v1/demo.js "what is javascript"

   Type a question and see the answer. No arguments means it runs
   through a few examples, ending on one the bank cannot answer.

   This used to print the COMPOSER's stats - "N possible replies
   across M languages" - and died on `s.total` the moment the
   provider moved to the real engine, because engine stats have no
   such field. It now waits for the bank, reports what the bank
   actually is, and shows the shape of the shelf tree, which is the
   part worth eyeballing by hand.
   ============================================================ */

"use strict";

var provider = require("./src/provider.js");

var arg = process.argv.slice(2).join(" ");

/* The tree, read straight off the generated manifest. Optional - the
   demo is still useful without it, so a missing file is skipped
   rather than fatal. */
function tree() {
  try { return require("./knowledge-base.json"); }
  catch (e) { return null; }
}

function banner(s) {
  var t = tree();
  console.log("");
  console.log("  bokkie.v1 - Bokskie Local");
  console.log("  " + (s.entries || 0).toLocaleString() + " entries, " +
              (s.topicsCount || 0) + " topics, " + (s.files || 0) + " files");
  if (t) {
    console.log("  " + t.totals.shelves + " shelves declared, " +
                t.totals.shelvesWithEntries + " written, " +
                t.totals.emptyShelves + " still empty");
    console.log("");
    t.groups.forEach(function (g) {
      console.log("    " + g.title.padEnd(17) + String(g.shelfCount).padStart(3) +
                  " shelves   " + (g.entryCount ? g.entryCount + " entries" : "not written yet"));
    });
  }
  if (s.error) console.log("  load error: " + s.error);
  console.log("");
  console.log("  offline, free, no key. It retrieves what was written down,");
  console.log("  and says so plainly when a question falls outside that.");
  console.log("");
}

function show(text, opts) {
  return provider.reply(text, opts).then(function (r) {
    console.log("  > " + text);
    var known = r.known
      ? "answered from " + (r.concept || r.entryId || "the bank")
      : "nothing cleared the bar, so it refused";
    console.log("  [" + (r.requestLang || r.lang || "?") + " / " +
                (r.topic || "no topic") + " / " + known + "]");
    console.log("");
    console.log(r.text.split("\n").map(function (line) { return "  " + line; }).join("\n"));
    console.log("");
  });
}

provider.ready().then(function () {
  banner(provider.stats());
  if (arg) return show(arg);
  return show("what is javascript")
    .then(function () { return show("unsa meaning nga salamat"); })
    .then(function () { return show("how do i fix a javascript bug"); })
    .then(function () { return show("ano ang presyo ng stock ng tesla"); });
});
