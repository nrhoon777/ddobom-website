/* =====================================================================
   계산 엔진 — 순수 계산만. 화면과 무관.
   data.js 의 PRODUCTS 정의를 받아 동작하므로,
   실제 상품 데이터를 넣으면 이 파일은 그대로 두면 됩니다.
===================================================================== */
var CALC = (function () {
  "use strict";

  /* 경과 연차별 적립비율 (환급률 표가 없을 때만 사용) */
  function credit(p, year) {
    var t = p.credit || [[999, 0.9]];
    for (var i = 0; i < t.length; i++) if (year <= t[i][0]) return t[i][1];
    return t[t.length - 1][1];
  }

  /* 그 시점까지 낸 보험료 누계 */
  function paidBy(monthly, term, year) {
    return monthly * 12 * Math.min(year, term);
  }
  function totalPaid(monthly, term) { return monthly * 12 * term; }

  /* 환급률 표 보간 — 가입설계서 표가 있으면 그것이 진실 */
  function refundPct(p, term, year) {
    if (!p.refund || !p.refund[term]) return null;
    var tbl = p.refund[term];
    var ys = Object.keys(tbl).map(Number).sort(function (a, b) { return a - b; });
    if (!ys.length) return null;
    if (year <= ys[0]) return (tbl[ys[0]] / ys[0]) * year;              // 0에서 첫 값까지 직선
    for (var i = 1; i < ys.length; i++) {
      if (year <= ys[i]) {
        var a = ys[i - 1], b = ys[i];
        return tbl[a] + (tbl[b] - tbl[a]) * ((year - a) / (b - a));
      }
    }
    return null;                                                        // 표 밖 → fundAt 이 이율로 연장
  }

  /* 경과 year 시점의 적립금(해지환급금 기준) */
  function fundAt(p, monthly, term, year, rate) {
    var r = rate / 100;
    if (p.refund && p.refund[term]) {
      var ys = Object.keys(p.refund[term]).map(Number).sort(function (a, b) { return a - b; });
      var last = ys[ys.length - 1];
      if (year <= last) {
        return paidBy(monthly, term, year) * refundPct(p, term, year) / 100;
      }
      var base = paidBy(monthly, term, last) * p.refund[term][last] / 100;
      return base * Math.pow(1 + r, year - last);                       // 표 마지막 이후는 이율로 연장
    }
    // 표가 없으면 월 단위 시뮬레이션 (사업비 차감 + 월복리)
    var m = r / 12, fund = 0;
    for (var k = 1; k <= Math.round(year * 12); k++) {
      var y = Math.ceil(k / 12);
      fund *= (1 + m);
      if (y <= term) fund += monthly * credit(p, y);
    }
    return fund;
  }

  /* 연차별 곡선 (그래프용) */
  function curve(p, monthly, term, years, rate) {
    var out = [];
    for (var y = 0; y <= years; y++) {
      out.push({ y: y, paid: paidBy(monthly, term, y), fund: y ? fundAt(p, monthly, term, y, rate) : 0 });
    }
    return out;
  }

  /* 확정기간 연금 월 수령액 */
  function annuity(fund, rate, months) {
    var r = rate / 100 / 12;
    if (r <= 0) return fund / months;
    return fund * r / (1 - Math.pow(1 + r, -months));
  }

  /* 원금을 헐지 않고 이자만 받는 고정 수령 (즉시 지급형) */
  function interestOnly(fund, payoutRate) {
    return fund * (payoutRate / 100) / 12;
  }

  /* ── 스노볼 인출 시뮬레이션 ────────────────────────────────────
     개시 시점부터 매년 draw 만큼 빼고, 남은 돈은 계속 굴린다.      */
  function withdraw(p, monthly, term, startYear, draw, rate, horizon) {
    var r = rate / 100;
    var fund = fundAt(p, monthly, term, startYear, rate);
    var paid = totalPaid(monthly, term);
    var rows = [{ y: startYear, fund: fund, drawn: 0, pct: (fund / paid) * 100 }];
    var drawn = 0;
    for (var y = startYear + 1; y <= startYear + horizon; y++) {
      fund = Math.max(0, fund - draw) * (1 + r);
      // 납입기간이 아직 남아 있으면 계속 납입분도 쌓인다
      if (y <= term) fund += monthly * 12 * credit(p, y);
      drawn += draw;
      rows.push({ y: y, fund: fund, drawn: drawn, pct: (fund / paid) * 100, total: (fund + drawn) / paid * 100 });
    }
    return { rows: rows, paid: paid };
  }

  /* 목표 금액을 만들려면 월 얼마? — 이분 탐색 */
  function solveMonthly(p, term, targetYear, goal, rate) {
    var lo = 1000, hi = 100000000, mid;
    for (var i = 0; i < 60; i++) {
      mid = (lo + hi) / 2;
      if (fundAt(p, mid, term, targetYear, rate) < goal) lo = mid; else hi = mid;
    }
    return hi;
  }

  /* 은행 적금 만기 (정액적립식·단리, 이자소득세 차감) */
  function bankSavings(monthly, years, bankRate, taxPct) {
    var n = years * 12, principal = monthly * n, interest = 0;
    for (var i = 1; i <= n; i++) interest += monthly * (bankRate / 100) * ((n - i + 1) / 12);
    var tax = interest * (taxPct / 100);
    return { principal: principal, interest: interest, tax: tax, net: principal + interest - tax };
  }

  return {
    credit: credit, paidBy: paidBy, totalPaid: totalPaid,
    refundPct: refundPct, fundAt: fundAt, curve: curve,
    annuity: annuity, interestOnly: interestOnly,
    withdraw: withdraw, solveMonthly: solveMonthly, bankSavings: bankSavings
  };
})();
