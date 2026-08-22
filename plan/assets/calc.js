/* =====================================================================
   계산 엔진 — 자료에 실제로 있는 수치만 근거로 씁니다.
   자료에 없는 구간은 "공시이율로 연장한 추정"임을 화면에 표시합니다.
===================================================================== */
var CALC = (function () {
  "use strict";

  /* 상품 표기 — CONFIG.showBrand 가 꺼져 있으면 일반 유형명 */
  function label(p) { return CONFIG.showBrand ? p.name : p.generic; }

  /* 기준 계약 대비 배율 (금액은 여기에 비례해 환산) */
  function scale(baseAmount, amount) { return amount / baseAmount; }

  /* {연차: 환급률%} 표 보간 — 표 안이면 실제값, 밖이면 null */
  function tblAt(t, y) {
    var ys = Object.keys(t).map(Number).sort(function (a, b) { return a - b; });
    if (!ys.length) return null;
    if (y < ys[0]) return null;                       // 자료에 없는 초기 구간은 추정하지 않는다
    if (y === ys[0]) return t[ys[0]];
    for (var i = 1; i < ys.length; i++) {
      if (y <= ys[i]) {
        var a = ys[i - 1], b = ys[i];
        return t[a] + (t[b] - t[a]) * ((y - a) / (b - a));
      }
    }
    return null;
  }

  /* 표 밖 구간을 공시이율로 연장 (추정) */
  function refund(t, rate, y) {
    var v = tblAt(t, y);
    if (v != null) return { pct: v, est: false };
    var ys = Object.keys(t).map(Number).sort(function (a, b) { return a - b; });
    var last = ys[ys.length - 1], first = ys[0];
    if (y > last) return { pct: t[last] * Math.pow(1 + rate / 100, y - last), est: true };
    // 표의 첫 시점보다 앞 — 확정이율 곡선으로 역산
    var k = t[first] / Math.pow(1 + rate / 100, first);
    return { pct: k * Math.pow(1 + rate / 100, y), est: true };
  }

  /* 이율확정형 거치 곡선 — 만기 환급률에서 사업비 계수를 역산해 전 구간을 그린다.
     (10년형 158.1% / 20년형 282.0% 모두 계수 ≈ 0.90 으로 일관되게 맞는다) */
  function deferAt(finalPct, rate, years, y) {
    var r = 1 + rate / 100;
    var k = finalPct / Math.pow(r, years);
    return k * Math.pow(r, y);
  }

  /* 확정기간 연금 월 수령액 */
  function annuity(fund, rate, months) {
    var r = rate / 100 / 12;
    if (r <= 0) return fund / months;
    return fund * r / (1 - Math.pow(1 + r, -months));
  }

  /* 원금을 헐지 않고 이자만 받는 고정 수령 */
  function interestOnly(fund, rate) { return fund * (rate / 100) / 12; }

  /* 자유 입출금 — 해지하지 않고 빼 쓰고 다시 채우는 경우
     events: [{ y: 경과연차, amount: 음수=인출 / 양수=추가납입 }] */
  function flex(startFund, rate, events, years) {
    var r = rate / 100, fund = startFund, rows = [{ y: 0, fund: fund }];
    for (var y = 1; y <= years; y++) {
      var ev = 0;
      (events || []).forEach(function (e) { if (e.y === y) ev += e.amount; });
      fund = Math.max(0, fund + ev) * (1 + r);
      rows.push({ y: y, fund: fund });
    }
    return rows;
  }

  /* 사망배수 — 표에 없는 나이는 앞뒤 값으로 보간 */
  function multipleAt(tbl, age) {
    var ages = Object.keys(tbl).map(Number).sort(function (a, b) { return a - b; });
    if (age <= ages[0]) return tbl[ages[0]];
    if (age >= ages[ages.length - 1]) return tbl[ages[ages.length - 1]];
    for (var i = 1; i < ages.length; i++) {
      if (age <= ages[i]) {
        var a = ages[i - 1], b = ages[i];
        return tbl[a] + (tbl[b] - tbl[a]) * ((age - a) / (b - a));
      }
    }
    return tbl[ages[0]];
  }

  /* 목표 금액을 만들려면 얼마를 넣어야 하나 — 환급률 표 기준 역산 */
  function needFor(goal, pct) { return goal / (pct / 100); }

  return {
    label: label, scale: scale, tblAt: tblAt, refund: refund, deferAt: deferAt,
    annuity: annuity, interestOnly: interestOnly, flex: flex,
    multipleAt: multipleAt, needFor: needFor
  };
})();
