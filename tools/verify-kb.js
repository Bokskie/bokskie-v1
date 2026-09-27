/* ============================================================
   bokskie-v1 · tools/verify-kb.js
   ------------------------------------------------------------
   Integrity gate for data/*.json.

     node bokskie-v1/tools/verify-kb.js
     node bokskie-v1/tools/verify-kb.js --min 1000

   Reports, and fails on: malformed JSON, duplicate ids, duplicate
   concepts, near-duplicate answers, empty or too-thin answers, missing
   required fields, malformed ids, and shelf sizes below --min.

   The duplicate check is the one that matters. A bank can pass every
   structural test and still be worse than a small one, because a
   thousand rows that say the same thing raise the score of whichever
   entry they all resemble and push real answers below the refusal
   threshold. That failure is invisible from inside the app - it just
   looks like the bot getting vaguer - so it is checked here.
   ============================================================ */

"use strict";

var fs = require("fs");
var path = require("path");

var DATA = path.join(__dirname, "..", "data");

/* Must stay in step with SHELVES in build-kb.js: the prefix is how an
   id is validated, and a mismatch would let a mislabelled file pass. */
/* Prefixes come from tools/shelves.js - the same registry the builder
   uses. Two separate tables meant a new shelf could be added to one
   and not the other, and the validator would then reject the very ids
   the builder had just written. */
var REG = require("./shelves.js");
var SHELVES = Object.create(null);
REG.shelves.forEach(function (s) { SHELVES[s.id] = s.prefix; });

var REQUIRED = ["id", "topic", "intent", "keywords", "patterns", "answer", "variations"];
var MIN_ANSWER_HARD = 60;

/* The real tokenizer, not a copy of it. A key that is not already
   stemmed is a key nothing can ever produce, and that mistake is
   invisible from here: the shelf loads, the file validates, the
   router simply never picks it, and the symptom is a vague answer
   rather than a config error. Importing the engine's own stemmer is
   what makes the lint trustworthy - build-kb.js deliberately does not
   import it, because the builder runs before the engine is loaded and
   a hand-maintained copy of a word list is a second thing to forget. */
var T = require(path.join(__dirname, "..", "engine", "tokenizer.js"));

/* One pass, matching tools/shelves.js and matching what tokenize()
   actually does. This used to loop to a fixed point, which demanded
   keys the router will never see: it wanted "nur" where the token is
   "nurs", and the shelf it belonged to was declared dead. */
function toStem(word) {
  var w = String(word).trim();
  return w ? T.stem(T.canonical(w)) : "";
}

var deadKeys = [];
REG.shelves.forEach(function (s) {
  /* What is genuinely worth checking: the stemmed form of every word
     of the shelf NAME has to be in `keys`. engine/intent.js derives a
     key from each word of `sub` and `group` WITHOUT stemming, so a
     sub like "conversations" contributes "conversations" - a key
     tokenize() can never produce. tools/shelves.js adds the stemmed
     form on top, and this is the check that the addition still
     happens: without it, a whole shelf is routable by name on paper
     and unreachable in practice, which is invisible from the outside. */
  [s.sub, s.group].forEach(function (field) {
    String(field).replace(/-/g, " ").split(/\s+/).forEach(function (w) {
      if (w.length < 2) return;
      var stem = toStem(w);
      if (stem !== w && s.keys.indexOf(stem) === -1) {
        deadKeys.push(s.id + ": name word \"" + w + "\" stems to \"" + stem +
                      "\" - add it to keys");
      }
    });
  });

  /* And that every key is at least a plausible token: lower case, no
     spaces, not a leftover phrase. A key with a space in it can never
     match, because the tokenizer splits on whitespace. */
  s.keys.forEach(function (k) {
    if (/\s/.test(k)) deadKeys.push(s.id + ": key \"" + k + "\" contains a space");
    else if (k !== String(k).toLowerCase()) deadKeys.push(s.id + ": key \"" + k + "\" is not lower case");
  });

  /* NOT checked, and it used to be: "this key stems to something
     else, so it is dead". That is wrong now that toStem is a single
     pass. tokenize() stems each word exactly once, so a key IS the
     one-pass stem of the word it came from and the router compares
     against exactly that. Re-stemming the key is not something any
     query does, so the check demanded "nur" where the token is
     "nurs", and flagged 22 correct shelves as dead - including the
     one whose whole shelf was silently unroutable. */
});

var args = process.argv.slice(2);
var minArg = args.indexOf("--min");
var MIN_PER_SHELF = minArg !== -1 ? parseInt(args[minArg + 1], 10) : 0;

function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function contentWords(text, limit) {
  var seen = Object.create(null), out = [];
  var parts = String(text).toLowerCase().split(/[^a-z0-9'\u00C0-\u024F]+/);
  for (var i = 0; i < parts.length; i++) {
    var w = parts[i].replace(/^'+|'+$/g, "");
    if (w.length < 4 || seen[w]) continue;
    seen[w] = 1; out.push(w);
    if (limit && out.length >= limit) break;
  }
  return out;
}

var report = {
  shelves: 0, total: 0, malformed: [], dupIds: [], dupConcepts: [],
  dupAnswers: [], emptyAnswers: [], thinAnswers: [], missingFields: [],
  badIds: [], topicMismatch: [], underMin: [], badKeywords: [], multiwordConcept: []
};

/* `conversation.json` is exempt from the id-shape check, and that is a
   deliberate exception rather than a hole. It holds behaviour
   definitions - the greeting, the identity answer, the memory-reference
   templates - which have fields the source format cannot express, so it
   stays hand-written. Its ids are descriptive on purpose, because a
   reader looking up "where is the memory wording defined" should be
   able to guess the id. */
var EXEMPT_ID_SHAPE = { "conversation": 1 };

/* Every entry document, at any depth. The bank is a tree on disk
   (data/<group>/<sub>.json), so this has to recurse - a flat readdir
   checked only the few files at the top of data/ and would report the
   whole bank clean while every real shelf went unexamined. */
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

var files = walk(DATA, "", []);

/* Concepts and answers are tracked GLOBALLY, not per file. Two shelves
   answering the same question is the interesting case - geography and
   general-knowledge will always graze each other - and a per-file check
   would never see it. */
var globalConcept = Object.create(null);
var globalOwnerLang = Object.create(null);
var globalAnswer = Object.create(null);

files.forEach(function (file) {
  /* The shelf id, used to look up the id prefix. It is NOT the file
     name any more: the file is "cebuano/basic-words.json" and the
     shelf is "cebuano-basic-words". Deriving one from the other here
     is what lets the prefix check keep working after the move onto
     disk, and `doc.group` + `doc.sub` is authoritative because the
     builder writes both. */
  var name = file.replace(/\.json$/, "").replace(/\//g, "-");
  var raw;
  try {
    raw = fs.readFileSync(path.join(DATA, file), "utf8");
  } catch (e) {
    report.malformed.push(file + " (unreadable)");
    return;
  }
  var doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    report.malformed.push(file + " -> " + e.message);
    return;
  }
  if (!doc || !Array.isArray(doc.entries)) {
    report.malformed.push(file + " (no entries array)");
    return;
  }

  var prefix = SHELVES[name];
  report.shelves++;
  report.total += doc.entries.length;
  if (MIN_PER_SHELF && doc.entries.length < MIN_PER_SHELF) {
    report.underMin.push(name + " has " + doc.entries.length + " (need " + MIN_PER_SHELF + ")");
  }

  var localIds = Object.create(null);

  doc.entries.forEach(function (e, i) {
    var at = name + "[" + i + "]";
    REQUIRED.forEach(function (f) {
      if (!(f in e)) report.missingFields.push(at + " missing " + f);
    });
    if (typeof e.answer !== "string" || !e.answer.trim()) {
      report.emptyAnswers.push(at + " id=" + e.id);
      return;
    }
    if (e.answer.length < MIN_ANSWER_HARD) {
      report.thinAnswers.push(at + " id=" + e.id + " only " + e.answer.length + " chars");
    }
    if (Array.isArray(e.keywords)) {
      if (!e.keywords.length) report.badKeywords.push(at + " id=" + e.id + " has no keywords");
      e.keywords.forEach(function (k, ki) {
        /* A phrase can never match a token, so a multi-word keyword is
           an index key nothing can ever hit. kb.add() drops it without
           complaint, which is exactly why it is checked here.

           Index 0 is exempt, because that is the concept and a two-word
           subject is a legitimate name. It is reported separately as a
           multi-word concept rather than as a broken keyword. */
        if (!/\s/.test(String(k))) return;
        if (ki === 0) { report.multiwordConcept.push(at + " id=" + e.id + " concept: " + k); return; }
        report.badKeywords.push(at + " id=" + e.id + " phrase keyword: " + k);
      });
    }

    if (prefix && !EXEMPT_ID_SHAPE[name] &&
        !new RegExp("^" + prefix + "-\\d{6}$").test(String(e.id))) {
      report.badIds.push(at + " id=" + e.id + " (expected " + prefix + "-NNNNNN)");
    }
    if (localIds[e.id]) report.dupIds.push(name + " id=" + e.id);
    localIds[e.id] = 1;

    if (doc.topic && e.topic !== doc.topic) {
      report.topicMismatch.push(at + " entry topic=" + e.topic + " file topic=" + doc.topic);
    }

    /* Concept: the first keyword is the subject that was authored.

       Cross-shelf, on purpose, because that is where the collision hurts
       - geography and general-knowledge will always graze each other.

       The one exception is the three language shelves, and it is an
       exception rather than a loophole. `kami`, `ikaw`, `oo` and
       `salamat` are genuinely the same word in Tagalog and in Bisaya,
       and writing them once in each language is the correct content,
       not a duplicated row: the two entries explain different things
       about the same word, and the Cebuano one documents a difference
       in how the pronouns work that the Tagalog one cannot. Flagging
       those would push an author to delete a correct entry.

       Any OTHER shelf pair still collides, so a new entry in geography
       shadowing one in history is still caught. */
    var LANGUAGE_GROUP = { cebuano: 1, filipino: 1, english: 1 };
    /* Keyed on `doc.group`, NOT on the file name. It used to be keyed on
       the name, which worked only while each language was a single file
       ("cebuano.json"). The shelf tree splits a language across 30
       files, so a name-keyed lookup silently stopped matching, the
       exception stopped firing, and every word shared between two
       languages would have been reported as a duplicate. `name` is the
       fallback for hand-written docs like conversation.json, which
       predate `group`. */
    var owner = doc.group || name;
    /* `concept`, not keywords[0]. build-kb.js already says so in as many
       words: the concept is carried on the entry because it is stable
       under reordering, and it is what anything outside the builder
       should assert on.

       Checking keywords[0] instead reported a false duplicate the
       moment english/question-words gained an entry about the word
       "who". The hand-written conv-identity entry leads its keyword
       list with "who" for routing while its real subject is "identity",
       so two entries about entirely different things collided on a
       keyword one of them merely happens to start with. The two fields
       usually agree, which is why this hid for so long: they diverge
       precisely where a human hand ordered the keywords. */
    var c = norm(e.concept || (e.keywords && e.keywords[0]) || "");
    /* `c` must be computed BEFORE this test. Declared after it, `var`
       hoisting would leave it undefined here, the exception would never
       fire, and the rule would silently do nothing - which looks
       exactly like the rule working. */
    var bothLanguage = LANGUAGE_GROUP[owner] &&
                       globalOwnerLang[c] && LANGUAGE_GROUP[globalOwnerLang[c]];

    if (c) {
      var prev = globalConcept[c];
      if (prev && !bothLanguage) {
        report.dupConcepts.push(name + " " + e.id + " == " + prev + "  (" + c + ")");
      } else if (!prev) {
        globalConcept[c] = name + " " + e.id;
        globalOwnerLang[c] = owner;
      }
    }

    /* Near-duplicate: two answers agreeing on the same ten content
       words are the same fact, whatever the wording. Compared globally,
       because that is where the collision actually hurts. */
    var sig = contentWords(e.answer, 10).sort().join(" ");
    if (sig) {
      if (globalAnswer[sig]) report.dupAnswers.push(name + " " + e.id + " == " + globalAnswer[sig]);
      else globalAnswer[sig] = name + " " + e.id;
    }
  });
});


function pad(s, n) {
  s = String(s);
  while (s.length < n) s += " ";
  return s;
}

console.log("\nbokskie.v1 knowledge bank integrity\n" + new Array(58, "-").join("-"));
files.forEach(function (file) {
  var doc, kb;
  try {
    doc = JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
    kb = Math.round(fs.statSync(path.join(DATA, file)).size / 1024);
  } catch (e) { return; }
  if (!doc || !doc.entries) return;
  console.log("  " + pad(file.replace(/\.json$/, ""), 20) + pad(doc.entries.length, 7) +
              " entries  " + pad(kb + " KB", 11));
});
console.log("  " + pad("", 20) + new Array(18, "-").join("-"));
console.log("  " + pad("TOTAL", 20) + pad(report.total, 7) + " entries across " + report.shelves + " files");

console.log("\nchecks\n" + new Array(58, "-").join("-"));
var failed = false;
function line(name, list) {
  var n = list.length;
  if (n > 0) {
    failed = true;
    console.log("  FAIL  " + pad(name, 34) + pad(n, 6));
    list.slice(0, 10).forEach(function (x) { console.log("          - " + x); });
    if (n > 10) console.log("          ... and " + (n - 10) + " more");
  } else {
    console.log("  ok    " + pad(name, 34) + pad(0, 6));
  }
}

line("malformed JSON", report.malformed);
line("duplicate ids", report.dupIds);
line("duplicate concepts", report.dupConcepts);
line("near-duplicate answers", report.dupAnswers);
line("empty answers", report.emptyAnswers);
line("thin answers (<" + MIN_ANSWER_HARD + " chars)", report.thinAnswers);
line("missing required fields", report.missingFields);
line("malformed ids", report.badIds);
line("topic mismatch", report.topicMismatch);
line("empty or phrase keywords", report.badKeywords);
line("dead router keys (" + REG.shelves.length + " shelves)", deadKeys);
/* Informational, not a failure: a two-word subject is a real name, it
   just cannot be a bridge target and memory will report it verbatim. */
if (report.multiwordConcept.length) {
  console.log("  note  " + pad("multi-word concepts", 34) + pad(report.multiwordConcept.length, 6) +
              "(not a bridge target; fine when the subject really is two words)");
}
if (MIN_PER_SHELF) line("shelves under " + MIN_PER_SHELF, report.underMin);

console.log("\n" + new Array(58, "=").join("="));
console.log(failed ? "  RESULT: FAIL - fix the above before shipping" : "  RESULT: PASS");
console.log(new Array(58, "=").join("=") + "\n");
process.exit(failed ? 1 : 0);

