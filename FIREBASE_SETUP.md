# Firebase 연동 설정 가이드 (관리자 콘솔)

또봄 관리자 콘솔(`admin.html`)은 **Firebase Authentication(로그인·권한)** 과 **Cloud Firestore(게시글·권한 데이터)** 로 동작합니다.
서버 없이 GitHub Pages에서 작동하며, 아래 설정만 마치면 활성화됩니다. (설정 전에는 사이트가 기존처럼 정상 동작)

---

## 1. Firebase 프로젝트 만들기
1. https://console.firebase.google.com → **프로젝트 만들기** (이름: 예 `ddobom`)
2. Google 애널리틱스는 꺼도 됩니다.

## 2. 웹 앱 등록 → config 복사
1. 프로젝트 개요 옆 **⚙️ → 프로젝트 설정**
2. 하단 **내 앱 → 웹(`</>`)** 추가 → 닉네임 입력 후 등록
3. 표시되는 `firebaseConfig` 값을 복사

## 3. config 입력
`assets/js/firebase-config.js` 파일을 열어 `PASTE_...` 부분을 복사한 값으로 교체:
```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "ddobom.firebaseapp.com",
  projectId: "ddobom",
  storageBucket: "ddobom.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcd..."
};
```
> 이 값들은 공개되어도 되는 식별자입니다. 실제 보안은 4번 규칙으로 관리됩니다.

## 4. Google 로그인 + 도메인 허용
1. **빌드 → Authentication → 시작하기 → Sign-in method → Google → 사용 설정**
2. **Authentication → Settings → 승인된 도메인**에 추가:
   - `nrhoon777.github.io`
   - `localhost` (로컬 테스트용)

## 5. Firestore 만들기 + 보안 규칙
1. **빌드 → Firestore Database → 데이터베이스 만들기** → 위치 선택(예: asia-northeast3 서울) → **프로덕션 모드**로 시작
2. **규칙(Rules)** 탭 → 저장소의 `firestore.rules` 내용을 붙여넣고 **게시(Publish)**

## 6. 첫 최고관리자(owner) 등록  ← 중요(부트스트랩)
권한은 `roles` 컬렉션에 **이메일을 문서 ID**로 저장합니다. 최초 1명은 콘솔에서 직접 만듭니다.
1. **Firestore Database → 데이터 → 컬렉션 시작** → 컬렉션 ID `roles`
2. 문서 ID = **본인 구글 이메일(소문자)** (예: `chlee@kyca.or.kr`)
3. 필드 추가:
   - `role` (string) = `owner`
   - `name` (string) = 본인 이름
   - `active` (boolean) = `true`
4. 저장

이제 `admin.html`에서 해당 구글 계정으로 로그인하면 최고관리자로 접속됩니다.
다른 운영진은 콘솔의 **회원·권한** 메뉴에서 이메일로 권한을 부여하면 됩니다.

## 7. (홈 소식 연동) 복합 색인
홈 화면 "또봄 소식"은 발행된 게시글을 불러옵니다. 최초 실행 시 브라우저 콘솔에
`The query requires an index ...` 링크가 뜨면, 그 링크를 눌러 **색인 만들기**를 1회 진행하세요.
(컬렉션 `posts`, `status` 오름차순 + `createdAt` 내림차순)

---

## 역할(권한) 설명
| 역할 | 권한 |
|---|---|
| `owner` (최고관리자) | 모든 기능 + 회원·권한 관리 |
| `editor` (콘텐츠 운영자) | 게시글 작성·수정·발행·삭제 |
| `viewer` (조회 전용) | 현황·게시글 열람만 |

## 데이터 구조
- `posts/{자동ID}`: `title, body, category, status('draft'|'published'), authorEmail, authorName, createdAt, updatedAt`
- `roles/{이메일}`: `role('owner'|'editor'|'viewer'), name, active(boolean)`

## 동작 흐름
관리자 콘솔에서 글 **발행** → Firestore 저장 → 홈 "또봄 소식"에 자동 노출 + 대시보드 수치 갱신.
