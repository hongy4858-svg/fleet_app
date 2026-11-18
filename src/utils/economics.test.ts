import { evaluateFleetReplacement, presentWorthFactorSeries, presentWorthFactorSingle } from './economics';
import { AnalysisInputSnapshot } from '../types';

function runTests() {
  console.log('=== [1] 경제성공학 현가계수 공식 검증 ===');
  // i = 0%
  console.assert(presentWorthFactorSeries(0, 5) === 5, 'P/A (i=0) failed');
  console.assert(presentWorthFactorSingle(0, 5) === 1, 'P/F (i=0) failed');

  // i = 10%, n = 1
  const pa1 = presentWorthFactorSeries(0.1, 1);
  const pf1 = presentWorthFactorSingle(0.1, 1);
  console.assert(Math.abs(pa1 - 1 / 1.1) < 1e-6, 'P/A (10%, 1) failed');
  console.assert(Math.abs(pf1 - 1 / 1.1) < 1e-6, 'P/F (10%, 1) failed');
  console.log('계수 계산 검증 성공!');

  console.log('=== [2] 손계산 사례 1: 할인율 0% 검증 ===');
  const inputCase1: AnalysisInputSnapshot = {
    analysis_name: '손계산 테스트 1 (i=0%)',
    analysis_period_years: 2,
    annual_distance_km: 10000,
    discount_rate_pct: 0,
    existing: {
      vehicle_id: 'test-v1',
      model_name: '기존 테스트차',
      plate_number: '11가 1111',
      fuel_type: 'gasoline',
      current_market_value: 10000000, // 1,000만원
      efficiency: 10, // 10 km/L -> 1,000L 소비
      energy_price: 2000, // 연간 에너지비 200만원
      annual_maintenance: 500000, // 50만원
      annual_tax: 300000, // 30만원
      annual_insurance: 700000, // 70만원 -> 연간 총운영비 350만원
      expected_salvage_value: 5000000, // 2년후 잔존가치 500만원
    },
    replacement: {
      model_name: '신규 전기차',
      fuel_type: 'electric',
      purchase_price: 30000000, // 3,000만원
      incidental_cost: 1000000, // 100만원
      subsidy: 5000000, // 500만원 -> 순투자액 3000+100-500-1000 = 1,600만원
      efficiency: 5, // 5 km/kWh -> 2,000kWh 소비
      energy_price: 300, // 연간 에너지비 60만원
      annual_maintenance: 200000, // 20만원
      annual_tax: 100000, // 10만원
      annual_insurance: 800000, // 80만원 -> 연간 총운영비 170만원
      expected_salvage_value: 15000000, // 2년후 잔존가치 1,500만원
    },
  };

  const res1 = evaluateFleetReplacement(inputCase1);
  console.log('사례 1 결과:');
  console.log('- 유지 대안 PV:', res1.keep_breakdown.pv_total_cost, '(손계산 기대치: 2,000,000)');
  console.log('- 교체 대안 PV:', res1.replace_breakdown.pv_total_cost, '(손계산 기대치: 4,400,000)');
  console.log('- Delta PV:', res1.delta_pv, '(손계산 기대치: 2,400,000)');
  console.log('- 추천 대안:', res1.recommended_alternative, '(손계산 기대치: keep)');

  console.assert(res1.keep_breakdown.pv_total_cost === 2000000, 'Keep PV mismatch');
  console.assert(res1.replace_breakdown.pv_total_cost === 4400000, 'Replace PV mismatch');
  console.assert(res1.delta_pv === 2400000, 'Delta PV mismatch');
  console.assert(res1.recommended_alternative === 'keep', 'Recommendation mismatch');

  console.log('=== [3] 손계산 사례 2: 할인율 10% 양수 검증 ===');
  const inputCase2: AnalysisInputSnapshot = {
    analysis_name: '손계산 테스트 2 (i=10%, 1년)',
    analysis_period_years: 1,
    annual_distance_km: 10000,
    discount_rate_pct: 10,
    existing: {
      vehicle_id: 'test-v2',
      model_name: '기존 테스트차 2',
      plate_number: '22나 2222',
      fuel_type: 'gasoline',
      current_market_value: 0,
      efficiency: 10,
      energy_price: 1100, // 연 110만원
      annual_maintenance: 0,
      annual_tax: 0,
      annual_insurance: 0,
      expected_salvage_value: 0,
    },
    replacement: {
      model_name: '신규 차 2',
      fuel_type: 'gasoline',
      purchase_price: 500000,
      incidental_cost: 0,
      subsidy: 0,
      efficiency: 10,
      energy_price: 220, // 연 22만원
      annual_maintenance: 0,
      annual_tax: 0,
      annual_insurance: 0,
      expected_salvage_value: 0,
    },
  };

  const res2 = evaluateFleetReplacement(inputCase2);
  console.log('사례 2 결과:');
  console.log('- 유지 대안 PV:', res2.keep_breakdown.pv_total_cost, '(손계산 기대치: 1,000,000)');
  console.log('- 교체 대안 PV:', res2.replace_breakdown.pv_total_cost, '(손계산 기대치: 700,000)');
  console.log('- Delta PV:', res2.delta_pv, '(손계산 기대치: -300,000)');
  console.log('- 추천 대안:', res2.recommended_alternative, '(손계산 기대치: replace)');

  console.assert(res2.keep_breakdown.pv_total_cost === 1000000, 'Case 2 Keep PV mismatch');
  console.assert(res2.replace_breakdown.pv_total_cost === 700000, 'Case 2 Replace PV mismatch');
  console.assert(res2.delta_pv === -300000, 'Case 2 Delta PV mismatch');
  console.assert(res2.recommended_alternative === 'replace', 'Case 2 Recommendation mismatch');

  console.log('모든 경제성공학 계산 검증 통과!');
}

runTests();

