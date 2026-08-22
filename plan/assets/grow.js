/* ===== 불리기 — short(짧게 넣고 10년 뒤) / long(목돈을 길게) ========= */
(function () {
  "use strict";
  var $ = UI.$;
  var mode = (location.search.match(/m=(\w+)/) || [])[1] === "long" ? "long" : "short";
  var P = mode === "long" ? PRODUCTS.lumpAnnuity : PRODUCTS.shortWhole;
  var FX0 = CONFIG.fx.now;
  var S = { age: 40, amt: mode === "long" ? 69000 : 500, plan: "20", type: "plus", year: mode === "long" ? 20 : 10 };

  var COPY = {
    short: { eyebrow: "불리기 · 짧게 넣고 10년 뒤", title: "7년만 넣고,<br />10년 뒤에 <em>찾습니다.</em>",
             lead: "짧게 내고 오래 두는 구조입니다. 내는 동안 암 진단을 받으면 남은 보험료는 면제되고, 그래도 환급률은 그대로 갑니다." },
    long:  { eyebrow: "불리기 · 목돈을 길게", title: "가입 시점 이율로<br /><em>10년·20년을 확정</em>합니다.",
             lead: "지금 있는 목돈을 넣으면 가입 시점의 공시이율로 만기까지 확정 운영됩니다. 이후 시장 금리가 내려가도 그대로 갑니다." }
  }[mode];
  $("#pgEyebrow").textContent = COPY.eyebrow;
  $("#pgTitle").innerHTML = COPY.title;
  $("#pgLead").textContent = COPY.lead;
  document.title = (mode === "long" ? "목돈을 길게 묻어두기" : "짧게 넣고 10년 뒤") + " | 달러 플랜";

  function U(v) { return "$" + UI.n(v); }
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

  /* ── 현재 조건이 만들어내는 수치 ─────────────────────────────── */
  function plan() { return P.plans ? P.plans[S.plan] : null; }
  function rate()  { return plan() ? plan().rate : P.rate; }
  function payTerm() { return P.base.payTerm; }
  function paid()  { return mode === "long" ? S.amt : S.amt * 12 * payTerm(); }

  function pctAt(y) {
    if (mode === "long") {
      var pl = plan(), fin = pl.defer[S.type];
      if (y === pl.years) return { pct: fin, est: false };
      return { pct: CALC.deferAt(fin, pl.rate, pl.years, y), est: true };
    }
    return CALC.refund(P.refund[payTerm()], P.rate, y);
  }
  function fundAt(y) { return paid() * pctAt(y).pct / 100; }

  /* ── 실행 ─────────────────────────────────────────────────── */
  function run() {
    buildSegs();
    UI.paintRange($("#age")); UI.paintRange($("#prem"));
    $("#ageOut").textContent = S.age + "세";
    $("#premOut").innerHTML = mode === "long"
      ? "$" + UI.n(S.amt) + " <span class='hint'>≈ " + UI.krw(S.amt * FX0) + "</span>"
      : "$" + UI.n(S.amt) + " <span class='hint'>월 ≈ " + UI.krw(S.amt * FX0) + "</span>";

    var r = pctAt(S.year), f = fundAt(S.year), p = paid();
    $("#hK").innerHTML = mode === "long"
      ? plan().years + "년 뒤 (만 " + (S.age + plan().years) + "세) 확정 환급금"
      : "10년 + 1일차에 찾으면";
    UI.count($("#hV"), f, U);
    $("#hKrw").textContent = "오늘 환율로 " + UI.krw(f * fx());
    $("#hS").innerHTML = "낸 돈 <b>" + U(p) + "</b> 대비 <b>" + UI.pct(r.pct) + "</b>" +
      (r.est ? " <span class='bene__chk'>추정</span>" : " <span class='tag'>자료값</span>");

    var g = $("#miniGrid"); g.className = "mini mini--4"; g.innerHTML = "";
    mini(g, mode === "long" ? "넣는 돈" : "총 납입액", U(p), UI.krw(p * FX0) +
      (mode === "short" ? " · 월 " + U(S.amt) + " × " + payTerm() + "년" : ""));
    mini(g, "불어난 부분", U(f - p), K(f - p));
    mini(g, "적용 이율", rate().toFixed(2) + "%", mode === "long" ? plan().years + "년 확정" : "공시이율");
    if (mode === "long" && S.type === "plus")
      mini(g, "연금개시 추가 보너스", "+" + plan().bonus + "%", "연금강화형에 한함");
    else if (mode === "short")
      mini(g, "암 진단 시", "납입면제", "환급률 변동 없음");
    else
      mini(g, "매달 이자만 받으면", U(CALC.interestOnly(f, rate())), "원금은 그대로");

    table(); chart(); notes();

    var chk = UI.taxCheck(mode === "long" ? "lump" : "monthly",
      mode === "long" ? S.amt * FX0 : S.amt * FX0);
    var bar = $("#limitBar"); bar.className = "limitbar" + (chk.over ? " is-over" : ""); bar.innerHTML = chk.html;

    $("#simPick").innerHTML = "상담 신청 시 <b>" + summary() + "</b> 조건이 함께 전달됩니다.";
  }

  function buildSegs() {
    if (mode === "long") {
      seg($("#termSeg"), [
        { value: "10", label: "10년 확정 <span class='hint'>" + P.plans["10"].rate.toFixed(2) + "%</span>" },
        { value: "20", label: "20년 확정 <span class='hint'>" + P.plans["20"].rate.toFixed(2) + "%</span>" }
      ], function () { return S.plan; }, function (v) { S.plan = v; S.year = P.plans[v].years; run(); });
      seg($("#rateSeg"), [
        { value: "basic", label: "기본형" },
        { value: "plus",  label: "연금강화형 <span class='hint'>+" + plan().bonus + "% 보너스</span>" }
      ], function () { return S.type; }, function (v) { S.type = v; run(); });
    } else {
      seg($("#termSeg"), [{ value: 7, label: payTerm() + "년납" }], function () { return payTerm(); }, function () {});
      seg($("#rateSeg"), [10, 15, 20, 30].map(function (y) {
        return { value: y, label: y + "년" + (y === 10 ? " <span class='hint'>+1일</span>" : "") };
      }), function () { return S.year; }, function (v) { S.year = v; run(); });
    }
  }

  function mini(g, k, v, s) {
    var d = document.createElement("div"); d.className = "mini__it";
    d.innerHTML = "<p class='mini__k'>" + k + "</p><p class='mini__v num'>" + v + "</p><p class='mini__krw'>" + s + "</p>";
    g.appendChild(d);
  }

  function table() {
    var tb = $("#mainTbl"); tb.innerHTML = "";
    var pts = mode === "long" ? [3, 5, 7, plan().years, plan().years + 5] : [10, 15, 20, 30];
    pts.filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (y) {
      var r = pctAt(y), f = paid() * r.pct / 100;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + y + "년" + (y === 10 && mode === "short" ? " + 1일" : " 뒤") +
        " (만 " + (S.age + y) + "세)" + (y === S.year ? " <span class='tag'>선택</span>" : "") + "</td>" +
        "<td>" + U(paid()) + "</td><td class='hi'>" + U(f) + "</td><td>" + K(f) + "</td>" +
        "<td class='" + (r.pct >= 100 ? "up" : "") + "'>" + UI.pct(r.pct) +
        (r.est ? " <span class='hint'>추정</span>" : "") + "</td>";
      tb.appendChild(tr);
    });
  }

  function chart() {
    var horizon = mode === "long" ? plan().years + 5 : 30, f = [], p = [];
    for (var y = 0; y <= horizon; y++) {
      f.push({ x: y, y: y ? paid() * pctAt(y).pct / 100 : (mode === "long" ? paid() : 0) });
      p.push({ x: y, y: mode === "long" ? paid() : S.amt * 12 * Math.min(y, payTerm()) });
    }
    UI.draw($("#chMain"), {
      series: [{ pts: f, cls: "l-gold", area: true }, { pts: p, cls: "l-dash" }],
      marks: [{ x: TAX.holdYears, label: "비과세 " + TAX.holdYears + "년" }], yFmt: yFmt
    });
  }

  function notes() {
    var base = "<b>" + CALC.label(P) + "</b> · " + P.baseNote + " 기준 (공시이율 " + CONFIG.asOfSrc + ").";
    var ageWarn = S.age !== P.base.age
      ? " <b class='warnt'>표기 수치는 만 " + P.base.age + "세 " + P.base.sex + "자 기준입니다. 나이·성별이 다르면 실제 값이 달라지니 설계서로 확인하세요.</b>"
      : "";
    var extra = mode === "long"
      ? " 만기 시점 환급률은 <b>자료의 확정값</b>이고, 중간 연차는 확정 공시이율로 그린 <b>추정</b>입니다. " + P.bonusNote
      : " 10년+1일과 20년 시점은 <b>자료의 값</b>이고, 그 사이와 이후는 공시이율로 연장한 <b>추정</b>입니다. " +
        "20년 시점 162.8%는 장기유지 보너스를 반영한 값입니다.";
    $("#mainNote").innerHTML = base + extra + ageWarn;

    $("#assumeTxt").innerHTML = "<b>계산 근거:</b> " + P.baseNote + " / 적용 이율 " + rate().toFixed(2) + "% · " +
      "금액은 기준 계약에 <b>비례 환산</b>했습니다 · 적용환율 " + UI.n(fx()) + "원 · 기준일 " + CONFIG.asOf + ". " +
      "실제 보험료·환급금은 나이·성별·심사 결과에 따라 달라집니다.";
  }

  function summary() {
    return (mode === "long"
      ? CALC.label(P) + " " + plan().years + "년 확정 " + (S.type === "plus" ? "연금강화형" : "기본형") + " / 일시납 $" + UI.n(S.amt)
      : CALC.label(P) + " " + payTerm() + "년납 / 월 $" + UI.n(S.amt) + " / " + S.year + "년 시점") +
      " / " + S.age + "세 / 환율 " + UI.n(fx());
  }
  UI.setSummary(summary);

  /* 입력 */
  var pr = $("#prem");
  if (mode === "long") { pr.min = P.minAmount; pr.max = P.maxAmount; pr.step = P.step; $("#premL").textContent = "일시납 금액"; }
  else { pr.min = P.minMonthly; pr.max = P.maxMonthly; pr.step = P.step; $("#premL").textContent = "월 보험료"; }
  pr.value = S.amt;
  $("#age").addEventListener("input", function () { S.age = +this.value; run(); });
  pr.addEventListener("input", function () { S.amt = +this.value; run(); });
  $("#waySeg").closest("div").hidden = true;
  $("#goalWrap").hidden = true; $("#premWrap").hidden = false;
  $("#termL").textContent = mode === "long" ? "확정 기간" : "납입 기간";
  $("#rateL").innerHTML = mode === "long" ? "형태" : "언제 찾을까요";

  UI.boot();
  UI.wireFx(run);
})();
