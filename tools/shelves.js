/* ============================================================
   bokskie-v1 · tools/shelves.js
   ------------------------------------------------------------
   THE SHELF REGISTRY - and therefore the shape of the whole
   knowledge base. One row per JSON file the bank is made of,
   organised as the tree a person actually browses:

     Cebuano
       +-- Basic words
       +-- Greetings
       +-- ...

   TREE below is that tree. Everything else in this file is
   DERIVED from it - `shelves`, `byId`, the id prefixes, the
   router keys. There is no second table to keep in step, which
   is the whole point: this used to be three hardcoded tables
   (SHELVES in build-kb.js, SHELVES in verify-kb.js, TOPICS in
   engine/intent.js), so adding a category meant editing three
   places and remembering all three. Forgetting one produced a
   shelf that built fine and could never be routed to, which is
   the worst kind of bug: it looks like a weak answer rather
   than a missing table.

   ROW FORMAT, per subcategory
     [ slug, Title, routerKeys ]

       slug   kebab-case id. data/<group>-<slug>.json and
              tools/source/<group>-<slug>.kb are both named
              after it, so the tree is greppable end to end.
       Title  display name. Goes into the JSON and the bundle so
              a UI can render the tree without hardcoding labels.
       keys   router keywords, comma separated, and ONLY for
              words a person would type that are not already
              the shelf name. Optional.

   WHY `keys` MUST BE STEMMED
   --------------------------
   The router matches against tokens, and tokens are stemmed, so
   "programming" as a key can never fire - the stemmer yields
   "programm". That shipped, took the 0.55x off-topic penalty on
   correct answers, and made a bare "lets talk about programming"
   refuse. verify-kb.js now lints every declared key for exactly
   this, so a new shelf cannot reintroduce it.

   The same trap catches the shelf NAME, because
   engine/intent.js derives a key from every word in `sub`. A
   sub called "conversations" contributes the key
   "conversations", which tokenize() can never produce. So any
   sub whose word stems differently must also list the stemmed
   form in `keys`. The lint reports those too.

   WHY ids CARRY THE SUB
   ---------------------
   `prefix` used to be per-GROUP, so every shelf in a group
   started at 000001: ceb-basic-words-000001 and
   ceb-greetings-000001 were the same id. kb.byId is a plain
   object, so the second one silently overwrote the first and a
   lookup could return an entry from the wrong shelf. Ids are now
   groupPrefix + sub, which is unique by construction, and
   assertPrefixes() fails the build if that ever stops being true.
   ============================================================ */

"use strict";

var path = require("path");

/* The engine's own stemmer, so a shelf author writes "greetings" and
   the router receives "greet". Without this, `keys` had to be written
   pre-stemmed by hand, which is a trap you cannot see: a key that is
   not already stemmed is a key nothing can ever produce, so the shelf
   loads, validates, and is simply never routed to. The symptom is a
   vague answer rather than a config error, which is the worst kind.

   This is a node-only require and that is fine - shelves.js is
   consumed by the build tools and by engine/index.js's node branch
   only. The browser gets its copy from the generated bundle, which
   carries the already-normalised values. */
var T = require(path.join(__dirname, "..", "engine", "tokenizer.js"));

/* One pass, and that is the whole point.

   tokenize() calls the stemmer exactly once per word, so a key must
   be stemmed exactly once to be the same string the router compares
   against. Peeling to a fixed point looked tidier and was wrong:
   "nursing" stems once to "nurs", which IS the token, and then stems
   again to "nur", which is nothing anyone types. The over-stemmed key
   was dead, so "is nursing hard" routed to no topic at all and
   refused, while the nursing shelf sat there fully written.

   A single pass is also self-consistent, which is what the lint needs:
   "phrases" stems once to "phras", and stemming "phras" changes
   nothing, so a stored "phras" is never flagged. Two stems that end
   up equal is not a thing to avoid, it is a thing to have. */
function toStem(word) {
  var w = String(word).trim();
  return w ? T.stem(T.canonical(w)) : "";
}

/* Every word of the shelf NAME, in the form the router compares
   against. engine/intent.js builds a key from each word of `sub` and
   `group` without stemming, so a shelf called "conversations"
   contributes "conversations" - a token tokenize() can never produce,
   and a dead key. Adding the stemmed form here means the name
   actually routes, and means an author never has to think about it. */
function nameWords(slug) {
  var out = [];
  String(slug).replace(/-/g, " ").split(/\s+/).forEach(function (w) {
    if (w.length < 2) return;
    var stem = toStem(w);
    if (out.indexOf(stem) === -1) out.push(stem);
  });
  return out;
}

/* Words a person types that the shelf name does not already cover.
   Normalised to their stemmed form, which is what the router
   compares against, and de-duplicated because "programming" and
   "programm" are the same key after this. */
function routerKeys(csv) {
  var out = [];
  String(csv || "").split(",").forEach(function (k) {
    k = k.trim();
    if (!k) return;
    var stem = toStem(k);
    if (out.indexOf(stem) === -1) out.push(stem);
  });
  return out;
}

var TREE = [
  /* ---------------- Cebuano ---------------- */
  { id: "cebuano", title: "Cebuano", lang: "bisaya", subs: [
    ["basic-words",          "Basic words",          "kaayo, sayop, oo"],
    ["greetings",           "Greetings",           "kumusta, kamusta, salamat, greeting"],
    ["pronouns",            "Pronouns",            "ako, ikaw, kami, sila, siya"],
    ["question-words",      "Question words",      "unsa, kinsa, asa, ngano, question"],
    ["common-verbs",        "Common verbs",        "buhaton, sulat, kaon, verb"],
    ["common-adjectives",   "Common adjectives",   "gamay, dako, maayo, adjective"],
    ["family",              "Family",              "pamilya, mama, papa, akong"],
    ["food",                "Food",                "pagkain, kanin, tubig, mangga"],
    ["places",              "Places",              "pilipinas, siyudad, balay, lugar"],
    ["time",                "Time",                "kanus, oras, adlaw, buntag"],
    ["numbers",             "Numbers",             "usa, duha, tulo, upat, number"],
    ["directions",          "Directions",          "tuyd, direksiyon, direction"],
    ["emotions",            "Emotions",            "dugtong, kalayo, masaya, emotion"],
    ["school",              "School",              "eskwela, klase, aralan, esamin"],
    ["work",                "Work",                "trabaho, empleyado, swerte, katapangan"],
    ["technology",          "Technology",          "kompyuter, telepono, device, teknolohiya"],
    ["internet",            "Internet",            "internet, wifi, website, online"],
    ["programming-terms",   "Programming terms",   "program, kode, function, variable"],
    ["health-vocabulary",   "Health vocabulary",   "sakit, kramat, doktor, ospital"],
    ["casual-conversation", "Casual conversation", "naa, gayud, unya, kumusta"],
    ["slang",               "Slang",               "slang, jarg, cheugy"],
    ["filipino-cebuano",    "Filipino to Cebuano", "pagkatransnya, kaugsa, translation"],
    ["english-cebuano",     "English to Cebuano",  "english, bisaya, tagalog, translation"],
    ["common-phrases",      "Common phrases",      "salamat, tabang, paalam, palagi"],
    ["questions",           "Questions",           "tanong, tanungon, question"],
    ["commands",            "Commands",            "pudong, palangi, sugdan, command"],
    ["negation",            "Negation",            "dili, wala, kanang, negation"],
    ["grammar",             "Grammar",             "gramatika, grammar, suffix, affix"],
    ["sentence-patterns",   "Sentence patterns",   "pattern, sentence, syntax, structure"],
    ["everyday-bisaya-conversations", "Everyday Bisaya conversations", "bisaya, everyday, chat"]
  ]},
  /* ---------------- Filipino ---------------- */
  { id: "filipino", title: "Filipino", lang: "tagalog", subs: [
    ["basic-words",          "Basic words",          "mahal, mura, wala, oo"],
    ["greetings",           "Greetings",            "kumusta, maganda, salamat, greeting"],
    ["pronouns",            "Pronouns",             "ako, ikaw, tayo, kami, kayo"],
    ["question-words",      "Question words",       "ano, sino, saan, bakit, question"],
    ["common-verbs",        "Common verbs",         "gawa, kain, kuha, verb"],
    ["common-adjectives",   "Common adjectives",    "maganda, masama, malaki, adjective"],
    ["family",              "Family",               "pamilya, ama, ina, kapatid"],
    ["food",                "Food",                 "pagkain, kanin, tubig, prutas"],
    ["places",              "Places",               "pilipinas, lungsod, bahay, lugar"],
    ["time",                "Time",                 "kanino, ngayon, oras, araw"],
    ["numbers",             "Numbers",              "isa, dalawa, tatlo, apat, number"],
    ["directions",          "Directions",           "kaliwa, kanan, direksiyon, direction"],
    ["emotions",            "Emotions",             "kagalit, malungkot, natutulog, emotion"],
    ["school",              "School",               "paaralan, klase, aral, pagsubok"],
    ["work",                "Work",                 "trabaho, kompanya, swerte, kasipagan"],
    ["technology",          "Technology",           "kompyuter, telepono, device, teknolohiya"],
    ["internet",            "Internet",             "internet, wifi, website, online"],
    ["programming-terms",   "Programming terms",    "program, kode, function, variable"],
    ["health-vocabulary",   "Health vocabulary",    "sakit, gamot, doktor, ospital"],
    ["casual-conversation", "Casual conversation",  "ba, naman, pala, sana"],
    ["slang",               "Slang",                "slang, jarg, cheeky"],
    ["filipino-grammar",    "Filipino grammar",     "gramatika, grammar, pangngalan, panghalip"],
    ["sentence-patterns",   "Sentence patterns",    "pattern, sentence, syntax, structure"],
    ["everyday-filipino-conversations", "Everyday Filipino conversations", "filipino, everyday, conversation"]
  ]},
  /* ---------------- English ---------------- */
  { id: "english", title: "English", lang: "english", subs: [
    ["basic-vocabulary",     "Basic vocabulary",    "vocabulary, word, meaning, basic"],
    ["greetings",            "Greetings",           "hello, hi, hey, morning, greeting"],
    ["pronouns",             "Pronouns",            "pronoun, he, she, they, we"],
    ["question-words",       "Question words",      "what, who, where, when, why, question"],
    ["verbs",                "Verbs",               "verb, tense, infinitive, gerund"],
    ["adjectives",           "Adjectives",          "adjective, describe, comparative"],
    ["family",               "Family",              "family, mother, father, sibling"],
    ["food",                 "Food",                "food, rice, bread, fruit"],
    ["places",               "Places",              "country, city, town, place"],
    ["time",                 "Time",                "hour, minute, day, clock"],
    ["numbers",              "Numbers",             "number, digit, count, integer"],
    ["directions",           "Directions",          "left, right, north, direction"],
    ["emotions",             "Emotions",            "happy, sad, angry, emotion"],
    ["school",               "School",              "school, teacher, class, student"],
    ["work",                 "Work",                "job, office, employee, career"],
    ["technology",           "Technology",          "computer, phone, device, gadget"],
    ["internet",             "Internet",            "internet, wifi, website, browser"],
    ["programming",          "Programming",         "code, function, loop, program"],
    ["health",               "Health",              "health, doctor, medicine, patient"],
    ["grammar",              "Grammar",             "grammar, article, preposition, clause"],
    ["sentence-patterns",    "Sentence patterns",   "pattern, sentence, structure, phrase"],
    ["everyday-conversations", "Everyday conversations", "everyday, conversation, chat"]
  ]},
  /* ---------------- Programming ---------------- */
  { id: "programming", title: "Programming", lang: "english", subs: [
    ["javascript",       "JavaScript",           "javascript, ecmascript, js"],
    ["html",             "HTML",                 "html, markup, tag, element"],
    ["css",              "CSS",                  "css, stylesheet, selector, flexbox"],
    ["php",              "PHP",                  "php, laravel, symfony"],
    ["python",           "Python",               "python, pip, django, flask"],
    ["java",             "Java",                 "java, jvm, jdk, maven"],
    ["c",                "C",                    "ansi, gcc, pointer"],
    ["cpp",              "C++",                  "cpp, stl, boost"],
    ["csharp",           "C#",                   "csharp, dotnet, asp.net"],
    ["sql",              "SQL",                  "sql, query, table, select"],
    ["nodejs",           "Node.js",              "node, npm, express, require"],
    ["vue",              "Vue",                  "vue, nuxt, component"],
    ["react",            "React",                "react, jsx, nextjs, hook"],
    ["apis",             "APIs",                 "api, endpoint, rest, json, request"],
    ["git",              "Git",                  "git, commit, branch, merge"],
    ["github",           "GitHub",               "github, pull, repository, issue"],
    ["debugging",        "Debugging",            "debug, breakpoint, stack, trace"],
    ["algorithms",       "Algorithms",           "algorithm, complexity, sorting, search"],
    ["data-structures",  "Data structures",      "array, linked, hash, tree, stack"],
    ["concepts",         "Programming concepts", "oop, recursion, variable, function, loop, concept"]
  ]},
  /* ---------------- Science ---------------- */
  { id: "science", title: "Science", lang: "english", subs: [
    ["physics",         "Physics",           "motion, force, energy, mass, wave"],
    ["chemistry",       "Chemistry",         "atom, element, molecule, reaction, acid"],
    ["biology",         "Biology",           "cell, gene, organism, evolution, dna"],
    ["astronomy",       "Astronomy",         "planet, star, galaxy, orbit, telescope"],
    ["earth-science",   "Earth science",     "rock, tectonic, atmosphere, climate"],
    ["environment",     "Environment",       "environment, pollution, ecosystem, recycle"],
    ["general-science", "General science",   "science, experiment, hypothesis, method"]
  ]},
  /* ---------------- Mathematics ---------------- */
  { id: "mathematics", title: "Mathematics", lang: "english", subs: [
    ["arithmetic",    "Arithmetic",     "addition, multiply, divide, percent"],
    ["algebra",       "Algebra",        "equation, variable, solve, linear"],
    ["geometry",      "Geometry",       "triangle, circle, angle, area, volume"],
    ["trigonometry",  "Trigonometry",   "sine, cosine, tangent, radians"],
    ["statistics",    "Statistics",     "mean, median, average, variance, sample"],
    ["probability",   "Probability",    "odds, chance, random, distribution"],
    ["calculus",      "Calculus",       "derivative, integral, limit, slope"]
  ]},
  /* ---------------- Technology ---------------- */
  { id: "technology", title: "Technology", lang: "english", subs: [
    ["computers",          "Computers",          "computer, cpu, ram, machine"],
    ["smartphones",        "Smartphones",        "smartphone, android, iphone, app"],
    ["operating-systems",  "Operating systems",  "linux, windows, kernel, process"],
    ["hardware",           "Hardware",           "chip, gpu, disk, ssd, device"],
    ["software",           "Software",           "software, application, install, update"],
    ["networking",         "Networking",         "router, dns, tcp, ip, vpn, lan"],
    ["internet",           "Internet",           "browser, website, wifi, download"],
    ["cloud",              "Cloud",              "cloud, aws, server, container, saas"],
    ["ai",                 "AI",                 "ai, model, training, neural, chatbot"],
    ["cybersecurity",      "Cybersecurity",      "malware, phishing, password, encryption"]
  ]},
  /* ---------------- General knowledge ---------------- */
  { id: "general-knowledge", title: "General Knowledge", lang: "english", subs: [
    ["geography",      "Geography",      "country, capital, river, mountain"],
    ["history",        "History",        "war, empire, century, revolution"],
    ["countries",      "Countries",      "japan, brazil, india, france, nation"],
    ["culture",        "Culture",        "language, tradition, festival, cuisine"],
    ["animals",        "Animals",        "mammal, bird, reptile, species, extinct"],
    ["space",          "Space",          "galaxy, universe, planet, nasa"],
    ["transportation", "Transportation", "train, bus, airplane, ship, transport"],
    ["everyday-facts", "Everyday facts", "fact, everyday, money, budget, tip"],
    ["artists", "Artists", "artist, painter, musician, actor, sculpture, famous"],
    ["news", "News", "news, headline, report, journalist, live, media"],
    ["weather", "Weather", "weather, forecast, temperature, storm, rain"],
    ["time", "Time", "time, clock, calendar, timezone, daylight"]
  ]},
  /* ---------------- Courses and programmes ----------------
     Aimed squarely at the questions that were refusing: "what course
     should I take", "what is midwifery", "is IT worth it". Each sub is
     one field, so "is midwifery hard" lands on the shelf that can
     actually answer rather than on a general education shelf. */
  { id: "courses", title: "Courses", lang: "english", subs: [
    ["nursing", "Nursing", "nursing, nurse, ward, patient, shift, care"],
    ["midwifery", "Midwifery", "midwifery, midwife, birth, antenatal, labour"],
    ["education", "Education", "teaching, teacher, classroom, curriculum, student, educ, course, major, graduate"],
    ["information-technology", "Information technology", "it, computing, network, system, support"],
    ["business", "Business", "business, management, marketing, finance, company"],
    ["engineering", "Engineering", "engineering, engineer, design, build, technical"],
    ["accountancy", "Accountancy", "accountancy, accountant, audit, ledger, tax"],
    ["criminology", "Criminology", "criminology, crime, offender, prison, justice"],
    ["culinary", "Culinary", "culinary, chef, cooking, kitchen, recipe"],
    ["architecture", "Architecture", "architecture, architect, building, design, structure"],
    ["law", "Law", "law, lawyer, court, legal, statute, case"],
    ["medicine", "Medicine", "medicine, doctor, hospital, diagnose, patient"]
  ]},
  /* ---------------- Health ---------------- */
  { id: "health", title: "Health", lang: "english", subs: [
    ["body",               "Body",               "organ, muscle, bone, heart, lung"],
    ["symptoms",           "Symptoms",           "fever, pain, cough, dizzy, sore"],
    ["injury",             "Injury",             "injury, injured, injure, hurt, damage, bleeding, emergency, first, aid, bone, fracture, arm, wound, treat"],
    ["diseases",           "Diseases",           "diabetes, asthma, infection, chronic"],
    ["medicine-vocabulary","Medicine vocabulary","medicine, dose, tablet, prescription, drug"],
    ["first-aid",          "First aid",          "bleeding, burn, cpr, emergency, wound"],
    ["nutrition",          "Nutrition",          "protein, vitamin, calorie, diet, mineral"],
    ["education",          "Health education",   "hygiene, exercise, prevention, health"]
  ]},
  /* ---------------- Conversations ---------------- */
  { id: "conversations", title: "Conversations", lang: "english", subs: [
    ["greetings",          "Greetings",            "hello, hi, welcome, introduce, greeting"],
    ["small-talk",         "Small talk",           "weather, weekend, news, how"],
    ["asking-questions",   "Asking questions",     "ask, question, wonder, curious"],
    ["casual-chat",        "Casual chat",          "chat, casual, hang, talk"],
    ["thanks",             "Thanks",               "thank, appreciate, welcome, grateful"],
    ["apologies",          "Apologies",            "sorry, excuse, forgive, mistake"],
    ["goodbyes",           "Goodbyes",             "bye, goodbye, farewell, see"],
    ["emotions",           "Emotions",             "happy, sad, tired, excited, worried"],
    ["relationships",      "Relationships",        "relationship, boundary, trust, partner"],
    ["friendly-conversation", "Friendly conversation", "friendly, company, banter, rapport"],
    ["context-follow-up",  "Context / follow-up",  "context, follow, remind, earlier, memory"]
  ]},
  /* ---------------- Legacy shelves, kept so nothing is lost --------

     These two are NOT part of the tree above. They were in the bank
     before the tree existed and they hold 12 hand-written entries, so
     dropping them silently would be the worst outcome. They are
     registered as real shelves (routable, buildable, validated) and
     flagged `extra` in tools/build-tree.js so a reader can see they
     are additions rather than part of the intended shape. Delete these
     two blocks and the two .kb files to remove them. */
  { id: "sports", title: "Sports", lang: "english", extra: true, subs: [
    ["football", "Football", "soccer, goal, match, striker, league"],
    ["basketball", "Basketball", "nba, dunk, court, points, rebound"],
    ["volleyball", "Volleyball", "spike, set, serve, rally, net"],
    ["swimming", "Swimming", "pool, lane, freestyle, breaststroke, swim"],
    ["running", "Running", "marathon, sprint, pace, jog, distance"],
    ["tennis", "Tennis", "serve, deuce, set, rally, grand, slam"],
    ["badminton", "Badminton", "shuttlecock, smash, shuttle, court, doubles"],
    ["martial-arts", "Martial arts", "judo, boxing, kick, stance, round"],
    ["athletics", "Athletics", "sprint, hurdles, relay, jump, throw"],
    ["fitness", "Fitness", "strength, cardio, routine, mobility, recovery"]
  ]},
  { id: "study", title: "Study", lang: "english", extra: true, subs: [
    ["motivation", "Motivation", "focus, habit, procrastination, discipline"],
    ["techniques", "Study techniques", "recall, revision, flashcard, method, memorise"],
    ["time-management", "Time management", "schedule, prioritise, deadline, plan, hour"],
    ["exam-prep", "Exam prep", "exam, mock, past, paper, syllabus, revise"],
    ["memory", "Memory", "forget, retention, encode, mnemonic, recall"],
    ["reading", "Reading", "skim, read, comprehension, summary, detail"],
    ["writing", "Academic writing", "essay, paragraph, thesis, draft, edit"],
    ["research", "Research", "source, cite, hypothesis, data, method"]
  ]}
];

/* ---- derivation ------------------------------------------------ */

/* Two or three letters, so an id stays readable at a glance. Explicit
   for the groups that already have ids written against them in tests
   and comments; the rest are derived by dropping a trailing vowel run
   and taking three characters. */
var PREFIX = {
  cebuan: "ceb", filipin: "fil", english: "eng", programm: "prg",
  scienc: "sci", mathematic: "mat", technolog: "tec",
  "general-knowledge": "gen", health: "hea", conversation: "con",
  sport: "spo", stud: "stu"
};

function groupPrefix(group) {
  if (PREFIX[group]) return PREFIX[group];
  var g = String(group);
  while (g.length > 3 && /[aeiou]$/.test(g)) g = g.slice(0, -1);
  return g.slice(0, 3);
}

/* The id prefix for a SHELF, not a group. See the header: a per-group
   prefix made every shelf in a group emit the same ids. */
function prefixFor(group, sub) {
  return groupPrefix(group) + "-" + sub;
}

/* Where a shelf physically lives, relative to data/ and to
   tools/source/. The tree is not just a list of names any more: each
   group is a real directory and each subcategory a real file inside
   it, so `data/cebuano/basic-words.json` rather than a flat
   `cebuano-basic-words.json`.

   Forward slashes on purpose. This string is used three ways - a node
   path.join, a browser fetch URL, and a key in the manifest - and
   path.join on Windows would hand back backslashes, which work on
   disk and then break every fetch. One form, used everywhere. */
function shelfRel(group, sub) {
  return group + "/" + sub;
}

var shelves = [];
var byId = Object.create(null);
var seenPrefix = Object.create(null);

TREE.forEach(function (g, gi) {
  g.subs.forEach(function (row, si) {
    var sub = row[0], title = row[1], keys = row[2] || "";
    var prefix = prefixFor(g.id, sub);
    var shelf = {
      id: g.id + "-" + sub,
      group: g.id,
      groupTitle: g.title,
      sub: sub,
      title: title,
      lang: g.lang || "english",
      topic: g.id + "-" + sub,
      prefix: prefix,
      /* The physical layout. `rel` is the shared stem, `file` and
         `sourceFile` are the two things built from it. */
      rel: shelfRel(g.id, sub),
      file: shelfRel(g.id, sub) + ".json",
      sourceFile: shelfRel(g.id, sub) + ".kb",
      order: [gi, si],
      extra: !!g.extra,
      keys: routerKeys(keys).concat(nameWords(sub)).concat(nameWords(g.id))
        .filter(function (k, i, all) { return all.indexOf(k) === i; })
    };
    /* A repeated prefix is the id-collision bug this whole function
       exists to prevent, and it is silent everywhere downstream:
       kb.byId is a plain object, so the second entry overwrites the
       first and a lookup returns a different shelf's answer. Fail at
       module load, where the message can name the two rows. */
    if (seenPrefix[prefix]) {
      throw new Error("shelves.js: duplicate id prefix \"" + prefix + "\" from " +
                      seenPrefix[prefix] + " and " + shelf.id +
                      " - two shelves would emit the same ids");
    }
    seenPrefix[prefix] = shelf.id;
    if (byId[shelf.id]) {
      throw new Error("shelves.js: duplicate shelf id \"" + shelf.id + "\"");
    }
    byId[shelf.id] = shelf;
    shelves.push(shelf);
  });
});

/* The tree, kept as a nested shape for anything that wants to render
   or walk it (tools/build-tree.js does). Derived, so it can never
   disagree with the flat list. */
var groups = TREE.map(function (g, gi) {
  return {
    id: g.id,
    title: g.title,
    lang: g.lang || "english",
    extra: !!g.extra,
    order: gi,
    subs: g.subs.map(function (row, si) {
      return {
        slug: row[0],
        title: row[1],
        shelf: g.id + "-" + row[0],
        topic: g.id + "-" + row[0],
        order: si
      };
    })
  };
});

var byGroup = Object.create(null);
groups.forEach(function (g) { byGroup[g.id] = g; });

module.exports = {
  tree: TREE,
  groups: groups,
  byGroup: byGroup,
  shelves: shelves,
  byId: byId,
  groupPrefix: groupPrefix,
  prefixFor: prefixFor,
  shelfRel: shelfRel
};
