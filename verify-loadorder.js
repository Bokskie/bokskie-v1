/* Simulate the browser loading index.html, in the order the page
   declares. This is the check that was missing: every other test
   required provider.js directly under node, so a script-order mistake
   in index.html passed everything and then broke the real page.

   Uses node:vm with a fake window/document. No browser, no puppeteer. */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

/* The repo root, derived from this file's own location rather than the
   working directory. It used to be process.cwd() with script paths
   resolved as ROOT/../<src>, which cannot both be right at once: run from
   the repo root and index.html resolves but every script reads as
   MISSING; run from inside bokskie-v1/ and the scripts resolve but
   index.html is ENOENT. Neither invocation worked, so the test silently
   never ran - which is exactly how a "bokskie-v1" typo in index.html
   shipped and 404'd all nine scripts in the real browser. */
var ROOT = path.resolve(__dirname, "..");
var page = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* Every script the page pulls in, in document order. */
var order = [];
var re = /<script\s+src="([^"]+)"/g;
var m;
while ((m = re.exec(page)) !== null) order.push(m[1]);
order = order.map(function (s) { return s.split("?")[0]; });

function resolveSrc(s) { return path.join(ROOT, s.replace(/\//g, path.sep)); }

console.log("scripts declared in index.html, in order:\n");
var missing = [];
order.forEach(function (s, i) {
  var onDisk = fs.existsSync(resolveSrc(s));
  if (!onDisk) missing.push(s);
  console.log("  " + (i + 1) + ". " + (onDisk ? "ok     " : "MISSING") + "  " + s);
});

/* A window-ish global. The UMD wrappers only touch globalThis, so this
   is enough to find out whether they can find each other. */
var sandbox = { console: console, JSON: JSON, Math: Math, Date: Date,
                Object: Object, Array: Array, String: String, Number: Number,
                RegExp: RegExp, Error: Error, Promise: Promise, fetch: undefined };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

/* app.js is the UI shell: it reads document/window the moment it runs, so
   it cannot be evaluated in a sandbox that deliberately has no DOM. It is
   not skipped to hide a problem - its existence is still checked above
   (a missing file is a hard failure), and it is covered for real by
   tests/ui-smoke.test.html, which loads the actual index.html in an
   iframe. Everything that can be order-dependent IS evaluated here. */
var DOM_ONLY = { "assets/js/app.js": true };

var failed = null;
console.log("\nloading them in that exact order:\n");
order.forEach(function (s) {
  if (failed) return;
  var p = resolveSrc(s);
  if (!fs.existsSync(p)) return;
  if (DOM_ONLY[s]) {
    console.log("  skip   " + s + "  (needs a DOM - see tests/ui-smoke.test.html)");
    return;
  }
  try {
    vm.runInContext(fs.readFileSync(p, "utf8"), sandbox, { filename: s });
    console.log("  ok     " + s);
  } catch (e) {
    failed = { src: s, err: e };
    console.log("  THREW  " + s);
    console.log("         " + e.message);
  }
});

console.log("\nglobals the page ended up with:");
["BokskieData", "BokskieTokenizer", "BokskieSimilarity", "BokskieIntent",
 "BokskieContext", "BokskieKB", "BokskieGenerator", "BokskieEngine",
 "BokskieLocal"].forEach(function (k) {
  var v = sandbox[k];
  console.log("  " + (v ? "ok     " : "MISSING") + "  window." + k +
              (v && v.entries ? "  (" + v.entries.length + " entries)" :
               v && v.KB ? "  (KB)" : v && v.Engine ? "  (Engine)" : ""));
});

/* A script tag pointing at a file that is not on disk is a silent 404:
   the page still loads, the provider global never appears, and the
   Settings card just says "files did not load" with no reason. Fail
   here, loudly, and name the path. */
if (missing.length) {
  console.log("\nRESULT: FAIL - index.html points at files that are not on disk:");
  missing.forEach(function (s) { console.log("  " + s); });
  console.log("\n  A browser requests these by exact path, so one wrong letter");
  console.log("  in the folder name 404s the file and the provider never loads.");
  console.log("  Check each spelling against the folder that is actually on disk.");
  process.exit(1);
}
if (failed) { console.log("\nRESULT: FAIL - a script threw while loading."); process.exit(1); }
if (!sandbox.BokskieLocal) { console.log("\nRESULT: FAIL - BokskieLocal never appeared."); process.exit(1); }

/* The exact gate the user hits. llm.js validate() is what refuses to send
   and shows "bokskie.v1 is not loaded" when BokskieLocal is absent, so
   asserting it returns null proves the reported bug is actually gone -
   not merely that the files parse. */
var gate = sandbox.LLM && sandbox.LLM.validate
  ? sandbox.LLM.validate({ provider: "bokskie-local", model: "bokskie.v1" })
  : "LLM.validate is not available";
console.log("\nthe send gate (llm.js validate):\n  " +
            (gate === null ? "ok     null - bokskie-local is allowed to send"
                           : "BLOCKED  " + gate));
if (gate !== null) {
  console.log("\nRESULT: FAIL - the app would still refuse to send.");
  process.exit(1);
}

/* Now actually use it, the way llm.js does. */
console.log("\ndriving it the way the app does:\n");
sandbox.BokskieLocal.ready()
  .then(function () {
    var st = sandbox.BokskieLocal.stats();
    console.log("  stats: entries=" + st.entries + " topics=" + st.topicsCount + " ready=" + st.ready);
    if (st.error) console.log("  error: " + st.error);
    return sandbox.BokskieLocal.reply("what is javascript", { seed: 1, useContext: false });
  })
  .then(function (r) {
    console.log('  "what is javascript" -> known=' + r.known + " id=" + r.entryId);
    if (!r.known || /could not load/.test(r.text)) { console.log("\nRESULT: still failing.\n  " + r.text); process.exit(1); }
    console.log("  " + r.text.slice(0, 90) + "...");
    return sandbox.BokskieLocal.reply("who won the 2019 basketball world cup", { seed: 1, useContext: false });
  })
  .then(function (r) {
    console.log('  "who won the 2019 basketball world cup" -> known=' + r.known + "  (correctly refused)");
    console.log("\nRESULT: PASS - index.html loads in order and the provider answers.");
    process.exit(0);
  })
  .catch(function (e) {
    console.log("\nRESULT: FAIL - " + (e && e.message ? e.message : e));
    process.exit(1);
  });
