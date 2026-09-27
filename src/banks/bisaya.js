/* ============================================================
   bokskie-v1 - banks/bisaya.js
   ------------------------------------------------------------
   Same topic keys as the other banks, so a Bisaya question can be
   answered in Tagalog or English by the same lookup.
   ============================================================ */

"use strict";

(function (root, factory) {
  var bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  else {
    root.BokskieBank = root.BokskieBank || {};
    root.BokskieBank.bisaya = bank;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
"use strict";

  return {
  label: "Bisaya",

  openers: [
    "Maayong tanong - anha lang ang akong nalang kabalo.",
    "Okay, ipaliwanag nako in batches.",
    "Naunay man gud, maa-short ang bersyon una.",
    "Apoy naaoy, duha kaayo siyagi nga topic.",
    "Ani ang akong honest nga tan-aw.",
    "Himatag nako nga dili abstract kaayo.",
    "Practical lang nako diri.",
    "Siyagi nga okay, sugdan nato sa pinak-importante.",
    "May useful nga paagi nga pangisip.",
    "Andam nako sa tabang nimo.",
    "Nibalok nga mahimong naa before ka magdesisyon.",
    "Sila kinsa, simple nga sugdan pero lisod i-implement."
  ],

  topics: {
    smalltalk: {
      keywords: ["kumusta", "maayong buntag", "maayong gabii", "naunay ka", "usta", "ayaw mo ba ko", "kumustahanon"],
      bodies: [
        "Naa ko gyud run sa imong computer, jadi mana nako kas Exhaust, apan nga maayo nga nimu nga ginawang open ako. Unsa na ang naa sa imong isip?",
        "Maayo nako nga sukto ang isang programa nga walay internet. Ikaw, naay nga adlawon ang imong adlaw?",
        "Mahimo nako nga makahold ug dialogo, maka-explaine, o mahimong tahimik rag kaayo. Tanan nga maayo.",
        "Walay balita nga naa ako, apan daghan nga buta nga nakatabang ako. Kitaon nimo asa kita?",
        "Kumusta! Wala pa sayup nga naa, ug wala pa kinahanglan nga higaonan - maayo na siya.",
        "Naa ako diri ug naa ako nga namina ginigwaan. Iyan lang gyud akong ginahimo hangtud nga mohangay mo nga something.",
        "Walay agenda akong side. Tan-awa sa code, pelikula, pagkaon, bisan unsa - o sari-sari lang ta dayon tan-awon nato asa ka diretso.",
        "Mga warning, tungod kay importante: dili ako maka-search online. Ang akong gisulti gikan ra sa akong alam, so kung recent o espesipiko nga buta, ang tinuod nga isulti ko nga dili ko sige kaysa mag-invento.",
        "Naa lang sa imong machine ang imong gi-type. Walay account, walay tracking, walay gipadalà bisan asa.",
        "Kon gusto nimo i-check kana nga claim, abanug-i ang network tab samtang nagtanaw ta. Walay maipadala."
      ],
      closers: [
        "So - unsa man ang gusto nimo nga hisaytan?",
        "Piling ka usab sa topic, kay gitawag nato og lawom kon unsa.",
        "Unsa ang pinakauna sa imong listahan karon?",
        "Pwali nga tanan, sisugdan nato bisan asa.",
        "Asa nimo gusto nga magsugdan?",
        "Unsa na nga palahigdan nga isip mo karong adlawa?",
        "Unsa nga matabang nimo?",
        "Kung andam ka na - o kung wala,Okay ra man nako diri."
      ]
    },

    greetings: {
      keywords: ["kinsa ka", "pala ka", "introduce", "kaayo nga adla", "naa ka unsa"],
      bodies: [
        "Ako si Bokskie - assistant nga run sa imong kaugalingon nga machine. Walay account, walay subscription, walay gikan nga moagi.",
        "Nakapagsagot ako, naka-explaine ako, ug nakatabang ako sa pagsulat ug code. Apan dili ako matibbon ug mahimong maka-Hunaw - ipili ko lang ang pinakamaayo nga materyal nga anha ako.",
        "Naa akong kabalo sa English, Tagalog, ug Bisaya. Bisaya nga naa ka gyud, bisaya ko nimo sulti.",
        "Wala ako og lawas, nawaliayaw, o skedyul. Ang naa ko mao ang dako nga teksto nga klaro kong ipaliwanag, ug ang abilidad nga mahimong mapuslan sa mga napulo ka nga direksyon."
      ],
      closers: [
        "Unsa ka man ang gusto nga tabangan una?",
        "Pwali nang mo - walay sayup nga unang tanong.",
        "Anda ako kung handa ka na."
      ]
    },

    vue: {
      keywords: ["vue", "nuxt", "pinia", "composition api", "script setup", "computed", "reactive", "props", "emits", "component", "v-model", "vite", "ref", "watcher"],
      bodies: [
        "Ang pinaka-mapusling nga buta nga tuason sa imong uttan sa Vue 3: ang ref nagbutang og usa ka value, ang reactive object nagbutang og usa ka bundle. Naa nga tanan nga follow sa kana nga usa ka kalain.",
        "Ang computed properties para sa derived state, dili para sa side effects. Kon may imong gustong buaton sulod sa computed, watch man ka nga naa.",
        "Naa ang Composition API aron maila ang logic gikan sa component ngadto sa usa ka plain function - ug ang plain function nga naa, mapilis nga i-test bisan walay i-mount.",
        "Ang props motaas, ang events motanaw. Kon naa ka naa nga gikan sa paghatag data, store o provide/inject mao ang naa nga nawala.",
        "Sa Vue, ang template naa nga gikan simple lang okay. Kon ma-puno na ug logic didto, naa siya nga gustong maging computed o method."
      ],
      closers: [
        "Asa man na nga gikan? Ang reactivity, ang structure, o ang build?",
        "Kon i-paste nimo ang component, ipakita nako ang exact line.",
        "Unsa gyud ang naa sa error message?",
        "Pakisayo ang pinakaminimal nga version nga ma-reproduce, dayon magpaliwanag ta nga lami natin."
      ]
    },

    programming: {
      keywords: ["code", "program", "javascript", "python", "function", "bug", "error", "debug", "html", "css", "algorithm", "npm", "git", "deploy", "server", "api"],
      bodies: [
        "Ang daghan sa mga bug dili hard. Sila mao ang sayup nga assumption nga wala gikan, so sulatan nimo unsa nga tuod nga nimo kinsa, dayon i-check nimo.",
        "Basaha ang error message tanan. Ang interesting nga linya usually sa pinaagi sa stack trace, dili sa ibabaw.",
        "Ang function nga usa ka buta ang iya: mapilis i-test, mapilis i-reuse, ug mapilis i-delete. Mao nga naa nga argumento para sa gamayng mga function.",
        "Kon naa ka lang sag-affected kininga, badtan ang race, shared mutable object, o unhandled promise rejection. Inon nga order.",
        "I-reproduce una. Ang bug nga dili nimo ma-reproduce, dili nimo maipapakita na naayos ka na."
      ],
      closers: [
        "Unsa na imong gikausab?",
        "I-paste ang pinakaminimal nga snippet nga maaapektuhan, dayon maglakad ta.",
        "Unsa gyud ang imong gipa expectation, unsa man nga naa?",
        "Dili didto kita ma-duha guide nimo kada linya."
      ]
    },
    films: {
      keywords: ["pelikula", "horror", "scary", "kuyog", "film", "cinema", "watch", "series", "thriller", "actor"],
      bodies: [
        "Kon horror film nga tinigdan gyud ka: trust sa dread, dili sa gore. Ang maa-ulaw sa imong naa, kadtong mga naghihintay, dili kadtong naa kuyog miambod.",
        "Ang pinakamaa nga horror, usa ra ka ideya gisalak sugdan hangtud. Sa diin pa siyagi nga naa tulo ka nga kabtoa, mawala na siyagi nga kahadlok, sugdan na siyagi nga abali.",
        "Kon gusto mo og atmosphere, tan-awa ang hinay. Kon gusto nimo ma-surprise, tan-awa kadtong naa may soundtrack nga naa nimo gipapansin kaniadto pa sa twist.",
        "Ang horror na tunay na nakababahala ay tanong sa imong kaguyod: mabugang dread, folk horror, ug simpleng slasher, tulo ka nga laing buta siyagi nga imong gipap.mean sa horror."
      ],
      closers: [
        "Dread, gore, o usa ka light nga pwede nimo ma-watch kasama imong mga kaibhan?",
        "Bag-o, o daan pa nga dili tan-aw sa ubos?",
        "Unsa ang pinakamina-imo nga napanatikan? Dili ko siya ma-od ang ana.",
        "Usa ra ka pick, o short list para kaning gabii?"
      ]
    },

    food: {
      keywords: ["pagkaon", "recipe", "luto", "cook", "karne", "chicken", "isda", "lugod", "adobo", "sinseeng", "mabakhaw"],
      bodies: [
        "Ang kalain sa daghan sa mga pasutsa nga maa: ang skillet mao ang plano. I-ihaw it una, tanan nga naa follows - ang order sa ingredients dili naa maimpact kay sa kantidad.",
        "Salt sa layers, dili tanan sa sugdan. Dili nimo maipak concentrates sa ulit, so diri season matag stage, ug taste mo before mo ihatag.",
        "Kon bland, kadal asa kulang acid, dili kulang salt. Usa ka ka og lemon o usa ka kutsara nga vinegar mao na naa sa matag dish dili sa tanan spice.",
        "Ang maa nga kusina dili kaayo pagpuno sa skillet. Naa mabuntag ang pagkaon kon dry ang sulod ug naa ug space paligid."
      ],
      closers: [
        "Unsa nga ingredients naa nimo na?",
        "Limayng minuto, o tanan nga adlaw?",
        "Simple ra ba, o naa nimo gustong tuzon og dyit?",
        "Kiyaha nako unsiyal imong ref, aron ma-discover nato gikan saa."
      ]
    },

    jokes: {
      keywords: ["joke", "katawa", "mapanga", "humor", "kataka-taka"],
      bodies: [
        "Naa duha ka klasi sa mga programmer: naa nga nasagdan sa timezone bug, ug naa nga nga-isab nila nga safe tungod kay usa ra ka timezone ang ila laptop.",
        "Naa ang SQL query nga sulok sa bar, duha ka tables iya gi-approach, unya: maa ko ba nga mag-join nimo?",
        "Ang pinakamaa nga debugging tool mao pa gikan pa ra og break. Likod ka, balik ka, unya magsulti ong og bug sa imong lawa - kasagdan naa ka nga nagpa-brew nga tea.",
        "Ang akong code sama sa usa ka relasyon: nga-isab nako nga okay, dayon may lain nga nagbasa ug nakit-an dayon ka dayon na nga i-check."
      ],
      closers: [
        "Im gusto pa ba niini, o laing klasi?",
        "Naa pa ako nga uban - gusto mo?",
        "Iyang tipa para sa sunod nong meeting."
      ]
    },

    motivation: {
      keywords: ["kadasay", "motivasyon", "naa kou kalain", "layo", "kapitodan", "kuyog", "tiwala", "kadtong mangisud"],
      bodies: [
        "Ang motivasyon naa human sa aksyon, dili sa una. Dili ka mipila para mahimong motugtan ka; motugtan ka na, ug doon ka na og duha ka minuto.",
        "Break-buka ni hangtud nga motoo ka nga basi nga dili mokas worth pagbuhat. Ang daghan sa procrastination usa ka reaction sa usa ka himawu nga motoo ka, dili sa himawu.",
        "Ang stuck information, dili verdict. Pagmenta nimo kung unsa gyud ang dili nimo nga naa, ug kana nga sagad nalang mahimong sunod nga oras sa trabaho.",
        "Ipares ang imong Tuesday sa imong kaugalingong Tuesday sa last week. Ang pagpares sa highlight reel sa lain, usa ka rigged nga away nga always mawawag ka."
      ],
      closers: [
        "Unsa ka man ang pinakaminimal nga next step nga pwede nimo karon?",
        "Unsa man ang itsura sa task kon duha lang ka minuto nga mugna?",
        "Ibutas nimo unsiyal imong gi-atubang, aron makita nato ang tinigod nga buta didto.",
        "Pili ta usa ka gamayng buta ug tapnawa na siya karon?"
      ]
    },

    study: {
      keywords: ["eskwela", "skool", "pagkatukod", "exam", "quiz", "pwede", "review", "university", "marka", "hatud"],
      bodies: [
        "Ang active recall mas maa kay sa pagbasa pagbalik. Isara ang libro, sulat sa imong pamagdan tanan ngayon, dayon i-check nimo unsiyal nawala. Kana nga gap kay diin nga natukod nga pagkatukod.",
        "Ang spaced repetition gumana tungod kay ang pagkatubod mao na nga punto. Ang review usa ka sandali human wala ka nga naak forget, mao kana nga moluyod sa long-term memory.",
        "Kon dili mo maipaliwanag in simple nga paagi, dili mo pa nakat-on og gyud. Ingon nga pagsalaysay sa louder sa emptong kwarto, usa ka brutal nga epektibong test.",
        "Magtuok in mga block sa katloan ka minuto ug tunay nga break between. Ang imong attention matapos na say sa imong stamina."
      ],
      closers: [
        "Asa man nga subject, ug pila ka na hangtud sa test?",
        "Asa nga bahin ang naghihigpit karon?",
        "Gusto mo og quick quiz, o study plan?",
        "Kiyaha nimo ang topic, aron sugdan nato sa nakat-on mo na."
      ]
    },

    weather: {
      keywords: ["panahon", "urals", "init", "moot", "bagyo", "hangin", "klima", "tibuok", "abdang"],
      bodies: [
        "Dili ako makaa kita sa imong bintana, jadi dili ko imahin nga pero. Kadtong gikan nimo unsa ang imong nakita, aron makatabang ako nimo kung unsiyal isimogon.",
        "Ang advice sa panahon pareho ra gyud: tan-aw ang kagulkan karon, ug forecast kaniadto sa imong molaktaw og sud sa gikan sa balay og duha ka oras.",
        "Sa imong lakad, ang tanong dili unsa ang panahon karon, kundi unsa ang mahimong padto og duha ka minuto na. Kana na nga ma-decide sa payong para sa ulan.",
                "Kon mag-pak ka para sa tanan nga adlaw, para sa pinaka cold nga oras, dili sa average. Kadaghan sa discomfort usa ka problema sa buntag, dili sa hapon."
      ],
      closers: [
        "Unsa man ang kagulkan sa imong lugar karon?",
        "Naghuna-kawha ka ba, o curiosity ra lang?",
        "Kahoy nako nga tulong ikaw unsiyal kaonon karon?"
      ]
    },

    facts: {
      keywords: ["fact", "katotohanan", "imong kabalo", "trivia", "historiya", "space", "siyensiya", "random"],
      bodies: [
        "Ang honey mao lang kaayo na kinagakan sa pagkaon nga dili na nga hangtod. Ang mga garas nga nakita sa mga tapyat sa Ehipto, adunay pa gyud hangtod sukto sa libuong tuig, tungod kay duha ka buta: acidic ug dry pa kaayo para mabuhi ang microbial.",
        "Adunay pa kay daghan nga kahoy sa Earth kaysa mga bituin sa among galaxy. Usa ka opis nga trilyon nga kahoy kumpara sa pipi ka bilyong bituin.",
        "Ang grupo sa mga flamingo, flamboyance ang nga; ang grupo sa mga jellyfish, smack ang nga; ang grupo sa mga meerkat, mob ang nga. Ang English adunay daghan niini ug wala gyud kay bisan unsa nga rule.",
        "Ang mga octopus, tulo ka dugo ug blue nga dugo, ug maka-taste sila pa sa ila ka braso. Gamay ra kaayo sa ila ang nagagana ogamit kay sa imong gipapaabut."
      ],
      closers: [
        "Gusto mo pa ba niini?",
        "Nakaabut ba ka? Naa pa ako nga uban.",
        "Puli ta - dili ako makaubos."
      ]
    },

    money: {
      keywords: ["kuyog", "presyo", "barya", "gasto", "free", "mura", "mahal", "subscription", "ipon"],
      bodies: [
        "Ang pinakamura nga buta usually dili kadtong maa rag lamang ang numero. Mao ka kadtong nga imong gamiton pa mga tuig adlawa.",
        "Sa software: ang open source ug local models gi-exchange ang kuskos sa imong panahon ug attention. Kana nga trade naa og value kon daghan ka og gamit, dili kon duha lang ka.",
        "Kon naa nga free tier, sugdan didto ug bayar sa tabi lang kon makahit na ka sa actual nga limit. Ang naa unang bayar, mao lang ka gi-funding sa mga feature nga dili mo nimo gi-gamit.",
        "Ang laing kat-half sa palit mao ang panahon. Sayon nga libre sa kuwarta ang dili sayon nga libre sa oras, ug kasagaran ang oras ang mas kulang."
      ],
      closers: [
        "Para sa usa ka buta - trabaho, eskwela, o personal?",
        "Unsa ang importante - ang presyo ba o ang kahimugan sa setup?",
        "Kiyaha nimo unsiyal imong kinahanglan, aron i-alertako nimo ang tinigod nga pinakamura nga opsyon."
      ]
    },

    health: {
      keywords: ["kag health", "katulog", "gikaugali", "stress", "kabusog", "headache", "t-ilaw", "lakad", "sekay"],
      bodies: [
        "Ang pinakamura nga health intervention mao ang pagkatulog, dili duha ka hakbang sa una. Tanan nga naa, mas maayo pa kung dili ka na naa nga kulang.",
        "Ang daghan sa mga headache stress o kulang sa tubig. Ang tubig, adlaw, ug muna ka og lakad, mao nga naa sa daghan kaysa bisan unsa nga medicina.",
        "Ang motion dili kinahanglan nga exercise aron ma-count. Usa ka minuto og lakad human sa pagkaon, labaw sa tanan nga naka-sitting og buong gabii.",
        "Dili ako doktor ug dili ko gyud magpacting nga ako. Kon kanunay, ang tunay nga clinician ang dapat nga gapnil; gamita ako aron makatukod unsiyal itanong nga imong iabutang."
      ],
      closers: [
        "Pila ka na giini?",
        "Pili ka nga topic - pagkatulog, pagkaon, ba ka naa lang nga naglakad?",
        "Unsa man ang kasagaran nga adlaw para sa imong karon?"
      ]
    },

    relationship: {
      keywords: ["namateman", "yugto", "love", "crush", "naa tawag", "kaaway", "mga kaibhan", "ex", "kabilaran", "relasyon"],
      bodies: [
        "Ang daghan sa mga problema sa relasyon, problema sa komunikasyon nga naka-costume. Ang away ra, dili gyud mahitungod sa butas nga inaaway nimo.",
        "Kon mikit-an nimo nga giparehe-play nimo ang conversation kaysa ihatag nimo, kana nga usually ang tubong - ang rehearse mas safe kay sa tunay.",
        "Ang pagka-babilaran dili kaayo ug katamnan, ug dili maa ngAyusin ka pagkayugma. Mas kadali kung mo-tiwal nimo sila bisan awkward.",
        "Minsan ang pinaka-maa nga buta, usa ka klaro nga tubon kaysa usa ka maa nga delay. Dili mo abihan ang usa ka door nga naa ka na gyud nga nagpasara."
      ],
      closers: [
        "Gusto mo mag-talk through unsiyal naa, o unsiyal nimo buhaton?",
        "Unsa gyud ang gusto nimo nga mahitagari diri?",
        "Kadtong bahin nga dili mo pa naa gisulti kon wala pa magkatawo.",
        "Unsa man nga gipupensar nimo diri niini?"
      ]
    },

    goodbye: {
      keywords: ["bye", "adlaw", "kaayo", "salamat", "makita kita", "gikan nako", "matulog na"],
      bodies: [
        "Andam nga nakatabang ako. Naa lang gyud tanan sa imong computer, jadi isara nimo ang tab, ug maa nimo siya tanan pagbalik nimo.",
        "Bisan una man. Balik ka bisan naa-o break, o bisan lang gustong mo nga maka-Hunaw.",
        "Adlaw nga maayo. Naa gipaluwas na sa imong local, walay gipadala bisan asa.",
        "Kon makatabang, isulat lang mo usa ka buta nga gusto mong hinumdom diri. Mas sayon matanduma ang usa ka sentence kaysa sa tibuok nga conversation."
      ],
      closers: [
        "Kitaon kita sunod nga beses.",
        "Good luck nimo.",
        "Kaayo kaayo."
      ]
    }
  }
  };
});
