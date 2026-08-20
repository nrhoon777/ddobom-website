/* ===== ② 소비 습관을 바꿔 만드는 1억 ================================= */
(function () {
  "use strict";
  var $ = UI.$;
  var P = PRODUCTS.million;
  var S = { age: 40, prem: P.premDefault, term: P.payTerms[P.payTerms.length - 1], rate: P.rate.current, when: P.checkYears[0], mode: "goal" };
  var H = {};   // 습관별 수량

  function yFmt(v) {
    if (v >= 100000000) return (v / 100000000).toFixed(1) + "억";
    if (v >= 10000) return Math.round(v / 10000).toLocaleString("ko-KR") + "만";
    return Math.round(v);
  }
  var M = function (v) { return UI.money(P, v); };

  /* ── 습관 슬라이더 ────────────────────────────────────────── */
  function monthlyOf(h, qty) { return h.per === "주" ? h.price * qty * 4.345 : h.price * qty; }
  function buildHabits() {
    var host = $("#habits");
    HABITS.forEach(function (h) {
      H[h.key] = h.def;
      var box = document.createElement("div");
      box.innerHTML =
        '<div class="habit__row"><span class="habit__l"><span aria-hidden="true">' + h.icon + "</span>" +
        h.label + ' <span class="hint">' + h.per + " " + h.unit + '</span></span>' +
        '<output class="habit__v num" id="h-' + h.key + '">—</output></div>' +
        '<input class="rng" type="range" id="r-' + h.key + '" min="0" max="' + (h.per === "주" ? 21 : 15) +
        '" step="1" value="' + h.def + '" aria-label="' + h.label + ' ' + h.per + " " + h.unit + '" />';
      host.appendChild(box);
      var r = box.querySelector("input");
      r.addEventListener("input", function () { H[h.key] = +r.value; habits(); });
    });
    habits();
  }
  function habits() {
    var total = 0;
    HABITS.forEach(function (h) {
      var m = monthlyOf(h, H[h.key]); total += m;
      $("#h-" + h.key).textContent = H[h.key] + h.unit + " · " + UI.krw(m);
      UI.paintRange($("#r-" + h.key));
    });
    var half = Math.round(total / 2 / 10000) * 10000;
    $("#savedV").textContent = UI.krw(half);
    $("#savedS").innerHTML = "지금 새는 돈 <b>" + UI.krw(total) + "</b> 중 절반입니다. 나머지 절반은 그대로 쓰셔도 됩니다.";
    $("#applySaved").setAttribute("data-v", Math.max(P.premRange[0], Math.min(P.premRange[1], Math.round(half / 10000))));
  }
  $("#applySaved").addEventListener("click", function () {
    S.prem = +this.getAttribute("data-v") || S.prem;
    $("#prem").value = S.prem;
    S.mode = "mine"; setMode(1);
    run();
    $("#calc").scrollIntoView({ behavior: UI.reduce ? "auto" : "smooth", block: "start" });
  });

  /* ── 세그먼트 ─────────────────────────────────────────────── */
  function seg(host, items, get, set) {
    host.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = it.label;
      b.className = get() === it.value ? "is-on" : "";
      b.addEventListener("click", function () { set(it.value); });
      host.appendChild(b);
    });
  }
  function buildSegs() {
    seg($("#termSeg"), P.payTerms.map(function (t) { return { value: t, label: t + "년납" }; }),
      function () { return S.term; }, function (v) { S.term = v; if (S.when < v) S.when = v; run(); });
    seg($("#rateSeg"), P.rate.options.map(function (r) { return { value: r, label: (r === P.rate.min ? "최저보증 " : "") + r.toFixed(1) + "%" }; }),
      function () { return S.rate; }, function (v) { S.rate = v; run(); });
    seg($("#whenSeg"), P.checkYears.filter(function (y) { return y >= S.term; })
      .map(function (y) { return { value: y, label: y + "년 뒤 (만 " + (S.age + y) + "세)" }; }),
      function () { return S.when; }, function (v) { S.when = v; run(); });
  }

  /* ── 모드 ─────────────────────────────────────────────────── */
  var TABS = [["mGoal", "pGoal", "goal"], ["mMine", "pMine", "mine"]];
  function setMode(i) {
    S.mode = TABS[i][2];
    TABS.forEach(function (x, k) {
      $("#" + x[0]).setAttribute("aria-selected", k === i ? "true" : "false");
      $("#" + x[1]).hidden = k !== i;
    });
  }
  TABS.forEach(function (t, i) { $("#" + t[0]).addEventListener("click", function () { setMode(i); run(); }); });

  $("#age").addEventListener("input", function () { S.age = +this.value; run(); });
  $("#prem").addEventListener("input", function () { S.prem = +this.value; run(); });

  /* ── 실행 ─────────────────────────────────────────────────── */
  function run() {
    buildSegs();
    UI.paintRange($("#age")); UI.paintRange($("#prem"));
    $("#ageOut").textContent = S.age + "세";
    $("#premOut").textContent = UI.n(S.prem) + "만원";
    if (S.when < S.term) S.when = S.term;

    if (S.mode === "goal") goal(); else mine();

    $("#assumeTxt").innerHTML = "<b>계산 가정:</b> 적립이율 연 " + S.rate.toFixed(1) +
      "%(복리) · 사업비는 경과 연차별 차감으로 단순화 · 고정 수령은 연 " + P.payoutRate.toFixed(1) +
      "% 지급률(원금 유지형) 가정" +
      (P.refund ? " · 환급률은 제공된 가입설계서 표 기준" : " · 환급률은 <b>예시 모델</b>로 추정(실제 가입설계서 표로 교체 예정)") + ".";
    $("#simPick").innerHTML = "상담 신청 시 <b>" + S.age + "세 · 월 " + S.prem + "만원 · " + S.term +
      "년납 · " + S.when + "년 뒤 목표</b> 조건이 함께 전달됩니다.";
  }

  UI.setSummary(function () {
    return "1억 만들기 / " + S.age + "세 / 월 " + S.prem + "만원 / " + S.term + "년납 / " +
      S.when + "년 뒤 확인 / 이율 " + S.rate.toFixed(1) + "%";
  });

  /* 목표 역산 */
  function goal() {
    var need = CALC.solveMonthly(P, S.term, S.when, P.goal, S.rate);
    var paid = CALC.totalPaid(need, S.term);
    $("#goalK").textContent = S.when + "년 뒤 " + UI.krw(P.goal) + "을 만들려면 매달";
    UI.count($("#goalV"), need, function (v) { return UI.krw(Math.round(v / 1000) * 1000); });
    $("#goalS").innerHTML = S.term + "년만 넣고, " + (S.when - S.term > 0 ? "이후 " + (S.when - S.term) + "년은 그냥 두면 됩니다." : "바로 목표에 닿습니다.");
    $("#goalPaid").textContent = UI.krw(paid);
    $("#goalPaidS").textContent = S.term + "년 × 12개월";
    $("#goalGain").textContent = UI.krw(Math.max(0, P.goal - paid));
    $("#goalDay").textContent = UI.krw(Math.round(need / 30 / 100) * 100);

    var tb = $("#goalTbl"); tb.innerHTML = "";
    P.payTerms.forEach(function (t) {
      var when = Math.max(S.when, t);
      var m = CALC.solveMonthly(P, t, when, P.goal, S.rate);
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + t + "년납" + (t === S.term ? " <span class='tag'>선택</span>" : "") + "</td>" +
        "<td class='hi'>" + UI.krw(Math.round(m / 1000) * 1000) + "</td>" +
        "<td>" + UI.krw(CALC.totalPaid(m, t)) + "</td>" +
        "<td class='up'>" + UI.krw(P.goal) + " <span class='hint'>(" + when + "년 뒤)</span></td>";
      tb.appendChild(tr);
    });
  }

  /* 내 금액 */
  function mine() {
    var monthly = S.prem * 10000;
    var paid = CALC.totalPaid(monthly, S.term);
    var fund = CALC.fundAt(P, monthly, S.term, S.when, S.rate);
    $("#mineK").textContent = S.when + "년 뒤 (만 " + (S.age + S.when) + "세) 받게 되는 금액";
    UI.count($("#mineV"), fund, M);
    $("#mineS").innerHTML = "월 " + UI.krw(monthly) + "씩 " + S.term + "년을 넣었을 때입니다.";
    $("#minePaid").textContent = UI.krw(paid);
    $("#minePaidS").textContent = "월 " + UI.krw(monthly) + " × " + S.term + "년";
    $("#minePct").textContent = UI.pct(fund / paid * 100);
    var gap = P.goal - fund;
    $("#mineGap").textContent = gap > 0 ? UI.krw(gap) + " 부족" : UI.krw(-gap) + " 초과";
    $("#mineGapS").textContent = gap > 0 ? "월 " + UI.krw(Math.round(CALC.solveMonthly(P, S.term, S.when, P.goal, S.rate) / 1000) * 1000) + "이면 도달" : "목표 달성";
    var fix = CALC.interestOnly(fund, P.payoutRate);
    $("#mineFix").textContent = UI.krw(Math.round(fix / 1000) * 1000);
    $("#mineFixS").innerHTML = "원금 " + UI.krw(fund) + "은 그대로";

    var c = CALC.curve(P, monthly, S.term, Math.max(S.when, S.term + 5), S.rate);
    UI.draw($("#chMine"), {
      series: [{ pts: c.map(function (p) { return { x: p.y, y: p.fund }; }), cls: "l-gold", area: true },
               { pts: c.map(function (p) { return { x: p.y, y: p.paid }; }), cls: "l-dash" },
               { pts: [{ x: 0, y: P.goal }, { x: c[c.length - 1].y, y: P.goal }], cls: "l-mint" }],
      marks: [{ x: S.term, label: "완납 " + S.term + "년" }],
      yFmt: yFmt
    });

    var hit = null;
    for (var y = 1; y <= 40; y++) if (CALC.fundAt(P, monthly, S.term, y, S.rate) >= P.goal) { hit = y; break; }
    $("#mineNote").innerHTML = hit
      ? "지금 조건이면 <b>" + hit + "년차(만 " + (S.age + hit) + "세)에 1억</b>에 닿습니다. 완납 뒤 그대로 두면 이자가 이자를 낳는 구간이라, 늦게 꺼낼수록 곡선이 가팔라집니다."
      : "지금 조건으로는 40년 안에 1억에 닿지 않습니다. <b>월 납입액을 올리거나 납입 기간을 늘려야</b> 합니다. 위 '1억을 만들려면 얼마?' 탭에서 필요한 금액을 확인해 보세요.";
  }

  UI.boot();
  buildHabits();
  setMode(0);
  run();
})();
