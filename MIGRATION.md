# 또봄 홈페이지 이관(다른 계정으로 옮기기) 가이드

이 사이트는 **정적 웹사이트**(HTML/CSS/JS + 이미지/영상)라 어떤 계정·호스팅으로도 쉽게 옮길 수 있습니다.
사이트 내부 링크는 모두 **상대경로**라 주소가 바뀌어도 그대로 동작합니다.

> **계정에 묶인 부분은 딱 하나** — 관리자 콘솔(Firebase)의 `assets/js/firebase-config.js` 뿐입니다.
> 관리자 기능을 안 쓰면 이 파일은 신경 쓸 필요 없습니다.

이관 패키지: **`ddobom-website_이관패키지.zip`** (바탕화면) — 사이트 전체 파일이 들어 있습니다.

---

## A. 다른 GitHub 계정으로 옮기는 3가지 방법

### 방법 1) 저장소 통째로 이전 (소유권 넘기기) — 가장 간단
현재 계정(nrhoon777)에서 새 계정으로 저장소 소유권을 넘깁니다.
1. https://github.com/nrhoon777/ddobom-website/settings 접속
2. 맨 아래 **Danger Zone → Transfer** 클릭
3. 받을 **새 계정(또는 조직) 이름** 입력 → 확인
4. 새 계정에서 저장소를 받은 뒤, 아래 **C. GitHub Pages 켜기** 진행
> 기존 방문 주소(nrhoon777.github.io/...)는 새 계정 주소로 바뀝니다.

### 방법 2) 공동 관리 (둘 다 접근) — 옮기지 않고 함께 쓰기
소유권은 그대로 두고 다른 계정도 편집할 수 있게 초대합니다.
1. https://github.com/nrhoon777/ddobom-website/settings/access
2. **Add people** → 상대 GitHub 아이디/이메일 입력 → 권한 **Write** 부여
3. 상대가 초대를 수락하면 함께 편집·배포 가능

### 방법 3) 새 계정에 독립 복사본 만들기 (완전히 별개로) — 추천
새 계정에서 **자기 소유의 새 저장소**로 올립니다. 두 가지 중 택1:

**(3-a) zip 업로드 (제일 쉬움)**
1. 새 계정으로 GitHub 로그인 → **New repository** → 이름 예: `ddobom-website` → **Public** → Create
2. 저장소 첫 화면의 **uploading an existing file** 클릭
3. 바탕화면의 `ddobom-website_이관패키지.zip`을 **압축 해제**한 뒤, 안의 파일 전체를 드래그해서 업로드 → **Commit**

**(3-b) 명령어로 복사 (git 사용자)**
```bash
# 1) 현재 저장소 내려받기
git clone https://github.com/nrhoon777/ddobom-website.git
cd ddobom-website

# 2) 새 계정의 빈 저장소를 원격으로 연결 (URL은 새 계정 것으로)
git remote set-url origin https://github.com/새계정/ddobom-website.git

# 3) 올리기
git push -u origin main
```

---

## B. (관리자 콘솔을 쓸 경우만) Firebase 이관
관리자 페이지(로그인·게시글·권한)를 새 계정에서도 쓰려면, **새 Firebase 프로젝트**를 만들고 설정만 바꾸면 됩니다.
1. 새 구글 계정으로 https://console.firebase.google.com → **프로젝트 만들기**
2. 웹 앱 등록 → `firebaseConfig` 복사
3. `assets/js/firebase-config.js`의 값을 **새 프로젝트 값으로 교체**
4. **Authentication → Google 로그인 켜기**
5. **Authentication → Settings → 승인된 도메인**에 **새 사이트 주소**(예: `새계정.github.io`) 추가
6. **Firestore 생성 + `firestore.rules` 규칙 게시**
7. `roles` 컬렉션에 **본인 이메일 = owner** 문서 등록
> 자세한 절차는 `FIREBASE_SETUP.md` 참고. 기존 ttobom-h 프로젝트 데이터(게시글 등)는 자동으로 넘어가지 않으며, 새로 시작하거나 Firestore export/import로 옮길 수 있습니다.
> 관리자 기능을 안 쓴다면 이 단계는 건너뛰어도 사이트는 정상 동작합니다(설정 안내 화면만 표시).

---

## C. GitHub Pages 켜기 (새 계정에서 배포)
1. 새 저장소 → **Settings → Pages**
2. **Build and deployment → Source**: `Deploy from a branch`
3. **Branch**: `main`, 폴더 `/ (root)` → **Save**
4. 1~2분 뒤 `https://새계정.github.io/저장소이름/` 로 접속

---

## D. (선택) 커스텀 도메인 연결
자체 도메인(예: `kyca.or.kr`)이 있으면:
1. **Settings → Pages → Custom domain**에 도메인 입력
2. 도메인 업체(DNS)에서 GitHub Pages로 레코드 설정(CNAME 또는 A레코드)
3. **Enforce HTTPS** 체크

---

## E. 이관 후 체크리스트
- [ ] 새 주소로 접속해 홈/소개/사업활동/후원 페이지가 뜨는지
- [ ] 이미지·영상·로고가 보이는지 (상대경로라 대부분 그대로 동작)
- [ ] 채널 링크(인스타/유튜브/네이버카페) 정상
- [ ] (관리자 쓰면) firebase-config 교체 + 승인 도메인 변경 + owner 등록
- [ ] `README.md`의 안내용 주소를 새 주소로 수정(선택)

---

## 파일 구성 (참고)
```
index.html / about.html / programs.html / donate.html   ← 페이지
admin.html / console.html                                ← 관리자(선택, Firebase 필요)
assets/css/style.css                                     ← 디자인
assets/js/  main.js / admin.js / news-loader.js / firebase-config.js
assets/img/ , assets/video/                              ← 이미지·영상
firestore.rules / FIREBASE_SETUP.md                      ← 관리자 보안·설정
KYCA_홈페이지_리뉴얼_기획서.md                            ← 기획 문서
```
