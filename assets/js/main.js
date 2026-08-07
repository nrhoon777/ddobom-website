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
      if (window.innerWidth > 767) gnb.classList.remove("is-open");
    });
  }

  /* ---------- 후원 페이지: 금액 선택 칩 ---------- */
  var amountGrid = document.querySelector(".amount-grid");
  var amountInput = document.getElementById("customAmount");
  if (amountGrid) {
    amountGrid.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      amountGrid.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", "false");
      });
      btn.setAttribute("aria-pressed", "true");
      if (amountInput && btn.dataset.amount) {
        amountInput.value = Number(btn.dataset.amount).toLocaleString("ko-KR");
      }
    });
  }

  /* ---------- 후원 폼: 데모 제출 방지 ---------- */
  var donateForm = document.getElementById("donateForm");
  if (donateForm) {
    donateForm.addEventListener("submit", function (e) {
      e.preventDefault();
      alert("※ 1차 초안 데모입니다.\n실제 결제(PG) 연동은 개발 단계에서 적용됩니다.");
    });
  }

  /* ---------- 후원 방식: 무기명 / 기명(로그인) ---------- */
  var modeRadios = document.querySelectorAll('input[name="mode"]');
  var loginProviders = document.getElementById("loginProviders");
  var modeHint = document.getElementById("modeHint");
  var receiptField = document.getElementById("receiptField");

  if (modeRadios.length && loginProviders) {
    var applyMode = function (mode) {
      var named = mode === "named";
      loginProviders.hidden = !named;
      if (modeHint) {
        modeHint.textContent = named
          ? "로그인하면 후원 내역 관리와 기부금영수증 발급이 가능합니다."
          : "무기명 후원은 로그인 없이 후원하실 수 있어요. (기부금영수증 발급은 어렵습니다.)";
      }
      if (receiptField) receiptField.hidden = !named;
    };
    modeRadios.forEach(function (r) {
      r.addEventListener("change", function () { applyMode(this.value); });
    });
    /* 초기 상태 반영 */
    var checked = document.querySelector('input[name="mode"]:checked');
    applyMode(checked ? checked.value : "anon");
  }

  /* ---------- 로그인 수단 버튼 (데모) ---------- */
  var providerGrid = document.querySelector(".provider-grid");
  if (providerGrid) {
    providerGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".provider-btn");
      if (!btn) return;
      alert(
        '※ 1차 초안 데모입니다.\n"' +
          btn.dataset.provider +
          '" 로그인은 실제 인증 연동(백엔드/제공자 키) 적용 후 동작합니다.'
      );
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

  /* ---------- 숫자 카운터 ---------- */
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    var setVal = function (el, v) {
      el.textContent = v.toLocaleString("ko-KR") + (el.dataset.suffix || "");
    };
    if (reduceMotion || !("IntersectionObserver" in window)) {
      counters.forEach(function (el) { setVal(el, parseInt(el.dataset.count, 10)); });
    } else {
      var cio = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            cio.unobserve(el);
            var target = parseInt(el.dataset.count, 10);
            var dur = 1300, t0 = null;
            var step = function (ts) {
              if (!t0) t0 = ts;
              var p = Math.min((ts - t0) / dur, 1);
              var eased = 1 - Math.pow(1 - p, 3);
              setVal(el, Math.floor(eased * target));
              if (p < 1) requestAnimationFrame(step);
              else setVal(el, target);
            };
            requestAnimationFrame(step);
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach(function (el) { cio.observe(el); });
    }
  }
})();
