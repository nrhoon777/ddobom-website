// =============================================================
// Firebase 설정 (또봄 — ttobom-h)
// 값 출처: Firebase 콘솔 → 프로젝트 설정 → 일반 → 내 앱(웹) → SDK 구성
// (이 값들은 공개되어도 되는 식별자입니다. 보안은 firestore.rules로 관리합니다.)
// =============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBcQDNUk82tEelImePh9A30GaCDjSFL-cg",
  authDomain: "ttobom-h.firebaseapp.com",
  projectId: "ttobom-h",
  storageBucket: "ttobom-h.firebasestorage.app",
  messagingSenderId: "253679360450",
  appId: "1:253679360450:web:0eeb57f0f1d482b00cde5b",
  measurementId: "G-PDG97SPZLM",
};

// config가 실제 값으로 채워졌는지 확인 (placeholder면 false)
export const isConfigured = !String(firebaseConfig.apiKey).includes("PASTE");
