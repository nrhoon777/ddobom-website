/* ===== ① 노후 현금흐름 ================================================ */
(function () {
  "use strict";
  var $ = UI.$, $$ = UI.$$;
  var P = PRODUCTS.cashflow;
  var S = { age: 45, prem: P.premDefault, term: 20, rate: P.rate.current, start: 20, drawPct: 100, mode: "live", pen: 20 };

  function yFmt(v) {
    if (P.currency === "USD") return v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v);
    if (v >= 100000000) return (v / 100000000).toFixed(1) + "억";
    if (v >= 10000) return Math.round(v / 10000).toLocaleString("ko-KR") + "만";
    return Math.round(v);
  }
  function M(v) { return UI.money(P, v); }
  function unit() { return P.currency === "USD" ? "달러" : "원"; }

  /* ── 세그먼트 버튼 만들기 ─────────────────────────────────── */
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

  function startOptions() {
    var out = [], seen = {};
    P.startAfter.forEach(function (v) {
      var y = Math.max(v, S.term);
      if (!seen[y]) { seen[y] = 1; out.push({ value: y, label: y + "년 뒤 (만 " + (S.age + y) + "세)" }); }
    });
    return out;
  }

  function buildSegs() {
    seg($("#termSeg"), P.payTerms.map(function (t) { return { value: t, label: t + "년납" }; }),
      function () { return S.term; }, function (v) { S.term = v; fixStart(); run(); });
    seg($("#rateSeg"), P.rate.options.map(function (r) {
      return { value: r, label: (r === P.rate.min ? "최저보증 " : "") + r.toFixed(1) + "%" };
    }), function () { return S.rate; }, function (v) { S.rate = v; run(); });
    seg($("#startSeg"), startOptions(), function () { return S.start; }, function (v) { S.start = v; run(); });
    seg($("#penSeg"), startOptions(), function () { return S.pen; }, function (v) { S.pen = v; run(); });
    seg($("#drawSeg"), [
      { value: 50, label: "낸 것의 절반" }, { value: 100, label: "낸 만큼" }, { value: 150, label: "낸 것의 1.5배" }
    ], function () { return S.drawPct; }, function (v) { S.drawPct = v; run(); });
  }
  function fixStart() {
    var ok = startOptions().map(function (o) { return o.value; });
    if (ok.indexOf(S.start) < 0) S.start = ok[0];
    if (ok.indexOf(S.pen) < 0) S.pen = ok[ok.length - 1];
  }

  /* ── 모드 탭 ──────────────────────────────────────────────── */
  var TABS = [["mLive", "pLive", "live"], ["mPen", "pPen", "pen"], ["mLump", "pLump", "lump"]];
  TABS.forEach(function (t, i) {
    $("#" + t[0]).addEventListener("click", function () {
      S.mode = t[2];
      TABS.forEach(function (x, k) {
        $("#" + x[0]).setAttribute("aria-selected", k === i ? "true" : "false");
        $("#" + x[1]).hidden = k !== i;
      });
      run();
    });
  });

  /* ── 입력 ─────────────────────────────────────────────────── */
  $("#age").addEventListener("input", function () { S.age = +this.value; run(); });
  $("#prem").addEventListener("input", function () { S.prem = +this.value; run(); });
  $("#prem").min = P.premRange[0]; $("#prem").max = P.premRange[1];
  $("#age").min = P.ageRange[0];  $("#age").max = P.ageRange[1];

  /* ── 계산 & 그리기 ────────────────────────────────────────── */
  function run() {
    buildSegs();
    UI.paintRange($("#age")); UI.paintRange($("#prem"));
    $("#ageOut").textContent = S.age + "세";
    $("#premOut").textContent = UI.n(S.prem) + "만원";

    var monthly = S.prem * 10000 / (P.currency === "USD" ? CONFIG.fxDefault : 1);
    var paid = CALC.totalPaid(monthly, S.term);

    if (S.mode === "live") drawLive(monthly, paid);
    if (S.mode === "pen")  drawPen(monthly, paid);
    if (S.mode === "lump") drawLump(monthly, paid);

    $("#assumeTxt").innerHTML =
      "<b>계산 가정:</b> 적립이율 연 " + S.rate.toFixed(1) + "%(복리) · 사업비는 경과 연차별 차감으로 단순화 · " +
      "연금은 " + (P.annuity.months / 12) + "년 확정 지급 기준" +
      (P.refund ? " · 환급률은 제공된 가입설계서 표 기준" : " · 환급률은 <b>예시 모델</b>로 추정(실제 가입설계서 표로 교체 예정)") +
      (P.currency === "USD" ? " · 환율 " + UI.n(CONFIG.fxDefault) + "원 가정" : "") + ".";

    $("#simPick").innerHTML = "상담 신청 시 <b>" + S.age + "세 · 월 " + S.prem + "만원 · " + S.term +
      "년납 · 이율 " + S.rate.toFixed(1) + "%</b> 조건이 함께 전달됩니다.";
  }

  UI.setSummary(function () {
    return "노후 현금흐름 / " + S.age + "세 / 월 " + S.prem + "만원 / " + S.term + "년납 / 이율 " +
      S.rate.toFixed(1) + "% / " + S.start + "년 뒤부터 " + S.drawPct + "% 인출";
  });

  /* 생활자금형 */
  function drawLive(monthly, paid) {
    var draw = monthly * 12 * S.drawPct / 100;
    var sim = CALC.withdraw(P, monthly, S.term, S.start, draw, S.rate, 20);
    var rows = sim.rows, last = rows[rows.length - 1];
    var startFund = rows[0].fund;

    $("#drawHint").innerHTML = "매년 <b>" + M(draw) + "</b>씩 (월 " + M(draw / 12) + " 꼴)";
    $("#liveK").textContent = "인출 시작 20년 뒤 — 매년 꺼내 쓰고도 남아 있는 돈";
    UI.count($("#liveV"), last.fund, M);
    var grew = last.fund >= startFund;
    $("#liveS").innerHTML = grew
      ? "매년 " + M(draw) + "씩 20년을 꺼내 썼는데도, 남은 돈은 개시 시점보다 <b>" + M(last.fund - startFund) + " 늘었습니다.</b>"
      : "매년 " + M(draw) + "씩 꺼내 쓰면 남은 돈이 개시 시점보다 <b>" + M(startFund - last.fund) + " 줄어듭니다.</b> 인출액을 낮추면 원금이 유지됩니다.";

    $("#livePaid").textContent = M(paid);
    $("#livePaidS").textContent = "월 " + M(monthly) + " × " + S.term + "년";
    $("#liveStart").textContent = M(startFund);
    $("#liveStartS").textContent = "환급률 " + UI.pct(startFund / paid * 100);
    $("#liveDrawn").textContent = M(last.drawn);
    $("#liveTotal").textContent = M(last.fund + last.drawn);
    $("#liveTotalS").textContent = "총 납입 대비 " + UI.pct((last.fund + last.drawn) / paid * 100);

    var fundPts = [], paidPts = [];
    for (var y = 0; y <= S.start; y++) {
      fundPts.push({ x: y, y: y ? CALC.fundAt(P, monthly, S.term, y, S.rate) : 0 });
      paidPts.push({ x: y, y: CALC.paidBy(monthly, S.term, y) });
    }
    rows.slice(1).forEach(function (r) { fundPts.push({ x: r.y, y: r.fund }); paidPts.push({ x: r.y, y: paid }); });
    UI.draw($("#chLive"), {
      series: [{ pts: fundPts, cls: "l-gold", area: true }, { pts: paidPts, cls: "l-dash" }],
      marks: [{ x: S.start, label: "인출 개시 " + (S.age + S.start) + "세" }],
      yFmt: yFmt
    });

    var tb = $("#liveTbl"); tb.innerHTML = "";
    [5, 10, 15, 20].forEach(function (k) {
      var r = rows[k]; if (!r) return;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>개시 " + k + "년째 (만 " + (S.age + S.start + k) + "세)</td>" +
        "<td>" + M(draw) + "</td><td>" + M(r.drawn) + "</td>" +
        "<td class='hi'>" + M(r.fund) + "</td>" +
        "<td class='" + (r.pct >= 100 ? "up" : "") + "'>" + UI.pct(r.pct) + "</td>";
      tb.appendChild(tr);
    });

    $("#liveNote").innerHTML = grew
      ? "<b>이 구조가 성립하는 조건.</b> 남은 적립금에 붙는 이자가 매년 꺼내는 금액보다 커야 원금이 유지됩니다. 이율이 " +
        P.rate.min.toFixed(1) + "%까지 내려가면 결과가 달라지니, 위 이율 버튼을 눌러 최저보증 기준으로도 꼭 확인해 보세요."
      : "<b>지금 조건에서는 원금이 줄어듭니다.</b> 인출액을 '낸 것의 절반'으로 낮추거나 개시 시점을 늦추면 유지됩니다. 위 버튼으로 바꿔가며 확인해 보세요.";
  }

  /* 연금형 */
  function drawPen(monthly, paid) {
    var fund = CALC.fundAt(P, monthly, S.term, S.pen, S.rate);
    var mo = CALC.annuity(fund, S.rate, P.annuity.months);
    $("#penK").textContent = "만 " + (S.age + S.pen) + "세부터 매월 받는 돈";
    UI.count($("#penV"), mo, M);
    $("#penS").innerHTML = (P.annuity.months / 12) + "년 확정 지급 기준 · 매달 내던 " + M(monthly) +
      "의 <b>약 " + (mo / monthly).toFixed(1) + "배</b>를 매달 받습니다";
    $("#penPaid").textContent = M(paid);
    $("#penFund").textContent = M(fund);
    $("#penFundS").textContent = "환급률 " + UI.pct(fund / paid * 100);
    $("#penTotal").textContent = M(mo * P.annuity.months);
    $("#penTotalS").textContent = "총 납입 대비 " + UI.pct(mo * P.annuity.months / paid * 100);

    var c = CALC.curve(P, monthly, S.term, S.pen, S.rate);
    UI.draw($("#chPen"), {
      series: [{ pts: c.map(function (p) { return { x: p.y, y: p.fund }; }), cls: "l-gold", area: true },
               { pts: c.map(function (p) { return { x: p.y, y: p.paid }; }), cls: "l-dash" }],
      marks: [{ x: S.pen, label: "연금 개시 " + (S.age + S.pen) + "세", anchor: "end" }],
      yFmt: yFmt
    });
  }

  /* 거치형 */
  function drawLump(monthly, paid) {
    var g = $("#lumpGrid"); g.innerHTML = "";
    [10, 15, 20, 30].forEach(function (y) {
      var f = CALC.fundAt(P, monthly, S.term, y, S.rate);
      var d = document.createElement("div"); d.className = "mini__it";
      d.innerHTML = "<p class='mini__k'>" + y + "년 뒤 (만 " + (S.age + y) + "세)</p>" +
        "<p class='mini__v num'>" + M(f) + "</p>" +
        "<p class='mini__s'>환급률 " + UI.pct(f / CALC.paidBy(monthly, S.term, y) * 100) + "</p>";
      g.appendChild(d);
    });
    var c = CALC.curve(P, monthly, S.term, 30, S.rate);
    UI.draw($("#chLump"), {
      series: [{ pts: c.map(function (p) { return { x: p.y, y: p.fund }; }), cls: "l-gold", area: true },
               { pts: c.map(function (p) { return { x: p.y, y: p.paid }; }), cls: "l-dash" }],
      marks: [{ x: S.term, label: "완납 " + S.term + "년" }],
      yFmt: yFmt
    });
    var be = null;
    for (var y = 1; y <= 40; y++) {
      if (CALC.fundAt(P, monthly, S.term, y, S.rate) >= CALC.paidBy(monthly, S.term, y)) { be = y; break; }
    }
    $("#lumpNote").innerHTML = be
      ? "<b>낸 돈을 넘어서는 시점은 " + be + "년차(만 " + (S.age + be) + "세)입니다.</b> 그 전에 해지하면 낸 돈보다 적게 돌려받습니다. 초기 해지 손실이 이 상품의 가장 큰 위험입니다."
      : "<b>가정한 이율에서는 40년 안에 낸 돈을 넘어서지 못합니다.</b> 납입 기간이나 금액 조건을 다시 보셔야 합니다.";
  }

  UI.boot();
  fixStart();
  run();
})();
