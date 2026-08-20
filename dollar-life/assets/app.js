/* =====================================================================
   달러 종신·연금 플랜 — 인터랙션 & 시뮬레이션
   또봄 사이트와 독립된 단독 페이지. 외부 라이브러리 없음.
   ▼ 실제 운영 전 CONFIG만 바꾸면 됩니다.
===================================================================== */
(function () {
  "use strict";

  /* ── CONFIG — 여기만 채우면 실서비스 ──────────────────────────── */
  var CONFIG = {
    kakaoUrl: "http://pf.kakao.com/_카카오채널ID/chat", // ★ 카카오톡 채널 상담 링크
    tel: "010-0000-0000",                               // ★ 상담 전화번호
    consultant: "담당 설계사",                            // ★ 표시 이름
    formEndpoint: "",                                   // ★ 폼 수신 URL(Formspree·구글폼·자체 API). 비우면 클립보드 복사 방식으로 동작
    fxDefault: 1380                                     // 기본 환율 가정
  };

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 숫자 포맷 ────────────────────────────────────────────────── */
  function n(v) { return Math.round(v).toLocaleString("ko-KR"); }
  function usd(v) { return "$" + n(v); }
  function krw(v) {
    v = Math.round(v);
    if (v >= 100000000) {
      var eok = v / 100000000;
      return (eok >= 10 ? eok.toFixed(1) : eok.toFixed(2)).replace(/\.0+$/, "") + "억 원";
    }
    if (v >= 10000) return n(v / 10000) + "만 원";
    return n(v) + "원";
  }

  /* ── 스크롤 진행선 · 리빌 ─────────────────────────────────────── */
  var fill = $("#scrollFill");
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    fill.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    $$(".rv").forEach(function (el) { io.observe(el); });
  } else {
    $$(".rv").forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ── 탐색 진행 pill ("계속 눌러보게" 만드는 장치) ──────────────── */
  var STEPS = ["melt", "flip", "fx", "tabs", "sim", "faq", "sens"];
  var seen = Object.create(null);
  var discFill = $("#discFill"), discTxt = $("#discTxt"), disc = $("#disc");

  function discover(key) {
    if (!key || seen[key]) return;
    seen[key] = true;
    var c = Object.keys(seen).length;
    discFill.style.width = (c / STEPS.length) * 100 + "%";
    if (c >= STEPS.length) {
      discTxt.textContent = "다 알아보셨어요 ✨";
      disc.classList.add("is-done");
    } else {
      discTxt.textContent = "알아본 것 " + c + "/" + STEPS.length;
    }
  }
  // data-discover 값을 그룹 키로 환산
  function keyOf(v) {
    if (!v) return "";
    if (v.indexOf("flip") === 0) return "flip";
    if (v.indexOf("tab") === 0) return "tabs";
    return v;
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-discover]");
    if (t) discover(keyOf(t.getAttribute("data-discover")));
  });
  document.addEventListener("input", function (e) {
    var t = e.target.closest("[data-discover]");
    if (t) discover(keyOf(t.getAttribute("data-discover")));
  });

  /* ── 4. 물가 슬라이더 ─────────────────────────────────────────── */
  (function () {
    var y = $("#meltYear"), i = $("#meltInf");
    if (!y) return;
    function paint(el) { el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min)) * 100 + "%"); }
    function run() {
      paint(y); paint(i);
      var yr = +y.value, inf = +i.value;
      var real = 100000000 / Math.pow(1 + inf / 100, yr);
      var pct = Math.round((real / 100000000) * 100);
      $("#meltYearOut").textContent = yr + "년 뒤";
      $("#meltInfOut").textContent = inf.toFixed(1) + "%";
      $("#meltBig").textContent = krw(real);
      $("#meltSub").innerHTML = yr + "년 뒤 1억 원으로 살 수 있는 것은 지금의 <b>" + pct +
        "%</b>. 그동안 <b>" + krw(100000000 - real) + "</b>어치가 조용히 사라집니다.";
      var bar = $("#meltBarKrw");
      bar.style.width = Math.max(pct, 8) + "%";
      bar.textContent = krw(real).replace(" 원", "");
    }
    y.addEventListener("input", run);
    i.addEventListener("input", run);
    run();
  })();

  /* ── 5-a. 카드 뒤집기 ─────────────────────────────────────────── */
  $$(".flip").forEach(function (b) {
    b.addEventListener("click", function () {
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
    });
  });

  /* ── 5-b. 환율 차트 ───────────────────────────────────────────── */
  var FX = [
    [1995, 771], [1996, 805], [1997, 951], [1998, 1401], [1999, 1189], [2000, 1131],
    [2001, 1291], [2002, 1251], [2003, 1192], [2004, 1145], [2005, 1024], [2006, 955],
    [2007, 929], [2008, 1102], [2009, 1276], [2010, 1156], [2011, 1108], [2012, 1127],
    [2013, 1095], [2014, 1053], [2015, 1131], [2016, 1160], [2017, 1130], [2018, 1100],
    [2019, 1166], [2020, 1180], [2021, 1144], [2022, 1292], [2023, 1305], [2024, 1364], [2025, 1440]
  ];
  var FX_EVENTS = [
    { y: 1998, t: "외환위기", d: "1997년 말 외환위기. 연평균 환율이 1년 만에 800원대에서 1,400원대로 뛰었습니다. 원화 자산만 가진 사람에겐 자산 가치가 사라진 해였고, 달러를 가진 사람에겐 반대였습니다." },
    { y: 2009, t: "금융위기", d: "글로벌 금융위기 직후. 주식·부동산이 동시에 흔들리는 동안 원/달러는 1,270원대까지 올랐습니다. 위기 때 달러가 오르는 패턴이 반복됐습니다." },
    { y: 2020, t: "팬데믹", d: "코로나 초기 시장 급락 국면에서도 달러 수요가 몰렸습니다. 이후 유동성 확대로 되돌림이 있었던 점도 함께 봐야 합니다." },
    { y: 2024, t: "고금리·강달러", d: "미국 금리 인상 사이클과 강달러가 이어지며 환율이 다시 1,300원대 후반으로 올라섰습니다. 다만 환율은 언제든 반대로 움직일 수 있습니다." }
  ];

  (function () {
    var svg = $("#fxChart");
    if (!svg) return;
    var W = 720, H = 300, P = { t: 18, r: 16, b: 34, l: 46 };
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    var lo = 600, hi = 1550;
    var X = function (yr) { return P.l + ((yr - FX[0][0]) / (FX[FX.length - 1][0] - FX[0][0])) * iw; };
    var Y = function (v) { return P.t + ih - ((v - lo) / (hi - lo)) * ih; };
    var ns = "http://www.w3.org/2000/svg";
    function el(tag, attrs, txt) {
      var e = document.createElementNS(ns, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (txt != null) e.textContent = txt;
      svg.appendChild(e); return e;
    }
    [600, 900, 1200, 1500].forEach(function (v) {
      el("line", { class: "grid", x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v) });
      el("text", { class: "axis", x: P.l - 8, y: Y(v) + 4, "text-anchor": "end" }, n(v));
    });
    var d = FX.map(function (p, k) { return (k ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join(" ");
    el("path", { class: "area", d: d + " L" + X(FX[FX.length - 1][0]) + " " + (P.t + ih) + " L" + X(FX[0][0]) + " " + (P.t + ih) + " Z" });
    el("path", { class: "line", d: d });
    FX.forEach(function (p) {
      if (p[0] % 5 === 0) el("text", { class: "axis", x: X(p[0]), y: H - 12, "text-anchor": "middle" }, p[0]);
    });
    var dots = {};
    FX_EVENTS.forEach(function (ev) {
      var pt = FX.filter(function (p) { return p[0] === ev.y; })[0];
      if (!pt) return;
      el("line", { class: "evt", x1: X(pt[0]), x2: X(pt[0]), y1: P.t, y2: P.t + ih });
      el("text", { class: "evtT", x: X(pt[0]), y: P.t - 4, "text-anchor": "middle" }, ev.t);
      dots[ev.y] = el("circle", { class: "dot", cx: X(pt[0]), cy: Y(pt[1]), r: 4.5 });
    });

    var hits = $("#fxHits"), read = $("#fxRead");
    FX_EVENTS.forEach(function (ev) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "fx__hit"; b.textContent = ev.y + " " + ev.t;
      b.setAttribute("data-discover", "fx");
      b.addEventListener("click", function () {
        $$(".fx__hit", hits).forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on");
        Object.keys(dots).forEach(function (k) { dots[k].setAttribute("r", 4.5); });
        dots[ev.y].setAttribute("r", 8);
        read.innerHTML = "<b>" + ev.y + " · " + ev.t + "</b><br />" + ev.d;
      });
      hits.appendChild(b);
    });
  })();

  /* ── 6. 탭 + 타임라인 ─────────────────────────────────────────── */
  (function () {
    var tabs = $$(".tab"), pts = $$(".tl__pt"), done = $("#tlDone");
    var MAP = [[0], [1, 2], [3]]; // 탭별로 밝히는 타임라인 지점
    function select(i) {
      tabs.forEach(function (t, k) {
        t.setAttribute("aria-selected", k === i ? "true" : "false");
        $("#" + t.getAttribute("aria-controls")).hidden = k !== i;
      });
      var on = MAP[i];
      pts.forEach(function (p, k) { p.classList.toggle("is-on", on.indexOf(k) >= 0 || k < on[0]); });
      done.style.width = ((on[on.length - 1] + 0.5) / pts.length) * 100 + "%";
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i); });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var k = (i + d + tabs.length) % tabs.length;
        tabs[k].focus(); select(k);
      });
    });
    select(0);
  })();

  /* =====================================================================
     7. 시뮬레이션 엔진
     ※ 모두 "예시 가정"이다. 실제 상품 요율이 아니다.
        - 요율: 사망보험금 $1,000당 월 보험료 (표준체 예시)
        - 적립: 경과 연차별 적립 비율 × 월 복리
        - 연금: 20년 확정 지급 기준
  ===================================================================== */
  var TERM_F = { 10: 1.72, 15: 1.28, 20: 1.0 };     // 20년납 대비 보험료 배수
  var CREDIT = function (year) {                     // 경과 연차별 적립 비율
    if (year <= 2) return 0.35;
    if (year <= 5) return 0.62;
    if (year <= 10) return 0.75;
    return 0.80;
  };

  function rate1000(age, sex, term) {
    var base = 1.30 * Math.exp(0.055 * (age - 25));  // 남성 20년납 기준
    if (sex === "F") base *= 0.82;
    return base * (TERM_F[term] || 1);
  }

  // 월 단위 적립금 시뮬레이션 → 연차별 배열 반환
  function project(premUsd, term, years, annualRate) {
    var r = annualRate / 100 / 12, fund = 0, paid = 0;
    var out = [{ y: 0, fund: 0, paid: 0 }];
    for (var m = 1; m <= years * 12; m++) {
      var yr = Math.ceil(m / 12);
      fund *= (1 + r);
      if (yr <= term) { fund += premUsd * CREDIT(yr); paid += premUsd; }
      if (m % 12 === 0) out.push({ y: yr, fund: fund, paid: paid });
    }
    return out;
  }

  function annuity(fund, annualRate, months) {
    var r = annualRate / 100 / 12;
    if (r <= 0) return fund / months;
    return fund * r / (1 - Math.pow(1 + r, -months));
  }

  var S = { age: 40, sex: "M", goals: [], prem: 30, term: 20, start: 65, fx: CONFIG.fxDefault, rate: 3.0 };
  var R = null;

  function compute() {
    var premUsd = (S.prem * 10000) / CONFIG.fxDefault;
    var face = (premUsd / rate1000(S.age, S.sex, S.term)) * 1000;
    var years = Math.max(S.start - S.age, S.term);
    var series = project(premUsd, S.term, years, S.rate);
    var last = series[series.length - 1];
    var pen = annuity(last.fund, S.rate, 240);
    // 손익분기(적립금이 낸 돈을 넘어서는 시점)는 연금 개시 이후까지 넓게 본다
    var long = project(premUsd, S.term, Math.max(years, 45), S.rate), be = null;
    for (var i = 1; i < long.length; i++) {
      if (long[i].fund >= long[i].paid) { be = long[i].y; break; }
    }
    R = { premUsd: premUsd, face: face, years: years, series: series, fund: last.fund, paid: last.paid, pen: pen, be: be };
    return R;
  }

  /* ── 위저드 ───────────────────────────────────────────────────── */
  (function () {
    var box = $("#simBox"); if (!box) return;
    var steps = $$(".step", box), segs = $$(".sim__seg", box);
    var cur = 1;

    function paintRange(el) { el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min)) * 100 + "%"); }

    function show(k) {
      cur = k;
      steps.forEach(function (s) { s.hidden = +s.getAttribute("data-step") !== k; });
      segs.forEach(function (s, i) { s.classList.toggle("is-done", i < k); });
      $("#simNo").textContent = k + " / 5";
      $("#simLive").textContent = k + "번째 질문입니다.";
      if (k === 5) startOptions();
    }

    // step1 — 나이 · 성별
    var age = $("#age");
    function ageRun() { paintRange(age); S.age = +age.value; $("#ageOut").textContent = age.value; }
    age.addEventListener("input", ageRun); ageRun();
    $$("[data-sex]").forEach(function (b) {
      b.addEventListener("click", function () {
        S.sex = b.getAttribute("data-sex");
        $$("[data-sex]").forEach(function (x) {
          var on = x === b;
          x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on ? "true" : "false");
        });
      });
    });

    // step2 — 목적(다중)
    $$("[data-goal]").forEach(function (b) {
      b.addEventListener("click", function () {
        var g = b.getAttribute("data-goal"), i = S.goals.indexOf(g);
        if (i >= 0) S.goals.splice(i, 1); else S.goals.push(g);
        b.setAttribute("aria-pressed", i >= 0 ? "false" : "true");
      });
    });

    // step3 — 납입액
    var prem = $("#prem");
    function premRun() {
      paintRange(prem); S.prem = +prem.value;
      $("#premOut").textContent = S.prem >= 100 ? (S.prem / 100).toFixed(S.prem % 100 ? 2 : 0).replace(/\.?0+$/, "") + "백만" : S.prem + "만";
      $("#premUsdOut").textContent = usd((S.prem * 10000) / CONFIG.fxDefault);
      $$("#premChips .chip").forEach(function (c) { c.classList.toggle("is-on", +c.getAttribute("data-prem") === S.prem); });
    }
    prem.addEventListener("input", premRun);
    $$("#premChips .chip").forEach(function (c) {
      c.addEventListener("click", function () { prem.value = c.getAttribute("data-prem"); premRun(); });
    });
    premRun();

    // step4 — 납입기간
    $$("[data-term]").forEach(function (b) {
      b.addEventListener("click", function () {
        S.term = +b.getAttribute("data-term");
        $$("[data-term]").forEach(function (x) {
          var on = x === b;
          x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on ? "true" : "false");
        });
      });
    });

    // step5 — 연금 개시(납입 완료 이후만 선택 가능)
    function startOptions() {
      var min = S.age + S.term, valid = [];
      $$("[data-start]").forEach(function (b) {
        var v = +b.getAttribute("data-start"), ok = v >= min;
        b.disabled = !ok;
        b.style.opacity = ok ? "" : ".38";
        b.setAttribute("aria-disabled", ok ? "false" : "true");
        if (ok) valid.push(b);
      });
      var hint = $("#startHint");
      if (!valid.length) {
        S.start = min;
        hint.innerHTML = "납입이 <b>" + min + "세</b>에 끝나므로, 완납 직후인 <b>" + min + "세</b>부터 받는 것으로 계산합니다.";
      } else {
        if (!valid.some(function (b) { return +b.getAttribute("data-start") === S.start; })) {
          S.start = +valid[0].getAttribute("data-start");
        }
        hint.innerHTML = "납입은 <b>" + min + "세</b>에 끝납니다. 그 이후 시점만 고를 수 있어요.";
      }
      $$("[data-start]").forEach(function (b) {
        var on = +b.getAttribute("data-start") === S.start && !b.disabled;
        b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    $$("[data-start]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.disabled) return;
        S.start = +b.getAttribute("data-start");
        startOptions();
      });
    });

    $$("[data-next]", box).forEach(function (b) { b.addEventListener("click", function () { show(cur + 1); box.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }); }); });
    $$("[data-prev]", box).forEach(function (b) { b.addEventListener("click", function () { show(cur - 1); }); });

    // 결과 계산
    var LINES = ["가정을 적용해 계산하는 중…", "적립금 곡선을 그리는 중…", "연금 전환액을 계산하는 중…"];
    $("[data-calc]").addEventListener("click", function () {
      steps.forEach(function (s) { s.hidden = true; });
      var c = $("#calcing"); c.hidden = false;
      var i = 0, t = setInterval(function () { $("#calcingT").textContent = LINES[++i % LINES.length]; }, 480);
      setTimeout(function () {
        clearInterval(t); c.hidden = true;
        segs.forEach(function (s) { s.classList.add("is-done"); });
        $("#simNo").textContent = "완료";
        compute(); render();
        var res = $("#res"); res.hidden = false;
        res.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
        res.focus({ preventScroll: true });
        dockToContact();
      }, reduce ? 60 : 1350);
    });

    $("#redo").addEventListener("click", function () {
      $("#res").hidden = true;
      show(1);
      box.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    });

    show(1);
  })();

  /* ── 8. 결과 렌더 ─────────────────────────────────────────────── */
  var GOAL_TXT = {
    pension: "노후 달러 연금",
    family: "가족 사망보장",
    legacy: "상속·증여 재원",
    hedge: "원화 자산 분산"
  };

  function render() {
    if (!R) return;
    var sexT = S.sex === "M" ? "남성" : "여성";
    $("#resTitle").textContent = S.age + "세 " + sexT + " · 월 " + S.prem + "만원 · " + S.term + "년납";
    var g = S.goals.map(function (k) { return GOAL_TXT[k]; }).filter(Boolean);
    $("#resSub").innerHTML = (g.length ? "선택하신 목적: <b>" + g.join(" · ") + "</b><br />" : "") +
      "아래 숫자는 <b>가정에 근거한 예시</b>입니다. 실제 계약 조건은 심사 결과에 따라 달라집니다.";

    $("#kFace").textContent = usd(R.face);
    $("#kFaceKrw").textContent = "원화 환산 약 " + krw(R.face * S.fx);
    $("#kPenK").textContent = S.start + "세부터 월 예상 연금";
    $("#kPen").textContent = usd(R.pen);
    $("#kPenKrw").textContent = "원화 환산 약 " + krw(R.pen * S.fx) + " / 월";
    $("#kPrem").textContent = usd(R.premUsd);
    $("#kPremKrw").textContent = "월 " + n(S.prem * 10000) + "원";
    $("#kPaid").textContent = usd(R.paid);
    $("#kPaidSub").textContent = S.term + "년 × 12개월";
    $("#kFund").textContent = usd(R.fund);
    $("#kFundSub").textContent = "낸 돈의 " + Math.round((R.fund / R.paid) * 100) + "%";
    $("#kBe").textContent = R.be ? R.be + "년차" : "장기 미도달";
    $("#kBe").parentNode.querySelector(".kpi__s").textContent =
      R.be ? "만 " + (S.age + R.be) + "세 무렵 · 해지환급금 기준 예시" : "가정 이율에서는 도달하지 않습니다";

    $("#assumeTxt").innerHTML = "<b>시뮬레이션 가정:</b> 표준체 기준 예시 요율 / 적립이율 연 " + S.rate.toFixed(1) +
      "%(월 복리) / 사업비는 경과 연차별 차감으로 단순화 / 연금은 20년 확정 지급 / 환율 " + n(S.fx) +
      "원 가정. 실제 상품과 다를 수 있습니다.";

    $("#simPick").innerHTML = "상담 신청 시 <b>" + S.age + "세 " + sexT + " · 월 " + S.prem + "만원 · " +
      S.term + "년납 · " + S.start + "세 개시</b> 조건이 함께 전달됩니다.";

    drawResult();
  }

  function drawResult() {
    var svg = $("#rcChart");
    $$("g,path,line,text,circle", svg).forEach(function (e) { e.remove(); });
    var W = 720, H = 320, P = { t: 20, r: 18, b: 38, l: 58 };
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    var s = R.series, maxY = s[s.length - 1].y || 1;
    var maxV = Math.max(R.fund, R.paid) * 1.12;
    var X = function (y) { return P.l + (y / maxY) * iw; };
    var Y = function (v) { return P.t + ih - (v / maxV) * ih; };
    var ns = "http://www.w3.org/2000/svg";
    function el(tag, a, txt) {
      var e = document.createElementNS(ns, tag);
      for (var k in a) e.setAttribute(k, a[k]);
      if (txt != null) e.textContent = txt;
      svg.appendChild(e); return e;
    }
    var stepV = Math.pow(10, Math.floor(Math.log(maxV / 4) / Math.LN10));
    stepV = Math.ceil((maxV / 4) / stepV) * stepV;
    for (var v = 0; v <= maxV; v += stepV) {
      el("line", { class: "grid", x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v) });
      el("text", { class: "axis", x: P.l - 8, y: Y(v) + 4, "text-anchor": "end" }, v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + v);
    }
    var dp = "", df = "";
    s.forEach(function (p, i) {
      dp += (i ? "L" : "M") + X(p.y).toFixed(1) + " " + Y(p.paid).toFixed(1);
      df += (i ? "L" : "M") + X(p.y).toFixed(1) + " " + Y(p.fund).toFixed(1);
    });
    el("path", { class: "fundA", d: df + " L" + X(maxY) + " " + (P.t + ih) + " L" + P.l + " " + (P.t + ih) + " Z" });
    el("path", { class: "paid", d: dp });
    el("path", { class: "fund", d: df });

    var tick = maxY > 30 ? 10 : 5;
    for (var y = 0; y <= maxY; y += tick) el("text", { class: "axis", x: X(y), y: H - 14, "text-anchor": "middle" }, y + "년");

    // 완납 시점
    if (S.term <= maxY) {
      el("line", { class: "mark", x1: X(S.term), x2: X(S.term), y1: P.t, y2: P.t + ih });
      el("text", { class: "markT", x: X(S.term), y: P.t - 6, "text-anchor": "middle" }, "완납 " + S.term + "년");
    }
    // 연금 개시
    el("line", { class: "mark", x1: X(maxY), x2: X(maxY), y1: P.t, y2: P.t + ih });
    el("text", { class: "markT", x: X(maxY) - 4, y: P.t - 6, "text-anchor": "end" }, "연금 개시 " + S.start + "세");
    // 손익분기
    if (R.be) {
      var pt = R.series[R.be];
      if (pt) {
        el("circle", { cx: X(pt.y), cy: Y(pt.fund), r: 5, fill: "#070d18", stroke: "#5ad2c2", "stroke-width": 2.4 });
        el("text", { class: "markT", x: X(pt.y), y: Y(pt.fund) - 12, "text-anchor": "middle" }, "낸 돈 회복 " + pt.y + "년차");
      }
    }
  }

  /* ── 민감도 컨트롤 ────────────────────────────────────────────── */
  (function () {
    var fx = $("#fxRate");
    fx.addEventListener("input", function () {
      fx.style.setProperty("--p", ((fx.value - fx.min) / (fx.max - fx.min)) * 100 + "%");
      S.fx = +fx.value;
      $("#fxRateOut").textContent = n(S.fx) + "원";
      if (R) render();
    });
    fx.style.setProperty("--p", ((fx.value - fx.min) / (fx.max - fx.min)) * 100 + "%");

    $$("#rateChips .chip").forEach(function (c) {
      c.addEventListener("click", function () {
        S.rate = +c.getAttribute("data-rate");
        $$("#rateChips .chip").forEach(function (x) { x.classList.toggle("is-on", x === c); });
        compute(); render();
      });
    });
  })();

  /* ── 9. FAQ ───────────────────────────────────────────────────── */
  $$(".qa__q").forEach(function (b) {
    b.addEventListener("click", function () {
      var qa = b.closest(".qa"), open = qa.classList.toggle("is-open");
      b.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* ── 11. 연락 수단 ────────────────────────────────────────────── */
  (function () {
    var k = $("#kakaoBtn"); if (k) k.href = CONFIG.kakaoUrl;
    var t = $("#telWay");
    if (t) { t.href = "tel:" + CONFIG.tel.replace(/[^0-9+]/g, ""); $("#telTxt").textContent = "전화 상담 " + CONFIG.tel; }
    $("#ftrContact").textContent = CONFIG.consultant + " · " + CONFIG.tel;
  })();

  /* ── 하단 도크 ────────────────────────────────────────────────── */
  function dockToContact() {
    $("#dockT").textContent = "결과가 준비됐어요";
    $("#dockS").textContent = "이 조건 그대로 상담을 받아보세요";
    var b = $("#dockBtn");
    b.textContent = "상담 신청"; b.href = "#contact";
  }

  /* ── 12. 상담 신청 폼 ─────────────────────────────────────────── */
  (function () {
    var form = $("#leadForm"); if (!form) return;
    var msg = $("#formMsg");

    function say(text, ok) {
      msg.hidden = false;
      msg.className = "form__msg " + (ok ? "is-ok" : "is-err");
      msg.innerHTML = text;
    }
    function summary(d) {
      var lines = [
        "[달러 종신·연금 상담 신청]",
        "성함: " + d.name,
        "연락처: " + d.phone,
        "통화 가능 시간: " + d.time,
        "선호 방식: " + d.way,
        "문의: " + (d.memo || "-")
      ];
      if (R) {
        lines.push(
          "--- 시뮬레이션 조건 ---",
          S.age + "세 " + (S.sex === "M" ? "남성" : "여성") + " / 월 " + S.prem + "만원 / " + S.term + "년납 / " + S.start + "세 개시",
          "예시 사망보험금 " + usd(R.face) + " · 예시 월 연금 " + usd(R.pen) + " (이율 " + S.rate + "%, 환율 " + n(S.fx) + "원 가정)"
        );
      }
      return lines.join("\n");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = {
        name: $("#fName").value.trim(),
        phone: $("#fPhone").value.trim(),
        time: $("#fTime").value,
        way: $("#fWay").value,
        memo: $("#fMemo").value.trim()
      };
      if (!d.name) { say("성함을 입력해 주세요.", false); $("#fName").focus(); return; }
      if (!/^01[016-9][-\s.]?\d{3,4}[-\s.]?\d{4}$/.test(d.phone)) { say("휴대폰 번호를 다시 확인해 주세요.", false); $("#fPhone").focus(); return; }
      if (!$("#fAgree").checked) { say("개인정보 수집·이용 동의가 필요합니다.", false); $("#fAgree").focus(); return; }

      var text = summary(d);

      if (CONFIG.formEndpoint) {
        fetch(CONFIG.formEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ text: text, data: d, sim: R ? { age: S.age, sex: S.sex, prem: S.prem, term: S.term, start: S.start } : null })
        }).then(function (r) {
          if (!r.ok) throw new Error("bad status");
          say("신청이 접수되었습니다. <b>" + CONFIG.consultant + "</b>가 곧 연락드리겠습니다.", true);
          form.reset();
        }).catch(function () {
          say("전송에 실패했습니다. 잠시 후 다시 시도하시거나, 위 <b>카카오톡 상담</b>으로 연락 주세요.", false);
        });
        return;
      }

      // 접수 서버가 없을 때 — 정직하게 안내하고 카카오톡으로 넘긴다
      var done = function () {
        say("접수 서버가 아직 연결되지 않아 <b>신청 내용을 클립보드에 복사</b>했습니다.<br />" +
            "카카오톡 상담창에 붙여넣어 보내주시면 그대로 접수됩니다.", true);
        window.open(CONFIG.kakaoUrl, "_blank", "noopener");
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          say("아래 내용을 복사해 카카오톡으로 보내주세요.<br /><br />" + text.replace(/\n/g, "<br />"), true);
        });
      } else {
        say("아래 내용을 복사해 카카오톡으로 보내주세요.<br /><br />" + text.replace(/\n/g, "<br />"), true);
      }
    });
  })();
})();
