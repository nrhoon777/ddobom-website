/* =====================================================================
   달러로 짓는 우물 — 계산 + 인터랙션 + 링크 공유
   모든 수치는 가입설계 자료(만 44세 · 월 $348 · 20년납 · 공시이율 4.75%)를
   월납입액에 비례 환산한 값입니다. 자료에 있는 시점은 그대로, 없는 구간만 계산.
===================================================================== */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var P = PRODUCTS[0];                       // 선택된 상품 (심사 유형)
  var S = { pid: P.id, sex: "M", age: 40, term: 20, annAge: 75,
            prem: 350, add: 0, rate: P.rate, drawPct: 45, fork: "ann", ann: "life10" };
  var FX = CONFIG.fx.now;
  var lastHash = location.hash;
  var END = 100;
  function TERMv() { return S.term; }
  function pickProduct(id) {
    var f = PRODUCTS.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    var wasLump = P.kind === "lump";
    P = f; S.pid = f.id;
    S.rate = P.rate;
    if ((P.kind === "lump") !== wasLump) {          // 월납 ↔ 일시납 전환 시 금액 단위가 다르다
      var pr = $("#prem");
      if (P.kind === "lump") { pr.min = P.premRange[0]; pr.max = P.premRange[1]; pr.step = P.premStep; S.prem = P.premDefault; }
      else { pr.min = 100; pr.max = 1500; pr.step = 10; S.prem = 350; }
      pr.value = S.prem;
    }
  }

  /* ── 포맷 ─────────────────────────────────────────────────── */
  function n(v) { return Math.round(v).toLocaleString("ko-KR"); }
  function U(v) { return "$" + n(v); }
  function U2(v) { return "$" + v.toFixed(2); }
  function krw(v) {
    v = Math.round(v * FX); var sg = v < 0 ? "-" : ""; v = Math.abs(v);
    if (v >= 1e8) { var e = Math.floor(v / 1e8), m = Math.round((v % 1e8) / 1e4);
      return sg + e + "억" + (m ? " " + n(m) + "만" : "") + "원"; }
    if (v >= 1e4) return sg + n(v / 1e4) + "만원";
    return sg + n(v) + "원";
  }
  function pct(v, d) { var p = Math.pow(10, d == null ? 1 : d); return (Math.round(v * p) / p).toLocaleString("ko-KR") + "%"; }
  function label() { return CONFIG.showBrand ? P.name : P.generic; }

  /* ── 실측 표 기반 계산 ─────────────────────────────────────────
     환급률은 납입기간이 결정하고, 나이·성별은 보험료율(=받는 가입금액)에 작용한다.
     10건의 실제 가입설계에서 뽑은 표를 그대로 쓴다.                    */
  function premRate() {                      // 가입금액 $1,000당 월 보험료
    var c = (PREM_RATE[S.term] || PREM_RATE[20])[S.sex];
    return Math.max(0.5, c.v + c.slope * (S.age - c.at));
  }
  function premRateEst() { return !!(PREM_RATE[S.term] && PREM_RATE[S.term][S.sex] || {}).est; }
  function face() {
    if (isLump()) return S.prem * interp(P.mult[S.sex] || P.mult.M, S.age);   // 일시납 × 사망배수
    return S.prem / premRate() * 1000;
  }

  function interp(tbl, k) {                  // {키: 값} 표 보간 (밖은 양끝 값)
    var ks = Object.keys(tbl).filter(function (x) { return !isNaN(+x); })
               .map(Number).sort(function (a, b) { return a - b; });
    if (k <= ks[0]) return tbl[ks[0]];
    if (k >= ks[ks.length - 1]) return tbl[ks[ks.length - 1]];
    for (var i = 1; i < ks.length; i++) if (k <= ks[i]) {
      var lo = ks[i - 1], hi = ks[i];
      return tbl[lo] + (tbl[hi] - tbl[lo]) * ((k - lo) / (hi - lo));
    }
    return tbl[ks[0]];
  }

  function isLump() { return P.kind === "lump"; }
  function paidAt(y) {
    if (isLump()) return S.prem;                       // 일시납은 처음 한 번이 전부
    var base = S.prem * 12 * Math.min(y, S.term);
    return base + (S.add ? ADD_PLAN.monthly * 12 * Math.min(y, ADD_PLAN.years) : 0);
  }
  function refundAt(y) {
    var tbl = isLump() ? (P.refundBySex[S.sex] || P.refundBySex.M)
                       : (REFUND_BY_TERM[S.term] || REFUND_BY_TERM[20]);
    var ks = Object.keys(tbl).filter(function (k) { return !isNaN(+k); })
                .map(Number).sort(function (a, b) { return a - b; });
    var v = y < ks[0] ? tbl[ks[0]] * (y / ks[0]) : interp(tbl, y);
    if (S.add && !isLump()) v *= interp(ADD_PLAN.mult, y);
    return { v: v, est: ks.indexOf(y) < 0 };
  }
  function fundAt(y) { return paidAt(y) * refundAt(y).v / 100; }

  /* 사망보험금 = 가입금액 · 적립액×103% · 이미 낸 보험료 중 큰 금액 (약관) */
  function deathAt(y) { return Math.max(face(), fundAt(y) * 1.03, paidAt(y)); }

  function startAge() { return S.age + (isLump() ? 10 : S.term); }   // 일시납은 10년 지나야 연금 전환
  function startFund() { return fundAt(isLump() ? 10 : S.term); }
  function safeDraw() { return startFund() * (S.rate / 100) / 12; }

  /* 연금 — 전환일시금(그 시점 해약환급금) × 개시 나이별 지급률 */
  function annYears() { return Math.max(S.term, S.annAge - S.age); }
  function annLump() { return fundAt(annYears()); }
  function annRateAt(age) {
    var tbl = ANNUITY_RATE[S.sex] || ANNUITY_RATE.F;
    var ks = Object.keys(tbl).map(Number).sort(function (x, y) { return x - y; });
    var lo = ks[0], hi = ks[ks.length - 1];
    var slope = (tbl[hi] - tbl[lo]) / (hi - lo);
    if (age < lo) return { v: Math.max(1, tbl[lo] + slope * (age - lo)), est: true };
    if (age > hi) return { v: tbl[hi] + slope * (age - hi), est: true };
    return { v: interp(tbl, age), est: false };   // 실측 범위 안은 보간이라 그대로 쓴다
  }
  function annRate() { return annRateAt(S.annAge).v; }
  function annMonthly() { return annLump() * (annRate() / 100) / 12; }

  /* 인출 시뮬레이션 — 개시 시점부터 매년 draw*12 를 빼고 나머지는 굴린다 */
  function sim(monthlyDraw) {
    var e = S.rate / 100, rows = [], f = startFund(), cum = 0, dry = null;
    rows.push({ age: startAge(), draw: 0, cum: 0, fund: f });
    for (var a = startAge() + 1; a <= END; a++) {
      var d = monthlyDraw * 12;
      f = f * (1 + e) - d;
      if (f <= 0) { d += f; f = 0; if (!dry) dry = a; }
      cum += Math.max(0, d);
      rows.push({ age: a, draw: Math.max(0, d), cum: cum, fund: f });
    }
    return { rows: rows, dry: dry };
  }

  /* ── 유틸 ─────────────────────────────────────────────────── */
  function paintRange(el) { el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min)) * 100 + "%"); }
  function seg(host, items, get, setter) {
    host.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button"; b.innerHTML = it.label;
      b.className = get() === it.value ? "on" : "";
      b.setAttribute("aria-pressed", get() === it.value ? "true" : "false");
      b.addEventListener("click", function () { setter(it.value); });
      host.appendChild(b);
    });
  }
  function stat(host, k, v, s) {
    var d = document.createElement("div"); d.className = "stat";
    d.innerHTML = "<p class='stat__k'>" + k + "</p><p class='stat__v mono'>" + v + "</p><p class='stat__s'>" + (s || "") + "</p>";
    host.appendChild(d);
  }
  var ns = "http://www.w3.org/2000/svg";
  function svgEl(svg, t, a, tx) {
    var e = document.createElementNS(ns, t);
    for (var k in a) e.setAttribute(k, a[k]);
    if (tx != null) e.textContent = tx; svg.appendChild(e); return e;
  }

  /* ── 적립금 그래프 ────────────────────────────────────────── */
  function chart(rows, dry) {
    var svg = $("#chart");
    $$("path,line,text,circle", svg).forEach(function (x) { x.remove(); });
    var W = 640, H = 220, PD = { t: 22, r: 16, b: 32, l: 58 };
    var iw = W - PD.l - PD.r, ih = H - PD.t - PD.b;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var x0 = rows[0].age, x1 = rows[rows.length - 1].age;
    var y1 = Math.max.apply(null, rows.map(function (r) { return r.fund; })) * 1.15 || 1;
    var X = function (v) { return PD.l + ((v - x0) / (x1 - x0)) * iw; };
    var Y = function (v) { return PD.t + ih - (v / y1) * ih; };
    var step = Math.pow(10, Math.floor(Math.log(y1 / 3) / Math.LN10));
    step = Math.max(step, Math.ceil((y1 / 3) / step) * step);
    for (var v = 0; v <= y1; v += step) {
      svgEl(svg, "line", { class: "grid", x1: PD.l, x2: W - PD.r, y1: Y(v), y2: Y(v) });
      svgEl(svg, "text", { class: "axis", x: PD.l - 7, y: Y(v) + 4, "text-anchor": "end" },
        v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v));
    }
    var d = rows.map(function (r, i) { return (i ? "L" : "M") + X(r.age).toFixed(1) + " " + Y(r.fund).toFixed(1); }).join(" ");
    svgEl(svg, "path", { class: "area", d: d + " L" + X(x1) + " " + (PD.t + ih) + " L" + X(x0) + " " + (PD.t + ih) + " Z" });
    svgEl(svg, "path", { class: "line", d: d });
    svgEl(svg, "path", { class: "line--paid", d: "M" + X(x0) + " " + Y(paidAt(TERMv())) + " L" + X(x1) + " " + Y(paidAt(TERMv())) });
    for (var a = Math.ceil(x0 / 10) * 10; a <= x1; a += 10)
      svgEl(svg, "text", { class: "axis", x: X(a), y: H - 11, "text-anchor": "middle" }, a + "세");
    svgEl(svg, "line", { class: "mark", x1: X(x0), x2: X(x0), y1: PD.t, y2: PD.t + ih });
    svgEl(svg, "text", { class: "markT", x: X(x0) + 5, y: PD.t - 7 }, "인출 시작 " + x0 + "세");
    if (dry) {
      svgEl(svg, "line", { class: "mark", x1: X(dry), x2: X(dry), y1: PD.t, y2: PD.t + ih, stroke: "#A33B22" });
      svgEl(svg, "text", { class: "markT", x: X(dry) - 5, y: PD.t - 7, "text-anchor": "end", fill: "#E08A6E" }, dry + "세 바닥");
    }
  }

  /* ── 환율 그래프 ──────────────────────────────────────────── */
  function fxChart() {
    var svg = $("#fxChart");
    $$("path,line,text,circle", svg).forEach(function (x) { x.remove(); });
    var W = 640, H = 190, PD = { t: 26, r: 16, b: 28, l: 52 };
    var iw = W - PD.l - PD.r, ih = H - PD.t - PD.b;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var d0 = FXH.series, x0 = d0[0][0], x1 = d0[d0.length - 1][0];
    var ys = d0.map(function (p) { return p[1]; });
    var lo = Math.min.apply(null, ys) * .9, hi = Math.max.apply(null, ys) * 1.06;
    var X = function (v) { return PD.l + ((v - x0) / (x1 - x0)) * iw; };
    var Y = function (v) { return PD.t + ih - ((v - lo) / (hi - lo)) * ih; };
    [1000, 1200, 1400].forEach(function (v) {
      if (v < lo || v > hi) return;
      svgEl(svg, "line", { class: "grid", x1: PD.l, x2: W - PD.r, y1: Y(v), y2: Y(v) });
      svgEl(svg, "text", { class: "axis", x: PD.l - 7, y: Y(v) + 4, "text-anchor": "end" }, n(v));
    });
    var d = d0.map(function (p, i) { return (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join(" ");
    svgEl(svg, "path", { class: "fxarea", d: d + " L" + X(x1) + " " + (PD.t + ih) + " L" + X(x0) + " " + (PD.t + ih) + " Z" });
    svgEl(svg, "path", { class: "fxline", d: d });
    // 지금 환율 선을 먼저 깔고, 라벨은 왼쪽에 붙여 마커와 겹치지 않게 한다
    svgEl(svg, "line", { class: "fxnow", x1: PD.l, x2: W - PD.r, y1: Y(FX), y2: Y(FX) });
    FXH.marks.forEach(function (mk) {
      var q = d0.filter(function (z) { return z[0] === mk.y; })[0]; if (!q) return;
      svgEl(svg, "circle", { cx: X(q[0]), cy: Y(q[1]), r: 4, fill: "#F8F3E6" });
      var anchor = X(q[0]) < PD.l + 60 ? "start" : (X(q[0]) > W - PD.r - 60 ? "end" : "middle");
      svgEl(svg, "text", {
        class: "markT", x: X(q[0]), y: mk.below ? Y(q[1]) + 17 : Y(q[1]) - 10, "text-anchor": anchor
      }, mk.t);
    });
    [x0, 2010, x1].forEach(function (a) {
      svgEl(svg, "text", { class: "axis", x: X(a), y: H - 9, "text-anchor": "middle" }, a);
    });
    $("#fxRange").innerHTML = x0 + "~" + x1 +
      " <span style='color:var(--gold-l)'>— — 지금 " + n(FX) + "원</span>";

    var first = d0[0], now = d0[d0.length - 1];
    var mult = now[1] / first[1];
    var five = d0.filter(function (q) { return q[0] <= x1 - 5; }).pop();
    var g5 = five ? (now[1] - five[1]) / five[1] * 100 : 0;
    $("#fxCap").innerHTML =
      "<b>" + first[0] + "년 " + n(first[1]) + "원 → " + now[0] + "년 " + n(now[1]) + "원. " +
      mult.toFixed(1) + "배</b>입니다. " +
      "오르내림은 있었지만 <b>50년 넘게 방향은 하나</b>였습니다 — 위기가 올 때마다 원화는 밀렸고, " +
      "회복해도 그 전 자리로 완전히 돌아가지는 않았습니다. " +
      "최근 5년(" + five[0] + "→" + x1 + ")만 봐도 <b>" + (g5 >= 0 ? "+" : "") + pct(g5, 0) + "</b>. " +
      "다만 <b>지금은 1,390원대에서 내려오는 중</b>입니다 — 달러를 싸게 담는 구간일 수도, 더 내릴 수도 있습니다.";
  }

  /* ── 메인 ─────────────────────────────────────────────────── */
  function run() {
    seg($("#uwSeg"), PRODUCTS.map(function (x) { return { value: x.id, label: x.tab }; }),
      function () { return S.pid; }, function (v) { pickProduct(v); run(); });
    seg($("#sexSeg"), [{ value: "M", label: "남성" }, { value: "F", label: "여성" }],
      function () { return S.sex; }, function (v) { S.sex = v; run(); });
    seg($("#termSeg"), (P.terms || [15, 20]).map(function (x) { return { value: x, label: x + "년납" }; }),
      function () { return S.term; }, function (v) { S.term = v; if (S.annAge < S.age + v) S.annAge = S.age + v; run(); });
    seg($("#annSeg"), (P.annuityAges || [65, 70, 75, 80]).filter(function (x) { return x >= S.age + S.term; })
      .map(function (x) { return { value: x, label: x + "세" }; }),
      function () { return S.annAge; }, function (v) { S.annAge = v; run(); });
    $("#uwDesc").innerHTML = "<b>" + label() + "</b> · " + P.desc;
    seg($("#addSeg"), [
      { value: 0, label: "기본만" },
      { value: 1, label: "월 $" + ADD_PLAN.monthly + " 더" }
    ], function () { return S.add; }, function (v) { S.add = v; run(); });
    S.rate = P.rate;                      // 공시이율은 현재값 하나로 고정 (선택지를 두면 헷갈린다)

    var lump = isLump();
    $("#termL").closest("div").hidden = lump;
    $("#addL").closest("div").hidden = lump;
    document.querySelector("label[for='prem']").textContent = lump ? "한 번에 넣을 돈" : "매달 넣을 돈";
    ["age", "prem", "draw", "fxNow"].forEach(function (id) { paintRange($("#" + id)); });
    $("#ageOut").textContent = S.age + "세";
    $("#premOut").innerHTML = U(S.prem) + " <small>≈ " + krw(S.prem) + "</small>" +
      (S.add && !lump ? " <small style='color:var(--gold-l)'>+ $" + ADD_PLAN.monthly + "</small>" : "");

    var sf = startFund(), safe = safeDraw(), pd = paidAt(TERMv());
    var maxDraw = Math.max(1, safe * 2), drawM = Math.round(maxDraw * S.drawPct / 100);
    $("#draw").value = S.drawPct; paintRange($("#draw"));

    /* 히어로 */
    $("#ansK").textContent = isLump()
      ? "지금 넣으면 곧바로 확정되는 사망보험금"
      : "만 " + startAge() + "세부터, 원금을 한 푼도 헐지 않고 매달";
    var heroV = isLump() ? face() : safe;
    $("#ansV").innerHTML = "<span class='cur'>$</span>" + n(heroV);
    $("#ansKrw").textContent = "환율 " + n(FX) + "원으로 약 " + krw(heroV);
    $("#ansS").innerHTML = isLump()
      ? "일시납 <b>" + U(S.prem) + "</b> 한 번으로 <b>" + interp(P.mult[S.sex] || P.mult.M, S.age).toFixed(2) +
        "배</b>가 됩니다. 20년간 확정이고, 그 뒤로는 적립금을 따라 더 올라갑니다."
      : "그러고도 <b>" + U(sf) + "</b>은 그대로 남습니다. 이자 안에서만 꺼내기 때문입니다." +
        (S.add ? " 추가납입을 함께 하셔서 <b>" + pct(refundAt(S.term).v, 0) + "</b>까지 쌓였습니다." : "");
    $("#asOf").textContent = "공시이율 " + S.rate.toFixed(2) + "% 유지 가정 · 매월 변동 · 실제 금액은 상담에서 설계서로";

    /* 1막 */
    $("#fillWhen").textContent = isLump()
      ? "만 " + S.age + "세 · 일시납 · " + (S.sex === "M" ? "남성" : "여성")
      : "만 " + S.age + "세 → " + startAge() + "세 · " + S.term + "년납 · " + (S.sex === "M" ? "남성" : "여성");
    var fs = $("#fillStats"); fs.innerHTML = "";
    stat(fs, isLump() ? "한 번에 넣는 돈" : "총 납입액", U(pd), krw(pd));
    stat(fs, startAge() + "세 적립금", U(sf), "환급률 " + pct(refundAt(TERMv()).v));
    stat(fs, "가입금액(사망보험금)", U(face()), krw(face()) + " · 첫 달부터" + (premRateEst() ? " · 추정" : ""));
    stat(fs, "불어난 부분", U(sf - pd), krw(sf - pd));

    var ft = $("#fillTbl"); ft.innerHTML = "";
    [5, 10, S.term, 20, 30, 50].filter(function (v, i, a) { return a.indexOf(v) === i; })
      .sort(function (x, y2) { return x - y2; }).forEach(function (y) {
      var r = refundAt(y), f = paidAt(y) * r.v / 100;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + y + "년 (만 " + (S.age + y) + "세)" + (y === S.term ? " <span class='tag'>완납</span>" : "") + "</td>" +
        "<td>" + U(paidAt(Math.min(y, S.term))) + "</td>" +
        "<td>" + U(f) + "<span class='krw'>" + krw(f) + "</span></td>" +
        "<td class='" + (r.v >= 100 ? "up" : "dn") + "'>" + pct(r.v) + "</td>" +
        "<td>" + U(deathAt(y)) + "</td>";
      ft.appendChild(tr);
    });
    $("#fillNote").innerHTML = COMMON.longBonus + " " + "5년 시점 환급률이 <b>" + pct(refundAt(5).v) +
      "</b>입니다. 그 전에 해지하면 낸 돈의 절반 남짓만 돌아옵니다. " +
      "낸 돈을 넘어서는 건 <b>10년 무렵</b>이고, 진짜 힘이 붙는 건 그 뒤입니다.";

    lookTable(); addBars(); drawAct(drawM, safe, sf, pd); forkAct(sf, safe); fxChart();

    $("#minRateTxt").innerHTML = P.minRate != null
      ? "<b>연복리 " + P.minRate.toFixed(2) + "%</b>입니다. 다만 " + COMMON.minCashNote
      : "<b class='warnt'>상품별로 다릅니다</b> <span class='chk'>확인 필요</span>";
    $("#y5Txt").textContent = pct(refundAt(5).v);
    $("#reduceTip").innerHTML = COMMON.reduceTip;
    $("#assume").innerHTML = "<b>계산 근거:</b> " + label() + " · <b>실제 가입설계 " + REFUND_SAMPLES.length +
      "건</b>(만 27~54세 · 남녀 · 15/20년납)에서 뽑은 표를 씁니다. " +
      "<b>환급률</b>은 납입기간이 결정하고(7건 모두 같은 범위), <b>나이·성별</b>은 보험료율에 작용해 " +
      "같은 보험료로 받는 <b>가입금액</b>을 바꿉니다. <b>연금</b>은 개시 나이별 지급률(현재 연 " +
      annRate().toFixed(2) + "%)을 적용했습니다. 적용환율 " + n(FX) + "원 · 공시이율 " + S.rate.toFixed(2) + "% 가정. " +
      "<b class='warnt'>실제 보험료·가입금액·환급금은 심사 결과와 시점에 따라 달라지므로 반드시 설계서로 확인하세요.</b>";
    $("#dockT").textContent = "만 " + startAge() + "세부터 매달 " + U(safe);
    saveUrl();
  }

  function termIsEst() {
    if (isLump()) return false;
    var tbl = REFUND_BY_TERM[S.term];
    return !!(tbl && tbl.est);
  }

  /* ── 한눈에 보기 — 연차별 통합 조회표 ─────────────────────── */
  function lookTable() {
    var tb = $("#lookTbl"); tb.innerHTML = "";
    var years = [];
    if (isLump()) years = Object.keys(P.refundBySex[S.sex] || P.refundBySex.M).filter(function (k) { return !isNaN(+k); }).map(Number);
    else { for (var y = 5; y <= 50; y += 5) years.push(y); if (years.indexOf(S.term) < 0) years.push(S.term); }
    years.sort(function (x, y2) { return x - y2; });
    var anyEst = false;
    years.forEach(function (y) {
      var age = S.age + y, r = refundAt(y), f = fundAt(y), pd2 = paidAt(y);
      var canAnn = age >= 45 && age <= 80 && y >= 10;      // 약관: 10년 이상 유지 + 45~80세
      var ar = canAnn ? annRateAt(age) : null;
      var mo = canAnn ? f * (ar.v / 100) / 12 : 0;
      if (ar && ar.est) anyEst = true;
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td><b>" + age + "세</b>" + (!isLump() && y === S.term ? " <span class='tag'>완납</span>" : "") + "</td>" +
        "<td>" + y + "년</td>" +
        "<td>" + U(pd2) + "</td>" +
        "<td>" + U(f) + "<span class='krw'>" + krw(f) + "</span></td>" +
        "<td class='" + (r.v >= 100 ? "up" : "dn") + "'>" + pct(r.v) + "</td>" +
        "<td>" + U(deathAt(y)) + "<span class='krw'>" + krw(deathAt(y)) + "</span></td>" +
        "<td>" + (canAnn
          ? "<b>" + U2(mo) + "</b>/월<span class='krw'>" + krw(mo) + (ar.est ? " · 추정" : "") + "</span>"
          : "<span class='hint'>" + (y < 10 ? "10년 미만" : "개시 불가") + "</span>") + "</td>";
      tb.appendChild(tr);
    });
    $("#lookLead").innerHTML = "<b>" + (S.sex === "M" ? "남성" : "여성") + " 만 " + S.age + "세</b>가 " +
      (isLump()
        ? "<b>" + U(S.prem) + "</b>(" + krw(S.prem) + ")을 한 번에 넣었을 때입니다."
        : "월 <b>" + U(S.prem) + "</b>(" + krw(S.prem) + ")씩 <b>" + S.term + "년</b> 넣었을 때입니다." +
          (S.add ? " 추가납입 $" + ADD_PLAN.monthly + "도 함께 계산했습니다." : "")) +
      " 위에서 조건을 바꾸면 이 표가 통째로 다시 계산됩니다.";
    $("#lookNote").innerHTML = (termIsEst()
        ? "<b class='warnt'>10년납은 아직 실제 설계서를 받지 못해 이 표가 추정치입니다.</b> " +
          "15·20년납은 실측이고, 10년납만 그 흐름으로 늘려 잡았습니다. " +
          "정확한 금액은 상담에서 설계서로 확인해 주세요. "
        : "") +
      "연금은 <b>계약 10년 이상 유지 + 만 45~80세</b>에 개시할 수 있어 그 밖은 비워뒀습니다. " +
      "종신 10년보증 기준이고, 체증형·확정형 등 다른 방식은 금액이 달라집니다. " +
      (anyEst ? "'추정'은 실측이 없는 개시 나이라 앞뒤 값으로 늘려 잡은 것입니다. " : "") +
      "공시이율 <b>연 " + S.rate.toFixed(2) + "%</b>가 계속 유지된다는 가정이며, 이율은 매월 바뀝니다.";
  }

  /* ── 추가납입 비교 ────────────────────────────────────────── */
  function addBars() {
    var sec = $("#addBars").closest(".act");
    if (isLump()) { sec.hidden = true; return; }
    sec.hidden = false;
    var host = $("#addBars"); host.innerHTML = "";
    var wasAdd = S.add;
    S.add = 0; var pA = paidAt(20), fA = fundAt(20);
    S.add = 1; var pB = paidAt(20), fB = fundAt(20);
    S.add = wasAdd;
    var max = Math.max(fA, fB);
    [["a", "기본만<br><span class='hint'>월 $" + n(S.prem) + "</span>", pA, fA, fA / pA * 100],
     ["b", "추가납입<br><span class='hint'>+ $" + ADD_PLAN.monthly + " × " + ADD_PLAN.years + "년</span>", pB, fB, fB / pB * 100]
    ].forEach(function (r) {
      var d = document.createElement("div"); d.className = "cbar__row cbar__row--" + r[0];
      d.innerHTML = "<span class='cbar__k'>" + r[1] + "</span>" +
        "<span class='cbar__track'><span class='cbar__fill' style='width:" + (r[3] / max * 100) + "%'>" +
        U(r[3]) + " · " + pct(r[4]) + "</span></span>";
      host.appendChild(d);
    });
    $("#addLead").innerHTML = "20년 시점 기준입니다. 추가로 넣은 돈은 <b>" + U(pB - pA) +
      "</b>인데, 돌아오는 돈은 <b>" + U(fB - fA) + "</b> 늘었습니다.";
    var g = document.createElement("p"); g.className = "cbar__gap";
    g.innerHTML = "환급률이 <b>" + pct(fA / pA * 100) + " → " + pct(fB / pB * 100) +
      "</b>로 올라갑니다. " + COMMON.addNote + " 위 <b>'월 $" + ADD_PLAN.monthly +
      " 더'</b> 버튼을 눌러 전체 숫자가 어떻게 바뀌는지 보세요.";
    host.appendChild(g);
    $("#addNote").innerHTML = COMMON.flex.withdrawFrom + " " + COMMON.flex.withdrawLimit +
      " 추가납입 한도와 수수료는 약관이 기준입니다. <span class='chk'>확인 필요</span>";
  }

  /* ── 2막 ──────────────────────────────────────────────────── */
  function drawAct(drawM, safe, sf, pd) {
    var r = sim(drawM), over = drawM > safe + 0.5;
    $("#drawOut").innerHTML = U(drawM) + " <small>≈ " + krw(drawM) + "</small>";
    $("#draw").classList.toggle("rng--warn", over);
    $("#safeLine").innerHTML = "원금이 줄지 않는 선 = 매달 <b>" + U(safe) + "</b> (연 " + U(safe * 12) + ")";
    var vd = $("#verdict"); vd.className = "draw__verdict " + (over ? "over" : "safe");
    var last = r.rows[r.rows.length - 1];
    vd.innerHTML = !over
      ? "<b>평생 마르지 않습니다.</b> 100세까지 꺼내 쓰고도 <b>" + U(last.fund) + "</b>이 남습니다. 그동안 꺼낸 돈은 " + U(last.cum) + " (" + krw(last.cum) + ")입니다."
      : (r.dry ? "<b>만 " + r.dry + "세에 우물이 바닥납니다.</b> " + (r.dry - startAge()) + "년치입니다. 매달 " + U(safe) + " 아래로 낮추면 평생 갑니다."
               : "<b>원금을 헐기 시작합니다.</b> 100세 잔액은 " + U(last.fund) + "입니다.");
    chart(r.rows, r.dry);
    $("#chartCap").innerHTML = over
      ? "선이 아래로 꺾이는 게 보이시나요? <b>이자보다 많이 꺼내는 순간</b>부터입니다. 점선은 낸 돈입니다."
      : "꺼내 쓰는데도 선이 <b>위로 갑니다.</b> 남은 돈에 붙는 이자가 꺼내는 돈보다 크기 때문입니다. 점선은 낸 돈입니다.";
    var tb = $("#simTbl"); tb.innerHTML = "";
    [0, 5, 10, 20, 30, END - startAge()].filter(function (v, i, a) { return v >= 0 && v <= END - startAge() && a.indexOf(v) === i; })
      .sort(function (a, b) { return a - b; }).forEach(function (k) {
        var row = r.rows[k]; if (!row) return;
        var pv = row.fund / pd * 100;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + row.age + "세" + (k === 0 ? " <span class='tag'>개시</span>" : "") + "</td>" +
          "<td>" + U(row.draw) + "</td><td>" + U(row.cum) + "</td>" +
          "<td>" + U(row.fund) + "<span class='krw'>" + krw(row.fund) + "</span></td>" +
          "<td class='" + (pv >= 100 ? "up" : "dn") + "'>" + pct(pv, 0) + "</td>";
        tb.appendChild(tr);
      });
  }

  /* ── 3막 ──────────────────────────────────────────────────── */
  var FORKS = [["fkAnn", "ann"], ["fkCash", "cash"], ["fkLeave", "leave"]];
  FORKS.forEach(function (f, i) {
    $("#" + f[0]).addEventListener("click", function () {
      S.fork = f[1];
      FORKS.forEach(function (x, k) { $("#" + x[0]).setAttribute("aria-selected", k === i ? "true" : "false"); });
      run();
    });
  });

  function forkAct(sf, safe) {
    var box = $("#forkExtra"); box.innerHTML = "";
    if (S.fork === "ann") {
      var lump = annLump(), mo = annMonthly(), yrs = Math.max(1, 100 - S.annAge);
      $("#forkLead").innerHTML = "만 <b>" + S.annAge + "세</b>에 연금으로 바꾸면, 그때 적립금 <b>" + U(lump) +
        "</b>이 연금 재원이 됩니다. 개시 나이를 올릴수록 매달 받는 금액이 커집니다.";
      var g3 = document.createElement("div"); g3.className = "stats stats--3";
      stat(g3, "매달 받는 돈", U2(mo), krw(mo) + " · 종신 10년보증");
      stat(g3, "100세까지 총", U(mo * 12 * yrs), krw(mo * 12 * yrs));
      stat(g3, "낸 돈의", (mo * 12 * yrs / paidAt(S.term)).toFixed(2) + "배", "총 납입액 대비");
      box.appendChild(g3);
      var note = document.createElement("p");
      note.className = "hint"; note.style.marginTop = "12px";
      note.innerHTML = "개시 나이별 지급률(연 " + annRate().toFixed(2) + "%)은 실제 가입설계 " +
        "7건에서 뽑았습니다. <b>체증형·확정형·상속연금형</b> 등 다른 지급 방식도 있고, " +
        "방식마다 매달 받는 금액과 총 수령액이 달라집니다 — 상담에서 함께 비교해 드립니다.";
      box.appendChild(note);
      $("#forkNote").innerHTML = "만 " + S.annAge + "세 개시 · 100세까지 수령 기준. 연금으로 바꾸면 <b>사망보험금은 줄거나 종료</b>됩니다. " +
        "<b>더 많이 받는 방법이 따로 있습니다</b> — 연금으로 바꾸지 않고 감액으로 꺼내는 방식인데, " +
        "계약마다 셈이 달라 <b>상담에서 직접 보여드립니다.</b> " + COMMON.annuityCond;
    } else if (S.fork === "cash") {
      $("#forkLead").innerHTML = "중간에 목돈이 필요해지면 <b>해지하지 않고</b> 꺼냅니다. 계약은 그대로 유지됩니다.";
      var g = document.createElement("div"); g.className = "stats stats--3";
      stat(g, "지금 뺄 수 있는 돈", U(sf * 0.3) + "~" + U(sf * 0.6), "해약환급금의 30~60%");
      stat(g, "빼고 남는 돈", U(sf * 0.4) + "~" + U(sf * 0.7), "나머지는 계속 굴러갑니다");
      stat(g, "계약은", "유지", "비과세 시계도 안 멈춥니다");
      box.appendChild(g);
      $("#forkNote").innerHTML = COMMON.flex.withdrawFrom + " " + COMMON.flex.withdrawLimit +
        " <b>인출한 만큼 적립금과 사망보험금이 줄어듭니다.</b> 정확한 한도·시기·수수료는 약관이 기준입니다. <span class='chk'>확인 필요</span>";
    } else {
      $("#forkLead").innerHTML = "한 번도 꺼내지 않고 <b>그대로 남기는</b> 경우입니다.";
      var g2 = document.createElement("div"); g2.className = "stats stats--3";
      stat(g2, "만 " + (S.age + 30) + "세 사망 시", U(deathAt(30)), krw(deathAt(30)));
      stat(g2, "만 " + (S.age + 40) + "세 사망 시", U(deathAt(40)), krw(deathAt(40)));
      stat(g2, "만 " + (S.age + 50) + "세 사망 시", U(deathAt(50)), krw(deathAt(50)));
      box.appendChild(g2);
      $("#forkNote").innerHTML = "사망보험금은 처음 20년간 가입금액으로 고정되고, 그 뒤에는 <b>적립금이 늘어난 만큼 함께</b> 올라갑니다. " +
        "<b>상속세·증여세가 면제되는 것은 아닙니다.</b> 계약자·피보험자·수익자를 어떻게 두느냐로 결과가 크게 달라지니 이 부분은 꼭 상담에서 짚어보세요.";
    }
  }

  /* ── 환율 슬라이더 ────────────────────────────────────────── */
  var fxEl = $("#fxNow");
  fxEl.min = CONFIG.fx.min; fxEl.max = CONFIG.fx.max; fxEl.step = 10; fxEl.value = FX;
  fxEl.addEventListener("input", function () {
    FX = +this.value; paintRange(this);
    var base = CONFIG.fx.now, d = FX - base, safe = safeDraw();
    $("#fxOut").textContent = n(FX) + "원";
    var v = $("#fxVerdict"); v.className = "draw__verdict " + (d >= 0 ? "safe" : "over");
    v.innerHTML = Math.abs(d) < 5
      ? "지금 환율 그대로입니다. 슬라이더를 움직이면 <b>원화 금액만</b> 바뀝니다 — 달러 금액은 그대로예요."
      : d > 0
        ? "지금보다 <b>" + n(d) + "원 오른</b> 경우입니다. 매달 받는 돈이 " + krw(safe) +
          " — 지금 환율일 때보다 <b>" + n(safe * d) + "원</b> 많습니다."
        : "지금보다 <b>" + n(-d) + "원 내린</b> 경우입니다. 매달 " + krw(safe) +
          "로 <b>" + n(safe * -d) + "원 줄어듭니다.</b> 이게 환위험입니다.";
    run();
  });

  /* ── 자유 입출금 · 비과세 카드 ────────────────────────────── */
  var BENS = [
    { t: "해지하지 않고 꺼내 씁니다", d: "목돈이 필요할 때 계약을 깨지 않고 필요한 만큼만 인출합니다. 여유가 생기면 다시 채워 넣을 수도 있습니다.",
      c: "추가납입을 하신 경우 인출은 가입 1년 후부터, 한도는 해약환급금의 30~60% 수준입니다. 인출한 만큼 적립금과 사망보험금이 줄어듭니다." },
    { t: "추가납입엔 사업비가 없습니다", d: "기본 보험료에는 계약체결비용이 붙지만 추가납입 보험료에는 붙지 않습니다. 같은 돈이라도 더 많이 쌓이는 이유입니다.",
      c: "추가납입 한도와 수수료는 상품·약관마다 다릅니다. 반드시 약관으로 확인하세요." },
    { t: "요건을 채우면 이자에 세금이 없습니다", d: "10년 이상 유지 등 세법상 요건을 충족하면 보험차익에 세금이 붙지 않고, 금융소득으로도 잡히지 않아 건강보험료 산정에서 빠집니다.",
      c: "월납 150만원 / 일시납 1억 한도와 유지 10년·납입 5년 요건을 모두 채워야 합니다. 하나라도 못 채우면 과세되고, 세법은 개정될 수 있습니다. ISA·비과세종합저축 등 다른 비과세 제도도 있으므로 '유일한 상품'은 아닙니다." }
  ];
  BENS.forEach(function (b) {
    var el = document.createElement("button");
    el.type = "button"; el.className = "ben"; el.setAttribute("aria-expanded", "false");
    el.innerHTML = "<span class='ben__t serif'>" + b.t + "</span><span class='ben__d'>" + b.d +
      "</span><span class='ben__c'>※ " + b.c + "</span>";
    el.addEventListener("click", function () {
      var on = el.classList.toggle("on"); el.setAttribute("aria-expanded", on ? "true" : "false");
    });
    $("#bens").appendChild(el);
  });
  FXNEWS.forEach(function (a) {
    var el = document.createElement("a");
    el.className = "newsit"; el.href = a.u; el.target = "_blank"; el.rel = "noopener";
    el.innerHTML = "<span class='newsit__m'>" + a.src + " · " + a.date + "</span><span class='newsit__t'>" + a.t + "</span>";
    $("#fxNews").appendChild(el);
  });

  /* ── 링크 공유 ────────────────────────────────────────────── */
  function saveUrl() {
    var q = "u=" + S.pid + "&g=" + S.sex + "&a=" + S.age + "&t=" + S.term + "&n=" + S.annAge +
            "&p=" + S.prem + "&x=" + S.add + "&r=" + S.rate + "&d=" + S.drawPct + "&f=" + FX;
    history.replaceState(null, "", location.pathname + "#" + q);
    lastHash = location.hash;
  }
  function loadUrl() {
    var h = location.hash.slice(1); if (!h) return false;
    var o = {}; h.split("&").forEach(function (kv) { var x = kv.split("="); o[x[0]] = x[1]; });
    if (!o.a) return false;
    if (o.u) { var f = PRODUCTS.filter(function (z) { return z.id === o.u; })[0]; if (f) { P = f; S.pid = f.id; } }
    if (o.g === "M" || o.g === "F") S.sex = o.g;
    S.age = +o.a; S.prem = o.p ? +o.p : S.prem; S.add = +o.x || 0;
    if (o.t) S.term = +o.t;
    if (o.n) S.annAge = +o.n;
    S.rate = o.r ? +o.r : S.rate; S.drawPct = o.d != null ? +o.d : S.drawPct;
    if (o.f) { FX = +o.f; fxEl.value = FX; }
    $("#age").value = S.age; $("#prem").value = S.prem; $("#draw").value = S.drawPct;
    return true;
  }
  $("#copyBtn").addEventListener("click", function () {
    saveUrl();
    var url = location.href;
    var ok = function () { $("#copyMsg").textContent = "복사했습니다. 카톡에 붙여넣어 보내시면 됩니다."; };
    var no = function () { $("#copyMsg").textContent = "주소창의 링크를 복사해 주세요 → " + url; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok).catch(no);
    else no();
  });
  $("#resetBtn").addEventListener("click", function () { location.hash = ""; location.reload(); });

  /* ── 연락 ─────────────────────────────────────────────────── */
  function summary() {
    return "[달러로 짓는 우물]\n" + (S.sex === "M" ? "남성" : "여성") + " " + S.age + "세 · 월 $" + n(S.prem) +
      (S.add ? " + 추가납입 $" + ADD_PLAN.monthly : "") +
      " · " + S.term + "년납 · 연금개시 " + S.annAge + "세 · 공시이율 " + S.rate.toFixed(2) + "% 가정\n" +
      "가입금액(사망보험금) $" + n(face()) + "\n" +
      startAge() + "세 적립금 $" + n(startFund()) + " (환급률 " + pct(refundAt(TERMv()).v) + ")\n" +
      "원금 안 줄이는 인출액: 매달 $" + n(safeDraw()) + " (환율 " + n(FX) + "원 기준 " + krw(safeDraw()) + ")\n" +
      "조건 링크: " + location.href;
  }
  function sms() {
    location.href = "sms:" + CONFIG.tel.replace(/[^0-9+]/g, "") + "?&body=" +
      encodeURIComponent(summary() + "\n\n위 조건으로 정확한 설계서 부탁드립니다.");
  }
  $("#smsBtn").addEventListener("click", sms);
  $("#smsWay").addEventListener("click", sms);
  $("#kakaoBtn").href = CONFIG.kakaoUrl;
  $("#kakaoWay").href = CONFIG.kakaoUrl;
  $("#telWay").href = "tel:" + CONFIG.tel.replace(/[^0-9+]/g, "");
  $("#telTxt").textContent = "전화 " + CONFIG.tel;
  $("#ftrContact").textContent = CONFIG.consultant + " · " + CONFIG.tel;

  $("#leadForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var msg = $("#formMsg");
    function say(t, ok) { msg.hidden = false; msg.className = "formmsg " + (ok ? "ok" : "err"); msg.innerHTML = t; }
    var name = $("#fName").value.trim(), phone = $("#fPhone").value.trim();
    if (!name) return say("성함을 입력해 주세요.", false);
    if (!/^01[016-9][-\s.]?\d{3,4}[-\s.]?\d{4}$/.test(phone)) return say("휴대폰 번호를 다시 확인해 주세요.", false);
    if (!$("#fAgree").checked) return say("개인정보 수집·이용 동의가 필요합니다.", false);
    var text = "[상담 신청]\n성함: " + name + "\n연락처: " + phone + "\n통화 가능: " + $("#fTime").value +
      "\n문의: " + ($("#fMemo").value.trim() || "-") + "\n\n" + summary();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        say("신청 내용을 <b>클립보드에 복사</b>했습니다. 카카오톡 상담창에 붙여넣어 보내주시면 그대로 접수됩니다.", true);
        window.open(CONFIG.kakaoUrl, "_blank", "noopener");
      }).catch(function () { say("아래 내용을 복사해 보내주세요.<br><br>" + text.replace(/\n/g, "<br>"), true); });
    } else say("아래 내용을 복사해 보내주세요.<br><br>" + text.replace(/\n/g, "<br>"), true);
  });

  /* ── 입력 · 등장 ──────────────────────────────────────────── */
  $("#age").addEventListener("input", function () { S.age = +this.value; run(); });
  $("#prem").addEventListener("input", function () { S.prem = +this.value; run(); });
  $("#draw").addEventListener("input", function () { S.drawPct = +this.value; run(); });

  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .05 });
    $$(".rv").forEach(function (x) { io.observe(x); });
  } else $$(".rv").forEach(function (x) { x.classList.add("in"); });

  if (loadUrl()) $("#fromLink").hidden = false;
  $("#fxOut").textContent = n(FX) + "원";
  $("#fxVerdict").innerHTML = "슬라이더를 움직이면 <b>원화 금액만</b> 바뀝니다 — 달러 금액은 그대로예요.";
  run();

  window.addEventListener("hashchange", function () {
    if (location.hash === lastHash) return;
    lastHash = location.hash;
    if (loadUrl()) { $("#fromLink").hidden = false; run(); }
  });
})();
