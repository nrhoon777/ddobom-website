# 보안 규칙 테스트

`firestore.rules`가 제휴 정산의 핵심 원칙을 실제로 강제하는지 검증합니다.
규칙을 고쳤다면 **반드시 이 테스트를 돌리고 배포하세요.**

검증 항목 (49건)
- 또봄은 병원 확인란을, 병원은 또봄 확인란을 쓸 수 없다
- 병원은 자기 제휴처 건만 읽고 쓸 수 있다 (게시글·타 제휴처 계약조건 접근 불가)
- 마감된 건은 아무도 못 고친다 (해제는 최고관리자만)
- 공개 신청 폼은 정해진 모양의 신규 건만 만들 수 있다 (확인란·매출액·임의 필드 차단)
- 정산 기준 수치는 최초 집계 후 누구도 못 바꾸고, 서명은 각자 자기 것만
- 감사 로그는 생성만 가능하고 수정·삭제가 불가능하다

## 실행

저장소 루트에서 실행합니다.

```bash
npm install --no-save firebase-tools @firebase/rules-unit-testing firebase
npx firebase emulators:exec --only firestore --project demo-ttobom "node tests/firestore-rules.test.mjs"
```

Java 11 이상이 필요합니다(Firestore 에뮬레이터). 실패 항목은 이름과 함께 마지막에 요약됩니다.
