/**
 * 경제성 계산 공식 검증 스크립트 (순수 Node.js 실행)
 */

function presentWorthFactorSeries(i, n) {
  if (n <= 0) return 0;
  if (i === 0) return n;
  return (Math.pow(1 + i, n) - 1) / (i * Math.pow(1 + i, n));
}

function presentWorthFactorSingle(i, n) {
  if (n <= 0) return 1;
  if (i === 0) return 1;
  return Math.pow(1 + i, -n);
}

function calculateAnnualEnergyCost(annualDistanceKm, efficiency, energyPrice) {
  if (efficiency <= 0 || annualDistanceKm <= 0 || energyPrice <= 0) return 0;
  return Math.round((annualDistanceKm / efficiency) * energyPrice);
}

function evaluateFleetReplacement(input) {
  const n = input.analysis_period_years;
  const rateDecimal = input.discount_rate_pct / 100;

  const paFactor = presentWorthFactorSeries(rateDecimal, n);
  const pfFactor = presentWorthFactorSingle(rateDecimal, n);

  // 1. 기존 차량 유지 대안
  const existingEnergy = calculateAnnualEnergyCost(
    input.annual_distance_km,
    input.existing.efficiency,
    input.existing.energy_price
  );

  const existingAnnualOperatingTotal =
    existingEnergy +
    input.existing.annual_maintenance +
    input.existing.annual_tax +
    input.existing.annual_insurance;

  const existingPvOperating = Math.round(existingAnnualOperatingTotal * paFactor);
  const existingPvSalvage = Math.round(input.existing.expected_salvage_value * pfFactor);
  const existingTotalPv = existingPvOperating - existingPvSalvage;

  // 2. 신규 차량 교체 대안
  const replacementInitialOutlay =
    input.replacement.purchase_price +
    input.replacement.incidental_cost -
    input.replacement.subsidy -
    input.existing.current_market_value;

  const replacementEnergy = calculateAnnualEnergyCost(
    input.annual_distance_km,
    input.replacement.efficiency,
    input.replacement.energy_price
  );

  const replacementAnnualOperatingTotal =
    replacementEnergy +
    input.replacement.annual_maintenance +
    input.replacement.annual_tax +
    input.replacement.annual_insurance;

  const replacementPvOperating = Math.round(replacementAnnualOperatingTotal * paFactor);
  const replacementPvSalvage = Math.round(input.replacement.expected_salvage_value * pfFactor);
  const replacementTotalPv = replacementInitialOutlay + replacementPvOperating - replacementPvSalvage;

  const deltaPv = replacementTotalPv - existingTotalPv;
  let recommended = 'indifferent';
  let savings = 0;

  if (deltaPv < 0) {
    recommended = 'replace';
    savings = Math.abs(deltaPv);
  } else if (deltaPv > 0) {
    recommended = 'keep';
    savings = deltaPv;
  }

  return {
    existingPvOperating,
    existingPvSalvage,
    existingTotalPv,
    replacementInitialOutlay,
    replacementPvOperating,
    replacementPvSalvage,
    replacementTotalPv,
    deltaPv,
    recommended,
    savings,
  };
}

// === 검증 실행 ===
console.log('----------------------------------------------------');
console.log('1. 계수 산출 검증');
console.log('- P/A (i=0%, n=5) =', presentWorthFactorSeries(0, 5), '(기대치: 5)');
console.log('- P/F (i=0%, n=5) =', presentWorthFactorSingle(0, 5), '(기대치: 1)');
console.log('- P/A (i=10%, n=1) =', presentWorthFactorSeries(0.1, 1).toFixed(6), `(기대치: ${(1/1.1).toFixed(6)})`);
console.log('- P/F (i=10%, n=1) =', presentWorthFactorSingle(0.1, 1).toFixed(6), `(기대치: ${(1/1.1).toFixed(6)})`);

console.log('\n----------------------------------------------------');
console.log('2. 손계산 사례 1 검증 (할인율 0%, 2년)');
const case1 = {
  analysis_period_years: 2,
  annual_distance_km: 10000,
  discount_rate_pct: 0,
  existing: {
    current_market_value: 10000000, // 1000만
    efficiency: 10,
    energy_price: 2000, // 연 에너지비 200만
    annual_maintenance: 500000,
    annual_tax: 300000,
    annual_insurance: 700000, // 연간 운영비 350만
    expected_salvage_value: 5000000, // 2년후 500만
  },
  replacement: {
    purchase_price: 30000000,
    incidental_cost: 1000000,
    subsidy: 5000000,
    efficiency: 5,
    energy_price: 300, // 연 에너지비 60만
    annual_maintenance: 200000,
    annual_tax: 100000,
    annual_insurance: 800000, // 연간 운영비 170만
    expected_salvage_value: 15000000,
  },
};
const res1 = evaluateFleetReplacement(case1);
console.log('- 기존 유지 연간운영비 현가: 3,500,000 * 2 = 7,000,000');
console.log('- 기존 유지 잔존가치 현가: 5,000,000');
console.log('- 기존 유지 PV:', res1.existingTotalPv, '(손계산: 2,000,000)');
console.log('- 신차 교체 초기순투자: 3000만+100만-500만-1000만 = 16,000,000');
console.log('- 신차 교체 운영비 현가: 1,700,000 * 2 = 3,400,000');
console.log('- 신차 교체 잔존가치 현가: 15,000,000');
console.log('- 신차 교체 PV:', res1.replacementTotalPv, '(손계산: 4,400,000)');
console.log('- 비용 차이 Delta PV:', res1.deltaPv, '(손계산: +2,400,000, 유리대안: keep)');
console.log('- 판정 결과:', res1.recommended, '절감액:', res1.savings);

if (res1.existingTotalPv === 2000000 && res1.replacementTotalPv === 4400000 && res1.recommended === 'keep') {
  console.log('>>> [성공] 사례 1 (할인율 0%) 완벽 일치!');
} else {
  console.error('>>> [실패] 사례 1 불일치!');
  process.exit(1);
}

console.log('\n----------------------------------------------------');
console.log('3. 손계산 사례 2 검증 (할인율 10%, 1년)');
const case2 = {
  analysis_period_years: 1,
  annual_distance_km: 10000,
  discount_rate_pct: 10,
  existing: {
    current_market_value: 0,
    efficiency: 10,
    energy_price: 1100, // 연 110만
    annual_maintenance: 0,
    annual_tax: 0,
    annual_insurance: 0,
    expected_salvage_value: 0,
  },
  replacement: {
    purchase_price: 500000, // 초기 50만
    incidental_cost: 0,
    subsidy: 0,
    efficiency: 10,
    energy_price: 220, // 연 22만
    annual_maintenance: 0,
    annual_tax: 0,
    annual_insurance: 0,
    expected_salvage_value: 0,
  },
};
const res2 = evaluateFleetReplacement(case2);
console.log('- 기존 유지 PV:', res2.existingTotalPv, '(손계산: 1,100,000 / 1.1 = 1,000,000)');
console.log('- 신차 교체 PV:', res2.replacementTotalPv, '(손계산: 500,000 + 220,000 / 1.1 = 700,000)');
console.log('- 비용 차이 Delta PV:', res2.deltaPv, '(손계산: -300,000, 유리대안: replace)');
console.log('- 판정 결과:', res2.recommended, '절감액:', res2.savings);

if (res2.existingTotalPv === 1000000 && res2.replacementTotalPv === 700000 && res2.recommended === 'replace') {
  console.log('>>> [성공] 사례 2 (할인율 10%) 완벽 일치!');
} else {
  console.error('>>> [실패] 사례 2 불일치!');
  process.exit(1);
}

console.log('\n====================================================');
console.log('모든 경제성공학 수치 검증 완료 (ALL TESTS PASSED)');
console.log('====================================================');

