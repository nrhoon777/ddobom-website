/* =====================================================================
   마르지 않는 우물 — 계산 + 인터랙션 + 링크 공유
   모델은 설계서 3개 지점(62세 125,910 / 71세 152,920 / 100세 543,850)에서
   역산한 실효이율·적립비율을 씁니다.
===================================================================== */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var S = { age: 42, prem: WELL.premDefault, term: 20, start: 62, drawPct: 45, fork: "keep",
            lgAge: 40, lgPrem: LEGACY.premDefault };
  var FX = CONFIG.fx.now;
  var lastHash = location.hash;
  var END = 100;                                     // 시뮬레이션 종료 나이

  /* ── 포맷 ─────────────────────────────────────────────────── */
  function n(v) { return Math.round(v).toLocaleString("ko-KR"); }
  function U(v) { return "$" + n(v); }
  function U2(v) { return "$" + v.toFixed(2); }
  function krw(v) {
    v = Math.round(v * FX); var sign = v < 0 ? "-" : ""; v = Math.abs(v);
    if (v >= 100000000) { var e = Math.floor(v / 1e8), m = Math.round((v % 1e8) / 1e4);
      return sign + e + "억" + (m ? " " + n(m) + "만" : "") + "원"; }
    if (v >= 10000) return sign + n(v / 1e4) + "만원";
    return sign + n(v) + "원";
  }
  function pct(v, d) { var p = Math.pow(10, d == null ? 1 : d); return (Math.round(v * p) / p).toLocaleString("ko-KR") + "%"; }
  function label(p) { return CONFIG.showBrand ? p.name : p.generic; }

  /* ── 우물 계산 ────────────────────────────────────────────── */
  var e = WELL.effRate / 100, m = e / 12;
  function paid() { return S.prem * 12 * S.term; }
  function death() { return S.prem * WELL.deathPerMonthly; }
  function fundAt(yearsFromStart) {          // 가입 후 N년 시점 적립금
    var f = 0, months = Math.round(yearsFromStart * 12), payM = S.term * 12;
    for (var k = 1; k <= months; k++) { f *= (1 + m); if (k <= payM) f += S.prem * WELL.credit; }
    return f;
  }
  function startYears() { return S.start - S.age; }
  function startFund() { return fundAt(startYears()); }
  function safeDraw() { return startFund() * e / 12; }   // 원금을 헐지 않는 월 최대 인출액

  /* 인출 시뮬레이션 — 매년 draw*12 를 빼고 나머지는 굴린다 */
  function sim(monthlyDraw) {
    var rows = [], f = startFund(), cum = 0, dry = null;
    rows.push({ age: S.start, draw: 0, cum: 0, fund: f });
    for (var a = S.start + 1; a <= END; a++) {
      var d = monthlyDraw * 12;
      f = f * (1 + e) - d;
      if (f <= 0) { d += f; f = 0; if (!dry) dry = a; }
      cum += Math.max(0, d);
      rows.push({ age: a, draw: Math.max(0, d), cum: cum, fund: f });
    }
    return { rows: rows, dry: dry };
  }

  /* ── 세그먼트 ─────────────────────────────────────────────── */
  function seg(host, items, get, set) {
    host.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button"; b.innerHTML = it.label;
      b.className = get() === it.value ? "on" : "";
      b.setAttribute("aria-pressed", get() === it.value ? "true" : "false");
      b.addEventListener("click", function () { set(it.value); });
      host.appendChild(b);
    });
  }
  function startOptions() {
    var done = S.age + S.term;                    // 완납 시점
    var floor = Math.max(done, WELL.startAgeMin);
    var out = [], seen = {};
    [floor, 60, 65, 70].forEach(function (a) {
      if (a < floor || a > 85 || seen[a]) return;
      seen[a] = 1;
      out.push({ value: a, label: a + "세" + (a === done ? " <span class='hint'>완납</span>" : "") });
    });
    return out.sort(function (x, y) { return x.value - y.value; });
  }

  /* ── 그리기 ───────────────────────────────────────────────── */
  function paintRange(el) { el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min)) * 100 + "%"); }

  function chart(rows, dry) {
    var svg = $("#chart");
    $$("path,line,text,circle", svg).forEach(function (x) { x.remove(); });
    var W = 640, H = 220, P = { t: 22, r: 16, b: 32, l: 56 };
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var x0 = rows[0].age, x1 = rows[rows.length - 1].age;
    var y1 = Math.max.apply(null, rows.map(function (r) { return r.fund; })) * 1.15 || 1;
    var X = function (v) { return P.l + ((v - x0) / (x1 - x0)) * iw; };
    var Y = function (v) { return P.t + ih - (v / y1) * ih; };
    var ns = "http://www.w3.org/2000/svg";
    function el(t, a, tx) { var n2 = document.createElementNS(ns, t);
      for (var k in a) n2.setAttribute(k, a[k]); if (tx != null) n2.textContent = tx; svg.appendChild(n2); return n2; }

    var step = Math.pow(10, Math.floor(Math.log(y1 / 3) / Math.LN10));
    step = Math.max(step, Math.ceil((y1 / 3) / step) * step);
    for (var v = 0; v <= y1; v += step) {
      el("line", { class: "grid", x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v) });
      el("text", { class: "axis", x: P.l - 7, y: Y(v) + 4, "text-anchor": "end" },
        v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v));
    }
    var d = rows.map(function (r, i) { return (i ? "L" : "M") + X(r.age).toFixed(1) + " " + Y(r.fund).toFixed(1); }).join(" ");
    el("path", { class: "area", d: d + " L" + X(x1) + " " + (P.t + ih) + " L" + X(x0) + " " + (P.t + ih) + " Z" });
    el("path", { class: "line", d: d });
    el("path", { class: "line--paid", d: "M" + X(x0) + " " + Y(paid()) + " L" + X(x1) + " " + Y(paid()) });

    for (var a = Math.ceil(x0 / 10) * 10; a <= x1; a += 10) {
      el("text", { class: "axis", x: X(a), y: H - 11, "text-anchor": "middle" }, a + "세");
    }
    el("line", { class: "mark", x1: X(x0), x2: X(x0), y1: P.t, y2: P.t + ih });
    el("text", { class: "markT", x: X(x0) + 5, y: P.t - 7 }, "인출 시작 " + x0 + "세");
    if (dry) {
      el("line", { class: "mark", x1: X(dry), x2: X(dry), y1: P.t, y2: P.t + ih, stroke: "#A33B22" });
      el("text", { class: "markT", x: X(dry) - 5, y: P.t - 7, "text-anchor": "end", fill: "#E08A6E" }, dry + "세 바닥");
    }
  }

  function stat(host, k, v, s) {
    var d = document.createElement("div"); d.className = "stat";
    d.innerHTML = "<p class='stat__k'>" + k + "</p><p class='stat__v mono'>" + v + "</p><p class='stat__s'>" + (s || "") + "</p>";
    host.appendChild(d);
  }

  /* ── 메인 ─────────────────────────────────────────────────── */
  function run() {
    /* 입력 정리 */
    var opts = startOptions();
    if (!opts.length) { S.term = Math.max(10, Math.min(S.term, 70 - S.age)); opts = startOptions(); }
    if (!opts.some(function (o) { return o.value === S.start; })) S.start = opts.length ? opts[0].value : S.age + S.term;

    seg($("#termSeg"), WELL.payTerms.map(function (t) { return { value: t, label: t + "년" }; }),
      function () { return S.term; }, function (v) { S.term = v; run(); });
    seg($("#startSeg"), opts, function () { return S.start; }, function (v) { S.start = v; run(); });

    ["age", "prem", "draw", "lgAge", "lgPrem"].forEach(function (id) { paintRange($("#" + id)); });
    $("#ageOut").textContent = S.age + "세";
    $("#premOut").innerHTML = U(S.prem) + " <small>≈ " + krw(S.prem) + "</small>";

    var sf = startFund(), safe = safeDraw(), p = paid();
    // 슬라이더는 0~100(%). 50% 지점이 정확히 "원금이 줄지 않는 선"이 되도록 잡는다.
    var maxDraw = Math.max(1, safe * 2);
    var drawM = Math.round(maxDraw * S.drawPct / 100);
    var dr = $("#draw"); dr.value = S.drawPct; paintRange(dr);

    /* 히어로 답 — 원금을 헐지 않는 금액 */
    $("#ansK").textContent = "만 " + S.start + "세부터, 원금을 한 푼도 헐지 않고 매달";
    $("#ansV").innerHTML = "<span class='cur'>$</span>" + n(safe);
    $("#ansKrw").textContent = "오늘 환율로 약 " + krw(safe);
    $("#ansS").innerHTML = "그러고도 <b>" + U(sf) + "</b>은 그대로 남아 있습니다. 이자 안에서만 꺼내기 때문입니다.";
    $("#asOf").textContent = CONFIG.asOf.replace(/-/g, ".") + " 공시이율 기준 · 매월 15일 변경 · 예시입니다";

    /* 1막 */
    $("#fillWhen").textContent = "만 " + S.age + "세 → " + (S.age + S.term) + "세 · " + S.term + "년";
    var fs = $("#fillStats"); fs.innerHTML = "";
    stat(fs, "총 납입액", U(p), krw(p));
    stat(fs, S.start + "세 적립금", U(sf), "환급률 " + pct(sf / p * 100));
    stat(fs, "사망보험금", U(death()), krw(death()) + " · 첫 달부터");
    stat(fs, "불어난 부분", U(sf - p), krw(sf - p));
    $("#fillNote").innerHTML = "월 " + U(S.prem) + " × " + S.term + "년 = " + U(p) +
      "을 넣고 " + (S.start - S.age - S.term > 0 ? (S.start - S.age - S.term) + "년 더 두면 " : "") +
      "만 " + S.start + "세에 <b>" + U(sf) + "</b>이 됩니다. 사망보험금은 납입액에 비례해 설계되며 실제 금액은 심사 결과에 따라 달라집니다.";

    /* 2막 */
    var r = sim(drawM);
    $("#drawOut").innerHTML = U(drawM) + " <small>≈ " + krw(drawM) + "</small>";
    var over = drawM > safe + 0.5;
    dr.classList.toggle("rng--warn", over);
    $("#safeLine").innerHTML = "원금이 줄지 않는 선 = 매달 <b>" + U(safe) + "</b> (연 " + U(safe * 12) + ")";
    var vd = $("#verdict"); vd.className = "draw__verdict " + (over ? "over" : "safe");
    if (!over) {
      var last = r.rows[r.rows.length - 1];
      vd.innerHTML = "<b>평생 마르지 않습니다.</b> 100세까지 매년 꺼내 쓰고도 <b>" + U(last.fund) +
        "</b>이 남습니다. 그동안 꺼내 쓴 돈은 " + U(last.cum) + " (" + krw(last.cum) + ")입니다.";
    } else {
      vd.innerHTML = r.dry
        ? "<b>만 " + r.dry + "세에 우물이 바닥납니다.</b> " + (r.dry - S.start) + "년치입니다. 매달 " +
          U(safe) + " 아래로 낮추면 평생 갑니다."
        : "<b>원금을 헐기 시작합니다.</b> 100세 시점 잔액은 " + U(r.rows[r.rows.length - 1].fund) + "입니다.";
    }
    chart(r.rows, r.dry);
    $("#chartCap").innerHTML = over
      ? "선이 아래로 꺾이는 게 보이시나요? <b>이자보다 많이 꺼내는 순간</b>부터입니다. 점선은 지금까지 낸 돈입니다."
      : "꺼내 쓰는데도 선이 <b>위로 갑니다.</b> 남은 돈에 붙는 이자가 꺼내는 돈보다 크기 때문입니다. 점선은 지금까지 낸 돈입니다.";

    var tb = $("#simTbl"); tb.innerHTML = "";
    [0, 5, 10, 20, 30, END - S.start].filter(function (v, i, a) { return v >= 0 && v <= END - S.start && a.indexOf(v) === i; })
      .sort(function (a, b) { return a - b; }).forEach(function (k) {
        var row = r.rows[k]; if (!row) return;
        var tr = document.createElement("tr");
        var pctv = row.fund / p * 100;
        tr.innerHTML = "<td>" + row.age + "세" + (k === 0 ? " <span class='tag'>개시</span>" : "") + "</td>" +
          "<td>" + U(row.draw) + "</td><td>" + U(row.cum) + "</td>" +
          "<td>" + U(row.fund) + "<span class='krw'>" + krw(row.fund) + "</span></td>" +
          "<td class='" + (pctv >= 100 ? "up" : "dn") + "'>" + pct(pctv, 0) + "</td>";
        tb.appendChild(tr);
      });

    fork(r, drawM, safe, sf, p);
    legacy();

    $("#assume").innerHTML = "<b>계산 근거:</b> " + label(WELL) + " · " + WELL.baseNote +
      " 설계서에서 역산한 <b>실효 적립이율 연 " + WELL.effRate.toFixed(2) + "%</b>(공시 " + WELL.noticeRate.toFixed(2) +
      "% − 보험비용)와 <b>적립비율 " + (WELL.credit * 100).toFixed(1) + "%</b>를 적용했습니다. " +
      "금액은 기준 계약에 비례 환산했고, 적용환율 " + n(FX) + "원 기준입니다. " +
      "기준 계약은 만 " + WELL.base.age + "세 " + WELL.base.sex + "자라 <b>나이·성별이 다르면 실제 값이 달라집니다.</b> " +
      "최저보증이율(" + WELL.minRate.toFixed(2) + "%) 적용 시에는 위 금액보다 낮아집니다.";

    $("#dockT").textContent = "만 " + S.start + "세부터 매달 " + U(safe);
    saveUrl();
  }

  /* ── 3막 갈림길 ───────────────────────────────────────────── */
  var FORKS = [["fkKeep", "keep"], ["fkAnn", "ann"], ["fkLeave", "leave"]];
  FORKS.forEach(function (f, i) {
    $("#" + f[0]).addEventListener("click", function () {
      S.fork = f[1];
      FORKS.forEach(function (x, k) { $("#" + x[0]).setAttribute("aria-selected", k === i ? "true" : "false"); });
      run();
    });
  });

  function fork(r, drawM, safe, sf, p) {
    var host = $("#forkStats"); host.innerHTML = "";
    var last = r.rows[r.rows.length - 1];
    if (S.fork === "keep") {
      $("#forkLead").innerHTML = "지금 맞춰놓으신 <b>매달 " + U(drawM) + "</b>을 계속 꺼내 쓰는 경우입니다.";
      stat(host, "100세까지 꺼내 쓴 돈", U(last.cum), krw(last.cum));
      stat(host, "100세 남은 적립금", U(last.fund), krw(last.fund));
      stat(host, "낸 돈 대비", pct((last.cum + last.fund) / p * 100, 0), "꺼낸 돈 + 남은 돈");
      $("#forkNote").innerHTML = "인출한 만큼 <b>사망보험금도 함께 줄어듭니다.</b> 얼마까지 줄어드는지는 약관 기준으로 확인해야 합니다. <span class='chk'>확인 필요</span>";
    } else if (S.fork === "ann") {
      var ratio = sf / (WELL.base.monthly * 12 * WELL.base.payTerm);   // 기준계약 대비
      var mo = WELL.annuityMonthly * (sf / 125910.13);                  // 설계서 기준점에 비례
      $("#forkLead").innerHTML = "적립금을 <b>종신연금</b>으로 바꾸면 죽을 때까지 매달 나옵니다. 얼마를 오래 살든 끊기지 않습니다.";
      stat(host, "매달 받는 돈", U2(mo), krw(mo));
      stat(host, "100세까지 총 수령", U(mo * 12 * (100 - WELL.annuityStart)), krw(mo * 12 * (100 - WELL.annuityStart)));
      stat(host, "보증지급", WELL.annuityGuarantee + "년", "일찍 사망해도 그만큼은 지급");
      $("#forkNote").innerHTML = "설계서의 <b>만 " + WELL.annuityStart + "세 개시 · " + WELL.annuityGuarantee +
        "년 보증지급</b> 예시($" + WELL.annuityMonthly + "/월)를 적립금에 비례해 환산한 값입니다. " +
        "개시 나이는 <b>만 " + WELL.startAgeMin + "세 이후 언제든</b> 고를 수 있고, 늦게 시작할수록 월 수령액이 커집니다. " +
        "연금으로 전환하면 <b>사망보험금은 줄거나 종료</b>됩니다. <span class='chk'>확인 필요</span>";
    } else {
      $("#forkLead").innerHTML = "한 번도 꺼내지 않고 <b>그대로 남기는</b> 경우입니다.";
      var noDraw = sim(0).rows;
      var i80 = Math.max(0, Math.min(80 - S.start, noDraw.length - 1));
      stat(host, (S.start + i80) + "세 사망 시", U(Math.max(death(), noDraw[i80].fund)), "사망보험금과 적립금 중 큰 쪽");
      stat(host, "100세 적립금", U(noDraw[noDraw.length - 1].fund), krw(noDraw[noDraw.length - 1].fund));
      stat(host, "낸 돈 대비", pct(noDraw[noDraw.length - 1].fund / p * 100, 0), "환급률");
      $("#forkNote").innerHTML = "실제 사망 시 지급액은 <b>사망보험금과 적립금 중 큰 쪽</b>이 되는 구조가 일반적이나 상품마다 다릅니다. " +
        "<b>상속세·증여세가 면제되는 것은 아닙니다.</b> 계약자·피보험자·수익자를 어떻게 두느냐에 따라 결과가 크게 달라집니다. <span class='chk'>확인 필요</span>";
    }
  }

  /* ── 남기기 (상속종신) ────────────────────────────────────── */
  function multipleAt(a) {
    var t = LEGACY.multiple, ks = Object.keys(t).map(Number).sort(function (x, y) { return x - y; });
    if (a <= ks[0]) return t[ks[0]];
    if (a >= ks[ks.length - 1]) return t[ks[ks.length - 1]];
    for (var i = 1; i < ks.length; i++) if (a <= ks[i]) {
      var lo = ks[i - 1], hi = ks[i];
      return t[lo] + (t[hi] - t[lo]) * ((a - lo) / (hi - lo));
    }
    return t[ks[0]];
  }
  function legacy() {
    $("#lgAgeOut").textContent = S.lgAge + "세";
    $("#lgPremOut").innerHTML = U(S.lgPrem) + " <small>≈ " + krw(S.lgPrem) + "</small>";
    var mult = multipleAt(S.lgAge), face = S.lgPrem * mult, f20 = S.lgPrem * LEGACY.refund[20] / 100;
    var host = $("#lgStats"); host.innerHTML = "";
    stat(host, "확정 사망보험금", U(face), krw(face));
    stat(host, "낸 돈의", mult.toFixed(1) + "배", "가입 후 20년 확정");
    stat(host, "20년 뒤 해약하면", U(f20), "환급률 " + pct(LEGACY.refund[20], 0));
    $("#lgNote").innerHTML = label(LEGACY) + " · " + LEGACY.baseNote + " 기준. " +
      "사망배수는 40세 6.1배 / 50세 4.5배 / 60세 3.0배이고 그 사이 나이는 보간했습니다. " +
      "<b>가입 초기에 해약하면 낸 돈보다 적게 돌려받습니다</b> (1년 " + LEGACY.refund[1] + "%, 3년 " +
      LEGACY.refund[3] + "%). 심사 결과에 따라 가입이 제한될 수 있습니다.";
  }

  /* ── 혜택 카드 ────────────────────────────────────────────── */
  var BENS = [
    { t: "세금 없이 (비과세)", d: "10년 이상 유지 등 세법상 요건을 채우면 보험차익에 세금이 붙지 않습니다.",
      c: "요건을 하나라도 못 채우면 과세됩니다. 세법은 개정될 수 있습니다." },
    { t: "건보료 걱정 없이", d: "비과세 요건을 충족한 보험차익은 금융소득으로 잡히지 않아, 건강보험료 산정 소득에서 빠집니다.",
      c: "건강보험료 부과 기준은 제도 변경에 따라 달라질 수 있습니다." },
    { t: "달러로 나눠서", d: "원화에만 몰려 있던 자산을 달러로 나눕니다. 받을 때 환율이 올라 있으면 그만큼 더해집니다.",
      c: "반대로 환율이 내리면 원화 환산 금액이 줄어듭니다. 환위험은 계약자가 부담합니다." }
  ];
  BENS.forEach(function (b) {
    var el = document.createElement("button");
    el.type = "button"; el.className = "ben"; el.setAttribute("aria-expanded", "false");
    el.innerHTML = "<span class='ben__t serif'>" + b.t + "</span><span class='ben__d'>" + b.d +
      "</span><span class='ben__c'>※ " + b.c + "</span>";
    el.addEventListener("click", function () {
      var on = el.classList.toggle("on");
      el.setAttribute("aria-expanded", on ? "true" : "false");
    });
    $("#bens").appendChild(el);
  });

  /* ── 링크 공유 ────────────────────────────────────────────── */
  function saveUrl() {
    var q = "a=" + S.age + "&p=" + S.prem + "&t=" + S.term + "&s=" + S.start + "&d=" + S.drawPct;
    history.replaceState(null, "", location.pathname + "#" + q);
    lastHash = location.hash;          // 내가 쓴 해시는 hashchange 로 다시 읽지 않는다
  }
  function loadUrl() {
    var h = location.hash.slice(1); if (!h) return false;
    var o = {}; h.split("&").forEach(function (kv) { var x = kv.split("="); o[x[0]] = +x[1]; });
    if (!o.a) return false;
    S.age = o.a; S.prem = o.p || S.prem; S.term = o.t || S.term;
    S.start = o.s || S.start; S.drawPct = o.d != null ? o.d : S.drawPct;
    $("#age").value = S.age; $("#prem").value = S.prem; $("#draw").value = S.drawPct;
    return true;
  }
  $("#copyBtn").addEventListener("click", function () {
    saveUrl();
    var url = location.href;
    var done = function () { $("#copyMsg").textContent = "복사했습니다. 카톡에 붙여넣어 보내시면 됩니다."; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(fail);
    else fail();
    function fail() { $("#copyMsg").textContent = "주소창의 링크를 복사해 주세요 → " + url; }
  });
  $("#resetBtn").addEventListener("click", function () {
    location.hash = ""; location.reload();
  });

  /* ── 연락 ─────────────────────────────────────────────────── */
  function summary() {
    return "[마르지 않는 우물]\n" + S.age + "세 · 월 $" + n(S.prem) + " · " + S.term + "년납 · " +
      S.start + "세부터 인출\n원금 안 줄이는 금액: 매달 $" + n(safeDraw()) + " (약 " + krw(safeDraw()) + ")\n" +
      S.start + "세 적립금 $" + n(startFund()) + "\n조건 링크: " + location.href;
  }
  function sms() {
    location.href = "sms:" + CONFIG.tel.replace(/[^0-9+]/g, "") + "?&body=" +
      encodeURIComponent(summary() + "\n\n위 조건으로 상담 부탁드립니다.");
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
    var text = "[상담 신청]\n성함: " + name + "\n연락처: " + phone +
      "\n통화 가능: " + $("#fTime").value + "\n문의: " + ($("#fMemo").value.trim() || "-") + "\n\n" + summary();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        say("신청 내용을 <b>클립보드에 복사</b>했습니다. 카카오톡 상담창에 붙여넣어 보내주시면 그대로 접수됩니다.", true);
        window.open(CONFIG.kakaoUrl, "_blank", "noopener");
      }).catch(function () { say("아래 내용을 복사해 보내주세요.<br><br>" + text.replace(/\n/g, "<br>"), true); });
    } else say("아래 내용을 복사해 보내주세요.<br><br>" + text.replace(/\n/g, "<br>"), true);
  });

  /* ── 입력 배선 ────────────────────────────────────────────── */
  $("#age").addEventListener("input", function () { S.age = +this.value; run(); });
  $("#prem").addEventListener("input", function () { S.prem = +this.value; run(); });
  $("#draw").addEventListener("input", function () { S.drawPct = +this.value; run(); });
  $("#lgAge").addEventListener("input", function () { S.lgAge = +this.value; legacy(); paintRange(this); });
  $("#lgPrem").addEventListener("input", function () { S.lgPrem = +this.value; legacy(); paintRange(this); });

  /* ── 등장 ─────────────────────────────────────────────────── */
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .05 });
    $$(".rv").forEach(function (x) { io.observe(x); });
  } else $$(".rv").forEach(function (x) { x.classList.add("in"); });

  if (loadUrl()) $("#fromLink").hidden = false;
  run();

  /* 같은 문서 안에서 해시만 바뀌면 스크립트가 다시 돌지 않는다.
     뒤로가기·앞으로가기와 "링크를 이미 열려 있는 탭에 붙여넣는" 경우까지 받아준다. */
  window.addEventListener("hashchange", function () {
    if (location.hash === lastHash) return;
    lastHash = location.hash;
    if (loadUrl()) { $("#fromLink").hidden = false; run(); }
  });
})();
