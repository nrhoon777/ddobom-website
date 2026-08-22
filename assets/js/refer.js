// =============================================================
// 제휴 병원 상담 신청 폼 (공개 페이지)
//  - ?code=제휴처코드 로 진입. 코드가 곧 "누가 소개했는지"의 증거.
//  - 진료 정보는 받지 않는다. 이름 · 연락처 · 희망 시간대까지만.
// =============================================================
import { firebaseConfig, isConfigured } from "./firebase-config.js?v=2";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, addDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const code = (new URLSearchParams(location.search).get("code") || "").trim().toUpperCase();

function maskName(name) {
  const s = String(name || "").trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return s[0] + "*";
  return s[0] + "*".repeat(s.length - 2) + s[s.length - 1];
}
async function personKey(name, phone) {
  const raw = String(name || "").replace(/\s/g, "") + "|" + String(phone || "").replace(/[^0-9]/g, "");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
const showErr = (msg) => { const el = $("#rErr"); el.textContent = msg; el.hidden = false; };

(async function init() {
  if (!isConfigured || !code) { $("#badCode").hidden = false; return; }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  let partner = null;
  try {
    const s = await getDoc(doc(db, "partnerPublic", code));
    if (s.exists() && s.data().active !== false) partner = s.data();
  } catch (e) { /* 규칙상 읽기 불가면 아래에서 처리 */ }

  if (!partner) { $("#badCode").hidden = false; return; }

  $("#codeBadge").textContent = partner.name || code;
  $("#cProvider").textContent = partner.name || "제휴 병원";
  $("#introText").textContent = `또봄과 제휴한 ${partner.name || "병원"}의 상담 예약 신청입니다. 신청하시면 병원에서 직접 연락드립니다.`;
  $("#referForm").hidden = false;

  $("#referForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#rErr").hidden = true;

    if ($("#rNick").value) return;                       // 봇 차단
    const name = $("#rName").value.trim();
    const phoneRaw = $("#rPhone").value.trim();
    const digits = phoneRaw.replace(/[^0-9]/g, "");
    if (name.length < 2) { showErr("이름을 정확히 입력해 주세요."); return; }
    if (digits.length < 10 || digits.length > 11) { showErr("연락처를 정확히 입력해 주세요."); return; }
    if (!$("#rConsent").checked) { showErr("개인정보 제3자 제공에 동의해 주셔야 신청할 수 있습니다."); return; }

    const lastAt = Number(localStorage.getItem("ttobom_refer_at") || 0);
    if (Date.now() - lastAt < 60000) { showErr("잠시 후 다시 시도해 주세요."); return; }

    const btn = $("#rSubmit");
    btn.disabled = true; btn.textContent = "접수 중…";
    try {
      const ref = await addDoc(collection(db, "referrals"), {
        partnerId: code,
        source: "web",
        createdAt: serverTimestamp(),
        nameMasked: maskName(name),
        phone: digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3"),
        phoneTail: digits.slice(-4),
        personKey: await personKey(name, phoneRaw),
        preferTime: $("#rWhen").value || "",
        memo: $("#rMemo").value.trim().slice(0, 200),
        consent: true,
        consentAt: serverTimestamp(),
        status: "requested",
        visitDate: "",
        revenue: 0,
        ttobomConfirmed: false,
        hospitalConfirmed: false,
        locked: false,
      });
      localStorage.setItem("ttobom_refer_at", String(Date.now()));
      $("#referForm").hidden = true;
      $("#doneNo").textContent = ref.id.slice(-6).toUpperCase();
      $("#referDone").hidden = false;
    } catch (err) {
      btn.disabled = false; btn.textContent = "상담 신청하기";
      showErr("접수에 실패했습니다. 잠시 후 다시 시도해 주세요. (" + err.message + ")");
    }
  });
})();
