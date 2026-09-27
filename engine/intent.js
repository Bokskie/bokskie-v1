/* ============================================================
   bokskie-v1 · engine/intent.js
   ------------------------------------------------------------
   Two jobs, and keeping them apart matters:

   1. TOPIC  - "which shelf do I look in". Cheap, and it is what
               makes the system scale: only the chosen topic is
               scored, not all 100k entries. A mis-routed topic
               still finds the right answer if shelves overlap.

   2. INTENT - "what kind of answer is wanted". A greeting wants
               a greeting. A "how do I" wants steps. A "what is"
               wants a definition. Getting this wrong is what makes
               a bot answer a greeting with an essay.

   Both return a confidence, and that confidence is load-bearing.
   Low confidence must never silently become a confident answer.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BokskieIntent = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Topic router. Weights matter: "javascript" should pull
     programming hard on its own, while "history" alone is weaker
     evidence because it is a word people use loosely. */
  var TOPICS = {
    programming: {
      keys: {
        javascript: 3, js: 2, html: 3, css: 3, python: 3, java: 2,
        code: 2, coding: 3, program: 2, programming: 3, function: 2,
        variable: 2, array: 2, loop: 2, method: 2, object: 1,
        bug: 2, debug: 3, error: 1, syntax: 2, api: 2, json: 2,
        framework: 2, library: 2, node: 2, react: 3, vue: 3, angular: 3,
        typescript: 3, database: 2, sql: 3, server: 2, deploy: 2,
        git: 2, github: 2, algorithm: 3, stack: 1, compile: 2, script: 2,
        /* Stemmed forms. The router compares against tokens, and tokens
           are stemmed - so a key that is not itself stemmed is a key
           nothing can ever produce. The stemmer turns "programming"
           into "programm" and "coding" into "cod", so those two keys
           above were dead, and a bare "lets talk about programming"
           routed to nothing. verify-engine.js now lints for this
           class of key so it cannot come back quietly. */
        programm: 3, cod: 2,
        php: 2, golang: 2, rust: 2, kotlin: 2, swift: 2, backend: 2,
        frontend: 2, dev: 1, software: 2, prompt: 2,
        /* Native-language keys. The lexicon bridge folds many of these
           onto their English concept already, but a router that only
           knows English mis-files every question whose subject word is
           not in the lexicon - and a mis-routed shelf is a 0.55x
           penalty on the eventual winner, so this is not cosmetic. */
        programa: 3, kompyuter: 2, kode: 2, "c++": 2, "c#": 2, web: 2
      }
    },
    science: {
      keys: {
        science: 3, atom: 3, molecule: 3, physics: 3, chemistry: 3,
        biology: 3, cell: 2, dna: 3, gravity: 3, energy: 2, electron: 3,
        quantum: 3, planet: 2, experiment: 2, scientist: 2,
        relativity: 3, evolution: 3, gene: 2, protein: 2, chemical: 2,
        reaction: 2, lab: 2, mass: 2, velocity: 3, orbit: 3,
        /* Tagalog / Bisaya */
        syansiya: 3, kimika: 3, biologya: 3, fizika: 3, atomo: 3,
        molekula: 3, "dna": 3, enerhiya: 2, planeta: 2, gravitation: 3
      }
    },
    mathematics: {
      keys: {
        math: 3, mathematics: 3, algebra: 3, geometry: 3, calculus: 3,
        equation: 3, solve: 2, sum: 2, product: 2, prime: 3, number: 1,
        fraction: 3, decimal: 2, percent: 2, integral: 3, derivative: 3,
        theorem: 3, triangle: 3, circle: 2, angle: 2, area: 2, volume: 2,
        formula: 3, matrix: 2, vector: 2, statistic: 3, probability: 3,
        /* Tagalog / Bisaya */
        matematika: 3, kalkulasyon: 3, kabuuan: 2, trilangkulo: 3,
        kuwadrado: 2, bahin: 2, tinong: 2
      }
    },
    geography: {
      keys: {
        geography: 3, country: 2, capital: 3, city: 2, map: 2, river: 3,
        mountain: 3, ocean: 3, continent: 3, island: 3, province: 2,
        climate: 2, latitude: 3, longitude: 3, population: 2,
        philippines: 3, asia: 2, europe: 2, africa: 2, landmark: 2, border: 3,
        /* `philippin` is the one that actually fires. The stemmer strips
           a trailing "es" from "philippines", so the plural written above
           could never be produced by tokenize() and the key was dead -
           the topic routed on nothing. Listing the stemmed form is the
           same reason science lists both "gravity" and "gravitation". */
        philippin: 3, pilipinas: 3, pilipina: 3,
        /* Tagalog / Bisaya */
        geograpiya: 3, bansa: 3, syudad: 2, kabisodao: 2, kapangalan: 3,
        dagat: 2, bundok: 3, ilawom: 2, klimat: 2, hanginan: 2
      }
    },
    history: {
      keys: {
        history: 3, historical: 3, war: 3, empire: 3, ancient: 3,
        century: 3, revolution: 3, dynasty: 3, king: 2, queen: 2,
        colonize: 3, independence: 2, treaty: 3, medieval: 3, world: 1,
        /* Tagalog / Bisaya */
        kasaysayan: 3, gubat: 3, imperyo: 3, siningkod: 3, rebolusyon: 3,
        henerasyon: 2, kaharianan: 3, kasunod: 2, driyri: 2
      }
    },
    health: {
      keys: {
        health: 3, sick: 3, illness: 3, fever: 3, cough: 3,
        medicine: 3, doctor: 2, hospital: 3, pain: 2, hurt: 2,
        symptom: 3, virus: 2, bacteria: 2, infection: 3, allergy: 3,
        diabetes: 3, cancer: 2, stress: 2, sleep: 2, nutrition: 3,
        exercise: 2, diet: 2, vitamin: 3, mental: 2, anxiety: 3,
        /* Tagalog / Bisaya. `katulog` is deliberately absent - the
           lexicon folds it onto `sleep`, which is already a key, so
           listing both would be two routes to one place. */
        karamat: 3, sakit: 3, pagamot: 3, doktor: 2, ospital: 3,
        ngipon: 2, ehersisyo: 2, pagkain: 2, pamamagitan: 2
      }
    },
    money: {
      keys: {
        money: 3, budget: 3, save: 2, savings: 3, invest: 3,
        stock: 2, crypto: 2, bitcoin: 3, loan: 3, debt: 3, price: 2,
        cost: 2, cheap: 2, expensive: 2, salary: 3, income: 2,
        expense: 3, pension: 3, finance: 3, profit: 3, freelance: 2,
        /* Tagalog / Bisaya. `abot` is deliberately not here: it is a
           common word meaning "reach", and weighting it toward money or
           technology would misfile ordinary conversation. */
        pera: 3, kabuhayan: 2, ipon: 3, utang: 3, presyo: 2, gastos: 2,
        kita: 2, sweldo: 3, kabuhay: 2, tubo: 2
      }
    },
    technology: {
      keys: {
        ai: 3, artificial: 3, machine: 2, robot: 2, computer: 2,
        internet: 3, phone: 2, smartphone: 3, app: 2, hardware: 2,
        cloud: 2, encrypt: 3, security: 2, password: 3, network: 2,
        chatgpt: 3, gemini: 3, automation: 2, digital: 2,
        /* Tagalog / Bisaya */
        teknolohiya: 3, makina: 2, telepono: 3, datos: 2,
        seguridad: 2, awtomatiko: 2, linya: 2,
        /* The stemmer has no rule for "-ion", so "encryption" survives
           whole and never reaches the "encrypt" key above. Adding a
           derivational suffix stripper here would be the wrong fix -
           the stemmer is deliberately conservative, and this table
           already lists variant forms explicitly for exactly this
           reason. */
        encryption: 3, cryptography: 3, hashing: 2
      }
    },

    /* ---- the shelves added for the large bank -------------------
       These are new topic keys, not a change to how routing works.
       The weights matter and they are not uniform:

       The five technical shelves are peers at 2-3, so a question that
       names one of them clearly wins. They overlap - "server" touches
       networking, computers and databases - and that is fine, because
       topic is a soft preference (0.55x off-topic) and the second
       ranked topic is a free fallback.

       The four catch-all shelves are deliberately held at weight 1.
       "english", "filipino", "cebuano", "conversations" and
       "general-knowledge" are the places a question lands when nothing
       more specific applies, so a single shared word in one of them
       must never outrank a real subject. At weight 1 it takes three
       such words to outscore a single weight-3 hit, which is the right
       way round: better to search the wrong catch-all shelf and let
       scoring sort it out than to route a genuine question away from
       its own topic. */
    "web-development": {
      keys: {
        html: 3, css: 3, dom: 3, browser: 3, frontend: 2, markup: 3,
        stylesheet: 3, responsive: 2, flexbox: 3, grid: 2, accessibility: 2,
        javascript: 1, cookie: 2, localstorage: 3, http: 2, url: 2,
        anchor: 2, div: 2, span: 2, tag: 1, class: 1, id: 1, header: 1,
        footer: 1, navbar: 2, form: 1, input: 1, button: 1, meta: 1,
        viewport: 2, webpage: 3, website: 2, page: 1, render: 2,
        pahina: 2, "web development": 3
      }
    },
    computers: {
      keys: {
        computer: 3, cpu: 3, ram: 3, harddrive: 3, ssd: 3, motherboard: 3,
        gpu: 3, graphics: 2, processor: 3, memory: 2, storage: 2, disk: 2,
        laptop: 2, desktop: 2, monitor: 2, keyboard: 2, mouse: 2,
        binary: 3, bit: 2, byte: 3, operating: 2, windows: 1, linux: 2,
        macos: 2, kernel: 3, file: 1, folder: 1, directory: 2, cache: 3,
        kompyuter: 3,
        /* Stemmed forms - see the note in the programming keys. */
        proces: 2, thread: 2, hardwar: 2, softwar: 2,
        /* Caught by the dead-key lint, not by reading: "graphics",
           "windows" and "operating" are each stemmed before the router
           ever sees them, so the unstemmed spellings above were dead. */
        graphic: 2, window: 1, operat: 2
      }
    },
    networking: {
      keys: {
        network: 3, router: 3, lan: 3, wan: 3, dns: 3, ip: 3, tcp: 3,
        udp: 3, bandwidth: 3, latency: 3, gateway: 3, switch: 2, ethernet: 3,
        wifi: 3, firewall: 2, packet: 3, protocol: 2, port: 2, subnet: 3,
        internet: 1, broadband: 3, fiber: 2, dialup: 3, hub: 2, bridge: 2,
        /* Stemmed forms - see the note in the programming keys. */
        vpn: 3, ethernet: 3, packet: 3, latenci: 2, subn: 2,
        "computer network": 3
      }
    },
    databases: {
      keys: {
        database: 3, sql: 3, table: 2, query: 2, schema: 3, index: 2,
        primary: 1, foreign: 1, key: 1, row: 1, column: 2, join: 3,
        normalize: 2, transaction: 3, commit: 2, nosql: 3, redis: 3,
        postgres: 3, mysql: 3, sqlite: 3, mongodb: 3, backup: 2,
        data: 1, records: 2, relational: 3, crud: 3
      }
    },
    cybersecurity: {
      keys: {
        security: 2, malware: 3, virus: 1, ransomware: 3, phishing: 3,
        hacker: 3, exploit: 3, vulnerability: 3, patch: 2, firewall: 2,
        encryption: 1, authentication: 3, authorization: 3, two: 1,
        factor: 1, cipher: 3, brute: 3, injection: 3, sql: 1, xss: 3,
        csrf: 3, cyber: 3, cyberattack: 3, privacy: 2, breach: 3,
        "computer security": 3
      }
    },
    "general-knowledge": {
      keys: {
        what: 1, why: 1, how: 1, who: 1, when: 1, where: 1, which: 1,
        explain: 1, meaning: 1, difference: 1, example: 1, fact: 1,
        trivia: 3, general: 1, knowledge: 1, information: 1, tell: 1,
        "general knowledge": 3
      }
    },
    english: {
      keys: {
        grammar: 3, spelling: 3, vocabulary: 3, verb: 3, noun: 3,
        adjective: 3, adverb: 3, pronoun: 3, tense: 3, sentence: 2,
        english: 3, word: 1, phrase: 2, idiom: 3, passive: 3,
        active: 2, plural: 3, singular: 2, synonym: 3, antonym: 3,
        infinitive: 3, gerund: 3, preposition: 3
      }
    },
    filipino: {
      keys: {
        tagalog: 3, filipino: 3, kayo: 2, po: 1, mga: 1, ang: 1, ng: 1,
        man: 1, sana: 2, salamat: 2, magandang: 2, maraming: 2,
        wala: 1, may: 1, hindi: 1, ito: 1, iyon: 1, sila: 1,
        wika: 2, grammar: 1, meaning: 1, translate: 2
      }
    },
    cebuano: {
      keys: {
        cebuano: 3, bisaya: 3, visayan: 3, kani: 1, nimo: 1, nato: 1,
        kanila: 1, gyud: 1, jud: 1, kaayo: 1, sayon: 1, unsaon: 1,
        adlaw: 1, gabon: 1, hapon: 1, wika: 1, meaning: 1, translate: 1,
        bis: 1, cebu: 2
      }
    },
    conversations: {
      keys: {
        hello: 1, hi: 1, hey: 1, bye: 1, goodbye: 1, thanks: 1, thank: 1,
        please: 1, sorry: 1, yes: 1, no: 1, ok: 1, okay: 1, help: 1,
        name: 1, welcome: 1, good: 1, morning: 1, night: 1, day: 1,
        kumusta: 1, kamusta: 1, musta: 1, salamat: 1, paalam: 1,
        greetings: 3, farewell: 3, small: 2, chat: 1, talk: 1
      }
    }
  };

  /* Intents are matched by pattern, not by a bag of words, because
     "who are you" and "what is your name" must both land on
     identity, and a bag of words would split them apart. */
  var INTENTS = [
    /* Memory reference is weighted above everything else on purpose.

       "you remember our last topic about sleep" also contains topic-shaped
       words, and if a lower-weight intent won the tie the question would
       be routed into ordinary knowledge search. That is the failure this
       whole feature exists to prevent: the words "you", "remember" and
       "topic" share no vocabulary with the entry that holds the answer,
       so retrieval returns whatever drifted closest and the engine
       confidently describes the wrong subject. The answer to this
       question is in the transcript, not in the bank. */
    { id: "memory_reference", weight: 5, re: /\b(do you remember|you remember|dont you remember|remember (our|my|the|last|what)|naalala mo|naalala ko|naalala ba|naalala nato|ginhapon natin|ginhapon nato|ginhapon tanan|pinag-?usapan (natin|nato|ko|mo)|pinagkay-?iya|unsa (ang )?(in|na)?(pinag-?usapan|ginhapon|topic)|katongod (ba )?nga (kay|ako)|last (topic|subject|question)|previous (topic|subject|question)|what did (we|i) (talk|discuss|say|ask)|we were (talking|discussing)|what was (our|my|the) (last |previous )?(topic|subject|question))\b/ },
    { id: "greeting",   weight: 3, re: /^(hi|hey|hello|yo|sup|hiya|oi|kumusta|kamusta|musta|unsa sayon|magandang (umaga|hapon|gabi|araw)|good (morning|evening|afternoon|day))\b/ },
    /* "salamat" means "thank you", so it lives in gratitude only.
       Listing it in both made farewell win the tie every time. */
    { id: "farewell",   weight: 3, re: /\b(bye|goodbye|see you|paalam|adios|good night|tapos na)\b/ },
    { id: "gratitude", weight: 3, re: /\b(thanks|thank you|salamat|arigato|slapatsa|mabuhay|appreciate)\b/ },
    { id: "identity",   weight: 3, re: /\b(who are you|what are you|your name|who r u|kayo ka|kanimo ka|katongod ka)\b/ },
    { id: "capability", weight: 3, re: /\b(what can you do|who can help|help me|paano ka makakatulong|unsa ka mahimong)\b/ },
    { id: "howto",      weight: 2, re: /\b(how (do|to|can)|paano (ako|ko|mo|kami|ka)|unsaon (ko|mo|nimo|ako|ka)|steps|guide|tutorial|instructions)\b/ },
    { id: "definition", weight: 2, re: /^(what is|what are|what does|define|meaning of|kay unsa)\b/ },
    { id: "price",      weight: 2, re: /\b(how much|cost|price|worth|presyo|magkano)\b/ },
    { id: "why",        weight: 2, re: /\b(why (is|are|do|does)|bakit|gano (nga|man))\b/ },
    { id: "where",      weight: 2, re: /\b(where (is|are|do)|saan|asa ka)\b/ },
    { id: "when",       weight: 2, re: /\b(when (is|are|do)|kailan|kanus-a)\b/ },
    { id: "who",        weight: 2, re: /\b(who (is|are|was|were)|sino|kinsa)\b/ },
    { id: "compare",    weight: 2, re: /\b(difference between| vs | versus |compare|unlike)\b/ },
    { id: "opinion",    weight: 2, re: /\b(do you think|what do you think|your opinion|ikaw ba)\b/ }
  ];

  /* ---- declaring shelves at runtime ----------------------------

     The bank is 100 JSON files. Hardcoding 100 topic tables here would
     be the wrong shape: adding a category would mean editing the router
     by hand, and a miss would produce a shelf that builds, loads, and
     then can never be routed to - which presents as a vague answer
     rather than a config error, and is genuinely hard to trace.

     So a shelf declares its own routing and this registers it. The
     declarations ship inside data/bundle.js, which loads before the
     engine, so the browser ends up with exactly the topics node has.

     Weights are deliberately modest. A per-shelf topic is a NARROWER
     category than the old coarse ones, and a narrow category that wins
     a routing contest steals questions that belonged elsewhere, so
     catching-all is a 2 and the original broad topics keep their
     higher weights. A real subject still beats a guess. */
  function registerShelves(list) {
    if (!list || !list.length) return 0;
    var n = 0, i, j;
    for (i = 0; i < list.length; i++) {
      var s = list[i];
      /* Idempotent: a topic that already exists keeps whatever weight
         it has, so this can never undo a hand-tuned one. */
      if (!s || !s.topic || TOPICS[s.topic]) continue;
      var keys = Object.create(null);
      /* The subcategory name, split on hyphens: a person types
         "first aid", not "health-first-aid". */
      var sub = String(s.sub || "").replace(/-/g, " ").split(/\s+/);
      for (j = 0; j < sub.length; j++) {
        if (sub[j].length >= 2) keys[sub[j]] = 3;
      }
      var g = String(s.group || "").replace(/-/g, " ").split(/\s+/);
      for (j = 0; j < g.length; j++) {
        if (g[j].length >= 2 && keys[g[j]] === undefined) keys[g[j]] = 2;
      }
      /* Declared extras: the words a person actually types that are not
         in the name. Weight 3, because they were written for this job. */
      if (s.keys && s.keys.length) {
        for (j = 0; j < s.keys.length; j++) {
          if (s.keys[j]) keys[s.keys[j]] = 3;
        }
      }
      TOPICS[s.topic] = { keys: keys, shelf: true, lang: s.lang || "english" };
      n++;
    }
    return n;
  }

  /* ---- topic -------------------------------------------------- */

  /* Ranked, not single. A hard topic pick throws away information
     for nothing: the second topic is a free fallback, and overlapping
     shelves are how "what is a good horror film" can still find
     something sane when the router guessed conversation. */
  function topics(tokens) {
    var scored = [];
    for (var name in TOPICS) {
      if (!TOPICS.hasOwnProperty(name)) continue;
      var keys = TOPICS[name].keys;
      var hits = 0;
      var evidence = [];
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (keys[t] !== undefined) { hits += keys[t]; evidence.push(t); }
        else if (keys[t + "s"] !== undefined) { hits += keys[t + "s"] * 0.5; }
      }
      if (hits > 0) scored.push({ topic: name, score: hits, evidence: evidence });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored;
  }

  /* ---- intent ------------------------------------------------- */

  function intents(text) {
    var out = [];
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].re.test(text)) out.push({ intent: INTENTS[i].id, weight: INTENTS[i].weight });
    }
    out.sort(function (a, b) { return b.weight - a.weight; });
    return out;
  }

  /* ---- language ------------------------------------------------ */

  /* Not a detector anyone would call rigorous, but it only has to
     pick which of three banks to answer in, so overlap is fine. */
  function language(text) {
    var w = " " + String(text || "").toLowerCase() + " ";
    var bis = 0, tl = 0, en = 0;
    var bisWords = [" kumusta ", " kamusta ", " musta ", " unsa ", " kinsa ", " asa ", " ngano ", " unsaon ", " kanus-a ", " adlaw ", " maayo ", " sayon ", " salamat ", " dili ", " gyud ", " jud "];
    var tlWords = [" magandang ", " ang ", " mga ", " nang ", " ikaw ", " ito ", " hindi ", " po ", " ba ", " sa ", " ko ", " mo "];
    var enWords = [" the ", " and ", " what ", " how ", " your ", " of ", " to ", " in ", " please ", " thanks ", " how "];
    var i;
    for (i = 0; i < bisWords.length; i++) if (w.indexOf(bisWords[i]) !== -1) bis++;
    for (i = 0; i < tlWords.length; i++) if (w.indexOf(tlWords[i]) !== -1) tl++;
    for (i = 0; i < enWords.length; i++) if (w.indexOf(enWords[i]) !== -1) en++;

    if (bis >= 2 && bis > tl) return "bisaya";
    if (tl >= 2 && tl > en) return "tagalog";
    if (en >= 2) return "english";
    if (bis && !en) return "bisaya";
    if (tl && !en) return "tagalog";
    return "english";
  }

  /* Everything at once - the shape the engine actually wants. */
  function analyse(text, tokens) {
    var t = topics(tokens || []);
    var i = intents(text);
    return {
      topic: t.length ? t[0].topic : null,
      topicScore: t.length ? t[0].score : 0,
      topicRank: t,
      intent: i.length ? i[0].intent : null,
      intentRank: i,
      language: language(text)
    };
  }

  return {
    TOPICS: TOPICS,
    INTENTS: INTENTS,
    registerShelves: registerShelves,
    topics: topics,
    intents: intents,
    language: language,
    analyse: analyse
  };
});
