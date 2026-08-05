// 홈 "또봄 소식" 섹션을 Firestore의 발행된 게시글로 채웁니다.
// Firebase 미설정 시 정적 소식이 그대로 유지됩니다.
import { firebaseConfig, isConfigured } from "./firebase-config.js?v=2";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 카테고리별 픽토그램 (게시글에 대표 이미지가 없을 때 사용)
const ICONS = {
  campaign: '<path d="M3 9h3l6-4v14l-6-4H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z"/><path d="M14 9a3 3 0 0 1 0 6"/><path d="M7 15l1 4"/>',
  press: '<path d="M4 5h13v14a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="M17 9h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2"/><path d="M6.5 8.5h8M6.5 12h8M6.5 15.5h5"/>',
  community: '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  default: '<path d="M5 19c9 1 14-4 14-13-9 0-14 4-14 13z"/><path d="M5 19c3-5 6-8 10-10"/>',
};

// 카테고리 문자열 → 픽토그램 종류
function kindOf(category) {
  const c = String(category || "");
  if (/캠페인|행사|모집/.test(c)) return "campaign";
  if (/보도|언론|기사/.test(c)) return "press";
  if (/커뮤니티|모임|후기/.test(c)) return "community";
  return "default";
}

// 대표 이미지가 있으면 사진, 없으면 픽토그램 썸네일을 만든다.
function thumbHtml(post) {
  const img = post.imageUrl || post.thumbnail || post.coverUrl;
  if (img) {
    return '<span class="news-thumb"><img src="' + esc(img) + '" alt="" loading="lazy" /></span>';
  }
  const kind = kindOf(post.category);
  return '<span class="news-thumb news-thumb--ico is-' + kind + '" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24">' + ICONS[kind] + "</svg></span>";
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
          thumbHtml(p) +
          '<div class="news-body">' +
          '<span class="tag">' + esc(p.category || "소식") + "</span>" +
          "<h3>" + esc(p.title) + "</h3>" +
          "<time>" + dstr + "</time>" +
          "</div>";
        list.appendChild(a);
      });
    } catch (e) {
      // 색인 미생성/네트워크 등 → 정적 소식 유지
      console.warn("[news] Firestore 로드 생략:", e && e.message);
    }
  })();
}
