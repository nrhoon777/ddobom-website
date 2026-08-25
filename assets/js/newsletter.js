// =============================================================
// 또봄 편지 — 구독 신청 + 공유
//
// 구독: 이메일을 Firestore(subscribers)에 저장한다. 발송 도구는 아직 없으므로
//       지금은 '나중에 보내드릴 주소를 받아 두는' 단계다.
// 공유: 카카오 SDK는 앱 키·도메인 등록이 필요해 쓰지 않는다. 대신 브라우저에
//       내장된 navigator.share를 쓴다. 폰에서 누르면 카카오톡·문자·메일이
//       그대로 뜬다. 없는 환경에서는 주소를 클립보드에 복사한다.
//
// Firebase SDK는 제출하는 순간에만 내려받는다(동적 import).
// 편지를 신청하지 않는 대다수 방문자에게 200KB를 미리 물릴 이유가 없다.
// =============================================================
(function () {
  "use strict";

  /* ---------- 공유 ---------- */
  var shareBtns = document.querySelectorAll("[data-nl-share]");
  shareBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var url = btn.dataset.nlShare || window.location.href;
      var abs = new URL(url, window.location.href).href;
      var data = {
        title: "또봄 편지",
        text: "청년 암 경험자 곁을 지키는 또봄이 두 달에 한 번 보내는 편지입니다.",
        url: abs,
      };

      var done = function (label) {
        var old = btn.querySelector(".nl-share__label");
        if (!old) return;
        var prev = old.textContent;
        old.textContent = label;
        btn.dataset.state = "done";
        setTimeout(function () {
          old.textContent = prev;
          btn.removeAttribute("data-state");
        }, 2200);
      };

      if (navigator.share) {
        navigator.share(data).catch(function () { /* 사용자가 닫은 경우 — 조용히 넘어간다 */ });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(abs).then(
          function () { done("주소를 복사했습니다"); },
          function () { window.prompt("아래 주소를 복사해 주세요", abs); }
        );
        return;
      }
      window.prompt("아래 주소를 복사해 주세요", abs);
    });
  });

  /* ---------- 구독 ---------- */
  var forms = document.querySelectorAll("[data-nl-subscribe]");
  if (!forms.length) return;

  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  forms.forEach(function (form) {
    var input = form.querySelector('input[type="email"]');
    var agree = form.querySelector('input[type="checkbox"]');
    var btn = form.querySelector('button[type="submit"]');
    var msg = form.querySelector("[data-nl-msg]");

    function say(text, tone) {
      if (!msg) return;
      msg.textContent = text;
      if (tone) msg.dataset.tone = tone; else msg.removeAttribute("data-tone");
    }

    /* 실패했을 때는 '안 됩니다'로 끝내지 않고, 지금 쓸 수 있는 길을 링크로 준다.
       링크가 필요해서 여기만 innerHTML을 쓴다 — 넣는 문자열은 아래 고정 문구뿐이다. */
    function sayFallback() {
      if (!msg) return;
      msg.innerHTML =
        '지금은 신청 접수가 안 됩니다. ' +
        '<a href="https://cafe.naver.com/iseeuagain" target="_blank" rel="noopener noreferrer">' +
        '네이버 카페</a>에 메일 주소를 남겨주시면 직접 챙겨드릴게요.';
      msg.dataset.tone = "err";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var email = (input.value || "").trim().toLowerCase();
      if (!EMAIL.test(email)) {
        say("메일 주소를 다시 확인해 주세요.", "err");
        input.focus();
        return;
      }
      if (agree && !agree.checked) {
        say("개인정보 수집·이용에 동의해 주세요.", "err");
        agree.focus();
        return;
      }

      btn.disabled = true;
      say("신청하는 중…");

      Promise.all([
        import("./firebase-config.js?v=2"),
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
      ])
        .then(function (mods) {
          var cfg = mods[0], appMod = mods[1], fsMod = mods[2];
          if (!cfg.isConfigured) throw new Error("not-configured");

          var apps = appMod.getApps ? appMod.getApps() : [];
          var app = apps.length ? apps[0] : appMod.initializeApp(cfg.firebaseConfig);
          var db = fsMod.getFirestore(app);

          return fsMod.addDoc(fsMod.collection(db, "subscribers"), {
            email: email,
            agreed: true,
            source: (form.dataset.nlSubscribe || "web").slice(0, 40),
            createdAt: fsMod.serverTimestamp(),
          });
        })
        .then(function () {
          form.reset();
          say("신청됐습니다. 다음 호가 나오면 보내드릴게요.", "ok");
        })
        .catch(function (err) {
          /* 흔한 원인 두 가지 — 운영자가 콘솔에서 한 번 손봐 주면 풀린다.
             not-found        : Firestore 데이터베이스가 아직 만들어지지 않음
             permission-denied: firestore.rules가 아직 게시되지 않음
             그 외에는 네트워크 문제. 어느 쪽이든 방문자는 카페로 안내한다. */
          var code = (err && err.code) || String(err);
          console.warn("[newsletter] 저장 실패:", code, err);
          if (code.indexOf("not-found") > -1) {
            console.warn("[newsletter] Firebase 콘솔에서 Firestore 데이터베이스를 먼저 만들어야 합니다.");
          } else if (code.indexOf("permission-denied") > -1) {
            console.warn("[newsletter] firestore.rules를 콘솔 규칙 탭에 붙여넣고 게시해야 합니다.");
          }
          sayFallback();
        })
        .then(function () { btn.disabled = false; });
    });
  });
})();
