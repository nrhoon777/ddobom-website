// =============================================================
// Firebase 설정
// Firebase 콘솔 → 프로젝트 설정(⚙️) → 내 앱(웹 </>) → "SDK 설정 및 구성"
// 에 나오는 firebaseConfig 값을 아래에 그대로 붙여넣으세요.
// (이 값들은 공개되어도 되는 식별자입니다. 보안은 firestore.rules로 관리합니다.)
// =============================================================
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID",
};

// config가 실제 값으로 채워졌는지 확인 (placeholder면 false)
export const isConfigured = !String(firebaseConfig.apiKey).includes("PASTE");
