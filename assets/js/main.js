/* 또봄 — 1차 초안 인터랙션 스크립트 */
(function () {
  "use strict";

  /* ---------- 히어로 스크롤 축소 (영상이 라임 배경 위 네모로 줄어듦) ---------- */
  var hero = document.querySelector(".hero--full");
  var heroBg = hero && hero.querySelector(".hero__bg");
  var heroInner = hero && hero.querySelector(".hero__inner-full");
  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (hero && heroBg && !reduceMotion) {
    var MAX_INSET = 5;   // vw — 너무 크면 영상이 답답해진다
    var MAX_RADIUS = 26; // px
    var ticking = false;

    var applyHeroShrink = function () {
      ticking = false;
      // 태블릿 이하는 영상/문구가 위아래로 분리된 레이아웃이라 축소 효과를 쓰지 않는다.
      if (window.innerWidth <= 1023) {
        heroBg.style.removeProperty("--i");
        heroBg.style.removeProperty("--r");
        if (heroInner) heroInner.style.removeProperty("--o");
        return;
      }
      var h = hero.offsetHeight || 1;
      // 히어로를 지나간 비율 0~1 (한 화면 내려가면 1)
      var p = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / h));
      heroBg.style.setProperty("--i", (p * MAX_INSET).toFixed(2) + "vw");
      heroBg.style.setProperty("--r", (p * MAX_RADIUS).toFixed(1) + "px");
      // 헤드라인은 영상이 충분히 줄어든 뒤(p≈0.8) 사라지도록 완만하게
      if (heroInner) heroInner.style.setProperty("--o", (1 - Math.min(1, p * 1.25)).toFixed(2));
    };

    var onScroll = function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(applyHeroShrink);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    applyHeroShrink();
  }

  /* ---------- 모바일 네비게이션 토글 ---------- */
  var toggle = document.getElementById("navToggle");
  var gnb = document.getElementById("gnb");

  if (toggle && gnb) {
    toggle.addEventListener("click", function () {
      var isOpen = gnb.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
    });

    /* 메뉴 링크 클릭 시 닫기 (모바일) */
    gnb.addEventListener("click", function (e) {
      if (e.target.tagName === "A" && gnb.classList.contains("is-open")) {
        gnb.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "메뉴 열기");
      }
    });

    /* ESC로 닫기 + 데스크톱 전환 시 초기화 */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && gnb.classList.contains("is-open")) {
        gnb.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1023) gnb.classList.remove("is-open");
    });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 스크롤 리빌 ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      reveals.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              en.target.classList.add("in");
              io.unobserve(en.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
      reveals.forEach(function (el) { io.observe(el); });
    }
  }


  /* ---------- 가로 스크롤 캐러셀 (또봄활동 · 소식) ----------
     스크롤 이벤트에 기대어 버튼을 비활성화하면, 그 이벤트가 오지 않는 환경에서
     '이전' 버튼이 잠겨 되돌아갈 수 없다. 화살표는 항상 눌리게 두고
     끝에서는 아무 일도 일어나지 않도록 둔다. */
  document.querySelectorAll("[data-hscroll]").forEach(function (wrap) {
    var track = wrap.querySelector(".hscroll__track");
    if (!track) return;
    wrap.querySelectorAll(".hscroll__btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var card = track.firstElementChild;
        var step = card ? card.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
        track.scrollBy({ left: step * Number(b.dataset.dir), behavior: "smooth" });
      });
    });

    /* 카드가 전부 보이는 폭(주로 PC)에서는 화살표와 안내가 할 일이 없다.
       판정에 실패하면 화살표가 그대로 보일 뿐이라 안전한 쪽으로 기운다. */
    var syncStatic = function () {
      wrap.classList.toggle("is-static", track.scrollWidth <= track.clientWidth + 4);
    };
    syncStatic();
    window.addEventListener("resize", syncStatic, { passive: true });
    window.addEventListener("load", syncStatic);
  });

  /* ---------- 숫자 카운터 ---------- */
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    /* data-dec="1"이면 소수 첫째 자리까지 세어 올린다 (70.6 / 30.5 / 69.5) */
    var setVal = function (el, v) {
      var d = parseInt(el.dataset.dec || "0", 10);
      var txt = d > 0
        ? v.toFixed(d)
        : Math.round(v).toLocaleString("ko-KR");
      el.textContent = txt + (el.dataset.suffix || "");
    };
    if (reduceMotion || !("IntersectionObserver" in window)) {
      counters.forEach(function (el) { setVal(el, parseFloat(el.dataset.count)); });
    } else {
      var cio = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            cio.unobserve(el);
            var target = parseFloat(el.dataset.count);
            var dur = 1300, t0 = null, done = false;
            var finish = function () { if (!done) { done = true; setVal(el, target); } };
            var step = function (ts) {
              if (done) return;
              if (!t0) t0 = ts;
              var p = Math.min((ts - t0) / dur, 1);
              var eased = 1 - Math.pow(1 - p, 3);
              if (p < 1) { setVal(el, eased * target); requestAnimationFrame(step); }
              else finish();
            };
            requestAnimationFrame(step);
            /* 통계 페이지라 중간값이 남으면 '틀린 수치'가 된다.
               rAF가 멈추더라도 최종값은 반드시 찍히도록 타이머로 못 박는다. */
            setTimeout(finish, dur + 500);
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach(function (el) { cio.observe(el); });
    }
  }
})();
