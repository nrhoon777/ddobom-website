/* ===== ③ 적금 대신 복리 ============================================== */
(function () {
  "use strict";
  var $ = UI.$;
  var P = PRODUCTS.compound;
  var S = { prem: P.premDefault, term: P.payTerms[P.payTerms.length - 1], rate: P.rate.current, bank: P.bank.rate, when: 10 };
  var WHENS = [5, 10, 15, 20];

  function yFmt(v) {
    if (v >= 100000000) return (v / 100000000).toFixed(1) + "억";
    if (v >= 10000) return Math.round(v / 10000).toLocaleString("ko-KR") + "만";
    return Math.round(v);
  }

  /* 적금: 납입기간까지는 정액적립식(단리), 만기 후에는 세후 이율로 재예치 */
  function bankAt(monthly, year) {
    var t = Math.min(year, S.term);
    var r = CALC.bankSavings(monthly, t, S.bank, P.bank.tax);
    if (year <= S.term) return r.net;
    var after = S.bank / 100 * (1 - P.bank.tax / 100);
    return r.net * Math.pow(1 + after, year - S.term);
  }

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
    seg($("#whenSeg"), WHENS.filter(function (y) { return y >= S.term; })
      .map(function (y) { return { value: y, label: y + "년 뒤" }; }),
      function () { return S.when; }, function (v) { S.when = v; run(); });
  }

  $("#prem").addEventListener("input", function () { S.prem = +this.value; run(); });
  $("#bank").addEventListener("input", function () { S.bank = +this.value; run(); });
  $("#prem").min = P.premRange[0]; $("#prem").max = P.premRange[1];

  UI.setSummary(function () {
    return "복리 저축 / 월 " + S.prem + "만원 / " + S.term + "년납 / " + S.when +
      "년 뒤 확인 / 상품이율 " + S.rate.toFixed(1) + "% vs 적금 " + S.bank.toFixed(1) + "%";
  });

  function run() {
    buildSegs();
    UI.paintRange($("#prem")); UI.paintRange($("#bank"));
    if (S.when < S.term) S.when = S.term;
    $("#premOut").textContent = UI.n(S.prem) + "만원";
    $("#bankOut").textContent = S.bank.toFixed(1) + "%";

    var monthly = S.prem * 10000;
    var paid = CALC.totalPaid(monthly, S.term);
    var b = CALC.bankSavings(monthly, S.term, S.bank, P.bank.tax);
    var bankV = bankAt(monthly, S.when);
    var ours = CALC.fundAt(P, monthly, S.term, S.when, S.rate);
    var gap = ours - bankV;

    $("#gapK").textContent = S.when + "년 뒤, 두 쪽의 차이는";
    UI.count($("#gapV"), Math.abs(gap), function (v) { return (gap < 0 ? "-" : "+") + UI.krw(v); });
    $("#gapS").innerHTML = gap >= 0
      ? "같은 돈을 같은 기간 넣었는데 <b>" + UI.krw(gap) + "</b>이 더 남습니다."
      : "지금 조건에서는 <b>적금이 더 낫습니다.</b> 적금 금리를 낮추거나 기간을 늘려 다시 보세요.";

    var max = Math.max(bankV, ours);
    $("#bankBar").style.width = (bankV / max * 100) + "%"; $("#bankBar").textContent = UI.krw(bankV);
    $("#oursBar").style.width = (ours / max * 100) + "%"; $("#oursBar").textContent = UI.krw(ours);
    $("#bankK").textContent = "세후 · 금리 " + S.bank.toFixed(1) + "%";
    $("#gapNote").innerHTML = gap >= 0
      ? "차이를 만든 것은 두 가지입니다. <b>복리로 굴러간 " + (S.rate - S.bank).toFixed(1) +
        "%p</b>, 그리고 <b>적금에서 떼인 이자소득세 " + P.bank.tax + "%</b>." +
        " 비과세 요건을 못 채우면 이 차이는 줄어듭니다."
      : "이 조건에서는 적금이 유리합니다. <b>짧게 넣고 금방 찾을 돈이라면 적금이 맞습니다.</b>";

    $("#mPaid").textContent = UI.krw(paid);
    $("#mPaidS").textContent = "월 " + UI.krw(monthly) + " × " + S.term + "년";
    $("#mInt").textContent = UI.krw(b.interest);
    $("#mIntS").textContent = "만기까지 붙는 이자";
    $("#mTax").textContent = "-" + UI.krw(b.tax);
    $("#mTaxS").textContent = "이자소득세 " + P.bank.tax + "%";
    $("#mPct").textContent = UI.pct(ours / paid * 100);

    var horizon = Math.max(S.when, S.term + 5), pts1 = [], pts2 = [], pts3 = [];
    for (var y = 0; y <= horizon; y++) {
      pts1.push({ x: y, y: y ? CALC.fundAt(P, monthly, S.term, y, S.rate) : 0 });
      pts2.push({ x: y, y: y ? bankAt(monthly, y) : 0 });
      pts3.push({ x: y, y: CALC.paidBy(monthly, S.term, y) });
    }
    UI.draw($("#chCmp"), {
      series: [{ pts: pts1, cls: "l-gold", area: true }, { pts: pts2, cls: "l-sky" }, { pts: pts3, cls: "l-dash" }],
      marks: [{ x: S.term, label: "완납 " + S.term + "년" }],
      yFmt: yFmt
    });

    var tb = $("#cmpTbl"); tb.innerHTML = "";
    WHENS.filter(function (y) { return y >= S.term; }).forEach(function (y) {
      var bb = bankAt(monthly, y), oo = CALC.fundAt(P, monthly, S.term, y, S.rate), g = oo - bb;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + y + "년 뒤" + (y === S.when ? " <span class='tag'>선택</span>" : "") + "</td>" +
        "<td>" + UI.krw(bb) + "</td><td class='hi'>" + UI.krw(oo) + "</td>" +
        "<td class='" + (g >= 0 ? "up" : "") + "'>" + (g >= 0 ? "+" : "-") + UI.krw(Math.abs(g)) + "</td>" +
        "<td>" + UI.pct(oo / CALC.paidBy(monthly, S.term, y) * 100) + "</td>";
      tb.appendChild(tr);
    });

    var be = null;
    for (var k = 1; k <= 40; k++) if (CALC.fundAt(P, monthly, S.term, k, S.rate) >= CALC.paidBy(monthly, S.term, k)) { be = k; break; }
    $("#fairNote").innerHTML =
      "<b>공정하게 말씀드리면.</b> 적금은 언제 깨도 원금이 남지만, 이 상품은 초기에 해지하면 <b>낸 돈보다 적게</b> 돌려받습니다" +
      (be ? " (낸 돈을 넘어서는 시점은 <b>" + be + "년차</b>)" : "") +
      ". 그래서 <b>2~3년 안에 쓸 돈은 적금</b>, <b>10년 이상 묻어둘 돈은 이쪽</b>으로 나누는 게 맞습니다. " +
      "비과세도 요건을 채웠을 때만 적용됩니다.";

    $("#assumeTxt").innerHTML = "<b>계산 가정:</b> 적금은 정액적립식 단리에 이자소득세 " + P.bank.tax +
      "% 차감(만기 후에는 세후 이율로 재예치 가정) · 이 상품은 적립이율 연 " + S.rate.toFixed(1) +
      "% 복리, 사업비는 경과 연차별 차감으로 단순화, 비과세 요건 충족 가정" +
      (P.refund ? " · 환급률은 제공된 가입설계서 표 기준" : " · 환급률은 <b>예시 모델</b>로 추정(실제 가입설계서 표로 교체 예정)") + ".";
    $("#simPick").innerHTML = "상담 신청 시 <b>월 " + S.prem + "만원 · " + S.term + "년납 · " + S.when +
      "년 뒤 · 이율 " + S.rate.toFixed(1) + "%</b> 조건이 함께 전달됩니다.";
  }

  UI.boot();
  run();
})();
