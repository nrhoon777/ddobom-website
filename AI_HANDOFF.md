# AI 인수인계 문서 (또봄 홈페이지) — 다른 Claude 계정/AI 플랫폼에서 이어서 작업하기

> **이 문서 하나로 새 AI가 프로젝트를 바로 이어받을 수 있도록** 전체 맥락을 정리했습니다.
> 새 세션/플랫폼에서 이 저장소를 열고, 이 파일 + `KYCA_홈페이지_리뉴얼_기획서.md`를 먼저 읽게 하세요.

---

## 0. 한 줄 요약 & 가장 중요한 주의점
청년 암 경험자 지원 비영리단체 **사단법인 한국청년암협회 또봄**의 **반응형 홈페이지**(정적 사이트, GitHub Pages 배포).

⚠️ **혼동 주의:** 도메인이 `kyca.or.kr`이고 약자가 KYCA라 '한국청소년상담복지센터협의회'로 오인하기 쉬우나 **전혀 다른 단체**임. KYCA = **Korea Young Cancer Association** = 20·30대 **청년 암 경험자** 지원 단체(2020년 8월 설립, 대표 **이정훈**). '또봄' = '다시 봄'(희망). 슬로건 **"I SEE U AGAIN"**, "OVERCOMING 2030's CANCER".

---

## 1. 링크 · 계정 (핵심 좌표)
| 항목 | 값 |
|---|---|
| 라이브 사이트 | https://nrhoon777.github.io/ddobom-website/ |
| GitHub 저장소 | https://github.com/nrhoon777/ddobom-website (Public) |
| GitHub 계정 | nrhoon777 |
| Firebase 프로젝트(관리자용) | `ttobom-h` (console.firebase.google.com) |
| 채널 | 인스타 instagram.com/iseeuagain · 유튜브 @tvttottobomtv · 네이버카페 cafe.naver.com/iseeuagain |
| 후원 계좌 | SC제일은행 202-20-132734 (예금주: 사단법인 한국청년암협회또봄) |

> 새 계정/플랫폼으로 **완전 이관**하려면 `MIGRATION.md` 참고(저장소 이전 or 새 계정 복사 + Firebase 재설정).

---

## 2. 기술 스택 & 배포 방법
- **순수 정적 사이트**: HTML + CSS + 바닐라 JS. 빌드 도구·프레임워크 없음. 모든 내부 링크는 **상대경로**(이관 안전).
- **호스팅**: GitHub Pages (main 브랜치 root). **push하면 1~2분 뒤 자동 재배포.**
- **관리자 콘솔만** Firebase(Authentication + Firestore) 사용 — 클라이언트 SDK(CDN), 서버 없음.
- **배포 확인**: push 후 `https://.../파일?v=랜덤`으로 fetch해 반영 확인(캐시 우회).

### 자주 쓰는 명령 (이 환경 기준)
```bash
git add -A && git commit -m "..." && git push origin main
# gh CLI 전체경로: "C:\Program Files\GitHub CLI\gh.exe"
# Pages 빌드 상태: gh api repos/nrhoon777/ddobom-website/pages/builds/latest --jq '.status'
```

---

## 3. 파일 구조
```
index.html          홈 (풀스크린 영상 히어로·미션·임팩트·사업활동·영상·후원·채널·소식·참여)
about.html          또봄 소개 (설립 스토리·미션 카드·연혁 타임라인)
programs.html       사업·활동 (또봄클래스·앎·Cheer UP·또또봄TV, 이미지 포함)
donate.html         후원하기 (무기명/로그인 후원, 금액 선택, 신뢰 섹션)
admin.html / console.html   관리자 콘솔(Firebase 연동. console.html은 캐시우회용 동일 사본)
partners.html               제휴 병원 연계·정산 콘솔 (또봄/병원 공용, 역할별 화면 분기)
refer.html                  제휴 병원 상담 신청 폼 (공개, ?code=제휴처코드)
assets/js/partners.js       제휴 콘솔 로직 (이중 확인·대사·월 정산 서명)
assets/js/refer.js          소개 신청 폼 로직 (동의·마스킹·해시키)
tests/                      firestore.rules 보안 규칙 테스트 (에뮬레이터, 49건)
PARTNER_SETTLEMENT.md       제휴 정산 시스템 설계·운영·법적 주의사항
assets/css/style.css        디자인 시스템 전체 (섹션 번호 주석 0~27로 구성)
assets/js/main.js           네비·스크롤 리빌·카운터·후원폼 토글
assets/js/admin.js          관리자: 로그인·권한·게시글 CRUD·대시보드
assets/js/news-loader.js    홈 소식을 Firestore 발행글로 동적 로드
assets/js/firebase-config.js  ★계정 종속 유일 파일 (Firebase 설정)
assets/img/ , assets/video/   로고·사진·영상
firestore.rules             Firestore 보안 규칙 (roles 이메일ID: owner/editor/viewer/hospital)
KYCA_홈페이지_리뉴얼_기획서.md  기획/디자인/개발 교차검증 기획서 (배경·IA·페르소나)
FIREBASE_SETUP.md / MIGRATION.md / AI_HANDOFF.md(이 문서)
```

---

## 4. 디자인 시스템 (요약)
- **브랜드 4색(로고)**: 청록 `#17b39a`(primary) · 오렌지 `#f06f2c` · 파랑 `#3f8edc` · 보라 `#8455c9`
- **포인트/후원 컬러**: **라임 `#DCFF50`** — 플로팅 후원 버튼 + 모든 후원 버튼(`.btn--secondary`)에 사용(글씨는 어둡게 `#16241a`)
- **시안(또봄홈페이지시안_2507) 톤**: 딥네이비 배경 + 청록/민트 네온 + 피어나는 꽃, "Hope Blooms" 무드. 히어로는 어두운 영상 배경 + 민트 강조.
- **폰트**: 본문 Pretendard, 헤드라인 Pretendard 800(클린 볼드, 세이브더칠드런풍). Gowun Batang/Jua/Nanum Pen 로드는 되어있음.
- **한글 줄바꿈**: 전역 `word-break: keep-all` 적용(단어 단위).
- **반응형**: 모바일 우선. 아이콘/카드류는 모바일 2×2 또는 2열. 브레이크포인트 767/1023/1439.
- **접근성**: 스킵링크·시맨틱·포커스·44px 터치·alt·`prefers-reduced-motion` 대응.

---

## 5. 지금까지 완료된 것
- 반응형 전 페이지, 실제 로고/파비콘, 메인 영상 히어로(모바일 잘림 방지 contain)
- 감성 카피("청춘에 찾아온 암, 그래도 다시 봄은 옵니다")
- 사업·활동(위케어리셋·TOGETHER CAMP 삭제됨), 또봄클래스 지난 클래스+인스타/카페 신청 안내, 프로그램 이미지/포스터
- 영상 가로 스크롤, 채널 한 줄 칩, 소식(미진행 항목 삭제)
- 소개: 대표 이정훈, 설립 스토리 재작성, 미션 이미지 카드, 연혁 최신순 타임라인
- 후원 페이지: 무기명/로그인 후원 UI(구글·카카오·애플·휴대폰·이메일 = **데모, 미연동**), 계좌 반영
- 관리자 콘솔 Firebase 코드 완성 — **로그인·권한·게시글·대시보드**. `firebase-config.js`에 ttobom-h 값 입력됨.
- 모바일 폰트 확대·2×2 그리드·체크박스 줄깨짐 수정·keep-all 등 가독성 개선

---

## 6. 남은 작업(TODO)
- [ ] **관리자 콘솔 활성 마무리**(Firebase 콘솔 설정): Google 로그인 켜기 / 승인도메인 `nrhoon777.github.io` / Firestore 규칙 게시 / `roles/{이메일}=owner` 부트스트랩. (사용자만 가능, `FIREBASE_SETUP.md` 참고)
- [ ] **후원 결제(PG) 실연동** — 현재 로그인/결제는 데모. 기부금영수증·정기결제 등은 백엔드 필요(기획서 오픈이슈 참고).
- [ ] **동의된 활동 사진** 반영 — 실제 환우 사진은 `동의서 필요` 상태라 미사용(포스터/브랜드 그래픽만 사용 중). 프라이버시 주의.
- [ ] (선택) 다크 테마 통일, 유튜브 영상 임베드, 대표 사진, 커스텀 도메인(kyca.or.kr)

---

## 7. 반드시 알아야 할 함정(gotcha)
- **모바일/사내망 캐시가 매우 강함**: JS 모듈은 `?v=2` 같은 버전 쿼리로 캐시 우회 중. HTML까지 캐시되면 `admin.html?fresh=1`처럼 쿼리를 붙이거나 새 경로(`console.html`)를 사용. 배포 확인 fetch에도 `?r=랜덤` 붙일 것.
- **PowerShell에서 git push의 빨간 출력**은 stderr 표시일 뿐 실패 아님(성공 시 `... main -> main` 라인 확인).
- **GitHub Pages가 원인불명으로 한 번 자동 비활성화된 적 있음** — 404 나면 has_pages 확인 후 Settings→Pages에서 재설정(또는 API로 재활성).
- **원본 자료 폴더(이 PC 로컬)**: `C:\Users\SKTelecom\Desktop\P\또봄`(로고/사진/영상), `C:\Users\SKTelecom\Desktop\P\*.pptx/docx/pdf`(소개서·연혁·시안·후원제안서). 다른 PC/플랫폼엔 없으니, 필요 자산은 이미 `assets/`로 복사되어 저장소에 포함됨.

---

## 8. 다른 AI 플랫폼에서 이어가는 법
1. 이 **GitHub 저장소(공개)** 를 새 AI에게 주거나 clone: `git clone https://github.com/nrhoon777/ddobom-website.git`
2. 새 AI에게 **먼저 이 `AI_HANDOFF.md`와 `KYCA_홈페이지_리뉴얼_기획서.md`를 읽게** 하기.
3. 편집·배포하려면 새 환경에 **git + 해당 GitHub 계정 인증**이 필요(또는 `MIGRATION.md`대로 새 계정으로 이관 후 진행).
4. 관리자 기능까지 이어가려면 Firebase `ttobom-h` 접근 권한 또는 새 프로젝트로 교체.

> 요약: **코드는 공개 저장소에 다 있고, 이 문서가 맥락을 담고 있음.** 새 AI는 저장소 + 이 문서만 있으면 바로 이어서 작업 가능.
