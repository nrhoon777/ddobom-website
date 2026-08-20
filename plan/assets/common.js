/* =====================================================================
   공통 UI — 포맷·리빌·뒤로가기·특장점·차트·상담폼
===================================================================== */
var UI = (function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 숫자 포맷 ─────────────────────────────────────────────── */
  function n(v) { return Math.round(v).toLocaleString("ko-KR"); }
  function krw(v) {
    v = Math.round(v);
    var sign = v < 0 ? "-" : ""; v = Math.abs(v);
    if (v >= 100000000) {
      var eok = Math.floor(v / 100000000), man = Math.round((v % 100000000) / 10000);
      return sign + eok + "억" + (man ? " " + n(man) + "만" : "") + "원";
    }
    if (v >= 10000) return sign + n(v / 10000) + "만원";
    return sign + n(v) + "원";
  }
  function usd(v) { return "$" + n(v); }
  function money(p, v) { return p && p.currency === "USD" ? usd(v) : krw(v); }
  function moneySub(p, v) { return p && p.currency === "USD" ? "약 " + krw(v * CONFIG.fxDefault) : ""; }
  function pct(v, d) { return (Math.round(v * Math.pow(10, d || 1)) / Math.pow(10, d || 1)).toLocaleString("ko-KR") + "%"; }

  /* ── 스크롤 진행선 · 등장 애니메이션 ───────────────────────── */
  function boot() {
    var fill = $("#scrollFill");
    if (fill) {
      var onScroll = function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        fill.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
      };
      window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.06 });
      $$(".rv").forEach(function (el) { io.observe(el); });
    } else $$(".rv").forEach(function (el) { el.classList.add("is-in"); });

    wireBack(); wireContact(); renderBenefits();
    $$(".rng").forEach(paintRange);
    document.addEventListener("input", function (e) { if (e.target.classList.contains("rng")) paintRange(e.target); });
  }

  function paintRange(el) {
    el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min)) * 100 + "%");
  }

  /* ── 뒤로가기 ──────────────────────────────────────────────── */
  function wireBack() {
    $$("[data-back]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        var sameSite = document.referrer && document.referrer.indexOf(location.origin) === 0;
        if (sameSite && history.length > 1) history.back();
        else location.href = "index.html";
      });
    });
  }

  /* ── 특장점 카드 ───────────────────────────────────────────── */
  function renderBenefits() {
    var host = $("#benefits"); if (!host || typeof BENEFITS === "undefined") return;
    var only = (host.getAttribute("data-keys") || "").split(",").filter(Boolean);
    BENEFITS.filter(function (b) { return !only.length || only.indexOf(b.key) >= 0; })
      .forEach(function (b) {
        var el = document.createElement("button");
        el.type = "button"; el.className = "bene"; el.setAttribute("aria-expanded", "false");
        el.innerHTML =
          '<span class="bene__ico" aria-hidden="true">' + b.icon + "</span>" +
          '<span class="bene__body">' +
            '<span class="bene__t">' + b.title + (b.code ? ' <span class="bene__code">' + b.code + "</span>" : "") +
              (b.confirmed ? "" : ' <span class="bene__chk">확인 필요</span>') + "</span>" +
            '<span class="bene__d">' + b.desc + "</span>" +
            '<span class="bene__c">※ ' + b.caution + "</span>" +
          "</span>";
        el.addEventListener("click", function () {
          var open = el.classList.toggle("is-open");
          el.setAttribute("aria-expanded", open ? "true" : "false");
        });
        host.appendChild(el);
      });
  }

  /* ── 범용 선 그래프 ────────────────────────────────────────────
     draw(svg, { series:[{pts:[{x,y}], cls}], marks:[{x,label}],
                 dots:[{x,y,label}], xSuffix, yFmt })              */
  function draw(svg, o) {
    $$("path,line,text,circle,rect", svg).forEach(function (e) { e.remove(); });
    var W = 720, H = o.h || 320, P = { t: 26, r: 20, b: 40, l: o.l || 64 };
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var xs = [], ys = [];
    o.series.forEach(function (s) { s.pts.forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y1 = Math.max.apply(null, ys) * 1.14, y0 = 0;
    if (x1 === x0) x1 = x0 + 1;
    var X = function (v) { return P.l + ((v - x0) / (x1 - x0)) * iw; };
    var Y = function (v) { return P.t + ih - ((v - y0) / (y1 - y0)) * ih; };
    var ns = "http://www.w3.org/2000/svg";
    function el(tag, a, txt) {
      var e = document.createElementNS(ns, tag);
      for (var k in a) e.setAttribute(k, a[k]);
      if (txt != null) e.textContent = txt;
      svg.appendChild(e); return e;
    }
    var step = Math.pow(10, Math.floor(Math.log(y1 / 4) / Math.LN10));
    step = Math.max(step, Math.ceil((y1 / 4) / step) * step);
    for (var v = 0; v <= y1; v += step) {
      el("line", { class: "grid", x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v) });
      el("text", { class: "axis", x: P.l - 8, y: Y(v) + 4, "text-anchor": "end" }, o.yFmt ? o.yFmt(v) : n(v));
    }
    o.series.forEach(function (s) {
      var d = s.pts.map(function (p, i) { return (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1); }).join(" ");
      if (s.area) el("path", { class: "areaF", d: d + " L" + X(s.pts[s.pts.length - 1].x) + " " + (P.t + ih) + " L" + X(s.pts[0].x) + " " + (P.t + ih) + " Z" });
      el("path", { class: s.cls, d: d });
    });
    var span = x1 - x0, tick = span > 30 ? 10 : span > 12 ? 5 : span > 6 ? 2 : 1;
    for (var x = Math.ceil(x0); x <= x1; x++) {
      if ((x - Math.ceil(x0)) % tick) continue;
      el("text", { class: "axis", x: X(x), y: H - 14, "text-anchor": "middle" }, x + (o.xSuffix || "년"));
    }
    (o.marks || []).forEach(function (m) {
      el("line", { class: "mark", x1: X(m.x), x2: X(m.x), y1: P.t, y2: P.t + ih });
      el("text", { class: "markT", x: X(m.x), y: P.t - 8, "text-anchor": m.anchor || "middle" }, m.label);
    });
    (o.dots || []).forEach(function (p) {
      el("circle", { cx: X(p.x), cy: Y(p.y), r: 5, fill: "#070d18", stroke: p.color || "#5ad2c2", "stroke-width": 2.4 });
      if (p.label) el("text", { class: "markT", x: X(p.x), y: Y(p.y) - 13, "text-anchor": "middle" }, p.label);
    });
  }

  /* ── 숫자 카운트업 ─────────────────────────────────────────── */
  function count(el, to, fmt) {
    var from = +el.getAttribute("data-v") || 0;
    el.setAttribute("data-v", to);
    if (reduce || Math.abs(to - from) < 1) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), dur = 620;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ── 상담 연결 ─────────────────────────────────────────────── */
  var summaryFn = null;
  function setSummary(fn) { summaryFn = fn; }

  function wireContact() {
    var k = $("#kakaoBtn"); if (k) k.href = CONFIG.kakaoUrl;
    var t = $("#telWay");
    if (t) { t.href = "tel:" + CONFIG.tel.replace(/[^0-9+]/g, ""); var tt = $("#telTxt"); if (tt) tt.textContent = "전화 상담 " + CONFIG.tel; }
    var f = $("#ftrContact"); if (f) f.textContent = CONFIG.consultant + " · " + CONFIG.tel;

    var form = $("#leadForm"); if (!form) return;
    var msg = $("#formMsg");
    function say(html, ok) {
      msg.hidden = false;
      msg.className = "form__msg " + (ok ? "is-ok" : "is-err");
      msg.innerHTML = html;
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = {
        name: $("#fName").value.trim(),
        phone: $("#fPhone").value.trim(),
        time: $("#fTime") ? $("#fTime").value : "",
        way: $("#fWay") ? $("#fWay").value : "",
        memo: $("#fMemo") ? $("#fMemo").value.trim() : ""
      };
      if (!d.name) { say("성함을 입력해 주세요.", false); $("#fName").focus(); return; }
      if (!/^01[016-9][-\s.]?\d{3,4}[-\s.]?\d{4}$/.test(d.phone)) { say("휴대폰 번호를 다시 확인해 주세요.", false); $("#fPhone").focus(); return; }
      if (!$("#fAgree").checked) { say("개인정보 수집·이용 동의가 필요합니다.", false); $("#fAgree").focus(); return; }

      var lines = ["[상담 신청] " + (document.title.split("|")[0] || "").trim(),
        "성함: " + d.name, "연락처: " + d.phone,
        "통화 가능 시간: " + d.time, "선호 방식: " + d.way, "문의: " + (d.memo || "-")];
      if (summaryFn) lines.push("", "--- 계산 조건 ---", summaryFn());
      var text = lines.join("\n");

      if (CONFIG.formEndpoint) {
        fetch(CONFIG.formEndpoint, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ text: text, _subject: "상담 신청 - " + d.name, name: d.name, phone: d.phone, memo: d.memo })
        }).then(function (r) {
          if (!r.ok) throw 0;
          say("신청이 접수되었습니다. <b>" + CONFIG.consultant + "</b>가 곧 연락드리겠습니다.", true);
          form.reset();
        }).catch(function () {
          say("전송에 실패했습니다. 잠시 후 다시 시도하시거나 <b>카카오톡 상담</b>으로 연락 주세요.", false);
        });
        return;
      }
      if (CONFIG.email) {
        location.href = "mailto:" + CONFIG.email +
          "?subject=" + encodeURIComponent("상담 신청 - " + d.name) + "&body=" + encodeURIComponent(text);
        say("메일 앱이 열립니다. 내용이 채워진 메일을 <b>보내기</b>만 누르시면 접수됩니다.", true);
        return;
      }
      var done = function () {
        say("신청 내용을 <b>클립보드에 복사</b>했습니다.<br />카카오톡 상담창에 붙여넣어 보내주시면 그대로 접수됩니다.", true);
        window.open(CONFIG.kakaoUrl, "_blank", "noopener");
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          say("아래 내용을 복사해 카카오톡으로 보내주세요.<br /><br />" + text.replace(/\n/g, "<br />"), true);
        });
      } else say("아래 내용을 복사해 카카오톡으로 보내주세요.<br /><br />" + text.replace(/\n/g, "<br />"), true);
    });
  }

  return {
    $: $, $$: $$, n: n, krw: krw, usd: usd, money: money, moneySub: moneySub, pct: pct,
    boot: boot, draw: draw, count: count, setSummary: setSummary, paintRange: paintRange, reduce: reduce
  };
})();
