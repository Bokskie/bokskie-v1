/* ============================================================
   bokskie-v1 · engine/tokenizer.js
   ------------------------------------------------------------
   The cheapest possible first pass: turn a messy human message
   into comparable tokens.

   Why not a real stemmer? English stems are cheap to learn, but
   Tagalog and Bisaya lean on prefixes (mag-, na-, naka-) that a
   suffix stripper destroys. "nag-aabot" and "aabot" must collapse
   together, but "nag" and "aabot" must not be the same word. So:
   a tiny conservative normaliser plus a hand list of Filipino
   prefixes we know are safe to drop.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BokskieTokenizer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Words that carry no retrieval signal. Asking "what is a good horror
     film" and "good horror film" must retrieve the same thing, so the
     filler has to go. Kept deliberately short: an aggressive stop list
     is a silent accuracy bug. */
  var STOP = {
    a: 1, an: 1, the: 1, is: 1, are: 1, was: 1, were: 1, am: 1, be: 1, been: 1,
    of: 1, to: 1, in: 1, on: 1, at: 1, for: 1, with: 1, about: 1, from: 1,
    and: 1, or: 1, but: 1, if: 1, so: 1, as: 1, it: 1, its: 1, this: 1,
    that: 1, these: 1, those: 1, i: 1, you: 1, he: 1, she: 1, we: 1, they: 1,
    me: 1, my: 1, your: 1, do: 1, does: 1, did: 1, can: 1, could: 1,
    would: 1, should: 1, will: 1, shall: 1, may: 1, might: 1, have: 1,
    has: 1, had: 1, having: 1, there: 1, here: 1, what: 1, which: 1, who: 1,
    whom: 1, whose: 1, when: 1, where: 1, why: 1, how: 1, all: 1, any: 1,
    some: 1, each: 1, more: 1, most: 1, other: 1, such: 1, no: 1, not: 1,
    nor: 1, only: 1, own: 1, same: 1, too: 1, very: 1, just: 1, get: 1,
    got: 1, tell: 1, please: 1, thanks: 1, thank: 1, know: 1, like: 1,
    good: 1, best: 1, give: 1, want: 1, make: 1, made: 1, say: 1, said: 1,
    /* Tagalog */
    ang: 1, ng: 1, mga: 1, na: 1, ba: 1, po: 1, ito: 1, iyon: 1, doon: 1,
    dito: 1, kay: 1, ko: 1, mo: 1, ka: 1, kami: 1, tayo: 1, sila: 1,
    ikaw: 1, ako: 1, at: 1, o: 1, pero: 1, dahil: 1, kasi: 1, para: 1,
    may: 1, wala: 1, hindi: 1, oo: 1, ano: 1, sino: 1, saan: 1, kailan: 1,
    bakit: 1, paano: 1, mag: 1, nag: 1, naka: 1, ni: 1, si: 1,
    /* Discourse particles - address and filler, never content.

       These are the Tagalog and Bisaya equivalents of "well" and "like",
       and they are everywhere in real Filipino chat: "bro ano ang
       sleep?" is a perfectly clear question that must retrieve exactly
       what "ano ang sleep?" retrieves. They were not here, and one of
       them alone dragged a strong match from 0.78 down to 0.23 - an
       unmatched token takes the highest IDF in the vector, so pure
       filler was outweighing the actual subject.

       "man" is deliberately NOT here despite being a common Bisaya
       particle. In Bisaya it also means "all/every" and carries real
       meaning; stopping it would lose that. */
    /* "raw" is not here despite being a common filler particle in some
       speech - it is also an ordinary English word (raw data), and a
       stopword list that quietly ate a real term would be its own bug. */
    bro: 1, pre: 1, bes: 1, besh: 1, boss: 1, dude: 1, sis: 1, ate: 1,
    koya: 1, uy: 1, pala: 1, sige: 1, ay: 1, daw: 1,
    /* Interrogatives. These say what KIND of answer is wanted and
       nothing about the subject, and intent.js already reads them as
       intent signals - "magkano" is the trigger for the `price` intent.
       Leaving them in the retrieval vector meant they were counted
       twice: once as the intent, and again as unmatched subject
       evidence, where they could only dilute. "magkano ang pera"
       scored 0.280 against the money entry and refused, on a question
       whose only real content word is "pera". */
    magkano: 1, pila: 1, ilan: 1,
    /* Request verbs, same argument as the interrogatives above.
       "what framework you suggest to use in frontend" contains exactly
       two content words - framework and frontend - and "suggest" and
       "use" are how the person phrased the request, not what they are
       asking about. Neither appears in any entry, so each one took the
       highest IDF in the vector and split the coverage in half, which
       put a fully answerable question at 0.245 and refused it.

       This is the same failure as "bro" and "magkano" wearing a
       different hat, so it belongs in the same list. The test is not
       "is it a real word" but "does it identify the subject or only
       the shape of the request". */
    suggest: 1, recommend: 1, prefer: 1, choose: 1, pick: 1,
    use: 1, using: 1, used: 1, gonna: 1, wanna: 1, about: 1,
    /* Conversation framing. "lets talk about programming", "teach me
       python" and "i need to learn sql" all name exactly one subject
       and bury it under verbs that describe the conversation rather
       than the thing. Those verbs appear in no entry, so each took the
       highest IDF in the vector and cut the real subject's share of the
       coverage - the difference between a 0.34 answer and a refusal. */
    talk: 1, chat: 1, discuss: 1, teach: 1, learn: 1, study: 1,
    stuff: 1, things: 1, thing: 1, topic: 1, subject: 1, question: 1,
    questions: 1, anything: 1, something: 1, explain: 1, know: 1,
    /* `let` and `need` are here for the same reason, and `let` is a
       sharper case: it is a JavaScript reserved word, so it looks like
       programming vocabulary while being nothing of the kind to a person
       typing "lets talk about programming". It was in the builder's
       keyword noise list and not in the tokenizer, which is exactly the
       kind of drift that makes a stop list quietly wrong. */
    let: 1, need: 1, needed: 1, needs: 1, want: 1, wanted: 1,
    /* Tagalog and Bisaya function words that FRAME a question rather
       than name a subject.

       The case that forced this: "may alam kaba about programming"
       means "do you know about programming", and its only content word
       is "programming". But "alam" (to know) and "kaba" (an emphatic
       particle) indexed as content, took the highest IDF in the vector
       as unmatched terms, and cut the real subject's share of the
       coverage to a third - so a perfectly answerable question scored
       0.214 and refused.

       DELIBERATELY EXCLUDED, because they are entry concepts in
       data/filipino.json and data/cebuano.json: dili, oo, kaayo, unsa,
       kinsa, ngano, asa, kami, ikaw, salamat, dako, gamay, sayop,
       kayo, tayo, sino, saan, kailan, bakit, hindi, may, wala, noo.
       Stopping those would make "unsa ang kaayo" unanswerable, which
       is a far worse failure than the one this fixes. The test is
       "can this word be the subject of a lookup", and "alam" cannot be
       while "kaayo" can. */
    alam: 1, kaba: 1, tulong: 1, tulungan: 1, sabi: 1, sabihin: 1,
    tanong: 1, tatanungin: 1, gawa: 1, gawain: 1, pwede: 1, dapat: 1,
    kaya: 1, sana: 1, naman: 1, bang: 1, paalala: 1, tanongin: 1,
    /* Bisaya framing words, same test, same exclusions */
    mahimo: 1, unsang: 1, unsaon: 1, usab: 1, bisan: 1, unya: 1,
    kay: 1, tanan: 1, ingon: 1, apan: 1, pero: 1, human: 1, unyaon: 1,

    /* High-frequency abstract nouns. These appear in almost every long
       answer, so they carry no topical information at all, and indexing
       them lets a single shared word carry a whole query.

       The case that forced this: the new `cell` entry contains "a cell
       is the smallest unit of life", so "life" became an index term.
       "what is the meaning of life" then matched it on that one word
       and scored 0.349, over the 0.34 bar, answering a question about
       existence with a definition of a cell. That is the confident
       wrong answer this project exists to prevent, and the threshold
       is not the thing to change - "life" is simply not a word that
       identifies a subject.

       Note this only covers words that can never be the SUBJECT of a
       lookup. Distinctive high-frequency words are deliberately absent,
       and `life` is safe to lose because nobody is looking up "life"
       expecting one definition. */
    life: 1, world: 1, time: 1, year: 1, years: 1, day: 1, days: 1,
    people: 1, person: 1, man: 1, woman: 1, way: 1, ways: 1, part: 1,
    case: 1, cases: 1, fact: 1, number: 1, group: 1, system: 1, form: 1,
    level: 1, point: 1, area: 1, end: 1, need: 1, kind: 1, sort: 1,
    order: 1, type: 1, value: 1, values: 1, work: 1, works: 1,
    /* Bisaya */
    nga: 1, nako: 1, nimo: 1, unya: 1, apan: 1, kon: 1,
    kung: 1, unsa: 1, kinsa: 1, asa: 1, ngano: 1, unsaon: 1, "kanus-a": 1,
    ikaw: 1, gikan: 1, ngadto: 1, diri: 1, didto: 1, naa: 1, wala: 1,
    dili: 1, oo: 1, usa: 1, adlaw: 1, giya: 1, tanan: 1, lang: 1, gyud: 1,
    jud: 1, mao: 1, pa: 1, kaayo: 1, salamat: 1, aron: 1, pudon: 1
  };

  /* Safe Filipino/Bisaya prefixes. Dropping these is what lets
     "nag-laro" and "laro" meet at the same key.

     Every entry is at least 3 characters and must leave a 4-character
     remainder. Two-letter prefixes look tempting ("ka" in kamusta) but
     they shred ordinary words - "kamusta" became "musta", "maayo"
     became "ayo" - and a silently mangled token is an accuracy bug
     that is very hard to notice later. */
  var PREFIX = [
    "naka", "nagi", "maka", "maki", "mama", "mami", "mang",
    "nang", "nag", "nam", "gika", "gina", "gipang",
    "paka", "pang", "pagi", "paa", "kaa"
  ];

  /* Suffixes, tried in order so "ies" wins over a bare "s". */
  var SUFFIX = ["ies", "ing", "ings", "ed", "es", "s", "ly"];

  /* Number of surfaces the lexicon has attached. Exposed so a test can
     assert the lexicon actually loaded, rather than a missing file
     quietly leaving every foreign word unmatched. */
  var lexiconCount = 0;

  /* The lexicon bridge, and the single most valuable line in the
     tokenizer.

     A Bisaya question about sleep says "unsa ang katulog". As far as
     retrieval is concerned "katulog" and "sleep" are unrelated strings
     that share nothing: the question scores near zero against the entry
     holding the answer, and the bank answers "I do not know" about a
     subject it plainly covers. No amount of extra entries fixes that,
     because the problem is not coverage - it is that the two languages
     were never connected.

     So the lexicon supplies the translation table, and every surface
     form collapses onto one canonical concept token before anything
     downstream sees it. "tulog" and "katulog" both become "sleep", the
     inverted index has a single key for the concept, and the topic
     router can read it too - which is what lets a question that never
     contains an English word still get routed to the right shelf.

     Exact match only, and deliberately so. This is a dictionary, not a
     guesser: "tulig" is a typo, not a word, and folding it in would put
     a wrong token into the index. Typos are already recovered one edit
     away, in kb.candidates(), against real tokens. */
  function registerLexicon(map) {
    if (!map) return 0;
    var added = 0;
    for (var key in map) {
      if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
      var word = normalize(key);
      /* One word per key: a token is a single word, so a multi-word
         phrase can never be matched here. Phrases still work - they are
         handled as patterns at the entry level. */
      if (!word || /[\s]/.test(word)) continue;
      var target = normalize(String(map[key]));
      if (!target || /[\s]/.test(target)) continue;
      /* Never clobber a hand-curated spelling. The MAP above is
         orthography ("kumustaaa" -> "kamusta") and is load-bearing;
         letting a bulk import overwrite it would trade a known-good
         rule for a data-file one. */
      if (MAP[word]) continue;
      MAP[word] = target;
      added++;
    }
    lexiconCount += added;
    return added;
  }

  function lexiconSize() { return lexiconCount; }

  /* WORDS THAT MUST STAY SEARCHABLE
     ---------------------------------
     The list above is old and was written without checking it against
     the data. Several words in it are entry CONCEPTS in data/filipino.json
     and data/cebuano.json, which means those entries could not be
     reached in their own language at all: "unsa ang kaayo" tokenised to
     nothing, because `unsa` was stopped, `ang` was stopped, and `kaayo`
     was stopped too. The shelf looked populated and answered English.

     Stopping a word is only correct if it can never be the SUBJECT of a
     lookup. `ba`, `naman` and `kaba` cannot. `unsa`, `kaayo` and `ikaw`
     are three of the most-asked things in those two shelves, so they
     must not be. Applied as a deletion rather than by editing the
     literal above, so the reason stays attached to the fix. */
  var MUST_STAY_SEARCHABLE = {
    /* Cebuano concepts */
    unsa: 1, kinsa: 1, asa: 1, ngano: 1, kaayo: 1, sayop: 1, dili: 1,
    salamat: 1, kami: 1, ikaw: 1, dako: 1, gamay: 1,
    /* English words that are on the stop list but are the subject of
       a whole shelf and are typed alone more often than not. "what
       time is it" tokenised to NOTHING at all, because "what", "is",
       "it" and "time" were all stopwords - so no entry could ever be
       reached, however well it was written, and the bank refused
       every time question while looking like it simply had no time
       shelf. The mechanism was already here for exactly this; the
       word was just never added to it. */
    time: 1, news: 1, weather: 1, course: 1, artist: 1,
    /* Tagalog surface forms get spelled a dozen ways
    /* Tagalog concepts */
    mahal: 1, mura: 1, kulang: 1, sobra: 1, kayo: 1, tayo: 1, sino: 1,
    saan: 1, kailan: 1, bakit: 1, hindi: 1, wala: 1, maganda: 1,
    masama: 1, malaki: 1, maliit: 1, natin: 1, ano: 1, kumusta: 1,
    musta: 1
  };
  Object.keys(MUST_STAY_SEARCHABLE).forEach(function (w) { delete STOP[w]; });

  /* Filipino surface forms get spelled a dozen ways ("ng kumusta",
     "na kumusta", "kumustaaa"). This map collapses the common ones so
     retrieval is not defeated by orthography. */
  var MAP = {
    kumusta: "kamusta", kamusta: "kamusta", musta: "kamusta",
    kumustaa: "kamusta", "kumust\u00e1": "kamusta",
    anong: "ano", sinong: "sino",
    magandang: "maganda", ganda: "ganda",
    kumikain: "kain", kain: "kain", kumuha: "kuha", kuha: "kuha",
    gumawa: "gawa", gawa: "gawa", nagawa: "gawa",
    naglaro: "laro", naglalaro: "laro", naghinayag: "hinayag",
    katongod: "katongod", adlawa: "adlaw",
    sayon: "sayon", sayra: "sayra", maayo: "maayo", sayoke: "sayoke",
    unsaon: "unsa", unsa: "unsa", kinsa: "kinsa", asa: "asa", ngano: "ngano"
  };

  /* ---- normalisation ---------------------------------------- */

  /* Diacritics matter in Tagalog/Bisaya (a-acute, n-tilde, e-acute),
     so we do not strip them. We only unify the curly quotes people
     paste in and squash whitespace. */
  function normalize(text) {
    return String(text == null ? "" : text)
      .replace(/[\u2018\u2019\u02BC\uFF07]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /* Split on anything that is not a letter, digit or apostrophe, so
     "don't" survives as one token. */
  function words(text) {
    var n = normalize(text);
    var out = n.split(/[^a-z0-9'\u00C0-\u024F]+/);
    var res = [];
    for (var i = 0; i < out.length; i++) {
      var w = out[i].replace(/^'+|'+$/g, "");
      if (w) res.push(w);
    }
    return res;
  }

  function canonical(w) { return MAP[w] || w; }

  /* ---- stemming --------------------------------------------- */

  function stem(w) {
    if (w.length <= 3) return w;
    var i;

    for (i = 0; i < PREFIX.length; i++) {
      var p = PREFIX[i];
      if (w.length - p.length >= 4 && w.indexOf(p) === 0) { w = w.slice(p.length); break; }
    }
    /* "mag-aabot" -> "aabot": drop a hyphen the prefix left behind. */
    if (w.charAt(0) === "-") w = w.slice(1);
    if (w.length <= 2) return w;

    for (i = 0; i < SUFFIX.length; i++) {
      var s = SUFFIX[i];
      if (w.length - s.length >= 3 && w.slice(-s.length) === s) {
        w = s === "ies" ? w.slice(0, -3) + "y" : w.slice(0, -s.length);
        break;
      }
    }
    if (w.charAt(0) === "-") w = w.slice(1);
    return w;
  }

  /* ---- entry points ----------------------------------------- */

  function toSet(arr) {
    var s = Object.create(null);
    for (var i = 0; i < arr.length; i++) s[arr[i]] = 1;
    return s;
  }

  /* The pipeline. Returns raw words (for display), every word (for
     substring checks) and the stemmed content tokens (for scoring). */
  function tokenize(text) {
    var raw = words(text);
    var all = [];
    var content = [];
    for (var i = 0; i < raw.length; i++) {
      var c = canonical(raw[i]);
      all.push(c);
      if (c.length < 2) continue;
      if (STOP[c]) continue;
      var st = stem(c);
      /* Very short stems collide ("a" out of both "ka" and "a"), so
         require a real length before a token is allowed to index. */
      if (st.length < 2) continue;
      /* Check the stop list AGAIN, on the stem. The check above only
         sees the literal word, so any morphological variant of a
         stopword walked straight through: "lets" became "let" and
         indexed as a content word, because "let" was on the list and
         "lets" was not.

         That is not cosmetic. "lets talk about programming" tokenised
         to let + talk + programm, and the two junk tokens took two
         thirds of the query weight, so the one real content word could
         not reach the accept bar on its own and a perfectly answerable
         question refused at 0.207. Every inflected form of every
         stopword was leaking this way. */
      if (STOP[st]) continue;
      content.push(st);
    }
    return { raw: raw, all: all, tokens: content, set: toSet(content) };
  }

  function isStop(w) { return !!STOP[canonical(w)]; }

  /* Character bigrams - what makes typos survivable, because
     "progaming" and "programming" share most of theirs. */
  function bigrams(str) {
    var s = " " + str + " ", out = [];
    for (var i = 0; i < s.length - 1; i++) out.push(s.substr(i, 2));
    return out;
  }

  return {
    normalize: normalize,
    words: words,
    stem: stem,
    canonical: canonical,
    tokenize: tokenize,
    isStop: isStop,
    bigrams: bigrams,
    toSet: toSet,
    registerLexicon: registerLexicon,
    lexiconSize: lexiconSize,
    STOP: STOP
  };
});
