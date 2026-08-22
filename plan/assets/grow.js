/* ===== 목돈 만들기 — short(단기 목표 역산) / long(길게 불리기) ========= */
(function () {
  "use strict";
  var $ = UI.$;
  var P = BASE;
  var mode = (location.search.match(/m=(\w+)/) || [])[1] === "short" ? "short" : "long";
  var S = { age: 45, way: "monthly", prem: 100, goal: 10000, term: mode === "short" ? 7 : 20, rate: P.rate.current };

  var COPY = {
    short: { eyebrow: "목돈 만들기 · 단기 목표", title: "정해둔 금액까지,<br /><em>얼마씩</em> 넣으면 될까요?",
             lead: "목표 금액과 기간을 정해두면 매달 넣을 금액을 거꾸로 계산해 드립니다. 달러로 쌓이고, 요건을 채우면 이자에 세금이 붙지 않습니다." },
    long:  { eyebrow: "목돈 만들기 · 길게", title: "지금 넣어두면<br /><em>그때 얼마</em>가 되어 있을까요?",
             lead: "길게 둘수록 복리가 일합니다. 10년, 15년, 20년 뒤에 손에 쥐는 달러 금액을 확인해 보세요." }
  }[mode];
  $("#pgEyebrow").textContent = COPY.eyebrow;
  $("#pgTitle").innerHTML = COPY.title;
  $("#pgLead").textContent = COPY.lead;
  document.title = (mode === "short" ? "단기 목표 자금" : "10~20년 뒤 목돈") + " | 달러 플랜";

  if (mode === "short") { $("#goalWrap").hidden = false; $("#premWrap").hidden = true; }

  function yFmt(v) { return v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v); }
  function U(v) { return "$" + UI.n(v); }
  function K(v) { return UI.krw(UI.toKrw(v)); }
  function fx() { return UI.getFx(); }
  /* 납입액은 가입 시점 환율로 달러 환산해 고정한다.
     그래야 아래 환율 슬라이더가 "받을 때의 환율"만 움직여 환차익이 눈에 보인다. */
  var FX0 = CONFIG.fx.now;
  function monthlyUsd() { return S.prem * 10000 / FX0; }
  function lumpUsd()    { return S.prem * 10000 / FX0; }

  /* ── 세그먼트 ─────────────────────────────────────────────── */
  function seg(host, items, get, set) {
    host.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button"; b.innerHTML = it.label;
      b.className = get() === it.value ? "is-on" : "";
      b.addEventListener("click", function () { set(it.value); });
      host.appendChild(b);
    });
  }
  var TERMS = mode === "short" ? [5, 7, 10] : [10, 15, 20];
  function buildSegs() {
    seg($("#waySeg"), [{ value: "monthly", label: "월납" }, { value: "lump", label: "일시납" }],
      function () { return S.way; }, function (v) { S.way = v; syncWay(); run(); });
    seg($("#termSeg"), TERMS.map(function (t) { return { value: t, label: t + "년" }; }),
      function () { return S.term; }, function (v) { S.term = v; run(); });
    seg($("#rateSeg"), P.rate.options.map(function (r) {
      return { value: r, label: (r === P.rate.min ? "최저보증 " : "") + r.toFixed(1) + "%" };
    }), function () { return S.rate; }, function (v) { S.rate = v; run(); });
  }
  function syncWay() {
    var r = $("#prem");
    if (S.way === "lump") { $("#premL").textContent = "일시납 금액"; r.min = 5000; r.max = 250000; r.step = 5000; if (S.prem < 5000) S.prem = 70000; }
    else { $("#premL").textContent = "월 납입액"; r.min = 10; r.max = 300; r.step = 5; if (S.prem > 300) S.prem = 100; }
    r.value = S.prem;
  }

  $("#age").addEventListener("input", function () { S.age = +this.value; run(); });
  $("#prem").addEventListener("input", function () { S.prem = +this.value; run(); });
  $("#goal").addEventListener("input", function () { S.goal = +this.value; run(); });

  /* ── 실행 ─────────────────────────────────────────────────── */
  function fundAt(y, monthly, lumpAmt) {
    return S.way === "lump" ? CALC.lump(P, lumpAmt, y, S.rate)
                            : CALC.fundAt(P, monthly, S.term, y, S.rate);
  }
  function paidAt(y, monthly, lumpAmt) {
    return S.way === "lump" ? lumpAmt : CALC.paidBy(monthly, S.term, y);
  }

  function run() {
    buildSegs();
    UI.paintRange($("#age")); UI.paintRange($("#prem")); UI.paintRange($("#goal"));
    $("#ageOut").textContent = S.age + "세";
    $("#premOut").innerHTML = UI.n(S.prem) + "만원 <span class='hint'>≈ $" + UI.n(monthlyUsd()) + "</span>";
    $("#goalOut").innerHTML = "$" + UI.n(S.goal) + " <span class='hint'>≈ " + UI.krw(S.goal * fx()) + "</span>";

    if (mode === "short") short(); else long();

    /* 비과세 한도 */
    var krwAmt = mode === "short" ? solveKrw() : S.prem * 10000;
    var chk = UI.taxCheck(S.way === "lump" ? "lump" : "monthly", krwAmt);
    var bar = $("#limitBar"); bar.className = "limitbar" + (chk.over ? " is-over" : ""); bar.innerHTML = chk.html;

    $("#assumeTxt").innerHTML = "<b>계산 가정:</b> 달러 공시이율 연 " + S.rate.toFixed(1) +
      "%(복리) · 사업비는 경과 연차별 차감으로 단순화 · 적용환율 " + UI.n(fx()) + "원" +
      (P.refund ? " · 환급률은 제공된 가입설계서 표 기준" : " · 환급률은 <b>예시 모델</b>로 추정(실제 가입설계서 표로 교체 예정)") +
      " · 기준일 " + CONFIG.asOf + ".";
    $("#simPick").innerHTML = "상담 신청 시 <b>" + summary() + "</b> 조건이 함께 전달됩니다.";
  }

  function solveUsd() {
    return S.way === "lump" ? CALC.solveLump(P, S.term, S.goal, S.rate)
                            : CALC.solveMonthly(P, S.term, S.term, S.goal, S.rate);
  }
  function solveKrw() { return solveUsd() * FX0; }

  /* 단기 목표 역산 */
  function short() {
    var need = solveUsd();
    $("#hK").innerHTML = S.term + "년 뒤 <b>$" + UI.n(S.goal) + "</b>을 만들려면 " + (S.way === "lump" ? "지금" : "매달");
    UI.count($("#hV"), need, U);
    $("#hKrw").textContent = "오늘 환율로 " + UI.krw(need * fx());
    var paid = S.way === "lump" ? need : need * 12 * S.term;
    $("#hS").innerHTML = S.way === "lump"
      ? "한 번에 넣고 " + S.term + "년 두면 됩니다."
      : S.term + "년 동안 총 <b>$" + UI.n(paid) + "</b>을 넣게 됩니다.";

    var g = $("#miniGrid"); g.className = "mini mini--3"; g.innerHTML = "";
    mini(g, S.way === "lump" ? "넣은 돈" : "총 납입액", U(paid), UI.krw(paid * FX0));
    mini(g, "내가 넣지 않은 돈", U(Math.max(0, S.goal - paid)), "이자로 붙는 부분");
    mini(g, "환급률", UI.pct(S.goal / paid * 100), "낸 돈 대비");

    table(need, need);
    chart(need, need, S.term);
    $("#mainNote").innerHTML = "<b>기간을 바꿔보세요.</b> 같은 $" + UI.n(S.goal) +
      "이라도 짧게 낼수록 총 납입액이 커지고, 길게 둘수록 이자가 더 일합니다. " +
      "비과세는 <b>유지 " + TAX.holdYears + "년</b>을 채워야 하므로, " + (S.term < TAX.holdYears
        ? "지금 고르신 " + S.term + "년은 요건에 <b>미달</b>합니다. 찾는 시점을 " + TAX.holdYears + "년 이후로 두시면 이자에 세금이 붙지 않습니다."
        : "지금 조건은 요건을 충족합니다.");
  }

  /* 길게 불리기 */
  function long() {
    var monthly = monthlyUsd(), lumpAmt = lumpUsd();
    var f = fundAt(S.term, monthly, lumpAmt), paid = paidAt(S.term, monthly, lumpAmt);
    $("#hK").textContent = S.term + "년 뒤 (만 " + (S.age + S.term) + "세) 손에 쥐는 달러";
    UI.count($("#hV"), f, U);
    $("#hKrw").textContent = "오늘 환율로 " + UI.krw(f * fx());
    $("#hS").innerHTML = (S.way === "lump" ? "한 번에 " : "매달 ") + UI.n(S.prem) +
      "만원씩 넣었을 때입니다. 낸 돈 대비 <b>" + UI.pct(f / paid * 100) + "</b>.";

    var g = $("#miniGrid"); g.className = "mini mini--4"; g.innerHTML = "";
    mini(g, S.way === "lump" ? "넣은 돈" : "총 납입액", U(paid), UI.krw(paid * FX0));
    mini(g, "불어난 부분", U(f - paid), K(f - paid));
    mini(g, "환급률", UI.pct(f / paid * 100), "낸 돈 대비");
    mini(g, "매달 이자만 받으면", U(CALC.interestOnly(f, S.rate)), "원금은 그대로 두고");

    table(monthly, lumpAmt);
    chart(monthly, lumpAmt, S.term);

    var be = null;
    for (var y = 1; y <= 40; y++) if (fundAt(y, monthly, lumpAmt) >= paidAt(y, monthly, lumpAmt)) { be = y; break; }
    $("#mainNote").innerHTML = (be
      ? "<b>낸 돈을 넘어서는 시점은 " + be + "년차입니다.</b> 그 전에 해지하면 낸 돈보다 적게 돌려받습니다. 초기 해지 손실이 이 상품의 가장 큰 위험입니다."
      : "<b>가정한 이율에서는 40년 안에 낸 돈을 넘어서지 못합니다.</b> 조건을 다시 보셔야 합니다.") +
      " 여기에 <b>환율</b>이 더해집니다 — 위 슬라이더로 오르내릴 때를 꼭 함께 보세요.";
  }

  function mini(g, k, v, s) {
    var d = document.createElement("div"); d.className = "mini__it";
    d.innerHTML = "<p class='mini__k'>" + k + "</p><p class='mini__v num'>" + v + "</p><p class='mini__krw'>" + s + "</p>";
    g.appendChild(d);
  }

  function table(monthly, lumpAmt) {
    var tb = $("#mainTbl"); tb.innerHTML = "";
    var pts = mode === "short" ? [Math.round(S.term / 2), S.term, TAX.holdYears, S.term + 10]
                               : [5, 10, TAX.holdYears, S.term, S.term + 10];
    pts.filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; }).sort(function (a, b) { return a - b; })
      .forEach(function (y) {
        var f = fundAt(y, monthly, lumpAmt), p = paidAt(y, monthly, lumpAmt);
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + y + "년 뒤 (만 " + (S.age + y) + "세)" +
          (y === TAX.holdYears ? " <span class='tag'>비과세 요건</span>" : "") + "</td>" +
          "<td>" + U(p) + "</td><td class='hi'>" + U(f) + "</td><td>" + K(f) + "</td>" +
          "<td class='" + (f >= p ? "up" : "") + "'>" + UI.pct(f / p * 100) + "</td>";
        tb.appendChild(tr);
      });
  }

  function chart(monthly, lumpAmt, term) {
    var horizon = Math.max(term + 10, TAX.holdYears + 5), f = [], p = [];
    for (var y = 0; y <= horizon; y++) {
      f.push({ x: y, y: y ? fundAt(y, monthly, lumpAmt) : (S.way === "lump" ? lumpAmt : 0) });
      p.push({ x: y, y: paidAt(y, monthly, lumpAmt) });
    }
    UI.draw($("#chMain"), {
      series: [{ pts: f, cls: "l-gold", area: true }, { pts: p, cls: "l-dash" }],
      marks: [{ x: TAX.holdYears, label: "비과세 " + TAX.holdYears + "년" }],
      yFmt: yFmt
    });
  }

  function summary() {
    return (mode === "short" ? "단기 목표" : "장기 목돈") + " / " + S.age + "세 / " +
      (S.way === "lump" ? "일시납" : "월납") + " " +
      (mode === "short" ? "목표 $" + UI.n(S.goal) : UI.n(S.prem) + "만원") +
      " / " + S.term + "년 / 이율 " + S.rate.toFixed(1) + "% / 환율 " + UI.n(fx());
  }
  UI.setSummary(summary);

  UI.boot();
  syncWay();
  UI.wireFx(run);
})();
