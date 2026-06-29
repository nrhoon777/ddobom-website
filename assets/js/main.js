/* 또봄 — 1차 초안 인터랙션 스크립트 */
(function () {
  "use strict";

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
})();
