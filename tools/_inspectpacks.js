"use strict";
/* Inspect response-packs.js WITHOUT importing it. Read-only, and it
   answers the only question that matters before anything is copied:
   how much of this is actually distinct? */
var fs = require("fs");
var path = require("path");

var file = path.join(__dirname, "..", "..", "response-packs.js");
var s = fs.readFileSync(file, "utf8");

console.log("file: " + path.basename(file) + "  " + Math.round(s.length / 1024) + " KB");
console.log("header: " + (s.split("\n")[1] || "").trim());

/* Pull the array literals out without executing anything. */
var packs = {};
var re = /^\s{2}([a-z]{2,3}):\s*\[([\s\S]*?)^\s{2}\]/gm;
var m;
while ((m = re.exec(s)) !== null) {
  var items = [];
  var sre = /^\s{4}"((?:[^"\\]|\\.)*)"/gm;
  var k;
  while ((k = sre.exec(m[2])) !== null) items.push(k[1]);
  packs[m[1]] = items;
}

Object.keys(packs).forEach(function (name) {
  var items = packs[name];
  var uniq = Object.create(null), n = 0;
  items.forEach(function (t) { if (!uniq[t]) { uniq[t] = 1; n++; } });
  /* Fragments, not sentences. If stripping the trailing clause leaves
     only a handful of pieces, the list is a cross-product rather than
     a pack of distinct replies. */
  var openers = Object.create(null), closers = Object.create(null);
  items.forEach(function (t) {
    var first = t.split(/[ ,.!]/)[0].toLowerCase();
    openers[first] = 1;
  });
  var heads = Object.keys(openers).length;
  console.log("");
  console.log("  " + name + ": " + items.length + " strings, " + n + " exact-unique (" +
              (items.length - n) + " repeats)");
  console.log("    distinct opening words: " + heads);
  console.log("    contains {name}: " + items.filter(function (t) { return t.indexOf("{name}") !== -1; }).length);
  console.log("    mojibake runs (U+00F0..): " +
              items.filter(function (t) { return /[ÃÂð][\x80-\xBF]/.test(t); }).length);
  /* Longest and median length: knowledge answers are paragraphs, chat
     openers are a sentence. This is the number that tells them apart. */
  var len = items.map(function (t) { return t.length; }).sort(function (a, b) { return a - b; });
  console.log("    length median " + len[Math.floor(len.length / 2)] +
              ", max " + len[len.length - 1]);
});
