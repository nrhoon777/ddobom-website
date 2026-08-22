import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const env = await initializeTestEnvironment({
  projectId: 'demo-ttobom',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

const fails = [];
async function t(name, fn, expect) {
  try {
    await (expect === 'ok' ? assertSucceeds(fn()) : assertFails(fn()));
    console.log('  PASS ' + name);
  } catch (e) {
    console.log('  FAIL ' + name + '  → ' + String(e.message).split('\n')[0]);
    fails.push(name);
  }
}
const OK = 'ok', NO = 'no';

// ---------- 시드 (규칙 우회) ----------
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'roles/boss@kyca.or.kr'),  { role: 'owner', active: true });
  await setDoc(doc(db, 'roles/staff@kyca.or.kr'), { role: 'editor', active: true });
  await setDoc(doc(db, 'roles/view@kyca.or.kr'),  { role: 'viewer', active: true });
  await setDoc(doc(db, 'roles/desk@eye.co.kr'),   { role: 'hospital', active: true, partnerId: 'TTB-EYE01' });
  await setDoc(doc(db, 'roles/other@x.co.kr'),    { role: 'hospital', active: true, partnerId: 'TTB-OTHER' });
  await setDoc(doc(db, 'partners/TTB-EYE01'),     { name: '봄안과', mode: 'revenue_share', rate: 10, active: true });
  await setDoc(doc(db, 'partnerPublic/TTB-EYE01'),{ name: '봄안과', active: true });
  await setDoc(doc(db, 'partnerPublic/TTB-STOP'), { name: '중지처', active: false });
  for (const id of ['r1', 'r2', 'rLock']) {
    await setDoc(doc(db, 'referrals/' + id), {
      partnerId: 'TTB-EYE01', status: 'visited', visitDate: '2026-08-05', revenue: 100000, month: '2026-08',
      ttobomConfirmed: false, hospitalConfirmed: false, locked: id === 'rLock', nameMasked: '홍*동', phone: '010-1-2',
    });
  }
  await setDoc(doc(db, 'referrals/rOther'), {
    partnerId: 'TTB-OTHER', status: 'visited', revenue: 1, month: '2026-08',
    ttobomConfirmed: false, hospitalConfirmed: false, locked: false,
  });
  await setDoc(doc(db, 'posts/draft1'), { status: 'draft', title: '비공개' });
  await setDoc(doc(db, 'auditLogs/a1'), { by: 'boss@kyca.or.kr', partnerId: 'TTB-EYE01', action: 'x' });
});

const asUser = (email) => env.authenticatedContext(email.replace(/\W/g, ''), { email }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const boss = asUser('boss@kyca.or.kr');
const staff = asUser('staff@kyca.or.kr');
const viewer = asUser('view@kyca.or.kr');
const desk = asUser('desk@eye.co.kr');
const other = asUser('other@x.co.kr');

console.log('\n[A] 이중 확인 — 남의 확인란은 못 쓴다');
await t('병원이 ttobomConfirmed 쓰기 → 거부',
  () => updateDoc(doc(desk, 'referrals/r1'), { ttobomConfirmed: true, ttobomBy: 'desk@eye.co.kr' }), NO);
await t('또봄이 hospitalConfirmed 쓰기 → 거부',
  () => updateDoc(doc(staff, 'referrals/r1'), { hospitalConfirmed: true, hospitalBy: 'staff@kyca.or.kr' }), NO);
await t('병원이 자기 확인란 쓰기 → 허용',
  () => updateDoc(doc(desk, 'referrals/r1'), { hospitalConfirmed: true, hospitalBy: 'desk@eye.co.kr', hospitalAt: new Date() }), OK);
await t('또봄이 자기 확인란 쓰기 → 허용',
  () => updateDoc(doc(staff, 'referrals/r1'), { ttobomConfirmed: true, ttobomBy: 'staff@kyca.or.kr', ttobomAt: new Date() }), OK);
await t('병원이 남의 이메일로 확인 서명 → 거부',
  () => updateDoc(doc(desk, 'referrals/r2'), { hospitalConfirmed: true, hospitalBy: 'boss@kyca.or.kr' }), NO);
await t('병원이 이미 한 확인을 되돌리기 → 거부',
  () => updateDoc(doc(desk, 'referrals/r1'), { hospitalConfirmed: false }), NO);
await t('조회 전용 계정이 확인 처리 → 거부',
  () => updateDoc(doc(viewer, 'referrals/r2'), { ttobomConfirmed: true, ttobomBy: 'view@kyca.or.kr' }), NO);

console.log('\n[B] 제휴처 격리');
await t('병원이 자기 건 읽기 → 허용', () => getDoc(doc(desk, 'referrals/r1')), OK);
await t('병원이 타 제휴처 건 읽기 → 거부', () => getDoc(doc(desk, 'referrals/rOther')), NO);
await t('병원이 타 제휴처 건 수정 → 거부',
  () => updateDoc(doc(desk, 'referrals/rOther'), { hospitalConfirmed: true, hospitalBy: 'desk@eye.co.kr' }), NO);
await t('병원이 타 제휴처 계약정보 읽기 → 거부', () => getDoc(doc(other, 'partners/TTB-EYE01')), NO);
await t('병원이 자기 계약정보 읽기 → 허용', () => getDoc(doc(desk, 'partners/TTB-EYE01')), OK);
await t('병원이 요율 변경 → 거부', () => updateDoc(doc(desk, 'partners/TTB-EYE01'), { rate: 50 }), NO);
await t('병원이 비공개 게시글 읽기 → 거부', () => getDoc(doc(desk, 'posts/draft1')), NO);
await t('또봄이 비공개 게시글 읽기 → 허용', () => getDoc(doc(staff, 'posts/draft1')), OK);
await t('병원이 본인 권한문서 읽기 → 허용', () => getDoc(doc(desk, 'roles/desk@eye.co.kr')), OK);
await t('병원이 남의 권한문서 읽기 → 거부', () => getDoc(doc(desk, 'roles/boss@kyca.or.kr')), NO);
await t('병원이 스스로 권한 승격 → 거부', () => setDoc(doc(desk, 'roles/desk@eye.co.kr'), { role: 'owner', active: true }), NO);

console.log('\n[C] 마감 잠금');
await t('병원이 마감 건 수정 → 거부',
  () => updateDoc(doc(desk, 'referrals/rLock'), { revenue: 999 }), NO);
await t('또봄 운영자가 마감 건 수정 → 거부',
  () => updateDoc(doc(staff, 'referrals/rLock'), { ttobomConfirmed: true, ttobomBy: 'staff@kyca.or.kr' }), NO);
await t('운영자가 마감 해제 → 거부', () => updateDoc(doc(staff, 'referrals/rLock'), { locked: false }), NO);
await t('최고관리자가 마감 해제 → 허용', () => updateDoc(doc(boss, 'referrals/rLock'), { locked: false }), OK);
await t('마감된 건 삭제 → 거부', async () => {
  await env.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), 'referrals/rLock'), { locked: true }));
  return deleteDoc(doc(boss, 'referrals/rLock'));
}, NO);

console.log('\n[D] 공개 신청 폼');
const goodNew = {
  partnerId: 'TTB-EYE01', source: 'web', createdAt: new Date(), nameMasked: '김*수', phone: '010-1-2',
  phoneTail: '1234', personKey: 'abc', preferTime: '', memo: '', consent: true, consentAt: new Date(),
  status: 'requested', visitDate: '', revenue: 0, ttobomConfirmed: false, hospitalConfirmed: false, locked: false,
};
await t('비로그인 정상 신청 → 허용', () => addDoc(collection(anon(), 'referrals'), goodNew), OK);
await t('없는 제휴처 코드로 신청 → 거부',
  () => addDoc(collection(anon(), 'referrals'), { ...goodNew, partnerId: 'NOPE' }), NO);
await t('중지된 제휴처로 신청 → 거부',
  () => addDoc(collection(anon(), 'referrals'), { ...goodNew, partnerId: 'TTB-STOP' }), NO);
await t('확인란을 켠 채 신청 → 거부',
  () => addDoc(collection(anon(), 'referrals'), { ...goodNew, hospitalConfirmed: true }), NO);
await t('매출액을 넣은 채 신청 → 거부',
  () => addDoc(collection(anon(), 'referrals'), { ...goodNew, revenue: 5000000 }), NO);
await t('동의 없이 신청 → 거부',
  () => addDoc(collection(anon(), 'referrals'), { ...goodNew, consent: false }), NO);
await t('허용되지 않은 필드(진료내용) 포함 → 거부',
  () => addDoc(collection(anon(), 'referrals'), { ...goodNew, diagnosis: '백내장' }), NO);
await t('비로그인 소개 건 읽기 → 거부', () => getDoc(doc(anon(), 'referrals/r1')), NO);
await t('비로그인 제휴처 공개정보 읽기 → 허용', () => getDoc(doc(anon(), 'partnerPublic/TTB-EYE01')), OK);
await t('비로그인 계약 요율 읽기 → 거부', () => getDoc(doc(anon(), 'partners/TTB-EYE01')), NO);

console.log('\n[E] 월 정산 서명');
const base = { partnerId: 'TTB-EYE01', month: '2026-08', mode: 'revenue_share', rate: 10,
               count: 1, revenueSum: 1500000, amount: 150000, status: 'open', updatedAt: new Date() };
await t('또봄이 병원 서명까지 넣어 생성 → 거부',
  () => setDoc(doc(staff, 'settlements/TTB-EYE01_202608'),
    { ...base, hospitalSignedBy: 'desk@eye.co.kr', hospitalSignedAt: new Date() }), NO);
await t('또봄이 기준 수치 + 자기 서명으로 생성 → 허용',
  () => setDoc(doc(staff, 'settlements/TTB-EYE01_202608'),
    { ...base, ttobomSignedBy: 'staff@kyca.or.kr', ttobomSignedAt: new Date() }), OK);
await t('또봄이 서명 후 기준 수치 변경 → 거부',
  () => updateDoc(doc(staff, 'settlements/TTB-EYE01_202608'), { revenueSum: 9999999, amount: 999999 }), NO);
await t('병원이 기준 수치 변경 → 거부',
  () => updateDoc(doc(desk, 'settlements/TTB-EYE01_202608'), { revenueSum: 1, amount: 1 }), NO);
await t('병원이 또봄 서명 덮어쓰기 → 거부',
  () => updateDoc(doc(desk, 'settlements/TTB-EYE01_202608'), { ttobomSignedBy: 'desk@eye.co.kr' }), NO);
await t('병원이 자기 서명 추가 → 허용',
  () => updateDoc(doc(desk, 'settlements/TTB-EYE01_202608'),
    { hospitalSignedBy: 'desk@eye.co.kr', hospitalSignedAt: new Date(), updatedAt: new Date() }), OK);
await t('병원이 서명 후 자기 서명 다시 쓰기 → 거부',
  () => updateDoc(doc(desk, 'settlements/TTB-EYE01_202608'),
    { hospitalSignedBy: 'desk@eye.co.kr', hospitalSignedAt: new Date() }), NO);
await t('타 제휴처 정산 읽기 → 거부', () => getDoc(doc(other, 'settlements/TTB-EYE01_202608')), NO);
await t('또봄 입금 완료 처리 → 허용',
  () => updateDoc(doc(staff, 'settlements/TTB-EYE01_202608'),
    { paidBy: 'staff@kyca.or.kr', paidAt: new Date(), status: 'paid', updatedAt: new Date() }), OK);
await t('정산 기록 삭제 → 거부', () => deleteDoc(doc(boss, 'settlements/TTB-EYE01_202608')), NO);

console.log('\n[F] 감사 로그는 지워지지 않는다');
await t('본인 이메일로 로그 기록 → 허용',
  () => addDoc(collection(desk, 'auditLogs'), { by: 'desk@eye.co.kr', partnerId: 'TTB-EYE01', action: 'confirm' }), OK);
await t('남의 이메일로 로그 위조 → 거부',
  () => addDoc(collection(desk, 'auditLogs'), { by: 'boss@kyca.or.kr', partnerId: 'TTB-EYE01', action: 'confirm' }), NO);
await t('로그 수정 → 거부', () => updateDoc(doc(boss, 'auditLogs/a1'), { action: 'changed' }), NO);
await t('로그 삭제 → 거부', () => deleteDoc(doc(boss, 'auditLogs/a1')), NO);
await t('병원이 자기 제휴처 로그 읽기 → 허용', () => getDoc(doc(desk, 'auditLogs/a1')), OK);
await t('병원이 타 제휴처 로그 읽기 → 거부', () => getDoc(doc(other, 'auditLogs/a1')), NO);

await env.cleanup();
console.log('\n' + (fails.length ? `❌ 규칙 테스트 실패 ${fails.length}건:\n - ` + fails.join('\n - ') : '✅ 규칙 테스트 전부 통과'));
process.exit(fails.length ? 1 : 0);
