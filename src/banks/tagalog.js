/* ============================================================
   bokskie-v1 - banks/tagalog.js
   ------------------------------------------------------------
   Same topic keys as the other banks, so a Tagalog question can be
   answered in Bisaya or English by the same lookup.
   ============================================================ */

"use strict";

(function (root, factory) {
  var bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  else {
    root.BokskieBank = root.BokskieBank || {};
    root.BokskieBank.tagalog = bank;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
"use strict";

  return {
  label: "Tagalog",

  openers: [
    "Magandang tanong - ito lang ang alam ko.",
    "Okay, ipaliwanag ko ito nang hati-hati.",
    "Muna muna ang maikling bersyon, saka ang detalye.",
    "May ilang bahagiyan ito.",
    "Ito ang tapat na aking pananaw.",
    "Ginawang simple ito.",
    "Practical lang ako dito.",
    "Sige, magsimula tayo sa pinakamahalagang bahagi.",
    "May kapaki-pakinabang paraan ng pag-iisip dito.",
    "Handa nako tumulong.",
    "Mahalagang malaman bago ka magpasya.",
    "Mukhang simple pero mahirap gawin sa totoo."
  ],

  topics: {
    smalltalk: {
      keywords: ["kumusta", "magandang umaga", "magandang gabi", "kamusta ka", "kamusta", "ano ang balita"],
      bodies: [
        "Tumatakbo ako sa sarili mong computer, kaya hindi ako nauuwiwan, pero natutuwa ako na binuksan mo ako. Ano ang nasa isip mo?",
        "Mabuti na ako para sa isang program na walay internet. Ikaw, kumusta ang araw mo?",
        "Kaya ko mag-usap, magpaliwanag, o tahimik na makinig. Lahat ng iyon ay may saysa.",
        "Walang balita na meron ako, pero maraming alam akong mapapaliwanag. Pumili ka ng direksyon.",
        "Kumusta! Wala pang problema at walang kailangang ayusin - mabuti na yan.",
        "Nandito ako at nakikinig ako. Iyan lang talaga ang ginagawa ko hanggang magtanong ka.",
        "Walang plano sa akin. Magtanong tungkol sa code, pelikula, pagkain, kahit ano - o kausap lang kita at tingnan namin saan pupunta.",
        "Isang babala, dahil mahalaga ito: hindi ako makakapag-search online. Ang sinasabi ko ay galing sa alam ko na, so kung bagong o tiyak na detalye, sasabihin ko sa iyo na hindi ako sige kaysa mag-invento.",
        "Lahat ng ini-type mo ay nasa iyong machine lamang. Walang account, walang tracking, walang ipinapadala kahit saan.",
        "Kung gusto mong i-check ang claim na iyan, buksan ang network tab habang nag-uusap tayo. Walay maipadala."
      ],
      closers: [
        "So - ano ang gusto mong pag-usapan?",
        "Pumili ka ng paksa, at magbababa tayo hangga't gusto mo.",
        "Ano ang pinakauna sa listahan mo ngayon?",
        "Tanungin mo ako kahit ano, at magsisimula tayo kung saan.",
        "Saan mo gusto magsimula?",
        "Ano ang lumalakas sa isip mo ngayon?",
        "Ano ang matutulong ko sa iyo?",
        "Kung handa ka na - o kung wala, okay lang naman ako rito."
      ]
    },

    greetings: {
      keywords: ["sino ka", "kilalanan", "introduce", "ano ka"],
      bodies: [
        "Ako si Bokskie - personal assistant na tumatakbo sa sarili mong computer. Walang account, walang subscription, walang lumalabas.",
        "Sinasagot ko ang tanong, pinapaliwanag ko ang mga bagay, at tumutulong ako sa paggawa ng code. Hindi ako talagang nakakaisip - pinipili ko lang ang pinakamainam na materyal na nasa akin.",
        "Alam ko ang English, Tagalog, at Bisaya. Sinasagot kita sa wikang ginamit mo.",
        "Wala akong katawan, mukha, o iskedyul. Ang meron ako ay malaking dami ng teksto na kaya kong ipaliwanag nang malinaw, at kakayahang maging kapaki-pakinabang sa labing-ang direksyon."
      ],
      closers: [
        "Ano ang gusto mong tulungan muna?",
        "Itanong mo ako kahit ano - walang maling unang tanong.",
        "Nasa dito ako kapag handa ka na."
      ]
    },

    vue: {
      keywords: ["vue", "nuxt", "pinia", "vuex", "composition api", "script setup", "computed", "reactive", "props", "emits", "component", "v-model", "vite", "ref", "watcher"],
      bodies: [
        "Ang pinakamahalagang dapat tandaan sa Vue 3: ang ref ay may isang value, ang reactive object ay may bundle. Lahat ng iba ay sumusunod sa iisang pagkakaiba na iyon.",
        "Ang computed properties ay para sa derived state, hindi para sa side effects. Kung may gusto mong gawin sa loob ng computed, watch ka na lang.",
        "Mayroon ang Composition API para mailabas ang logic mula sa component papunta sa plain function - at ang plain function ay madaling i-test kahit walay i-mount.",
        "Pababa ang props, pataas ang events. Kung nahihirapan ka sa pagpapasa ng data, store o provide/inject ang karaniwang nawala.",
        "Sa Vue, okay lang na simple ang template. Kung maraming logic ang nakipon doon, gusto niyang maging computed o method."
      ],
      closers: [
        "Saan ka ba natat-api - sa reactivity, sa structure, o sa build?",
        "Kung i-paste mo ang component, ituturo ko sa iyo ang eksaktong linya.",
        "Ano ba talaga ang sinasabi ng error message?",
        "Subukan ang pinakamalaking bersyong nakare-produce, pagkatapos ay lalamawan natin."
      ]
    },

    programming: {
      keywords: ["code", "program", "javascript", "python", "function", "bug", "error", "debug", "html", "css", "algorithm", "npm", "git", "deploy", "server", "api"],
      bodies: [
        "Karamihan sa mga bug ay hindi mahirap. Sila ay maling assumption na walang sinasabi, kaya isulat mo muna ang totoong iniisip mo, pagkatapos ay i-check mo.",
        "Basahin ang buong error message. Ang kawaliwalang linya ay karaniwang nasa ibaba ng stack trace, hindi sa itaas.",
        "Ang function na isang bagay lang ang ginagawa niya: madaling i-test, madaling gamitin muli, at madaring tanggalin. Yan ang buong argumento para sa maliliit na function.",
        "Kung pababagsakan ka lang, isipin muna ang race, shared mutable object, o unhandled promise rejection. Sa ganito ang pagkakasunod-sunod.",
        "I-reproduce muna. Ang bug na hindi mo ma-reproduce, hindi mo maipapakita na naayos ka na."
      ],
      closers: [
        "Anong sinubukan mo na?",
        "I-paste ang pinakamalit na snippet na gumagalaw pa rin, at tayo nang lakadin.",
        "Ano ang inaasahan mong mangyari, at ano ang nangyari?",
        "Magsisimula tayo doon, at gagabayan kita bawat linya."
      ]
    },
    films: {
      keywords: ["pelikula", "horror", "scary", "film", "cinema", "panood", "watch", "series", "thriller", "aktista"],
      bodies: [
        "Para sa horror na sulit tingnan: magtiwala sa dread, hindi sa gore. Ang nakatakot sa iyo ay ang naghihintay, hindi ang biglaang lumilitaw.",
        "Ang pinakamahusay na horror ay isang ideya lang at hindi ito papakawin. Kapag tatlong kabigatan na ang kailangang lampasan, nawala na ang takot at naging abala na lang.",
        "Kung gusto mo ang atmosphere, panoorin ang mabagal. Kung gusto mong mabigla, panoorin ang may soundtrack na naipapansin mo bago pa ang twist.",
        "Ang horror na tunay na nakababahala ay tanong ng mood: mabagal na dread, folk horror, at simpleng slasher - tatlong magkaibang bagay ang sinasabi ng mga tao kapag sinasabi nilang horror."
      ],
      closers: [
        "Dread, gore, o uming light na puwede ninyong panoorin kasama ang mga kaibhan?",
        "Bago, o matanda na at hindi pa nalalakad ng iba?",
        "Ano ang huling nagustuhan mo? Mula doon ako magsisimula.",
        "Isang recommendation lang ba, o maikling listahan para mamayang gabi?"
      ]
    },

    food: {
      keywords: ["pagkain", "recipe", "luto", "gabi", "kain", "chicken", "isda", "adobo", "side dish", "ginaing", "kapamilya"],
      bodies: [
        "Ang lihim sa karamihan sa mabilis na pagluto ay ang plano mismo ang kawali. I-brown muna, saka lahat - mas mahalaga ang pagkakasunod kaysa dami.",
        "Maglagay ng asin nang paunti-unti, hindi lahat sa simula. Hindi mo na maipak concentrates sa huli, kaya i-season sa bawat yugto, at tikman bago ihatag.",
        "Kung bland, kadalas kulang ang acid, hindi asin. Isang squeeze ng lemon o isang kutsara ng vinegar ang nakakapag-ayus sa maraming pagkain.",
        "Ang maganda at kusina ay hindi pagpuno ng kawali. Nagiging kulay ang pagkain kapag tuyo ang ibabaw at may puwang sa paligid."
      ],
      closers: [
        "Anong mga sangkap ang meron ka na?",
        "Labin-limang minuto, o buong araw?",
        "Simple lang ba, o nagtututo ka ng isang tunay na pagkain?",
        "Sabihin mo kung ano ang nasa ref, at mula doon tayo magsisimula."
      ]
    },

    jokes: {
      keywords: ["joke", "natawa", "nakakatawa", "humor", "aliw"],
      bodies: [
        "May dalawang klase ang programmer: ang nakatransahan ng timezone bug, at ang akala nila ligtas dahil isang timezone lang ang laptop nila.",
        "Pumasok ang SQL query sa isang bar, lumapit sa dalawang table, at nagtanong: maaari ba akong makipag-join sa inyo?",
        "Ang pinakamainam na debugging tool ay pa rin ang pahinga. Lumaktaw ka, bumabalik ka, at sasabihin sa iyo ng bug kung ano ito - karaniwang habang nagtutago ka ng tsa.",
        "Ang code ko gaya ng relasyon: akala ko okay, tapos may ibang nagbasa at nahanap agad ang problema."
      ],
      closers: [
        "Gusto mo pa ba ito, o ibang klase?",
        "May iba pa ako - gusto mo?",
        "I-save mo iyan para sa susunod na pulong."
      ]
    },

    motivation: {
      keywords: ["motivasyon", "malampa", "tanggalin", "stuck", "sumuko", "pagod", "burnout", "tiwala", "takot", "kawalang-loob"],
      bodies: [
        "Sumusunod ang motivasyon sa aksyon, hindi sa kabuuan. Hindi ka naghihintay na magkaroon ng kagustuhan; sisimulan mo na, at doon ka na makararating dalawang minuto na.",
        "Hatiin hanggang hindi na ito worthong gawin. Ang karamihan sa procrastination ay pagtugon sa gawaing masyadong malaki, hindi sa mismong gawain.",
        "Ang pagkakapit ay impormasyon, hindi hatol. Tanungin mo kung ano mismo ang hindi mo pa alam, at iyon ang magiging isa oras ng trabaho.",
        "Ihambing ang iyong Martes sa sarili mong Martes noong nakaraang linggo. Ang paghahambing sa highlight reel ng iba ay palaging panalo sila."
      ],
      closers: [
        "Ano ang pinakamalaking hakbang na kaya mong gawin ngayon?",
        "Ano ang itsura ng gawain kung sampung minuto lang ang gagawin mo?",
        "Sabihin mo kung ano ang iniiwasan mo, at makikita natin kung ano talaga ang nasa loob nito.",
        "Pumili ng isang maliit na bagay at tapusin natin ito ngayon."
      ]
    },

    study: {
      keywords: ["pag-aaral", "paaralan", "eskwela", "pagsusulit", "exam", "quiz", "review", "marka"],
      bodies: [
        "Mas mainam ang aktibong pagbibigay-kasalaysay kaysa sa muling pagbasa. Isara ang libro, isulat ang lahat ng naaalala mo, pagkatapos ay tignan mo kung ano ang nawala. Sa puwang na iyon nangyayari ang pagtututo.",
        "Gumagana ang spaced repetition dahil ang pagkalimot mismo ang punto. Ang pagbabalik-aral bago mo makalimutan ang siyang lumilipat sa long-term memory.",
        "Kung hindi mo maiipaliwanag nang simple, hindi mo pa talaga naiintindihan. Ang paglalarawan nang malakas sa walang laman na kuwarto ay mahirap pero epektibong pagsubok.",
        "Mag-aaral nang mga bloc ng 40 minuto at may totoong pahinga sa pagitan. Ang attention mo ay nauuwiwan muna bago ang stamina mo."
      ],
      closers: [
        "Anong subject, at ilang araw na bago ang pagsusulit?",
        "Aling bahagi ang pakiramdam mong malakas?",
        "Gusto mo bang magsaalitan, o balangkas sa pag-aaral?",
        "Sabihin mo ang paksa, at magsisimula tayo sa alam mo na."
      ]
    },

    weather: {
      keywords: ["panahon", "ulan", "mainit", "malamig", "bagyo", "hangin", "kalatagan", "temperatura"],
      bodies: [
        "Hindi ko kita ang labas ng bintana mo, kaya hindi ako magsasabi ng alam ko hindi ko alam. Sabihin mo kung ano ang nakikita mo, at makakatulong ako sa pagpili ng damit.",
        "Halos pareho ang panuntunan sa panahon: tingnan mo ngayon ang langit, at ang forecast bago ka magpasya na lumabas nang ilang oras.",
        "Sa pag-commute, ang tanong hindi kung anong panahon ngayon, kundi kung anong magiging panahon pagkatapos ng 20 minuto. Yan ang nagpapasya sa payong.",
                "Kung magpapack ka para sa araw, para sa pinakamalamig na oras, hindi para sa average. Karamihan sa discomfort ay problema ng umaga, hindi ng hapon."
      ],
      closers: [
        "Ano ang lagay ng panahon sa lugar mo ngayon?",
        "May plano ka ba sa labas, o kinakwartela lang?",
        "Kailangan mo ba ng tulong sa pagpili ng gagawin ngayong araw?"
      ]
    },

    facts: {
      keywords: ["katotohanan", "alam mo ba", "trivia", "kasaysayan", "space", "siyensiya", "alamin"],
      bodies: [
        "Ang honey lang ang pagkain na hindi nauumay. Ang mga garas na natagpuan sa mga libing ng Ehipto, kinakain pa rin pagkalipas ng libu-libong taon, dahil masyadong acidic at tuyo para mabuhay ang mga mikrobyo.",
        "Mas maraming kahoy sa Mundo kaysa bituin sa galaksya namin. Halos tatlong trilyong kahoy laban sa ilang daang bilyong bituin.",
        "Ang grupo ng mga flamingo ay flamboyance, ang grupo ng mga jellyfish ay smack, at ang grupo ng mga meerkat ay mob. Maraming ganyan ang wikang Ingles, at halos walang patakaran.",
        "Tatlong puso at asul na dugo ang mga octopus, at nakaka-dibuho sila sa kanilang mga braso. Kaunti sa kanila ang gumagana ayon sa inaasahan mo."
      ],
      closers: [
        "Gusto mo pa ba ng ganoon?",
        "Tama ba ang dating niyan? Marami pa ako.",
        "Magtanong ka pa - hindi ako nauubos."
      ]
    },

    money: {
      keywords: ["pera", "presyo", "mahal", "mura", "libre", "bayad", "subscription", "ipon", "badyet"],
      bodies: [
        "Ang pinakamura ay karaniwang hindi ang pinakamaliit na numero. Ito yung gagamitin mo pa rin sa darating na taon.",
        "Sa software: ang open source at local models ay nagpapalit ng bayad para sa oras at pansin mo. Worth it iyon kung marami kang gamit, at hindi kung dalawa lang.",
        "Kung may libreng tier, magsimula doon at magbayad lang kapag nakatama ka sa totoong limit. Ang maagang pagbabayad ay pambayad lamang sa mga feature na hindi mo gagamitin.",
        "Ang ibang kalahati ng palitan ay ang oras. Madalas, libre sa pera ay hindi libre sa oras - at karaniwang mas bihira ang oras."
      ],
      closers: [
        "Para sa baon - trabaho, pag-aaral, o personal?",
        "Alin ang mas mahalaga, ang presyo ba o ang hirap i-setup?",
        "Sabihin mo ang kailangan mo, at sasabihin ko sa iyo ang pinakamakatuwirang opsyon."
      ]
    },

    health: {
      keywords: ["kalusugan", "tulog", "pagod", "sakit", "ehersisyo", "diyeta", "stres", "sakit ng ulo", "tubig", "lakad"],
      bodies: [
        "Ang pinakamurang health intervention ay ang tulog, at malayo ito sa unang lugar. Mas magana ang lahat kapag hindi ka nang kulang.",
        "Ang karamihan sa sakit ng ulo ay tensyon o kakulangan sa tubig. Ang tubig, sikat ng araw, at maikling lakad ang nakakapag-ayus sa marami - higit sa anumang gamot.",
        "Hindi kailangang ehersisyo ang galaw para makasama. Isang 10 minutong lakad pagkatapos ng pagkain ang may mas malaking epekto kaysa buong gabing nakaupo.",
        "Hindi ako doktor at hindi ako magpapakita. Kung patuloy, ang tunay na doktor ang dapat mong puntahan - gamitin ako para malaman ano ang itatanong mo."
      ],
      closers: [
        "Gaano katagal na?",
        "Tulog ba, pagkain, o galaw ang tinutukoy mo?",
        "Anong itsura ang isang normal na araw para sa iyo ngayon?"
      ]
    },

    relationship: {
      keywords: ["relasyon", "crush", "mahal", "hiwalay", "kaaway", "kaibhan", "ex", "pag-isa", "gustong-gusto"],
      bodies: [
        "Karamihan sa problema sa relasyon ay problema sa komunikasyon na nagsu-costume. Ang-away ay karaniwang hindi tungkol sa bagay na inaaway ninyo.",
        "Kung nakikita mong iniisip mo ang usapan sa halip na sabihin mo ito, iyon ang sagot - ang pag-iisip ay mas ligtas kaysa sa totoo.",
        "Ang pag-isa ay hindi katamnan, at hindi ito naaayos sa pagiging abala. Mas nagiging madali kapag pumasok ka ng maraming tao, kahit na kabahas.",
        "Minsan ang pinakamagalit ay malinaw na sagot kaysa maganda na paghihintay. Huwag mong bayaan ang bukas kung saan mo na talaga pasyahan."
      ],
      closers: [
        "Gusto mong pag-usapan ang nangyari, o ang susunin mong hakbang?",
        "Ano ba talaga ang gusto mong mangyari dito?",
        "Sabihin mo ang bahaging hindi mo pa naisalita.",
        "Ano ang lumalakas sa isip mo tungkol dito?"
      ]
    },

    goodbye: {
      keywords: ["bye", "paalam", "salamat", "magkita", "bukas", "good night"],
      bodies: [
        "Masaya akong nakatulong. Lahat ay nasa iyo, kaya isara mo na ang tab at doon pa rin lahat kapag bumalik ka.",
        "Kahit anuman. Balik ka tuwing may nasisira, o tuwing gusto mong mag-isip nang malalim.",
        "Maganda ang araw. Naka-save na ang mga chat mo, at walang ipinadala kahit saan.",
        "Kung makakatulong, isulat mo lang ang isang bagay na gusto mong tandaan dito. Mas madaling tandaan ang isang pangungusap kaysa sa buong usapan."
      ],
      closers: [
        "Kitaon kita sa susunod.",
        "Good luck sa iyo.",
        "Ingat ka."
      ]
    }
  }
  };
});
