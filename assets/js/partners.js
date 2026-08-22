// =============================================================
// 또봄 제휴 정산 콘솔 — 양측 상호확인(dual confirmation) 대장
// 설계 원칙
//  1. 진료 정보는 저장하지 않는다. 상태 · 방문일 · 금액만 다룬다.
//  2. 또봄 확인란은 또봄만, 병원 확인란은 병원만 쓸 수 있다(규칙으로 강제).
//  3. 모든 변경은 auditLogs 에 남고 지워지지 않는다.
//  4. 월 마감이 끝난 건은 잠기고, 이후 조정은 다음 달 건으로 처리한다.
// =============================================================
import { firebaseConfig, isConfigured } from "./firebase-config.js?v=2";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const won = (n) => (Number(n) || 0).toLocaleString("ko-KR") + "원";
const screens = ["pSetup", "pLogin", "pDenied", "pApp"];

function show(id) {
  screens.forEach((s) => { const el = document.getElementById(s); if (el) el.hidden = s !== id; });
  const lo = document.getElementById("topLogout");
  if (lo) lo.style.display = id === "pApp" ? "" : "none";
}
function fmtDate(ts) {
  try {
    const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
    if (!d || isNaN(d)) return "—";
    return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
  } catch (e) { return "—"; }
}
function fmtDateTime(ts) {
  try {
    const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
    if (!d || isNaN(d)) return "—";
    return fmtDate(d) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  } catch (e) { return "—"; }
}
function thisMonth() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
function maskName(name) {
  const s = String(name || "").trim();
  if (s.length <= 1) return s || "—";
  if (s.length === 2) return s[0] + "*";
  return s[0] + "*".repeat(s.length - 2) + s[s.length - 1];
}
// 대사용 가명키: 평문 대조 없이 양측이 같은 사람인지 맞춰보기 위한 값
async function personKey(name, phone) {
  const raw = String(name || "").replace(/\s/g, "") + "|" + String(phone || "").replace(/[^0-9]/g, "");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
const STATUS_LABEL = { requested: "접수", visited: "내원", no_show: "미내원", canceled: "취소" };
const MODE_LABEL = {
  revenue_share: "매출 연동 %", fixed: "월 정액", donation: "병원 기부(성과 무관)", none: "실적 기록만",
};

if (!isConfigured) {
  show("pSetup");
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();

  let me = null;            // { email, role, side, partnerId, name }
  let partners = [];        // [{ id(code), name, mode, rate, active }]
  let referrals = [];       // 현재 로드된 소개 건
  let currentSettlement = null;

  const isTtobom = () => me && me.side === "ttobom";
  const isHospital = () => me && me.side === "hospital";
  const canEditTtobom = () => isTtobom() && (me.role === "owner" || me.role === "editor");
  const isOwner = () => isTtobom() && me.role === "owner";

  // ---------------- 로그인 ----------------
  $("#loginBtn") && $("#loginBtn").addEventListener("click", () =>
    signInWithPopup(auth, provider).catch((e) => alert("로그인 실패: " + e.message)));
  $$(".logoutBtn").forEach((b) => b.addEventListener("click", () => signOut(auth)));

  onAuthStateChanged(auth, async (user) => {
    if (!user) { me = null; show("pLogin"); return; }
    const email = (user.email || "").toLowerCase();
    let snap;
    try {
      snap = await getDoc(doc(db, "roles", email));
    } catch (e) {
      $("#deniedEmail").textContent = email; show("pDenied"); return;
    }
    if (!snap.exists() || snap.data().active === false) {
      $("#deniedEmail").textContent = email; show("pDenied"); return;
    }
    const d = snap.data();
    const side = d.role === "hospital" ? "hospital" : "ttobom";
    if (side === "hospital" && !d.partnerId) {
      $("#deniedEmail").textContent = email + " (제휴처 미연결)"; show("pDenied"); return;
    }
    me = { email, role: d.role, side, partnerId: d.partnerId || null, name: d.name || user.displayName || email };
    $("#meName").textContent = me.name + " · " + (side === "hospital" ? "제휴 병원" : "또봄 운영진");
    show("pApp");
    applyPermissionUI();
    await bootstrap();
  });

  function applyPermissionUI() {
    $$("[data-need]").forEach((el) => {
      const need = el.getAttribute("data-need");
      const ok = need === "ttobom" ? isTtobom() : need === "hospital" ? isHospital() : true;
      el.style.display = ok ? "" : "none";
    });
    if (isHospital()) {
      $("#dashSub").textContent = "또봄이 소개한 건입니다. 내원 여부와 매출액을 확인해 주세요.";
    }
  }

  // ---------------- 사이드 내비 ----------------
  const sections = ["pdash", "plist", "pmatch", "psettle", "ppartners", "paudit"];
  function route() {
    const hash = (location.hash || "#pdash").slice(1);
    const target = sections.includes(hash) ? hash : "pdash";
    sections.forEach((s) => { const el = document.getElementById(s); if (el) el.hidden = s !== target; });
    $$(".admin-side a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + target));
    if (target === "paudit") loadAudit();
  }
  window.addEventListener("hashchange", route);

  // ---------------- 부트스트랩 ----------------
  async function bootstrap() {
    $("#fMonth").value = "";
    $("#sMonth").value = thisMonth();
    await loadPartners();
    await loadReferrals();
    route();
  }

  async function loadPartners() {
    partners = [];
    try {
      if (isHospital()) {
        const s = await getDoc(doc(db, "partners", me.partnerId));
        if (s.exists()) partners = [{ id: s.id, ...s.data() }];
      } else {
        const s = await getDocs(collection(db, "partners"));
        s.forEach((docSnap) => partners.push({ id: docSnap.id, ...docSnap.data() }));
        partners.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      }
    } catch (e) { console.error("제휴처 로드 실패", e); }
    fillPartnerSelects();
    renderPartners();
  }

  function fillPartnerSelects() {
    const opts = partners.map((p) => `<option value="${esc(p.id)}">${esc(p.name || p.id)}</option>`).join("");
    $("#fPartner").innerHTML = `<option value="">전체</option>` + opts;
    $("#sPartner").innerHTML = opts;
    const npEmailCode = $("#npEmailCode");
    if (npEmailCode) npEmailCode.innerHTML = opts;
  }

  async function loadReferrals() {
    referrals = [];
    try {
      const col = collection(db, "referrals");
      const q = isHospital() ? query(col, where("partnerId", "==", me.partnerId)) : query(col);
      const s = await getDocs(q);
      s.forEach((docSnap) => referrals.push({ id: docSnap.id, ...docSnap.data() }));
      // 복합 색인 없이 쓰기 위해 정렬은 클라이언트에서
      referrals.sort((a, b) => (msOf(b.createdAt) - msOf(a.createdAt)));
    } catch (e) {
      console.error("소개 건 로드 실패", e);
      alert("소개 건을 불러오지 못했습니다. Firestore 규칙이 배포됐는지 확인하세요.\n" + e.message);
    }
    renderDash();
    renderList();
    renderMatch();
  }
  const msOf = (ts) => { try { return ts && ts.toDate ? ts.toDate().getTime() : (ts ? new Date(ts).getTime() : 0); } catch (e) { return 0; } };

  const partnerName = (id) => (partners.find((p) => p.id === id) || {}).name || id || "—";

  // ---------------- 현황 ----------------
  function renderDash() {
    const m = thisMonth();
    const inMonth = referrals.filter((r) => (r.month || monthOf(r)) === m);
    $("#kpiNew").textContent = inMonth.length;
    $("#kpiVisited").textContent = inMonth.filter((r) => r.status === "visited").length;
    $("#kpiBoth").textContent = inMonth.filter((r) => r.ttobomConfirmed && r.hospitalConfirmed).length;
    $("#kpiDiff").textContent = referrals.filter(isMismatch).length;

    $("#recentBody").innerHTML = referrals.slice(0, 8).map((r) => `
      <tr>
        <td>${fmtDate(r.createdAt)}</td>
        <td>${esc(partnerName(r.partnerId))}</td>
        <td>${esc(r.nameMasked || "—")}</td>
        <td>${statusBadge(r)}</td>
        <td>${checkMark(r.ttobomConfirmed)}</td>
        <td>${checkMark(r.hospitalConfirmed)}</td>
      </tr>`).join("") || `<tr><td colspan="6" class="sub">아직 소개 건이 없습니다.</td></tr>`;
  }
  const monthOf = (r) => {
    const base = r.visitDate || null;
    if (base) return String(base).slice(0, 7);
    const d = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : null;
    return d ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") : "";
  };
  const checkMark = (v) => v ? `<span class="chk on">✔</span>` : `<span class="chk off">—</span>`;
  const statusBadge = (r) => r.locked
    ? `<span class="badge locked">마감</span>`
    : `<span class="badge ${esc(r.status || "requested")}">${esc(STATUS_LABEL[r.status] || "접수")}</span>`;

  function isMismatch(r) {
    if (r.status === "canceled" || r.status === "no_show") return false;
    if (r.locked) return false;
    if (r.ttobomConfirmed !== r.hospitalConfirmed) return true;
    if (r.status === "visited" && r.hospitalConfirmed && !(Number(r.revenue) > 0)) return true;
    return false;
  }
  function mismatchReason(r) {
    if (r.ttobomConfirmed && !r.hospitalConfirmed) return "병원 확인 대기";
    if (!r.ttobomConfirmed && r.hospitalConfirmed) return "또봄 확인 대기";
    return "매출액 미입력";
  }

  // ---------------- 소개 건 대장 ----------------
  ["#fMonth", "#fPartner", "#fStatus"].forEach((s) => $(s).addEventListener("change", renderList));
  $("#btnReload").addEventListener("click", loadReferrals);

  function filtered() {
    const m = $("#fMonth").value, p = $("#fPartner").value, st = $("#fStatus").value;
    return referrals.filter((r) =>
      (!m || (r.month || monthOf(r)) === m) &&
      (!p || r.partnerId === p) &&
      (!st || (r.status || "requested") === st));
  }

  function renderList() {
    const rows = filtered();
    $("#listEmpty").style.display = rows.length ? "none" : "";
    $("#listBody").innerHTML = rows.map((r) => {
      const canT = canEditTtobom() && !r.locked;
      const canH = isHospital() && !r.locked;
      let actions = "";
      if (canH) {
        actions += `<button class="btn btn--ghost btn--sm" data-act="visit" data-id="${esc(r.id)}" style="min-height:34px;padding:6px 12px;">내원·매출 입력</button> `;
        if (!r.hospitalConfirmed) actions += `<button class="btn btn--primary btn--sm" data-act="hconfirm" data-id="${esc(r.id)}" style="min-height:34px;padding:6px 12px;">병원 확인</button>`;
      }
      if (canT && !r.ttobomConfirmed) {
        actions += `<button class="btn btn--primary btn--sm" data-act="tconfirm" data-id="${esc(r.id)}" style="min-height:34px;padding:6px 12px;">또봄 확인</button>`;
      }
      return `<tr class="${isMismatch(r) ? "diffrow" : ""}">
        <td>${fmtDate(r.createdAt)}</td>
        <td>${esc(partnerName(r.partnerId))}</td>
        <td>${esc(r.nameMasked || "—")}<br /><span class="mono sub">${esc(r.personKey || "")}</span></td>
        <td class="mono">${esc(r.phone || (r.phoneTail ? "****" + r.phoneTail : "—"))}</td>
        <td>${statusBadge(r)}</td>
        <td>${esc(r.visitDate || "—")}</td>
        <td>${r.revenue ? won(r.revenue) : "—"}</td>
        <td>${checkMark(r.ttobomConfirmed)}</td>
        <td>${checkMark(r.hospitalConfirmed)}</td>
        <td>${actions}</td>
      </tr>`;
    }).join("");
  }

  $("#listBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const r = referrals.find((x) => x.id === btn.dataset.id);
    if (!r) return;
    btn.disabled = true;
    try {
      if (btn.dataset.act === "visit") await enterVisit(r);
      else if (btn.dataset.act === "hconfirm") await confirmSide(r, "hospital");
      else if (btn.dataset.act === "tconfirm") await confirmSide(r, "ttobom");
    } catch (err) {
      alert("처리 실패: " + err.message);
    } finally { btn.disabled = false; }
  });

  async function enterVisit(r) {
    const visited = confirm(`${r.nameMasked || "이 대상자"} 님이 실제로 내원했습니까?\n\n확인 = 내원, 취소 = 미내원 처리`);
    let patch;
    if (!visited) {
      patch = { status: "no_show", visitDate: "", revenue: 0 };
    } else {
      const date = prompt("방문일 (YYYY-MM-DD)", r.visitDate || new Date().toISOString().slice(0, 10));
      if (!date) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert("날짜 형식은 YYYY-MM-DD 입니다."); return; }
      const amt = prompt("해당 건의 매출액(원). 진료 내용은 적지 마세요.", r.revenue || "");
      if (amt === null) return;
      const revenue = Math.max(0, Math.round(Number(String(amt).replace(/[^0-9]/g, "")) || 0));
      patch = { status: "visited", visitDate: date, revenue, month: date.slice(0, 7) };
    }
    await updateDoc(doc(db, "referrals", r.id), { ...patch, updatedAt: serverTimestamp() });
    await writeAudit("visit_update", r.id, r.partnerId, JSON.stringify(patch));
    Object.assign(r, patch);
    renderList(); renderMatch(); renderDash();
  }

  async function confirmSide(r, side) {
    const label = side === "hospital" ? "병원" : "또봄";
    if (!confirm(`${label} 확인으로 처리합니다.\n대상: ${r.nameMasked || "—"} / 방문일 ${r.visitDate || "미입력"} / 매출 ${r.revenue ? won(r.revenue) : "미입력"}\n\n계속할까요?`)) return;
    const patch = side === "hospital"
      ? { hospitalConfirmed: true, hospitalBy: me.email, hospitalAt: serverTimestamp() }
      : { ttobomConfirmed: true, ttobomBy: me.email, ttobomAt: serverTimestamp() };
    await updateDoc(doc(db, "referrals", r.id), { ...patch, updatedAt: serverTimestamp() });
    await writeAudit(side + "_confirm", r.id, r.partnerId, "");
    Object.assign(r, patch, side === "hospital" ? { hospitalConfirmed: true } : { ttobomConfirmed: true });
    renderList(); renderMatch(); renderDash();
  }

  // ---------------- 수기 등록 ----------------
  $("#btnManual").addEventListener("click", async () => {
    if (!canEditTtobom()) return;
    if (!partners.length) { alert("먼저 제휴처를 등록하세요."); return; }
    const code = prompt("제휴처 코드\n" + partners.map((p) => `${p.id} — ${p.name}`).join("\n"), partners[0].id);
    if (!code) return;
    if (!partners.some((p) => p.id === code)) { alert("없는 제휴처 코드입니다."); return; }
    const name = prompt("대상자 이름 (대장에는 가려서 표시됩니다)");
    if (!name) return;
    const phone = prompt("연락처 (병원 예약 연락용)");
    if (!phone) return;
    if (!confirm("본인에게 개인정보 제3자 제공 동의를 받았습니까?\n동의 없이 등록하면 안 됩니다.")) return;
    try {
      const ref = await addDoc(collection(db, "referrals"), {
        partnerId: code, source: "manual", createdAt: serverTimestamp(),
        nameMasked: maskName(name), phone: String(phone).trim(),
        phoneTail: String(phone).replace(/[^0-9]/g, "").slice(-4),
        personKey: await personKey(name, phone),
        consent: true, consentAt: serverTimestamp(),
        status: "requested", visitDate: "", revenue: 0, month: thisMonth(),
        ttobomConfirmed: false, hospitalConfirmed: false, locked: false,
        createdBy: me.email,
      });
      await writeAudit("referral_create", ref.id, code, "수기 등록");
      await loadReferrals();
      alert("등록했습니다.");
    } catch (e) { alert("등록 실패: " + e.message); }
  });

  // ---------------- CSV ----------------
  $("#btnCsv").addEventListener("click", () => {
    const rows = filtered();
    const head = ["접수일", "제휴처", "대상", "가명키", "상태", "방문일", "매출액", "또봄확인", "병원확인", "마감"];
    const body = rows.map((r) => [
      fmtDate(r.createdAt), partnerName(r.partnerId), r.nameMasked || "", r.personKey || "",
      STATUS_LABEL[r.status] || "접수", r.visitDate || "", r.revenue || 0,
      r.ttobomConfirmed ? "Y" : "N", r.hospitalConfirmed ? "Y" : "N", r.locked ? "Y" : "N",
    ]);
    const csv = [head, ...body].map((cols) =>
      cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `또봄_제휴대장_${$("#fMonth").value || "전체"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---------------- 대사 ----------------
  function renderMatch() {
    const rows = referrals.filter(isMismatch);
    $("#matchEmpty").style.display = rows.length ? "none" : "";
    $("#matchBody").innerHTML = rows.map((r) => `
      <tr class="diffrow">
        <td>${fmtDate(r.createdAt)}</td>
        <td>${esc(partnerName(r.partnerId))}</td>
        <td>${esc(r.nameMasked || "—")}</td>
        <td>${esc(mismatchReason(r))}</td>
        <td>${checkMark(r.ttobomConfirmed)}</td>
        <td>${checkMark(r.hospitalConfirmed)}</td>
      </tr>`).join("");
  }

  // ---------------- 월 정산 ----------------
  $("#btnCalc").addEventListener("click", calcSettlement);

  async function calcSettlement() {
    const month = $("#sMonth").value, code = $("#sPartner").value;
    if (!month || !code) { alert("정산월과 제휴처를 선택하세요."); return; }
    const p = partners.find((x) => x.id === code) || {};
    const rows = referrals.filter((r) => r.partnerId === code && (r.month || monthOf(r)) === month && r.status === "visited");
    const eligible = rows.filter((r) => r.ttobomConfirmed && r.hospitalConfirmed);
    const revenueSum = eligible.reduce((a, r) => a + (Number(r.revenue) || 0), 0);
    const rate = Number(p.rate) || 0;
    const amount = p.mode === "revenue_share" ? Math.floor(revenueSum * rate / 100)
      : p.mode === "fixed" || p.mode === "donation" ? rate : 0;

    $("#sCount").textContent = eligible.length + "건";
    $("#sRevenue").textContent = won(revenueSum);
    $("#sRate").textContent = p.mode === "revenue_share" ? rate + "%" : MODE_LABEL[p.mode] || "—";
    $("#sAmount").textContent = p.mode === "none" ? "정산 없음" : won(amount);

    const pending = rows.length - eligible.length;
    const notes = [];
    if (pending > 0) {
      notes.push(`⚠️ 이 달에 <b>양측 확인이 끝나지 않은 건이 ${pending}건</b> 있습니다. 정산 금액에서 제외되어 있습니다. ‘대사 · 불일치’ 탭에서 먼저 정리하세요.`);
    }

    $("#settleBody").innerHTML = rows.map((r) => `
      <tr class="${r.ttobomConfirmed && r.hospitalConfirmed ? "" : "diffrow"}">
        <td>${esc(r.visitDate || "—")}</td>
        <td>${esc(r.nameMasked || "—")}</td>
        <td>${won(r.revenue)}</td>
        <td>${checkMark(r.ttobomConfirmed)}</td>
        <td>${checkMark(r.hospitalConfirmed)}</td>
      </tr>`).join("") || `<tr><td colspan="5" class="sub">해당 월 내원 건이 없습니다.</td></tr>`;

    const sid = code + "_" + month.replace("-", "");
    let sdoc = null;
    try { const snap = await getDoc(doc(db, "settlements", sid)); if (snap.exists()) sdoc = snap.data(); } catch (e) { /* 없으면 신규 */ }

    // 이미 한쪽이 집계를 확정해 둔 경우, 지금 계산값과 다르면 그 자체가 불일치 신호다
    if (sdoc && (Number(sdoc.revenueSum) !== revenueSum || Number(sdoc.count) !== eligible.length)) {
      notes.push(`⚠️ 먼저 집계된 기준값과 다릅니다. 기준: <b>${sdoc.count}건 / ${won(sdoc.revenueSum)}</b>, 현재 계산: <b>${eligible.length}건 / ${won(revenueSum)}</b>. 서명 전에 어느 건이 다른지 확인하세요.`);
    }
    const warn = $("#settleWarn");
    warn.hidden = notes.length === 0;
    warn.innerHTML = notes.join("<br />");

    currentSettlement = { id: sid, code, month, rate, mode: p.mode || "revenue_share", count: eligible.length, revenueSum, amount, doc: sdoc };
    $("#settleResult").hidden = false;
    renderSignState();
  }

  function renderSignState() {
    const s = currentSettlement, d = (s && s.doc) || {};
    const parts = [];
    parts.push(d.ttobomSignedAt ? `또봄 서명 ✔ (${esc(d.ttobomSignedBy || "")})` : "또봄 서명 대기");
    parts.push(d.hospitalSignedAt ? `병원 서명 ✔ (${esc(d.hospitalSignedBy || "")})` : "병원 서명 대기");
    if (d.paidAt) parts.push("입금 완료 ✔");
    $("#signState").innerHTML = parts.join(" · ");
    $("#btnSignTtobom").disabled = !!d.ttobomSignedAt;
    $("#btnSignHospital").disabled = !!d.hospitalSignedAt;
    $("#btnPaid").disabled = !(d.ttobomSignedAt && d.hospitalSignedAt) || !!d.paidAt;
  }

  async function signSettlement(side) {
    const s = currentSettlement;
    if (!s) return;
    const label = side === "ttobom" ? "또봄" : "병원";
    if (!confirm(`${s.month} ${partnerName(s.code)} 정산에 ${label} 확인 서명을 합니다.\n건수 ${s.count}건 · 매출 ${won(s.revenueSum)} · 산정 ${won(s.amount)}\n\n서명 후에는 취소할 수 없습니다.`)) return;
    const sign = side === "ttobom"
      ? { ttobomSignedBy: me.email, ttobomSignedAt: serverTimestamp() }
      : { hospitalSignedBy: me.email, hospitalSignedAt: serverTimestamp() };
    let patch;
    if (!s.doc) {
      // 최초 서명자가 기준 수치를 확정한다. 이후에는 누구도 수치를 바꿀 수 없다.
      patch = {
        partnerId: s.code, month: s.month, mode: s.mode, rate: s.rate,
        count: s.count, revenueSum: s.revenueSum, amount: s.amount,
        status: "open", updatedAt: serverTimestamp(), ...sign,
      };
      await setDoc(doc(db, "settlements", s.id), patch);
    } else {
      patch = { ...sign, updatedAt: serverTimestamp() };
      await updateDoc(doc(db, "settlements", s.id), patch);
    }
    await writeAudit(side + "_settlement_sign", s.id, s.code, `${s.count}건 / ${s.revenueSum} / ${s.amount}`);
    s.doc = { ...(s.doc || {}), ...patch, [side + "SignedAt"]: new Date(), [side + "SignedBy"]: me.email };
    renderSignState();
    alert("서명했습니다.");
  }
  $("#btnSignTtobom").addEventListener("click", () => signSettlement("ttobom").catch((e) => alert("서명 실패: " + e.message)));
  $("#btnSignHospital").addEventListener("click", () => signSettlement("hospital").catch((e) => alert("서명 실패: " + e.message)));

  $("#btnPaid").addEventListener("click", async () => {
    const s = currentSettlement;
    if (!s || !isTtobom()) return;
    if (!confirm(`${s.month} ${partnerName(s.code)} 정산을 입금 완료로 마감합니다.\n해당 월 건은 잠기고 더 이상 수정할 수 없습니다.`)) return;
    try {
      await setDoc(doc(db, "settlements", s.id), {
        paidBy: me.email, paidAt: serverTimestamp(), status: "paid", updatedAt: serverTimestamp(),
      }, { merge: true });
      const target = referrals.filter((r) => r.partnerId === s.code && (r.month || monthOf(r)) === s.month && !r.locked);
      for (const r of target) {
        await updateDoc(doc(db, "referrals", r.id), { locked: true, updatedAt: serverTimestamp() });
        r.locked = true;
      }
      await writeAudit("settlement_paid", s.id, s.code, `${target.length}건 잠금`);
      s.doc = { ...(s.doc || {}), paidAt: new Date() };
      renderSignState(); renderList(); renderMatch(); renderDash();
      alert(`마감했습니다. ${target.length}건이 잠겼습니다.`);
    } catch (e) { alert("마감 실패: " + e.message); }
  });

  // ---------------- 제휴처 관리 ----------------
  function renderPartners() {
    const body = $("#partnersBody");
    if (!body) return;
    const origin = location.origin + location.pathname.replace(/[^/]*$/, "");
    body.innerHTML = partners.map((p) => {
      const link = origin + "refer.html?code=" + encodeURIComponent(p.id);
      return `<tr>
        <td class="mono">${esc(p.id)}</td>
        <td>${esc(p.name || "—")}</td>
        <td>${esc(MODE_LABEL[p.mode] || "—")}${p.mode === "revenue_share" ? " " + esc(p.rate) + "%" : p.rate ? " " + won(p.rate) : ""}</td>
        <td><a href="${esc(link)}" target="_blank" rel="noopener" class="mono">refer.html?code=${esc(p.id)}</a></td>
        <td>${p.active === false ? "중지" : "운영중"}</td>
        <td>${isOwner() ? `<button class="btn btn--ghost" data-toggle="${esc(p.id)}" style="min-height:34px;padding:6px 12px;">${p.active === false ? "재개" : "중지"}</button>` : ""}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="6" class="sub">등록된 제휴처가 없습니다.</td></tr>`;
  }

  $("#partnersBody") && $("#partnersBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-toggle]");
    if (!btn || !isOwner()) return;
    const p = partners.find((x) => x.id === btn.dataset.toggle);
    if (!p) return;
    const next = p.active === false;
    try {
      await updateDoc(doc(db, "partners", p.id), { active: next, updatedAt: serverTimestamp() });
      await setDoc(doc(db, "partnerPublic", p.id), { name: p.name || p.id, active: next }, { merge: true });
      await writeAudit("partner_toggle", p.id, p.id, next ? "운영 재개" : "운영 중지");
      p.active = next; renderPartners();
    } catch (err) { alert("변경 실패: " + err.message); }
  });

  $("#btnAddPartner") && $("#btnAddPartner").addEventListener("click", async () => {
    if (!isOwner()) { alert("최고관리자만 제휴처를 등록할 수 있습니다."); return; }
    const code = ($("#npCode").value || "").trim().toUpperCase();
    const name = ($("#npName").value || "").trim();
    const mode = $("#npMode").value;
    const rate = Number($("#npRate").value) || 0;
    if (!/^[A-Z0-9-]{4,20}$/.test(code)) { alert("추천코드는 영문 대문자·숫자·하이픈 4~20자로 입력하세요."); return; }
    if (!name) { alert("제휴처 이름을 입력하세요."); return; }
    if (mode === "revenue_share" &&
        !confirm("매출 연동 % 방식입니다.\n\n의료법 제27조 3항상 환자 소개 대가를 매출에 연동해 받는 구조는 유인·알선으로 해석될 수 있습니다.\n계약서를 법률 검토받은 상태입니까?")) return;
    try {
      await setDoc(doc(db, "partners", code), {
        name, mode, rate, active: true, createdAt: serverTimestamp(), createdBy: me.email,
      }, { merge: true });
      // 공개 신청 폼이 코드를 검증할 때 쓰는 문서 — 요율은 절대 넣지 않는다
      await setDoc(doc(db, "partnerPublic", code), { name, active: true }, { merge: true });
      await writeAudit("partner_create", code, code, `${name} / ${mode} / ${rate}`);
      $("#npCode").value = ""; $("#npName").value = ""; $("#npRate").value = "";
      await loadPartners();
      alert("등록했습니다. 소개 링크를 병원과 공유하세요.");
    } catch (e) { alert("등록 실패: " + e.message); }
  });

  $("#btnAddHospitalUser") && $("#btnAddHospitalUser").addEventListener("click", async () => {
    if (!isOwner()) { alert("최고관리자만 권한을 부여할 수 있습니다."); return; }
    const email = ($("#npEmail").value || "").trim().toLowerCase();
    const code = $("#npEmailCode").value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { alert("이메일 형식을 확인하세요."); return; }
    if (!code) { alert("연결할 제휴처를 선택하세요."); return; }
    try {
      await setDoc(doc(db, "roles", email), {
        role: "hospital", partnerId: code, name: partnerName(code) + " 담당자",
        active: true, createdAt: serverTimestamp(), createdBy: me.email,
      }, { merge: true });
      await writeAudit("hospital_user_grant", email, code, "");
      $("#npEmail").value = "";
      alert(`${email} 계정에 ${partnerName(code)} 담당자 권한을 부여했습니다.\n해당 구글 계정으로 이 페이지에 로그인하면 자기 병원 건만 보입니다.`);
    } catch (e) { alert("권한 부여 실패: " + e.message); }
  });

  // ---------------- 감사 로그 ----------------
  async function writeAudit(action, targetId, partnerId, detail) {
    try {
      await addDoc(collection(db, "auditLogs"), {
        at: serverTimestamp(), by: me.email, side: me.side, role: me.role,
        action, targetId: targetId || "", partnerId: partnerId || "", detail: detail || "",
      });
    } catch (e) { console.warn("감사 로그 기록 실패", e); }
  }

  async function loadAudit() {
    try {
      const col = collection(db, "auditLogs");
      const q = isHospital()
        ? query(col, where("partnerId", "==", me.partnerId))
        : query(col, orderBy("at", "desc"), limit(200));
      const s = await getDocs(q);
      const rows = [];
      s.forEach((d) => rows.push(d.data()));
      rows.sort((a, b) => msOf(b.at) - msOf(a.at));
      $("#auditBody").innerHTML = rows.slice(0, 200).map((r) => `
        <tr>
          <td>${fmtDateTime(r.at)}</td>
          <td>${esc(r.by || "")}</td>
          <td>${r.side === "hospital" ? "병원" : "또봄"}</td>
          <td>${esc(r.action || "")}</td>
          <td class="mono">${esc(r.targetId || "")} ${esc(r.detail || "")}</td>
        </tr>`).join("") || `<tr><td colspan="5" class="sub">기록이 없습니다.</td></tr>`;
    } catch (e) {
      $("#auditBody").innerHTML = `<tr><td colspan="5" class="sub">이력을 불러오지 못했습니다: ${esc(e.message)}</td></tr>`;
    }
  }
}
