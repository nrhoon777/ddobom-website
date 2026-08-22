/* ===== 지키기 — health(건보료·세금) / legacy(상속종신) =============== */
(function () {
  "use strict";
  var $ = UI.$;
  var mode = (location.search.match(/m=(\w+)/) || [])[1] === "legacy" ? "legacy" : "health";
  var P = mode === "legacy" ? PRODUCTS.legacy : PRODUCTS.lumpAnnuity;
  var FX0 = CONFIG.fx.now;
  var HB = { report: 10000000, depend: 20000000 };   // 건보료 산정 포함 / 피부양자 탈락 기준(원)
  var BANK = 3.0, ITAX = 15.4;                        // 비교용 예금 금리 / 이자소득세율(%)
  var S = { age: 40, amt: mode === "legacy" ? 32778 : 69000, inc: 1500, year: mode === "legacy" ? 20 : 10, sc: "same" };

  var COPY = {
    health: { eyebrow: "지키기 · 건보료와 세금", title: "이자는 그대로,<br /><em>소득으로는 안 잡히게.</em>",
              lead: "금융소득이 연 1천만원을 넘으면 그 전액이 건강보험료 산정 소득에 들어갑니다. 비과세 요건을 채운 보험차익은 애초에 금융소득으로 잡히지 않습니다." },
    legacy: { eyebrow: "지키기 · 물려주기", title: "낸 돈의 <em>6배</em>를<br />달러로 남깁니다.",
              lead: "일시납 한 번으로 사망보험금이 확정됩니다. 40세에 넣으면 가입 후 20년간 낸 돈의 약 6.1배가 확정되고, 20년 시점 해약환급률도 금리와 무관하게 확정입니다." }
  }[mode];
  $("#pgEyebrow").textContent = COPY.eyebrow;
  $("#pgTitle").innerHTML = COPY.title;
  $("#pgLead").textContent = COPY.lead;
  document.title = (mode === "health" ? "건보료·세금에서 빼기" : "달러로 물려주기") + " | 달러 플랜";

  if (mode === "legacy") { $("#incWrap").hidden = true; $("#healthOnly").hidden = true; $("#thLast").textContent = "사망보험금"; }

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
  var YEARS = mode === "legacy" ? [1, 3, 7, 10, 20] : [5, 10, 15, 20];

  function buildSegs() {
    seg($("#yearSeg"), YEARS.map(function (y) {
      return { value: y, label: y + "년" + (y === TAX.holdYears && mode === "health" ? " <span class='hint'>비과세</span>" : "") };
    }), function () { return S.year; }, function (v) { S.year = v; run(); });

    if (mode === "legacy") {
      seg($("#rateSeg"), ["up", "same", "down"].map(function (k) {
        return { value: k, label: P.mva[k].label + " <span class='hint'>" + P.mva[k].rate.toFixed(2) + "%</span>" };
      }), function () { return S.sc; }, function (v) { S.sc = v; run(); });
    } else {
      seg($("#rateSeg"), ["10", "20"].map(function (k) {
        return { value: k, label: k + "년 확정 <span class='hint'>" + P.plans[k].rate.toFixed(2) + "%</span>" };
      }), function () { return String(S.year); }, function (v) { S.year = +v; run(); });
    }
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
    $("#amtOut").innerHTML = "$" + UI.n(S.amt) + " <span class='hint'>≈ " + UI.krw(S.amt * FX0) + "</span>";
    $("#incOut").textContent = UI.n(S.inc) + "만원";

    if (mode === "health") health(); else legacy();

    var chk = UI.taxCheck("lump", S.amt * FX0);
    var bar = $("#limitBar"); bar.className = "limitbar" + (chk.over ? " is-over" : ""); bar.innerHTML = chk.html;
    $("#simPick").innerHTML = "상담 신청 시 <b>" + summary() + "</b> 조건이 함께 전달됩니다.";
  }

  /* ── 건보료·세금 ─────────────────────────────────────────────── */
  function pctHealth(y) {
    var pl = P.plans[String(S.year)] || P.plans["10"];
    if (y === pl.years) return { pct: pl.defer.plus, est: false };
    return { pct: CALC.deferAt(pl.defer.plus, pl.rate, pl.years, y), est: true };
  }

  function health() {
    var incKrw = S.inc * 10000;
    var fromThis = S.amt * FX0 * (BANK / 100);
    var after = Math.max(0, incKrw - fromThis);
    var tax = fromThis * (ITAX / 100);

    $("#hK").textContent = "옮기고 나면 내 금융소득은";
    UI.count($("#hV"), after, function (v) { return UI.krw(v); });
    $("#hKrw").textContent = "지금 " + UI.krw(incKrw) + " → " + UI.krw(after);

    var crossed2 = incKrw > HB.depend && after <= HB.depend;
    var crossed1 = incKrw > HB.report && after <= HB.report;
    $("#hS").innerHTML = crossed2
      ? "<b>피부양자 탈락 기준선(" + UI.krw(HB.depend) + ") 아래로 내려옵니다.</b>"
      : crossed1 ? "<b>건보료 산정 포함 기준선(" + UI.krw(HB.report) + ") 아래로 내려옵니다.</b>"
      : (after > HB.report ? "아직 " + UI.krw(HB.report) + " 위입니다. 옮기는 금액을 늘리면 기준선 아래로 내려갑니다."
                           : "이미 기준선 아래입니다. 앞으로 이자가 불어나도 이 자리에서는 소득으로 잡히지 않습니다.");

    var max = Math.max(incKrw, HB.depend * 1.1, 1);
    $("#barA").style.width = (incKrw / max * 100) + "%"; $("#barA").textContent = UI.krw(incKrw);
    $("#barB").style.width = (after / max * 100) + "%";  $("#barB").textContent = UI.krw(after);
    $("#gapNote").innerHTML = "이 돈을 옮기면 여기서 나오던 금융소득 <b>" + UI.krw(fromThis) +
      "</b>이 빠집니다. 이자소득세 <b>" + UI.krw(tax) + "</b>도 함께 사라집니다. " +
      "<b>비과세 요건(유지 " + TAX.holdYears + "년 등)을 채웠을 때</b>의 이야기입니다.";

    var target = incKrw > HB.depend ? HB.depend : HB.report;
    var needKrw = Math.max(0, (incKrw - target) / (BANK / 100));
    var pl = P.plans[String(S.year)] || P.plans["10"];
    var f = S.amt * pl.defer.plus / 100;

    var g = $("#miniGrid"); g.className = "mini mini--4"; g.innerHTML = "";
    mini(g, "옮기는 금액", U(S.amt), UI.krw(S.amt * FX0));
    mini(g, "빠지는 금융소득", UI.krw(fromThis), "연간");
    mini(g, "안 내게 되는 이자소득세", UI.krw(tax), "연간 · " + ITAX + "%");
    if (needKrw > 0)
      mini(g, UI.krw(target) + " 아래로 가려면", U(needKrw / FX0),
        needKrw > TAX.lumpLimit ? UI.krw(needKrw) + " — 일시납 한도 초과라 <b>종신형 연금</b>으로 나눠야 합니다"
                                : UI.krw(needKrw) + " 옮기면 됩니다");
    else
      mini(g, pl.years + "년 뒤 환급금", U(f), "환급률 " + UI.pct(pl.defer.plus, 0));

    tableHealth(pl); chartHealth(pl);
    $("#mainNote").innerHTML = "<b>건강보험료 금액 자체는 여기서 계산하지 않았습니다.</b> " +
      "실제 건보료는 소득뿐 아니라 재산·자동차·가구 구성까지 합쳐 산정되고, 직장가입자와 지역가입자의 방식도 달라 " +
      "개인별로 확인해야 정확합니다. 이 화면은 <b>금융소득에서 얼마가 빠지는지</b>까지만 보여드립니다.";
    $("#assumeTxt").innerHTML = "<b>계산 근거:</b> " + CALC.label(P) + " · " + P.baseNote +
      " / " + pl.years + "년 확정 연금강화형 " + pl.defer.plus + "% · 금액은 기준 계약에 <b>비례 환산</b> · " +
      "'그대로 뒀을 때'는 예금 금리 " + BANK.toFixed(1) + "%, 이자소득세 " + ITAX + "% 가정 · " +
      "건보료 기준선은 금융소득 " + UI.krw(HB.report) + "(산정 포함) / " + UI.krw(HB.depend) + "(피부양자 탈락) · " +
      "공시이율 기준 " + CONFIG.asOfSrc + " · 적용환율 " + UI.n(fx()) + "원." + ageWarn();
  }

  function tableHealth(pl) {
    var tb = $("#mainTbl"); tb.innerHTML = "";
    [3, 5, 7, pl.years].filter(function (v, i, a) { return v <= pl.years && a.indexOf(v) === i; }).forEach(function (y) {
      var r = pctHealth(y), f = S.amt * r.pct / 100, gain = f - S.amt;
      var free = y >= TAX.holdYears;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + y + "년 뒤 (만 " + (S.age + y) + "세)" +
        (y === pl.years ? " <span class='tag'>만기</span>" : "") + "</td>" +
        "<td class='hi'>" + U(f) + (r.est ? " <span class='hint'>추정</span>" : "") + "</td>" +
        "<td>" + K(f) + "</td><td class='up'>+" + U(gain) + "</td>" +
        "<td class='" + (free ? "up" : "") + "'>" +
        (free ? "0원 (비과세)" : UI.krw(gain * fx() * ITAX / 100) + " 과세") + "</td>";
      tb.appendChild(tr);
    });
  }
  function chartHealth(pl) {
    var f = [], p = [];
    for (var y = 0; y <= pl.years; y++) { f.push({ x: y, y: S.amt * pctHealth(y).pct / 100 }); p.push({ x: y, y: S.amt }); }
    UI.draw($("#chMain"), {
      series: [{ pts: f, cls: "l-gold", area: true }, { pts: p, cls: "l-dash" }],
      marks: [{ x: TAX.holdYears, label: "비과세 " + TAX.holdYears + "년" }], yFmt: yFmt
    });
  }

  /* ── 물려주기 (상속종신) ──────────────────────────────────────── */
  function legacy() {
    var mult = CALC.multipleAt(P.multiple, S.age);
    var death = S.amt * mult;
    var sc = P.mva[S.sc];
    var r = CALC.tblAt(sc.t, S.year);
    var f = r != null ? S.amt * r / 100 : null;

    $("#hK").textContent = "지금 넣으면 확정되는 사망보험금";
    UI.count($("#hV"), death, U);
    $("#hKrw").textContent = "오늘 환율로 " + UI.krw(death * fx());
    $("#hS").innerHTML = "일시납 <b>" + U(S.amt) + "</b> 한 번으로 <b>" + mult.toFixed(1) +
      "배</b>가 됩니다 (가입 후 20년 확정)." +
      (S.age !== 40 ? " 만 " + Math.round(S.age) + "세 기준으로 환산한 배수입니다." : "");

    var g = $("#miniGrid"); g.className = "mini mini--4"; g.innerHTML = "";
    mini(g, "일시납 보험료", U(S.amt), UI.krw(S.amt * FX0));
    mini(g, "사망배수", mult.toFixed(1) + "배", "가입 후 20년 확정");
    mini(g, "20년 시점 환급률", UI.pct(P.mva.same.t[20], 0), "금리와 무관하게 확정");
    mini(g, S.year + "년 시점 환급금", f != null ? U(f) : "—", f != null ? "환급률 " + UI.pct(r, 0) : "자료 없음");

    var tb = $("#mainTbl"); tb.innerHTML = "";
    YEARS.forEach(function (y) {
      var rr = CALC.tblAt(sc.t, y), ff = rr != null ? S.amt * rr / 100 : 0;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + y + "년 뒤 (만 " + (S.age + y) + "세)" +
        (y === S.year ? " <span class='tag'>선택</span>" : "") + "</td>" +
        "<td class='hi'>" + U(ff) + "</td><td>" + K(ff) + "</td>" +
        "<td class='" + (rr >= 100 ? "up" : "") + "'>" + UI.pct(rr, 0) + "</td>" +
        "<td>" + U(death) + "</td>";
      tb.appendChild(tr);
    });

    var pts = [], dl = [];
    YEARS.forEach(function (y) { pts.push({ x: y, y: S.amt * CALC.tblAt(sc.t, y) / 100 }); });
    pts.unshift({ x: 0, y: S.amt });
    [0, 20].forEach(function (y) { dl.push({ x: y, y: S.amt }); });
    UI.draw($("#chMain"), {
      series: [{ pts: pts, cls: "l-gold", area: true }, { pts: dl, cls: "l-dash" }],
      marks: [{ x: 20, label: "20년 확정", anchor: "end" }], yFmt: yFmt
    });

    $("#mainNote").innerHTML = "<b>" + CALC.label(P) + "</b> · " + P.baseNote + " 기준. " + P.mvaNote +
      " 위 버튼으로 금리가 오를 때·내릴 때를 함께 보세요 — <b>초기에 해약하면 낸 돈보다 적게 돌려받습니다.</b> " +
      "<b>상속세·증여세가 면제되는 것은 아닙니다.</b> 계약자·피보험자·수익자를 어떻게 두느냐에 따라 결과가 크게 달라지니 이 부분은 꼭 상담에서 함께 짚어보세요." + ageWarn();
    $("#assumeTxt").innerHTML = "<b>계산 근거:</b> " + P.baseNote + " · 사망배수 40세 6.1배 / 50세 4.5배 / 60세 3.0배 " +
      "(그 사이 나이는 보간) · MVA 환급률은 " + sc.label + "(" + sc.rate.toFixed(2) + "%) 시나리오 · " +
      "금액은 기준 계약에 <b>비례 환산</b> · 공시이율 기준 " + CONFIG.asOfSrc + " · 적용환율 " + UI.n(fx()) + "원.";
  }

  function ageWarn() {
    return S.age !== P.base.age
      ? " <b class='warnt'>표기 수치는 만 " + P.base.age + "세 " + P.base.sex +
        "자 기준입니다. 나이·성별이 다르면 실제 값이 달라지니 설계서로 확인하세요.</b>" : "";
  }

  function summary() {
    return (mode === "health"
      ? "건보료·세금 / " + CALC.label(P) + " / $" + UI.n(S.amt) + " / 현재 금융소득 " + UI.n(S.inc) + "만원 / " + S.year + "년"
      : "상속·증여 / " + CALC.label(P) + " / 일시납 $" + UI.n(S.amt) + " / " + S.year + "년 / " + P.mva[S.sc].label) +
      " / " + S.age + "세 / 환율 " + UI.n(fx());
  }
  UI.setSummary(summary);

  var am = $("#amt");
  am.min = mode === "legacy" ? P.minPremium : P.minAmount;
  am.max = mode === "legacy" ? P.maxPremium : P.maxAmount;
  am.step = P.step; am.value = S.amt;
  $("#amtL").textContent = mode === "legacy" ? "일시납 보험료" : "옮길 금액";
  $("#yearL").textContent = "몇 년 뒤를 볼까요";
  $("#rateL").innerHTML = mode === "legacy" ? "해약 시점 금리가 이렇게 되면 <span class='hint'>(MVA)</span>" : "확정 기간";

  UI.boot();
  UI.wireFx(run);
})();
