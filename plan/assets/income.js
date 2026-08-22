/* ===== 매달 받기 — now(지금부터 생활자금형) / later(60세부터) ======== */
(function () {
  "use strict";
  var $ = UI.$;
  var mode = (location.search.match(/m=(\w+)/) || [])[1] === "later" ? "later" : "now";
  var P = mode === "now" ? PRODUCTS.lumpAnnuity : PRODUCTS.monthlyAnnuity;
  var FX0 = CONFIG.fx.now;
  var S = { age: 40, amt: mode === "now" ? 69000 : 1000, plan: "20", type: "basic", draw: 0, drawY: 5 };

  var COPY = {
    now:   { eyebrow: "매달 받기 · 지금부터", title: "가입하고 나면<br /><em>매달 생활비</em>가 들어옵니다.",
             lead: "이자로 매월 받고, 만기에 원금은 그대로 돌려받습니다. 연금강화형을 고르면 매월 금액은 조금 줄지만 만기 환급률이 100%를 넘습니다." },
    later: { eyebrow: "매달 받기 · 60세부터", title: "5년만 넣고,<br /><em>60세부터</em> 받습니다.",
             lead: "짧게 넣고 길게 묻어둔 뒤 연금으로 개시합니다. 10년 시점 환급률이 이미 낸 돈을 크게 넘어섭니다." }
  }[mode];
  $("#pgEyebrow").textContent = COPY.eyebrow;
  $("#pgTitle").innerHTML = COPY.title;
  $("#pgLead").textContent = COPY.lead;
  document.title = (mode === "now" ? "지금부터 매달 받기" : "60세부터 매달 받기") + " | 달러 플랜";

  function U(v) { return "$" + UI.n(v); }
  function U2(v) { return "$" + v.toFixed(2); }
  function K(v) { return UI.krw(UI.toKrw(v)); }
  function fx() { return UI.getFx(); }
  function yFmt(v) { return v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v); }

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

  function plan() { return P.plans ? P.plans[S.plan] : null; }
  function ratio() { return mode === "now" ? S.amt / P.base.amount : S.amt / P.base.monthly; }
  function paid()  { return mode === "now" ? S.amt : S.amt * 12 * P.base.payTerm; }

  function run() {
    buildSegs();
    UI.paintRange($("#age")); UI.paintRange($("#prem"));
    UI.paintRange($("#wd")); UI.paintRange($("#wdY"));
    $("#ageOut").textContent = S.age + "세";
    $("#premOut").innerHTML = "$" + UI.n(S.amt) + " <span class='hint'>" +
      (mode === "now" ? "≈ " : "월 ≈ ") + UI.krw(S.amt * FX0) + "</span>";

    if (mode === "now") now(); else later();

    var chk = UI.taxCheck(mode === "now" ? "lump" : "monthly", S.amt * FX0);
    var bar = $("#limitBar"); bar.className = "limitbar" + (chk.over ? " is-over" : ""); bar.innerHTML = chk.html;
    $("#simPick").innerHTML = "상담 신청 시 <b>" + summary() + "</b> 조건이 함께 전달됩니다.";
  }

  function buildSegs() {
    if (mode === "now") {
      seg($("#waySeg"), [
        { value: "10", label: "10년형 <span class='hint'>" + P.plans["10"].rate.toFixed(2) + "%</span>" },
        { value: "20", label: "20년형 <span class='hint'>" + P.plans["20"].rate.toFixed(2) + "%</span>" }
      ], function () { return S.plan; }, function (v) { S.plan = v; run(); });
      seg($("#startSeg"), [
        { value: "basic", label: "기본형 <span class='hint'>매월 많이</span>" },
        { value: "plus",  label: "연금강화형 <span class='hint'>만기 많이</span>" }
      ], function () { return S.type; }, function (v) { S.type = v; run(); });
      $("#rateSeg").closest("div").hidden = true;
      $("#drawWrap").hidden = true;
    } else {
      $("#wayWrap").hidden = true; $("#startWrap").hidden = true; $("#drawWrap").hidden = true;
      seg($("#rateSeg"), [{ value: P.rate, label: "공시이율 " + P.rate.toFixed(2) + "%" }],
        function () { return P.rate; }, function () {});
    }
  }

  function mini(g, k, v, s) {
    var d = document.createElement("div"); d.className = "mini__it";
    d.innerHTML = "<p class='mini__k'>" + k + "</p><p class='mini__v num'>" + v + "</p><p class='mini__krw'>" + s + "</p>";
    g.appendChild(d);
  }

  /* ── 지금부터 매달 (생활자금형) ─────────────────────────────── */
  function now() {
    var pl = plan(), lv = pl.living[S.type];
    var mo = lv.mo * ratio();
    var endPct = lv.refund, endFund = S.amt * endPct / 100;
    var total = mo * 12 * pl.years;

    $("#hK").textContent = "가입 후 매달 받는 생활비";
    UI.count($("#hV"), mo, U2);
    $("#hKrw").textContent = "오늘 환율로 " + UI.krw(mo * fx());
    $("#hS").innerHTML = pl.years + "년 동안 매달 받고, " + pl.years + "년차에 <b>" + UI.pct(endPct, 0) +
      "</b>를 돌려받습니다" + (endPct > 100 ? " — <b>원금보다 많습니다.</b>" : " — <b>원금 그대로입니다.</b>");

    var g = $("#miniGrid"); g.className = "mini mini--4"; g.innerHTML = "";
    mini(g, "넣는 돈", U(S.amt), UI.krw(S.amt * FX0));
    mini(g, pl.years + "년간 받는 생활비", U(total), K(total));
    mini(g, pl.years + "년차 환급금", U(endFund), "환급률 " + UI.pct(endPct, 0));
    mini(g, "받은 돈 + 환급금", U(total + endFund), "넣은 돈의 " + ((total + endFund) / S.amt).toFixed(2) + "배");

    /* 생활자금형은 이자를 매월 빼가므로 적립금이 거의 평평하다 */
    var f = [], p = [];
    for (var y = 0; y <= pl.years; y++) {
      f.push({ x: y, y: S.amt + (endFund - S.amt) * (y / pl.years) });
      p.push({ x: y, y: S.amt });
    }
    UI.draw($("#chMain"), {
      series: [{ pts: f, cls: "l-gold", area: true }, { pts: p, cls: "l-dash" }],
      marks: [{ x: 0, label: "바로 개시", anchor: "start" }], yFmt: yFmt
    });

    var tb = $("#mainTbl"); tb.innerHTML = "";
    [1, 5, 10, pl.years].filter(function (v, i, a) { return v <= pl.years && a.indexOf(v) === i; }).forEach(function (y) {
      var cum = mo * 12 * y, fundY = S.amt + (endFund - S.amt) * (y / pl.years);
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + y + "년째 (만 " + (S.age + y) + "세)" +
        (y === pl.years ? " <span class='tag'>만기</span>" : "") + "</td>" +
        "<td>" + U(mo * 12) + "</td><td>" + U(cum) + "</td>" +
        "<td class='hi'>" + U(fundY) + "</td><td>" + K(fundY) + "</td>";
      tb.appendChild(tr);
    });

    var other = pl.living[S.type === "basic" ? "plus" : "basic"];
    $("#mainNote").innerHTML = "<b>" + CALC.label(P) + "</b> · " + P.baseNote + " 기준. " +
      "기준 계약($" + UI.n(P.base.amount) + ")에서 매월 <b>$" + lv.mo + "</b>, " + pl.years + "년차 <b>" + lv.refund + "%</b>이고, " +
      "지금 넣으신 금액에 비례해 환산했습니다. " +
      "다른 쪽(" + (S.type === "basic" ? "연금강화형" : "기본형") + ")은 매월 $" + other.mo +
      " · " + other.refund + "% 입니다 — <b>매달 더 받을지, 만기에 더 받을지</b>의 선택입니다." +
      ageWarn();
    $("#assumeTxt").innerHTML = assume(pl.rate);
  }

  /* ── 60세부터 매달 (월납 연금) ──────────────────────────────── */
  function later() {
    var term = P.base.payTerm, p = paid();
    var r10 = CALC.refund(P.refund[term], P.rate, 10);
    var f10 = p * r10.pct / 100;
    var toStart = Math.max(0, P.base.startAge - S.age);
    var rS = CALC.refund(P.refund[term], P.rate, toStart);
    var fS = p * rS.pct / 100;
    var mo = CALC.interestOnly(fS, P.rate);

    $("#hK").textContent = "만 " + P.base.startAge + "세부터 매달 (이자만 받을 때)";
    UI.count($("#hV"), mo, U2);
    $("#hKrw").textContent = "오늘 환율로 " + UI.krw(mo * fx());
    $("#hS").innerHTML = term + "년만 넣고 " + toStart + "년을 두면 적립금이 <b>" + U(fS) + "</b>. " +
      "이자만 꺼내면 <b>원금은 그대로</b> 남습니다.";

    var g = $("#miniGrid"); g.className = "mini mini--4"; g.innerHTML = "";
    mini(g, "총 납입액", U(p), UI.krw(p * FX0) + " · 월 " + U(S.amt) + " × " + term + "년");
    mini(g, "10년 시점", U(f10), "환급률 " + UI.pct(r10.pct) + (r10.est ? " 추정" : " 자료값"));
    mini(g, P.base.startAge + "세 시점 적립금", U(fS), "환급률 " + UI.pct(rS.pct) + (rS.est ? " 추정" : ""));
    mini(g, "1년에 받는 돈", U(mo * 12), K(mo * 12));

    var horizon = Math.max(toStart + 20, 25), f = [], pp = [];
    for (var y = 0; y <= horizon; y++) {
      var rr = CALC.refund(P.refund[term], P.rate, y);
      var fund = y <= toStart ? p * rr.pct / 100 : fS;
      f.push({ x: y, y: fund });
      pp.push({ x: y, y: S.amt * 12 * Math.min(y, term) });
    }
    UI.draw($("#chMain"), {
      series: [{ pts: f, cls: "l-gold", area: true }, { pts: pp, cls: "l-dash" }],
      marks: [{ x: toStart, label: "연금 개시 " + P.base.startAge + "세" }], yFmt: yFmt
    });

    var tb = $("#mainTbl"); tb.innerHTML = "";
    [10, 15, toStart, toStart + 10].filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; })
      .sort(function (a, b) { return a - b; }).forEach(function (y) {
        var rr = CALC.refund(P.refund[term], P.rate, y);
        var fund = y <= toStart ? p * rr.pct / 100 : fS;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + y + "년 뒤 (만 " + (S.age + y) + "세)" +
          (y === toStart ? " <span class='tag'>연금 개시</span>" : "") + "</td>" +
          "<td>" + (y > toStart ? U(mo * 12) : "<span class='hint'>개시 전</span>") + "</td>" +
          "<td>" + (y > toStart ? U(mo * 12 * (y - toStart)) : "—") + "</td>" +
          "<td class='hi'>" + U(fund) + "</td><td>" + K(fund) + "</td>";
        tb.appendChild(tr);
      });

    $("#mainNote").innerHTML = "<b>" + CALC.label(P) + "</b> · " + P.baseNote + " 기준. " +
      P.refundNote + " 10년 시점만 자료값이고 나머지 구간은 공시이율 " + P.rate.toFixed(2) +
      "%로 연장한 <b>추정</b>입니다." + ageWarn();
    $("#assumeTxt").innerHTML = assume(P.rate);
  }

  function ageWarn() {
    return S.age !== P.base.age
      ? " <b class='warnt'>표기 수치는 만 " + P.base.age + "세 " + P.base.sex +
        "자 기준입니다. 나이·성별이 다르면 실제 값이 달라지니 설계서로 확인하세요.</b>" : "";
  }
  function assume(r) {
    return "<b>계산 근거:</b> " + P.baseNote + " / 적용 이율 " + r.toFixed(2) + "% · " +
      "금액은 기준 계약에 <b>비례 환산</b>했습니다 · 적용환율 " + UI.n(fx()) + "원 · " +
      "공시이율 기준 " + CONFIG.asOfSrc + " (기준일 " + CONFIG.asOf + "). " +
      "실제 보험료·환급금은 나이·성별·심사 결과에 따라 달라집니다.";
  }

  function summary() {
    return mode === "now"
      ? CALC.label(P) + " " + plan().years + "년형 생활자금형 " + (S.type === "plus" ? "연금강화형" : "기본형") +
        " / 일시납 $" + UI.n(S.amt) + " / " + S.age + "세 / 환율 " + UI.n(fx())
      : CALC.label(P) + " " + P.base.payTerm + "년납 / 월 $" + UI.n(S.amt) + " / " +
        P.base.startAge + "세 개시 / " + S.age + "세 / 환율 " + UI.n(fx());
  }
  UI.setSummary(summary);

  var pr = $("#prem");
  if (mode === "now") { pr.min = P.minAmount; pr.max = P.maxAmount; pr.step = P.step; $("#premL").textContent = "넣을 목돈"; }
  else { pr.min = P.minMonthly; pr.max = P.maxMonthly; pr.step = P.step; $("#premL").textContent = "월 보험료"; }
  pr.value = S.amt;
  $("#age").addEventListener("input", function () { S.age = +this.value; run(); });
  pr.addEventListener("input", function () { S.amt = +this.value; run(); });
  $("#wayL").textContent = "확정 기간";
  $("#startL").textContent = "형태";

  UI.boot();
  UI.wireFx(run);
})();
