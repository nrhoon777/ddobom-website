/* ===== 매달 받기 — now(지금부터) / later(15~20년 뒤부터) ============== */
(function () {
  "use strict";
  var $ = UI.$;
  var P = BASE;
  var mode = (location.search.match(/m=(\w+)/) || [])[1] === "later" ? "later" : "now";
  var S = { age: mode === "later" ? 45 : 58, way: "lump", prem: 70000, start: 20, rate: P.rate.current,
            draw: "interest", wd: 0, wdY: 5 };

  var COPY = {
    now:   { eyebrow: "매달 받기 · 지금부터", title: "원금은 그대로 두고,<br />다음 달부터 <em>매달</em>.",
             lead: "목돈을 넣어두면 이자만 매달 달러로 받습니다. 원금은 헐지 않아 그대로 남고, 나중에 통째로 찾거나 물려줄 수 있습니다." },
    later: { eyebrow: "매달 받기 · 15~20년 뒤", title: "일 안 하는 날의 <em>월급</em>을<br />지금부터 만들어둡니다.",
             lead: "지금 쌓아두고 15~20년 뒤부터 매달 받습니다. 받는 동안에도 남은 돈은 계속 굴러가서, 꺼내 쓰는데 원금이 줄지 않는 구간이 생깁니다." }
  }[mode];
  $("#pgEyebrow").textContent = COPY.eyebrow;
  $("#pgTitle").innerHTML = COPY.title;
  $("#pgLead").textContent = COPY.lead;
  document.title = (mode === "now" ? "지금부터 매달 받기" : "15~20년 뒤부터 매달 받기") + " | 달러 플랜";

  if (mode === "now") { $("#startWrap").hidden = true; $("#wayWrap").hidden = true; S.way = "lump"; }
  else { $("#drawWrap").hidden = false; }

  function yFmt(v) { return v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v); }
  function U(v) { return "$" + UI.n(v); }
  function K(v) { return UI.krw(UI.toKrw(v)); }
  function fx() { return UI.getFx(); }

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
  function buildSegs() {
    seg($("#waySeg"), [{ value: "lump", label: "목돈 한 번에" }, { value: "monthly", label: "매달 나눠서" }],
      function () { return S.way; }, function (v) { S.way = v; syncWay(); run(); });
    seg($("#startSeg"), [15, 20].map(function (t) { return { value: t, label: t + "년 뒤 (만 " + (S.age + t) + "세)" }; }),
      function () { return S.start; }, function (v) { S.start = v; run(); });
    seg($("#rateSeg"), P.rate.options.map(function (r) {
      return { value: r, label: (r === P.rate.min ? "최저보증 " : "") + r.toFixed(1) + "%" };
    }), function () { return S.rate; }, function (v) { S.rate = v; run(); });
    seg($("#drawSeg"), [
      { value: "interest", label: "이자만 <span class='hint'>원금 유지</span>" },
      { value: "annuity",  label: "연금으로 <span class='hint'>20년 확정</span>" }
    ], function () { return S.draw; }, function (v) { S.draw = v; run(); });
  }
  function syncWay() {
    var r = $("#prem");
    if (S.way === "lump") { $("#premL").textContent = "넣을 목돈"; r.min = 5000; r.max = 250000; r.step = 5000; if (S.prem < 5000) S.prem = 70000; }
    else { $("#premL").textContent = "월 납입액"; r.min = 10; r.max = 300; r.step = 5; if (S.prem > 300) S.prem = 100; }
    r.value = S.prem;
  }

  ["age", "prem", "wd", "wdY"].forEach(function (id) {
    $("#" + id).addEventListener("input", function () {
      S[id === "age" ? "age" : id] = +this.value; run();
    });
  });

  /* 넣은 금액 → 달러 */
  var FX0 = CONFIG.fx.now;
  function inUsd() { return S.way === "lump" ? S.prem : S.prem * 10000 / FX0; }

  function run() {
    buildSegs();
    ["age", "prem", "wd", "wdY"].forEach(function (id) { UI.paintRange($("#" + id)); });
    $("#ageOut").textContent = S.age + "세";
    $("#premOut").innerHTML = S.way === "lump"
      ? "$" + UI.n(S.prem) + " <span class='hint'>≈ " + UI.krw(S.prem * FX0) + "</span>"
      : UI.n(S.prem) + "만원 <span class='hint'>≈ $" + UI.n(inUsd()) + "</span>";

    if (mode === "now") now(); else later();

    var krwAmt = S.way === "lump" ? S.prem * FX0 : S.prem * 10000;
    var chk = UI.taxCheck(S.way === "lump" ? "lump" : "monthly", krwAmt);
    var bar = $("#limitBar"); bar.className = "limitbar" + (chk.over ? " is-over" : ""); bar.innerHTML = chk.html;

    $("#assumeTxt").innerHTML = "<b>계산 가정:</b> 달러 공시이율 연 " + S.rate.toFixed(1) +
      "%(복리) · 사업비는 경과 연차별 차감으로 단순화 · 적용환율 " + UI.n(fx()) + "원" +
      " · 연금은 " + (P.annuity.months / 12) + "년 확정 지급 기준" +
      (P.refund ? " · 환급률은 제공된 가입설계서 표 기준" : " · 환급률은 <b>예시 모델</b>로 추정(실제 가입설계서 표로 교체 예정)") +
      " · 기준일 " + CONFIG.asOf + ".";
    $("#simPick").innerHTML = "상담 신청 시 <b>" + summary() + "</b> 조건이 함께 전달됩니다.";
  }

  function mini(g, k, v, s) {
    var d = document.createElement("div"); d.className = "mini__it";
    d.innerHTML = "<p class='mini__k'>" + k + "</p><p class='mini__v num'>" + v + "</p><p class='mini__krw'>" + s + "</p>";
    g.appendChild(d);
  }

  /* ── 지금부터 매달 (즉시 이자 수령 · 원금 유지) ─────────────── */
  function now() {
    var principal = CALC.lump(P, inUsd(), 0, S.rate);   // 초기 사업비 차감분 반영
    var mo = CALC.interestOnly(principal, P.payout.rate);
    $("#hK").textContent = "다음 달부터 매달 받는 돈";
    UI.count($("#hV"), mo, U);
    $("#hKrw").textContent = "오늘 환율로 " + UI.krw(mo * fx());
    $("#hS").innerHTML = "원금 <b>$" + UI.n(principal) + "</b>은 그대로 남습니다. 이자만 꺼내 쓰는 구조라 <b>줄지 않습니다.</b>";

    var g = $("#miniGrid"); g.className = "mini mini--4"; g.innerHTML = "";
    mini(g, "넣은 돈", U(inUsd()), UI.krw(inUsd() * FX0));
    mini(g, "1년에 받는 돈", U(mo * 12), K(mo * 12));
    mini(g, "10년간 받는 돈", U(mo * 120), K(mo * 120));
    mini(g, "그러고도 남는 원금", U(principal), K(principal));

    var rows = [], f = [], p = [];
    for (var y = 0; y <= 20; y++) {
      f.push({ x: y, y: principal }); p.push({ x: y, y: inUsd() });
      rows.push({ y: y, draw: y ? mo * 12 : 0, cum: mo * 12 * y, fund: principal });
    }
    UI.draw($("#chMain"), {
      series: [{ pts: f, cls: "l-gold", area: true }, { pts: p, cls: "l-dash" }],
      marks: [{ x: 0, label: "바로 개시", anchor: "start" }], yFmt: yFmt
    });
    table(rows);
    flexSim(principal);
    $("#mainNote").innerHTML = "<b>원금이 줄지 않는 이유.</b> 붙는 이자만큼만 꺼내기 때문입니다. " +
      "이율이 <b>" + P.rate.min.toFixed(1) + "%</b>까지 내려가면 받는 금액도 그만큼 줄어드니, 위 이율 버튼으로 최저보증 기준도 꼭 확인해 보세요. " +
      "그리고 <b>환율</b>이 내려가면 달러 금액은 같아도 원화로 바꿀 때 줄어듭니다.";
  }

  /* ── 15~20년 뒤부터 매달 ─────────────────────────────────────── */
  function later() {
    var amt = inUsd();
    var fundAt = function (y) {
      return S.way === "lump" ? CALC.lump(P, amt, y, S.rate) : CALC.fundAt(P, amt, S.start, y, S.rate);
    };
    var paidAt = function (y) {
      return S.way === "lump" ? amt : CALC.paidBy(amt, S.start, y);
    };
    var startFund = fundAt(S.start), paid = paidAt(S.start);
    var mo = S.draw === "annuity" ? CALC.annuity(startFund, S.rate, P.annuity.months)
                                  : CALC.interestOnly(startFund, P.payout.rate);

    $("#hK").textContent = "만 " + (S.age + S.start) + "세부터 매달 받는 돈";
    UI.count($("#hV"), mo, U);
    $("#hKrw").textContent = "오늘 환율로 " + UI.krw(mo * fx());
    $("#hS").innerHTML = S.draw === "annuity"
      ? (P.annuity.months / 12) + "년 확정 지급 기준. 총 <b>$" + UI.n(mo * P.annuity.months) + "</b>을 나눠 받습니다."
      : "이자만 받는 방식이라 <b>원금 $" + UI.n(startFund) + "은 그대로</b> 남습니다.";

    var g = $("#miniGrid"); g.className = "mini mini--4"; g.innerHTML = "";
    mini(g, S.way === "lump" ? "넣은 돈" : "총 납입액", U(paid), UI.krw(paid * FX0));
    mini(g, "개시 시점 적립금", U(startFund), "환급률 " + UI.pct(startFund / paid * 100));
    mini(g, "1년에 받는 돈", U(mo * 12), K(mo * 12));
    mini(g, "20년간 받는 돈", U(mo * 240), K(mo * 240));

    /* 수령 중 적립금 추이 */
    var horizon = S.start + 20, f = [], p = [], rows = [], fund = startFund, cum = 0;
    for (var y = 0; y <= horizon; y++) {
      if (y <= S.start) { fund = fundAt(y); }
      else {
        var d = mo * 12;
        // 연금형은 원금을 헐어 나가고, 이자형은 붙은 이자 안에서만 꺼내므로 원금이 유지된다
        if (S.draw === "annuity") fund = Math.max(0, fund - d) * (1 + S.rate / 100);
        else fund = Math.max(0, fund * (1 + S.rate / 100) - d);
        cum += d;
      }
      f.push({ x: y, y: fund }); p.push({ x: y, y: paidAt(y) });
      rows.push({ y: y, draw: y > S.start ? mo * 12 : 0, cum: cum, fund: fund });
    }
    UI.draw($("#chMain"), {
      series: [{ pts: f, cls: "l-gold", area: true }, { pts: p, cls: "l-dash" }],
      marks: [{ x: S.start, label: "수령 개시 " + (S.age + S.start) + "세" }], yFmt: yFmt
    });
    table(rows.filter(function (r) { return r.y >= S.start; }));
    flexSim(startFund);

    var last = rows[rows.length - 1];
    var grew = last.fund >= startFund;
    $("#mainNote").innerHTML = grew
      ? "<b>20년을 받고도 원금이 줄지 않았습니다.</b> 남은 적립금에 붙는 이자가 매년 꺼내는 금액보다 크기 때문입니다. " +
        "이율이 <b>" + P.rate.min.toFixed(1) + "%</b>로 내려가면 이 구조는 성립하지 않으니, 위 이율 버튼으로 꼭 함께 확인해 보세요."
      : "<b>지금 조건에서는 받는 동안 원금이 줄어듭니다.</b> 남은 " + U(last.fund) + "이 20년 뒤 잔액입니다. " +
        "'이자만' 방식으로 바꾸거나 개시 시점을 늦추면 원금이 유지됩니다.";
  }

  function table(rows) {
    var tb = $("#mainTbl"); tb.innerHTML = "";
    var base = rows[0].y;
    [0, 5, 10, 15, 20].forEach(function (k) {
      var r = rows[k]; if (!r) return;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + (k === 0 ? "개시 시점" : "개시 " + k + "년째") + " (만 " + (S.age + base + k) + "세)</td>" +
        "<td>" + U(r.draw) + "</td><td>" + U(r.cum) + "</td>" +
        "<td class='hi'>" + U(r.fund) + "</td><td>" + K(r.fund) + "</td>";
      tb.appendChild(tr);
    });
  }

  /* 중도인출 시뮬 */
  function flexSim(startFund) {
    var maxWd = Math.round(startFund * P.withdraw.maxPct / 100 / 1000) * 1000;
    var el = $("#wd"); el.max = Math.max(1000, maxWd);
    if (S.wd > el.max) { S.wd = +el.max; el.value = S.wd; }
    $("#wdOut").innerHTML = S.wd ? "$" + UI.n(S.wd) + " <span class='hint'>≈ " + UI.krw(S.wd * fx()) + "</span>" : "빼지 않음";
    $("#wdYOut").textContent = S.wdY + "년 뒤";
    if (!S.wd) {
      $("#wdNote").innerHTML = "슬라이더를 움직이면 <b>해지하지 않고</b> 빼 썼을 때 이후가 어떻게 달라지는지 보여드립니다. " +
        "인출 한도는 해지환급금의 <b>" + P.withdraw.maxPct + "%</b>까지입니다.";
      return;
    }
    var a = CALC.flex(P, startFund, S.rate, [], 20);
    var b = CALC.flex(P, startFund, S.rate, [{ y: S.wdY, amount: -S.wd }], 20);
    var gap = a[20].fund - b[20].fund;
    $("#wdNote").innerHTML = "<b>$" + UI.n(S.wd) + "</b>을 " + S.wdY + "년 뒤에 빼 쓰면, 20년 뒤 적립금은 " +
      "<b>$" + UI.n(b[20].fund) + "</b>이 됩니다 (빼지 않았을 때보다 $" + UI.n(gap) + " 적음). " +
      "해지가 아니라 <b>계약은 그대로 유지</b>되고, 나중에 다시 채워 넣을 수도 있습니다.";
  }

  function summary() {
    return (mode === "now" ? "지금부터 월지급" : S.start + "년 뒤부터 월지급") + " / " + S.age + "세 / " +
      (S.way === "lump" ? "일시납 $" + UI.n(S.prem) : "월납 " + UI.n(S.prem) + "만원") +
      (mode === "later" ? " / " + (S.draw === "annuity" ? "연금형" : "이자만") : "") +
      " / 이율 " + S.rate.toFixed(1) + "% / 환율 " + UI.n(fx());
  }
  UI.setSummary(summary);

  UI.boot();
  syncWay();
  UI.wireFx(run);
})();
