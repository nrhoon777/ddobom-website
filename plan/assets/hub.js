/* ===== 첫 화면 — 핵심 메시지 + 2단계 니즈 선택 ======================== */
(function () {
  "use strict";
  var $ = UI.$;

  /* 비과세 요건 요약 */
  $("#fLimit").innerHTML = "월 " + UI.n(TAX.monthlyLimit / 10000) + "만원" +
    '<span class="fact__div">/</span>' + (TAX.lumpLimit / 100000000) + "억원";
  $("#fHold").textContent = TAX.holdYears + "년";
  $("#fHist").innerHTML = TAX.history.map(function (h, i) {
    return (i ? "→ " : "") + '<span class="' + (i === TAX.history.length - 1 ? "hi" : "") + '">' + h.v + "</span>";
  }).join(" ");

  /* 자유 입출금 — 한도·횟수는 상품과 약관에 따라 다르므로 수치를 단정하지 않는다 */
  $("#flexOut").innerHTML = "필요한 만큼 빼 쓰고도 계약은 유지됩니다. 한도·횟수·수수료는 상품과 약관에 따라 다릅니다.";
  $("#flexIn").innerHTML = "여윳돈이 생기면 같은 계약에 더 넣을 수 있습니다. 추가납입 한도 역시 상품마다 다릅니다.";

  /* 이번 달 숫자 — 자료에 실제로 있는 값만 */
  var LA = PRODUCTS.lumpAnnuity, LG = PRODUCTS.legacy, SW = PRODUCTS.shortWhole;
  [
    { k: "20년 확정 공시이율", v: LA.plans["20"].rate.toFixed(2) + "%",
      s: "가입 시점 이율로 20년을 확정합니다" },
    { k: "20년 시점 확정 환급률", v: LA.plans["20"].defer.plus.toFixed(1) + "%",
      s: "일시납 연금 · 거치형 연금강화형" },
    { k: "상속종신 사망배수", v: LG.multiple[40].toFixed(1) + "배",
      s: "40세 가입 · 가입 후 20년 확정" },
    { k: "단기납 종신 10년+1일", v: SW.refund[7][10].toFixed(1) + "%",
      s: "7년납 · 암 진단 시 납입면제 기본" }
  ].forEach(function (r) {
    var el = document.createElement("div");
    el.className = "rate";
    el.innerHTML = '<p class="rate__k">' + r.k + "</p><p class=\"rate__v num\">" + r.v +
      '</p><p class="rate__s">' + r.s + "</p>";
    $("#rates").appendChild(el);
  });

  /* 근거 기사 */
  var nl = $("#newsList");
  NEWS.forEach(function (a) {
    var el = document.createElement("a");
    el.className = "newsit"; el.href = a.url; el.target = "_blank"; el.rel = "noopener";
    el.innerHTML =
      '<span class="newsit__top"><span class="newsit__tag">' + a.tag + "</span>" +
      '<span class="newsit__meta">' + a.src + " · " + a.date + "</span></span>" +
      '<span class="newsit__t">' + a.title + "</span>" +
      '<span class="newsit__d">' + a.desc + "</span>" +
      '<span class="newsit__go">원문 보기 →</span>';
    nl.appendChild(el);
  });

  /* ── STEP 1 ─────────────────────────────────────────────────── */
  var host = $("#tracks"), current = null;
  TRACKS.forEach(function (t) {
    var el = document.createElement("button");
    el.type = "button"; el.className = "pick"; el.setAttribute("data-k", t.key);
    el.innerHTML =
      '<span class="pick__no" aria-hidden="true">' + t.no + "</span>" +
      '<span class="pick__q">' + t.q + "</span>" +
      '<span class="pick__t">' + t.t + "</span>" +
      '<span class="pick__d">' + t.d + "</span>" +
      '<span class="pick__go">이걸로 보기</span>';
    el.addEventListener("click", function () { open(t); });
    host.appendChild(el);
  });

  /* ── STEP 2 ─────────────────────────────────────────────────── */
  function open(t) {
    current = t;
    UI.$$(".pick").forEach(function (p) { p.classList.toggle("is-on", p.getAttribute("data-k") === t.key); });
    $("#s2Title").innerHTML = t.t;
    $("#s2Lead").textContent = "조금만 더 좁혀볼게요. 어느 쪽에 가까우신가요?";
    var s = $("#subs"); s.innerHTML = "";
    t.subs.forEach(function (sub) {
      var a = document.createElement("a");
      a.className = "sub"; a.href = t.page + "?m=" + sub.m;
      var prod = PRODUCTS[sub.pid];
      a.innerHTML =
        '<span class="sub__ico" aria-hidden="true">' + sub.icon + "</span>" +
        '<span class="sub__body"><span class="sub__t">' + sub.t + "</span>" +
        '<span class="sub__d">' + sub.d + "</span>" +
        (prod ? '<span class="sub__p">' + CALC.label(prod) + "</span>" : "") +
        '<span class="sub__go">' + sub.cta + " →</span></span>";
      s.appendChild(a);
    });
    var sec = $("#step2");
    sec.hidden = false;
    sec.scrollIntoView({ behavior: UI.reduce ? "auto" : "smooth", block: "start" });
    try { sessionStorage.setItem("track", t.key); } catch (e) {}
  }

  $("#s2Back").addEventListener("click", function () {
    $("#step2").hidden = true;
    UI.$$(".pick").forEach(function (p) { p.classList.remove("is-on"); });
    $("#pick").scrollIntoView({ behavior: UI.reduce ? "auto" : "smooth", block: "start" });
  });

  UI.setSummary(function () {
    return "첫 화면에서 문의 (선택 전)" + (current ? " · 관심: " + current.q : "");
  });

  UI.boot();
})();
