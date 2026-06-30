// 홈 "또봄 소식" 섹션을 Firestore의 발행된 게시글로 채웁니다.
// Firebase 미설정 시 정적 소식이 그대로 유지됩니다.
import { firebaseConfig, isConfigured } from "./firebase-config.js?v=2";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

if (isConfigured) {
  (async () => {
    try {
      const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      const { getFirestore, collection, query, where, orderBy, limit, getDocs } =
        await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      const db = getFirestore(app);
      const qs = await getDocs(query(
        collection(db, "posts"),
        where("status", "==", "published"),
        orderBy("createdAt", "desc"),
        limit(3)
      ));
      if (qs.empty) return;
      const list = document.querySelector(".news-list");
      if (!list) return;
      list.innerHTML = "";
      qs.forEach((d) => {
        const p = d.data();
        const dt = p.createdAt && p.createdAt.toDate ? p.createdAt.toDate() : null;
        const dstr = dt
          ? dt.getFullYear() + "." + String(dt.getMonth() + 1).padStart(2, "0") + "." + String(dt.getDate()).padStart(2, "0")
          : "";
        const a = document.createElement("a");
        a.className = "news-item reveal in";
        a.href = "#";
        a.innerHTML =
          '<span class="tag">' + esc(p.category || "소식") + "</span>" +
          "<h3>" + esc(p.title) + "</h3>" +
          "<time>" + dstr + "</time>";
        list.appendChild(a);
      });
    } catch (e) {
      // 색인 미생성/네트워크 등 → 정적 소식 유지
      console.warn("[news] Firestore 로드 생략:", e && e.message);
    }
  })();
}
