/* bokskie.v1 engine demo.
   Loads the same engine files node uses - the UMD wrapper picks the
   right path at load time, so there is no second implementation to
   drift out of sync with the tests. */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var engine = null;
  var turnNo = 0;

  var SUGGESTIONS = [
    { q: "what is javascript", miss: false },
    { q: "how does gravity work", miss: false },
    { q: "what is compound interest", miss: false },
    { q: "kumusta ka", miss: false },
    { q: "who are you", miss: false },
    { q: "what can you do", miss: false },
    { q: "who won the 2019 basketball world cup", miss: true },
    { q: "how to bake sourdough bread", miss: true }
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Seeded from the turn number so a reload reproduces a session, and
     so repeated identical questions do not return identical text. */
  function nextSeed() { return (turnNo * 2654435761) >>> 0; }

  function render(r, asked) {
    turnNo++;
    var out = $("out");
    var empty = out.querySelector(".empty");
    if (empty) empty.remove();

    var kind = !r.known ? "refused" : (r.weak ? "weak" : "known");
    var cls = "turn" + (r.known ? (r.weak ? " weak" : "") : " unknown");
    var label = !r.known ? "not in the bank · refused"
              : (r.weak ? "low confidence" : "answered");

    var html = '<div class="' + cls + '">'
      + '<div class="asked">' + esc(asked) + "</div>"
      + '<span class="badge ' + kind + '">' + label + "</span>"
      + '<p class="said">' + esc(r.text) + "</p>";

    if (r.debug) {
      var d = r.debug;
      html += '<div class="trace">'
        + "tokens &nbsp;" + esc((d.tokens || []).join(" ") || "(none)")
        + "<br>lang &nbsp;&nbsp;&nbsp;" + esc(d.language)
        + "<br>intent " + esc(d.intent || "—")
        + "<br>topic &nbsp;&nbsp;" + esc(d.topic || "—")
        + "<br>candidates " + d.candidates
        + "<br>top score " + Number(d.topScore).toFixed(3)
        + "<br>entries " + esc((d.hits || []).join("  ·  ") || "(none)")
        + "</div>";
    }
    html += "</div>";

    var div = document.createElement("div");
    div.innerHTML = html;
    out.insertBefore(div, out.firstChild);
  }

  function ask(text) {
    if (!engine) return;
    var asked = String(text || "").trim();
    if (!asked) return;
    var r = engine.reply(asked, { seed: nextSeed(), explain: true });
    render(r, asked);
  }

  /* ---- boot ---------------------------------------------------- */

  function fail(msg) {
    var s = $("status");
    s.className = "status err";
    s.textContent = "could not load: " + msg;
    $("q").disabled = true;
    $("go").disabled = true;
  }

  function ready(e) {
    engine = e;
    var st = e.stats();
    $("status").className = "status ready";
    $("status").textContent = "ready · " + st.entries + " entries · " + st.topics + " topics";

    $("stats").innerHTML = [
      "<span><b>" + st.entries + "</b> entries</span>",
      "<span><b>" + st.tokens + "</b> indexed tokens</span>",
      "<span><b>" + st.topics + "</b> topics</span>",
      "<span><b>" + st.files + "</b> json files</span>",
      "<span><b>0</b> network calls</span>"
    ].join("");

    SUGGESTIONS.forEach(function (s) {
      var b = document.createElement("button");
      b.textContent = s.q;
      if (s.miss) b.className = "miss";
      b.title = s.miss ? "outside the bank — watch it refuse" : "in the bank";
      b.addEventListener("click", function () { $("q").value = s.q; ask(s.q); });
      $("chips").appendChild(b);
    });

    $("q").disabled = false;
    $("go").disabled = false;
    $("q").focus();
  }

  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    ask($("q").value);
    $("q").value = "";
  });

  /* fetch() on file:// is blocked by every modern browser, so the page
     has to be served. Say so plainly rather than failing silently. */
  if (location.protocol === "file:") {
    fail("open over http - run: node server.js, then visit localhost:3000/bokskie-v1/app/");
  } else {
    BokskieEngine.Engine.load({ basePath: "../data/" })
      .then(ready)
      .catch(function (err) { fail(err && err.message ? err.message : String(err)); });
  }
})();
