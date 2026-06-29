// =============================================================
// 또봄 관리자 콘솔 — Firebase Auth + Firestore
// =============================================================
import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  deleteDoc, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const screens = ["adminSetup", "adminLogin", "adminDenied", "adminApp"];
function show(id) {
  screens.forEach((s) => { const el = document.getElementById(s); if (el) el.hidden = s !== id; });
  const lo = document.getElementById("topLogout");
  if (lo) lo.style.display = id === "adminApp" ? "" : "none";
}
const roleLabel = (r) => ({ owner: "최고관리자", editor: "콘텐츠 운영자", viewer: "조회 전용" }[r] || r);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function fmtDate(ts) {
  try { const d = ts && ts.toDate ? ts.toDate() : null; if (!d) return "—";
    return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
  } catch (e) { return "—"; }
}

if (!isConfigured) {
  show("adminSetup");
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  let me = null;          // { email, role, name, active }
  let editingId = null;   // 수정 중인 게시글 id

  // ---- 로그인 / 로그아웃 ----
  $("#loginBtn") && $("#loginBtn").addEventListener("click", () =>
    signInWithPopup(auth, provider).catch((e) => alert("로그인 실패: " + e.message))
  );
  document.querySelectorAll(".logoutBtn").forEach((b) =>
    b.addEventListener("click", () => signOut(auth))
  );

  onAuthStateChanged(auth, async (user) => {
    if (!user) { show("adminLogin"); return; }
    const email = (user.email || "").toLowerCase();
    let snap;
    try {
      snap = await getDoc(doc(db, "roles", email));
    } catch (e) { alert("권한 확인 오류: " + e.message); show("adminLogin"); return; }

    if (!snap.exists() || snap.data().active === false) {
      $("#deniedEmail").textContent = user.email || "";
      show("adminDenied");
      return;
    }
    me = Object.assign({ email }, snap.data());
    $("#meName").textContent = (me.name || user.displayName || email) + " · " + roleLabel(me.role);
    show("adminApp");
    applyRoleUI();
    await refreshAll();
  });

  function canEdit() { return me && (me.role === "owner" || me.role === "editor"); }
  function isOwner() { return me && me.role === "owner"; }

  function applyRoleUI() {
    document.querySelectorAll("[data-need='edit']").forEach((el) => { el.style.display = canEdit() ? "" : "none"; });
    document.querySelectorAll("[data-need='owner']").forEach((el) => { el.style.display = isOwner() ? "" : "none"; });
  }

  async function refreshAll() {
    const posts = await loadPosts();
    renderDashboard(posts);
    if (isOwner()) loadRoles();
  }

  // ---- 게시글 ----
  async function loadPosts() {
    const tbody = $("#postsBody");
    tbody.innerHTML = '<tr><td colspan="5">불러오는 중…</td></tr>';
    let posts = [];
    try {
      const qs = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
      qs.forEach((d) => posts.push(Object.assign({ id: d.id }, d.data())));
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5">불러오기 오류: ' + esc(e.message) + "</td></tr>"; return []; }

    if (!posts.length) { tbody.innerHTML = '<tr><td colspan="5" style="color:#888">게시글이 없습니다. 첫 글을 작성해 보세요.</td></tr>'; return posts; }
    tbody.innerHTML = "";
    posts.forEach((p) => {
      const tr = document.createElement("tr");
      const pub = p.status === "published";
      tr.innerHTML =
        "<td>" + esc(p.title) + "</td>" +
        "<td>" + esc(p.category || "") + "</td>" +
        "<td>" + esc(p.authorName || "") + "</td>" +
        "<td>" + fmtDate(p.createdAt) + "</td>" +
        '<td><span class="status-dot ' + (pub ? "on" : "off") + '"></span>' + (pub ? "공개" : "임시저장") + "</td>";
      if (canEdit()) {
        const td = document.createElement("td");
        td.style.whiteSpace = "nowrap";
        const bEdit = mkBtn("수정", () => startEdit(p));
        const bPub = mkBtn(pub ? "비공개" : "발행", () => togglePublish(p));
        const bDel = mkBtn("삭제", () => removePost(p));
        bDel.style.color = "#c62828";
        td.append(bEdit, bPub, bDel);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    return posts;
  }
  function mkBtn(label, fn) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn btn--ghost";
    b.style.cssText = "min-height:34px;padding:4px 10px;margin-right:6px;font-size:0.85rem";
    b.textContent = label; b.addEventListener("click", fn); return b;
  }

  function startEdit(p) {
    editingId = p.id;
    $("#postTitle").value = p.title || "";
    $("#postCat").value = p.category || "공지사항";
    $("#postBody").value = p.body || "";
    $("#postFormTitle").textContent = "게시글 수정";
    $("#postCancel").style.display = "";
    location.hash = "#write";
  }
  function resetForm() {
    editingId = null;
    $("#postTitle").value = ""; $("#postBody").value = "";
    $("#postFormTitle").textContent = "게시글 작성";
    $("#postCancel").style.display = "none";
  }
  $("#postCancel") && $("#postCancel").addEventListener("click", resetForm);

  async function savePost(status) {
    if (!canEdit()) return alert("권한이 없습니다.");
    const title = $("#postTitle").value.trim();
    const body = $("#postBody").value.trim();
    const category = $("#postCat").value;
    if (!title) return alert("제목을 입력하세요.");
    try {
      if (editingId) {
        await updateDoc(doc(db, "posts", editingId), { title, body, category, status, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "posts"), {
          title, body, category, status,
          authorEmail: me.email, authorName: me.name || me.email,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      }
      resetForm();
      await refreshAll();
      alert(status === "published" ? "발행되었습니다." : "임시저장되었습니다.");
    } catch (e) { alert("저장 오류: " + e.message); }
  }
  $("#btnPublish") && $("#btnPublish").addEventListener("click", () => savePost("published"));
  $("#btnDraft") && $("#btnDraft").addEventListener("click", () => savePost("draft"));

  async function togglePublish(p) {
    try { await updateDoc(doc(db, "posts", p.id), { status: p.status === "published" ? "draft" : "published", updatedAt: serverTimestamp() }); await refreshAll(); }
    catch (e) { alert("오류: " + e.message); }
  }
  async function removePost(p) {
    if (!confirm('"' + p.title + '" 글을 삭제할까요?')) return;
    try { await deleteDoc(doc(db, "posts", p.id)); await refreshAll(); }
    catch (e) { alert("삭제 오류: " + e.message); }
  }

  // ---- 대시보드 ----
  function renderDashboard(posts) {
    const total = posts.length;
    const pub = posts.filter((p) => p.status === "published").length;
    const draft = total - pub;
    setNum("kpiPosts", total);
    setNum("kpiPublished", pub);
    setNum("kpiDrafts", draft);
    const recent = $("#recentPosts");
    recent.innerHTML = "";
    posts.slice(0, 5).forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>" + fmtDate(p.createdAt) + "</td><td>" + esc(p.category || "") + "</td><td>" +
        esc(p.title) + "</td><td>" + (p.status === "published" ? "공개" : "임시저장") + "</td>";
      recent.appendChild(tr);
    });
    if (!posts.length) recent.innerHTML = '<tr><td colspan="4" style="color:#888">활동 내역이 없습니다.</td></tr>';
  }
  function setNum(id, n) { const el = document.getElementById(id); if (el) el.textContent = Number(n).toLocaleString("ko-KR"); }

  // ---- 회원·권한 ----
  async function loadRoles() {
    const tbody = $("#rolesBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4">불러오는 중…</td></tr>';
    let rows = [];
    try {
      const qs = await getDocs(collection(db, "roles"));
      qs.forEach((d) => rows.push(Object.assign({ email: d.id }, d.data())));
    } catch (e) { tbody.innerHTML = '<tr><td colspan="4">오류: ' + esc(e.message) + "</td></tr>"; return; }
    setNum("kpiAdmins", rows.filter((r) => r.active !== false).length);
    tbody.innerHTML = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>" + esc(r.name || "—") + "</td><td>" + esc(r.email) + "</td>";
      const tdRole = document.createElement("td");
      if (r.role === "owner") {
        tdRole.innerHTML = '<span class="role-badge role-admin">최고관리자</span>';
      } else {
        const sel = document.createElement("select");
        ["editor", "viewer"].forEach((v) => { const o = document.createElement("option"); o.value = v; o.textContent = roleLabel(v); if (r.role === v) o.selected = true; sel.appendChild(o); });
        sel.addEventListener("change", async () => {
          try { await updateDoc(doc(db, "roles", r.email), { role: sel.value }); } catch (e) { alert("오류: " + e.message); }
        });
        tdRole.appendChild(sel);
      }
      tr.appendChild(tdRole);
      const tdAct = document.createElement("td");
      if (r.role !== "owner") {
        const del = mkBtn("삭제", async () => { if (confirm(r.email + " 권한을 삭제할까요?")) { try { await deleteDoc(doc(db, "roles", r.email)); loadRoles(); } catch (e) { alert(e.message); } } });
        del.style.color = "#c62828";
        tdAct.appendChild(del);
      }
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
  }
  $("#inviteBtn") && $("#inviteBtn").addEventListener("click", async () => {
    const email = ($("#inviteEmail").value || "").trim().toLowerCase();
    const role = $("#inviteRole").value;
    const name = ($("#inviteName").value || "").trim();
    if (!email) return alert("이메일을 입력하세요.");
    try {
      await setDoc(doc(db, "roles", email), { role, name, active: true });
      $("#inviteEmail").value = ""; $("#inviteName").value = "";
      loadRoles();
      alert(email + " 님에게 " + roleLabel(role) + " 권한을 부여했습니다.\n(해당 이메일의 구글 계정으로 로그인하면 접근됩니다.)");
    } catch (e) { alert("오류: " + e.message); }
  });
}
