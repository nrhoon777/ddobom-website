/* ===== 지키기 — health(건보료·세금) / legacy(상속·증여) ============== */
(function () {
  "use strict";
  var $ = UI.$;
  var P = BASE;
  var mode = (location.search.match(/m=(\w+)/) || [])[1] === "legacy" ? "legacy" : "health";
  var S = { age: mode === "legacy" ? 60 : 58, amt: 50000, inc: 1500, year: TAX.holdYears, rate: P.rate.current };

  var COPY = {
    health: { eyebrow: "지키기 · 건보료와 세금", title: "이자는 그대로,<br /><em>소득으로는 안 잡히게.</em>",
              lead: "금융소득이 연 1천만원을 넘으면 그 전액이 건강보험료 산정 소득에 들어갑니다. 비과세 요건을 채운 보험차익은 애초에 금융소득으로 잡히지 않습니다." },
    legacy: { eyebrow: "지키기 · 물려주기", title: "달러로 굴리다가,<br /><em>달러로 남깁니다.</em>",
              lead: "필요한 시점까지 불리다가 남기면 현금으로 바로 쓸 수 있는 재원이 됩니다. 부동산과 달리 쪼개기도, 나누기도 쉽습니다." }
  }[mode];
  $("#pgEyebrow").textContent = COPY.eyebrow;
  $("#pgTitle").innerHTML = COPY.title;
  $("#pgLead").textContent = COPY.lead;
  document.title = (mode === "health" ? "건보료·세금에서 빼기" : "달러로 물려주기") + " | 달러 플랜";

  if (mode === "legacy") { $("#incWrap").hidden = true; $("#healthOnly").hidden = true; $("#thLast").textContent = "넣은 돈의 몇 배"; }

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
  var YEARS = mode === "legacy" ? [10, 15, 20, 30] : [5, 10, 15, 20];
  function buildSegs() {
    seg($("#yearSeg"), YEARS.map(function (y) {
      return { value: y, label: y + "년" + (y === TAX.holdYears ? " <span class='hint'>비과세</span>" : "") };
    }), function () { return S.year; }, function (v) { S.year = v; run(); });
    seg($("#rateSeg"), P.rate.options.map(function (r) {
      return { value: r, label: (r === P.rate.min ? "최저보증 " : "") + r.toFixed(1) + "%" };
    }), function () { return S.rate; }, function (v) { S.rate = v; run(); });
  }

  ["age", "amt", "inc"].forEach(function (id) {
    $("#" + id).addEventListener("input", function () { S[id] = +this.value; run(); });
  });

  function mini(g, k, v, s) {
    var d = document.createElement("div"); d.className = "mini__it";
    d.innerHTML = "<p class='mini__k'>" + k + "</p><p class='mini__v num'>" + v + "</p><p class='mini__krw'>" + s + "</p>";
    g.appendChild(d);
  }

  function run() {
    buildSegs();
    ["age", "amt", "inc"].forEach(function (id) { UI.paintRange($("#" + id)); });
    $("#ageOut").textContent = S.age + "세";
    $("#amtOut").innerHTML = "$" + UI.n(S.amt) + " <span class='hint'>≈ " + UI.krw(S.amt * fx()) + "</span>";
    $("#incOut").textContent = UI.n(S.inc) + "만원";

    if (mode === "health") health(); else legacy();
    table(); chart();

    var chk = UI.taxCheck("lump", S.amt * fx());
    var bar = $("#limitBar"); bar.className = "limitbar" + (chk.over ? " is-over" : ""); bar.innerHTML = chk.html;

    $("#assumeTxt").innerHTML = "<b>계산 가정:</b> 달러 공시이율 연 " + S.rate.toFixed(1) +
      "%(복리) · 적용환율 " + UI.n(fx()) + "원 · '그대로 뒀을 때'는 예금 금리 " + P.bankRate.toFixed(1) +
      "%, 이자소득세 " + P.interestTax + "% 가정 · 건보료 기준선은 금융소득 " +
      UI.krw(P.hbLine.report) + "(산정 포함) / " + UI.krw(P.hbLine.depend) + "(피부양자 탈락) · 기준일 " + CONFIG.asOf + ".";
    $("#simPick").innerHTML = "상담 신청 시 <b>" + summary() + "</b> 조건이 함께 전달됩니다.";
  }

  /* ── 건보료·세금 ─────────────────────────────────────────────── */
  function health() {
    var incKrw = S.inc * 10000;                                  // 지금 금융소득(원)
    var fromThis = S.amt * fx() * (P.bankRate / 100);            // 이 돈이 예금에 있을 때 만들어내는 금융소득
    var after = Math.max(0, incKrw - fromThis);                  // 옮긴 뒤 금융소득
    var tax = fromThis * (P.interestTax / 100);                  // 여기 붙던 이자소득세

    $("#hK").textContent = "옮기고 나면 내 금융소득은";
    UI.count($("#hV"), after, function (v) { return UI.krw(v); });
    $("#hKrw").textContent = "지금 " + UI.krw(incKrw) + " → " + UI.krw(after);

    var crossed = incKrw > P.hbLine.depend && after <= P.hbLine.depend;
    var crossed1 = incKrw > P.hbLine.report && after <= P.hbLine.report;
    $("#hS").innerHTML = crossed
      ? "<b>피부양자 탈락 기준선(" + UI.krw(P.hbLine.depend) + ") 아래로 내려옵니다.</b>"
      : crossed1
        ? "<b>건보료 산정 포함 기준선(" + UI.krw(P.hbLine.report) + ") 아래로 내려옵니다.</b>"
        : (after > P.hbLine.report
            ? "아직 " + UI.krw(P.hbLine.report) + " 위입니다. 옮기는 금액을 늘리면 기준선 아래로 내려갑니다."
            : "이미 기준선 아래입니다. 앞으로 이자가 불어나도 이 자리에서는 소득으로 잡히지 않습니다.");

    var max = Math.max(incKrw, P.hbLine.depend * 1.1, 1);
    $("#barA").style.width = (incKrw / max * 100) + "%"; $("#barA").textContent = UI.krw(incKrw);
    $("#barB").style.width = (after / max * 100) + "%";  $("#barB").textContent = UI.krw(after);
    $("#gapNote").innerHTML = "이 돈을 옮기면 여기서 나오던 금융소득 <b>" + UI.krw(fromThis) +
      "</b>이 빠집니다. 이자소득세 <b>" + UI.krw(tax) + "</b>도 함께 사라집니다. " +
      "다만 <b>비과세 요건(유지 " + TAX.holdYears + "년 등)을 채웠을 때</b>의 이야기입니다.";

    /* 기준선 아래로 내리려면 얼마를 옮겨야 하는가 — 역산 */
    var target = incKrw > P.hbLine.depend ? P.hbLine.depend : P.hbLine.report;
    var needKrw = Math.max(0, (incKrw - target) / (P.bankRate / 100));
    var needUsd = needKrw / fx();

    var g = $("#miniGrid"); g.className = "mini mini--4"; g.innerHTML = "";
    mini(g, "옮기는 금액", U(S.amt), UI.krw(S.amt * fx()));
    mini(g, "빠지는 금융소득", UI.krw(fromThis), "연간");
    mini(g, "안 내게 되는 이자소득세", UI.krw(tax), "연간 · " + P.interestTax + "%");
    if (needKrw > 0)
      mini(g, UI.krw(target) + " 아래로 가려면", U(needUsd),
        needKrw > TAX.lumpLimit
          ? UI.krw(needKrw) + " — 일시납 한도 초과라 <b>종신형 연금</b>으로 나눠야 합니다"
          : UI.krw(needKrw) + " 옮기면 됩니다");
    else
      mini(g, S.year + "년 뒤 적립금", U(CALC.lump(P, S.amt, S.year, S.rate)), K(CALC.lump(P, S.amt, S.year, S.rate)));

    $("#mainNote").innerHTML = "<b>건강보험료 금액 자체는 여기서 계산하지 않았습니다.</b> " +
      "실제 건보료는 소득뿐 아니라 재산·자동차·가구 구성까지 합쳐 산정되고, 직장가입자와 지역가입자의 방식도 달라 " +
      "개인별로 확인해야 정확합니다. 이 화면은 <b>금융소득에서 얼마가 빠지는지</b>까지만 보여드립니다. " +
      "실제 영향은 상담에서 함께 계산해 드리겠습니다.";
  }

  /* ── 물려주기 ────────────────────────────────────────────────── */
  function legacy() {
    var f = CALC.lump(P, S.amt, S.year, S.rate);
    $("#hK").textContent = S.year + "년 뒤 (만 " + (S.age + S.year) + "세) 남길 수 있는 돈";
    UI.count($("#hV"), f, U);
    $("#hKrw").textContent = "오늘 환율로 " + UI.krw(f * fx());
    $("#hS").innerHTML = "지금 <b>" + U(S.amt) + "</b>을 넣어두면, 불어난 <b>" + U(f - S.amt) +
      "</b>까지 함께 남습니다. 요건을 채우면 이 불어난 부분에 소득세가 붙지 않습니다.";

    var g = $("#miniGrid"); g.className = "mini mini--4"; g.innerHTML = "";
    mini(g, "지금 넣는 돈", U(S.amt), UI.krw(S.amt * fx()));
    mini(g, "불어난 부분", U(f - S.amt), K(f - S.amt));
    mini(g, "배수", (f / S.amt).toFixed(2) + "배", S.year + "년 기준");
    mini(g, "매달 이자만 받으면", U(CALC.interestOnly(f, S.rate)), "원금은 남기고");

    $("#mainNote").innerHTML = "<b>상속세·증여세가 면제되는 것은 아닙니다.</b> " +
      "보험차익에 붙는 <b>소득세</b>가 비과세라는 뜻이고, 상속·증여 자체에 대한 세금은 별도로 계산됩니다. " +
      "다만 <b>계약자·피보험자·수익자를 어떻게 두느냐</b>에 따라 결과가 크게 달라집니다. " +
      "미리 설계하면 나중에 바꾸는 것보다 유리한 경우가 많아, 이 부분은 꼭 상담에서 함께 짚어보시길 권합니다.";
  }

  function table() {
    var tb = $("#mainTbl"); tb.innerHTML = "";
    YEARS.forEach(function (y) {
      var f = CALC.lump(P, S.amt, y, S.rate), gain = f - S.amt;
      var free = y >= TAX.holdYears;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + y + "년 뒤 (만 " + (S.age + y) + "세)" +
        (y === S.year ? " <span class='tag'>선택</span>" : "") + "</td>" +
        "<td class='hi'>" + U(f) + "</td><td>" + K(f) + "</td><td class='up'>+" + U(gain) + "</td>" +
        (mode === "legacy"
          ? "<td class='hi'>" + (f / S.amt).toFixed(2) + "배</td>"
          : "<td class='" + (free ? "up" : "") + "'>" + (free ? "0원 (비과세)" : UI.krw(gain * fx() * P.interestTax / 100) + " 과세") + "</td>");
      tb.appendChild(tr);
    });
  }

  function chart() {
    var horizon = Math.max.apply(null, YEARS), f = [], p = [];
    for (var y = 0; y <= horizon; y++) {
      f.push({ x: y, y: CALC.lump(P, S.amt, y, S.rate) });
      p.push({ x: y, y: S.amt });
    }
    UI.draw($("#chMain"), {
      series: [{ pts: f, cls: "l-gold", area: true }, { pts: p, cls: "l-dash" }],
      marks: [{ x: TAX.holdYears, label: "비과세 " + TAX.holdYears + "년" }], yFmt: yFmt
    });
  }

  function summary() {
    return (mode === "health" ? "건보료·세금" : "상속·증여") + " / " + S.age + "세 / $" + UI.n(S.amt) +
      (mode === "health" ? " / 현재 금융소득 " + UI.n(S.inc) + "만원" : "") +
      " / " + S.year + "년 / 이율 " + S.rate.toFixed(1) + "% / 환율 " + UI.n(fx());
  }
  UI.setSummary(summary);

  UI.boot();
  UI.wireFx(run);
})();
