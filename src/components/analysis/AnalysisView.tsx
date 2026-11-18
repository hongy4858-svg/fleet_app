import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  Info,
  CheckCircle2,
  Save,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { fleetRepository } from '../../services/repository';
import {
  AnalysisInputSnapshot,
  AnalysisResultSnapshot,
  FuelType,
  ReplacementCandidate,
  Vehicle,
  TripLog,
  EnergyLog,
  MaintenanceLog,
} from '../../types';
import { evaluateFleetReplacement } from '../../utils/economics';
import { getVehicleHistoricalEstimates } from '../../utils/metrics';
import {
  formatCurrency,
  getEfficiencyUnit,
  getEnergyPriceUnit,
  getFuelTypeLabel,
} from '../../utils/formatters';

interface AnalysisViewProps {
  initialInput?: AnalysisInputSnapshot; // 복제(Clone) 시 주입될 수 있는 초기 입력값
  onSaved?: () => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ initialInput, onSaved }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [candidates, setCandidates] = useState<ReplacementCandidate[]>([]);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [energy, setEnergy] = useState<EnergyLog[]>([]);
  const [maint, setMaint] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  // 분석 제목
  const [analysisTitle, setAnalysisTitle] = useState<string>('업무용 차량 유지 vs 친환경차 교체 경제성 분석');

  // 공통 분석 조건
  const [periodYears, setPeriodYears] = useState<number>(5);
  const [annualDistance, setAnnualDistance] = useState<number>(20000);
  const [discountRate, setDiscountRate] = useState<number>(4.5);

  // 1. 기존 차량 상태
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [existingMarketValue, setExistingMarketValue] = useState<number>(12000000); // 현재 매각가 S_0
  const [existingEfficiency, setExistingEfficiency] = useState<number>(11.2);
  const [existingEnergyPrice, setExistingEnergyPrice] = useState<number>(1720);
  const [existingMaint, setExistingMaint] = useState<number>(900000);
  const [existingTax, setExistingTax] = useState<number>(520000);
  const [existingInsurance, setExistingInsurance] = useState<number>(850000);
  const [existingSalvage, setExistingSalvage] = useState<number>(3000000); // N년 후 잔존가치

  // DB 참고값 보관 상태
  const [dbRef, setDbRef] = useState<{
    referenceEfficiency: number;
    referenceEnergyPrice: number;
    referenceAnnualMaintenance: number;
    totalTripCount: number;
    totalLoggedDistance: number;
  } | null>(null);

  // 2. 교체 차량 상태
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [newModelName, setNewModelName] = useState<string>('현대 아이오닉 6 익스클루시브 (전기차)');
  const [newFuelType, setNewFuelType] = useState<FuelType>('electric');
  const [newPurchasePrice, setNewPurchasePrice] = useState<number>(52000000);
  const [newSubsidy, setNewSubsidy] = useState<number>(6800000);
  const [newIncidental, setNewIncidental] = useState<number>(2200000);
  const [newEfficiency, setNewEfficiency] = useState<number>(6.2);
  const [newEnergyPrice, setNewEnergyPrice] = useState<number>(340);
  const [newMaint, setNewMaint] = useState<number>(350000);
  const [newTax, setNewTax] = useState<number>(130000);
  const [newInsurance, setNewInsurance] = useState<number>(900000);
  const [newSalvage, setNewSalvage] = useState<number>(19000000); // N년 후 잔존가치

  // 저장 모달
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // 초기 데이터 로딩
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setCloudError(null);
      try {
        const [vList, cList, tList, eList, mList] = await Promise.all([
          fleetRepository.getVehicles(),
          fleetRepository.getReplacementCandidates(),
          fleetRepository.getTripLogs(),
          fleetRepository.getEnergyLogs(),
          fleetRepository.getMaintenanceLogs(),
        ]);
        setVehicles(vList);
        setCandidates(cList);
        setTrips(tList);
        setEnergy(eList);
        setMaint(mList);

        // 복제된 initialInput이 있으면 복원
        if (initialInput) {
          setAnalysisTitle(`${initialInput.analysis_name} (복제본)`);
          setPeriodYears(initialInput.analysis_period_years);
          setAnnualDistance(initialInput.annual_distance_km);
          setDiscountRate(initialInput.discount_rate_pct);

          setSelectedVehicleId(initialInput.existing.vehicle_id);
          setExistingMarketValue(initialInput.existing.current_market_value);
          setExistingEfficiency(initialInput.existing.efficiency);
          setExistingEnergyPrice(initialInput.existing.energy_price);
          setExistingMaint(initialInput.existing.annual_maintenance);
          setExistingTax(initialInput.existing.annual_tax);
          setExistingInsurance(initialInput.existing.annual_insurance);
          setExistingSalvage(initialInput.existing.expected_salvage_value);

          setNewModelName(initialInput.replacement.model_name);
          setNewFuelType(initialInput.replacement.fuel_type);
          setNewPurchasePrice(initialInput.replacement.purchase_price);
          setNewSubsidy(initialInput.replacement.subsidy);
          setNewIncidental(initialInput.replacement.incidental_cost);
          setNewEfficiency(initialInput.replacement.efficiency);
          setNewEnergyPrice(initialInput.replacement.energy_price);
          setNewMaint(initialInput.replacement.annual_maintenance);
          setNewTax(initialInput.replacement.annual_tax);
          setNewInsurance(initialInput.replacement.annual_insurance);
          setNewSalvage(initialInput.replacement.expected_salvage_value);
        } else {
          // 기본 선택값 세팅
          if (vList.length > 0) {
            handleSelectExistingVehicle(vList[0].id, vList, tList, eList, mList);
          }
          if (cList.length > 0) {
            handleSelectCandidate(cList[0].id, cList);
          }
        }
      } catch (e: any) {
        console.error(e);
        setCloudError(e.message || '분석에 필요한 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [initialInput]);

  // 기존 차량 선택 핸들러
  const handleSelectExistingVehicle = (
    vId: string,
    vList = vehicles,
    tList = trips,
    eList = energy,
    mList = maint
  ) => {
    setSelectedVehicleId(vId);
    const target = vList.find((v) => v.id === vId);
    if (!target) return;

    // 과거 실적 기반 참고값 산출
    const ref = getVehicleHistoricalEstimates(target, tList, eList, mList);
    setDbRef(ref);

    // 기본 추정값 반영 (사용자가 직접 수정 가능)
    setExistingEfficiency(ref.referenceEfficiency);
    setExistingEnergyPrice(ref.referenceEnergyPrice);
    setExistingMaint(ref.referenceAnnualMaintenance);

    // 차량 연식/구매가 기반 현실적 매각가 및 잔존가치 기본값 제안
    const defaultMarket = Math.round(target.purchase_price * 0.35);
    setExistingMarketValue(defaultMarket);
    setExistingSalvage(Math.round(defaultMarket * 0.25));

    // 자동차세 기본값 (배기량/차종 추정치)
    if (target.fuel_type === 'gasoline' || target.fuel_type === 'diesel') {
      setExistingTax(520000);
    } else if (target.fuel_type === 'hybrid') {
      setExistingTax(380000);
    } else {
      setExistingTax(130000);
    }
  };

  // 교체 후보 선택 핸들러
  const handleSelectCandidate = (cId: string, cList = candidates) => {
    setSelectedCandidateId(cId);
    const cand = cList.find((c) => c.id === cId);
    if (!cand) return;

    setNewModelName(cand.name);
    setNewFuelType(cand.fuel_type);
    setNewPurchasePrice(cand.purchase_price);
    setNewSubsidy(cand.subsidy);
    setNewIncidental(cand.incidental_cost);
    setNewEfficiency(cand.efficiency);
    setNewEnergyPrice(cand.energy_price);
    setNewMaint(cand.annual_maintenance);
    setNewTax(cand.annual_tax);
    setNewInsurance(cand.annual_insurance);
    setNewSalvage(cand.expected_salvage);
  };

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  }, [vehicles, selectedVehicleId]);

  // 분석 입력 스냅샷 생성
  const currentInputSnapshot: AnalysisInputSnapshot = useMemo(() => {
    return {
      analysis_name: analysisTitle,
      analysis_period_years: periodYears,
      annual_distance_km: annualDistance,
      discount_rate_pct: discountRate,
      existing: {
        vehicle_id: selectedVehicle?.id || 'unknown',
        model_name: selectedVehicle?.model_name || '기존 차량',
        plate_number: selectedVehicle?.plate_number || '',
        fuel_type: selectedVehicle?.fuel_type || 'gasoline',
        current_market_value: existingMarketValue,
        efficiency: existingEfficiency,
        energy_price: existingEnergyPrice,
        annual_maintenance: existingMaint,
        annual_tax: existingTax,
        annual_insurance: existingInsurance,
        expected_salvage_value: existingSalvage,
      },
      replacement: {
        candidate_id: selectedCandidateId,
        model_name: newModelName,
        fuel_type: newFuelType,
        purchase_price: newPurchasePrice,
        incidental_cost: newIncidental,
        subsidy: newSubsidy,
        efficiency: newEfficiency,
        energy_price: newEnergyPrice,
        annual_maintenance: newMaint,
        annual_tax: newTax,
        annual_insurance: newInsurance,
        expected_salvage_value: newSalvage,
      },
    };
  }, [
    analysisTitle,
    periodYears,
    annualDistance,
    discountRate,
    selectedVehicle,
    existingMarketValue,
    existingEfficiency,
    existingEnergyPrice,
    existingMaint,
    existingTax,
    existingInsurance,
    existingSalvage,
    selectedCandidateId,
    newModelName,
    newFuelType,
    newPurchasePrice,
    newIncidental,
    newSubsidy,
    newEfficiency,
    newEnergyPrice,
    newMaint,
    newTax,
    newInsurance,
    newSalvage,
  ]);

  // 경제성 분석 결과 실시간 산출
  const analysisResult: AnalysisResultSnapshot = useMemo(() => {
    return evaluateFleetReplacement(currentInputSnapshot);
  }, [currentInputSnapshot]);

  // 차트 데이터 구성 (비용 구성 분해 비교)
  const chartData = useMemo(() => {
    const keep = analysisResult.keep_breakdown;
    const rep = analysisResult.replace_breakdown;

    return [
      {
        name: '초기 순투자액',
        기존유지: keep.initial_net_investment,
        신차교체: rep.initial_net_investment,
      },
      {
        name: '에너지비 PV',
        기존유지: Math.round(
          keep.annual_energy_cost *
            (keep.pv_operating_costs / (keep.annual_operating_total || 1))
        ),
        신차교체: Math.round(
          rep.annual_energy_cost *
            (rep.pv_operating_costs / (rep.annual_operating_total || 1))
        ),
      },
      {
        name: '정비비 PV',
        기존유지: Math.round(
          keep.annual_maintenance_cost *
            (keep.pv_operating_costs / (keep.annual_operating_total || 1))
        ),
        신차교체: Math.round(
          rep.annual_maintenance_cost *
            (rep.pv_operating_costs / (rep.annual_operating_total || 1))
        ),
      },
      {
        name: '세금/보험료 PV',
        기존유지: Math.round(
          (keep.annual_tax_cost + keep.annual_insurance_cost) *
            (keep.pv_operating_costs / (keep.annual_operating_total || 1))
        ),
        신차교체: Math.round(
          (rep.annual_tax_cost + rep.annual_insurance_cost) *
            (rep.pv_operating_costs / (rep.annual_operating_total || 1))
        ),
      },
      {
        name: '잔존가치 회수(-PV)',
        기존유지: -keep.pv_salvage_value,
        신차교체: -rep.pv_salvage_value,
      },
    ];
  }, [analysisResult]);

  // 분석 결과 저장 핸들러
  const handleSaveAnalysis = async () => {
    setIsSaving(true);
    try {
      await fleetRepository.saveAnalysis({
        title: analysisTitle.trim() || `${selectedVehicle?.plate_number} 교체 분석`,
        existing_vehicle_id: selectedVehicle?.id || '',
        replacement_candidate_id: selectedCandidateId,
        input_snapshot: currentInputSnapshot,
        result_snapshot: analysisResult,
        owner_id: 'demo-user-001',
      });
      setIsSaveModalOpen(false);
      setSaveSuccessMsg('분석 스냅샷이 영구 저장되었습니다. "분석 이력" 탭에서 확인하실 수 있습니다.');
      if (onSaved) onSaved();
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (e: any) {
      alert(e.message || '분석 저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 클라우드 오류 안내 배너 */}
      {cloudError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start space-x-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">클라우드 데이터베이스 통신 오류</div>
            <p className="text-rose-700">{cloudError}</p>
            <p className="text-[11px] text-rose-600">
              * Supabase 프로젝트에 테이블이 정상 생성되어 있는지 확인해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 등록 차량 0대 안내 배너 */}
      {vehicles.length === 0 && !cloudError && (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl text-teal-800 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <Info className="w-5 h-5 text-teal-600 shrink-0" />
            <span>
              분석 대상 기존 차량이 없습니다. 상단 <strong>[시연 데이터 생성]</strong> 버튼을 누르면 가상 시연 차량 5대가 즉시 주입됩니다.
            </span>
          </div>
        </div>
      )}
      {/* 저장 성공 알림 */}
      {saveSuccessMsg && (
        <div className="bg-teal-700 text-white text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-teal-200" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-teal-200 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* 헤더 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Scale className="w-6 h-6 text-teal-600" />
            <span>유지 vs 친환경차 교체 경제성 비교 분석</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            경제성공학(현가비교법)을 바탕으로 기존 차량을 계속 유지할 때와 지금 새 차량으로 교체할 때의 수명주기 총비용을 객관적으로 비교합니다.
          </p>
        </div>

        <button
          onClick={() => setIsSaveModalOpen(true)}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
        >
          <Save className="w-4 h-4" />
          <span>현재 분석 결과 저장</span>
        </button>
      </div>

      {/* 분석 명칭 및 공통 분석 조건 카드 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            공통 분석 파라미터 설정
          </span>
          <span className="text-[11px] text-slate-400">
            동일한 비교 기간과 할인율을 기준으로 미래 현금흐름을 환산합니다.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* 분석 제목 */}
          <div className="md:col-span-1">
            <label className="block font-semibold text-slate-700 mb-1">분석 리포트 명칭</label>
            <input
              type="text"
              value={analysisTitle}
              onChange={(e) => setAnalysisTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
            />
          </div>

          {/* 분석 기간 N */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              향후 분석 기간 (N)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="30"
                value={periodYears}
                onChange={(e) => setPeriodYears(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 pr-8 font-semibold"
              />
              <span className="absolute right-3 top-2.5 text-slate-400">년</span>
            </div>
          </div>

          {/* 연간 예상 주행거리 */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              연간 예상 주행거리
            </label>
            <div className="relative">
              <input
                type="number"
                step="1000"
                min="1000"
                value={annualDistance}
                onChange={(e) => setAnnualDistance(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 pr-10 font-semibold"
              />
              <span className="absolute right-3 top-2.5 text-slate-400">km/년</span>
            </div>
          </div>

          {/* 연간 할인율 i */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>연간 할인율 (i)</span>
              <span className="text-[10px] text-teal-600 font-normal">0% 허용</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={discountRate}
                onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 pr-8 font-semibold"
              />
              <span className="absolute right-3 top-2.5 text-slate-400">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 대안 A (기존차 유지) vs 대안 B (신차 교체) 2열 입력 폼 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 대안 A: 기존 차량 유지 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                A
              </div>
              <h3 className="font-bold text-slate-900 text-sm">대안 1: 기존 차량 유지</h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
              현재 보유차 지속 운행
            </span>
          </div>

          {/* 보유 차량 선택 드롭다운 */}
          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">비교 대상 보유 차량 선택</label>
            <select
              value={selectedVehicleId}
              onChange={(e) => handleSelectExistingVehicle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white font-medium"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} - {v.model_name} ({getFuelTypeLabel(v.fuel_type)})
                </option>
              ))}
            </select>
          </div>

          {/* DB 실적 참고값 뱃지 */}
          {dbRef && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-teal-600" />
                DB 누적 실적 기반 참고값 (최근 데이터)
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                <div>
                  실적 연비:{' '}
                  <strong className="text-slate-800">
                    {dbRef.referenceEfficiency} {getEfficiencyUnit(selectedVehicle?.fuel_type || 'gasoline')}
                  </strong>
                </div>
                <div>
                  최근 에너지단가:{' '}
                  <strong className="text-slate-800">
                    {dbRef.referenceEnergyPrice.toLocaleString()}원
                  </strong>
                </div>
                <div>
                  누적 주행기록:{' '}
                  <strong className="text-slate-800">{dbRef.totalTripCount}건</strong>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                * 위 실적값은 참고치이며, 향후 분석에 사용할 예상값은 아래 입력란에서 직접 수정하실 수 있습니다.
              </p>
            </div>
          )}

          {/* 매몰비용 안내 배너 */}
          <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-tight flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>매몰비용(Sunk Cost) 원칙</strong>: 기존 차량의 과거 구매가격({formatCurrency(selectedVehicle?.purchase_price || 0)})은 이미 회수 불가능한 매몰비용이므로 미래 의사결정 비용에 가산하지 않습니다.
            </div>
          </div>

          {/* 세부 수치 입력 (2열 그리드) */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                현재 시장 매각가 (S₀) <span className="text-teal-600 font-normal">(기회비용)</span>
              </label>
              <input
                type="number"
                step="100000"
                value={existingMarketValue}
                onChange={(e) => setExistingMarketValue(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold text-right"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                {formatCurrency(existingMarketValue)}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {periodYears}년 후 예상 잔존가치
              </label>
              <input
                type="number"
                step="100000"
                value={existingSalvage}
                onChange={(e) => setExistingSalvage(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold text-right"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                {formatCurrency(existingSalvage)}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                향후 예상 연비 ({getEfficiencyUnit(selectedVehicle?.fuel_type || 'gasoline')})
              </label>
              <input
                type="number"
                step="0.1"
                value={existingEfficiency}
                onChange={(e) => setExistingEfficiency(parseFloat(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-right"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                향후 에너지가격 ({getEnergyPriceUnit(selectedVehicle?.fuel_type || 'gasoline')})
              </label>
              <input
                type="number"
                step="10"
                value={existingEnergyPrice}
                onChange={(e) => setExistingEnergyPrice(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-right"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">예상 연간 정비비</label>
              <input
                type="number"
                step="10000"
                value={existingMaint}
                onChange={(e) => setExistingMaint(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-right"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                {formatCurrency(existingMaint)}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">예상 연간 세금/보험료</label>
              <input
                type="number"
                step="10000"
                value={existingTax + existingInsurance}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  setExistingTax(Math.round(val * 0.4));
                  setExistingInsurance(Math.round(val * 0.6));
                }}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-right"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                세금 {formatCurrency(existingTax)} + 보험 {formatCurrency(existingInsurance)}
              </span>
            </div>
          </div>
        </div>

        {/* 대안 B: 신규 차량 교체 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-teal-600 flex items-center justify-center text-white font-bold text-xs">
                B
              </div>
              <h3 className="font-bold text-slate-900 text-sm">대안 2: 신규 친환경차 교체</h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-100 text-teal-800">
              신차 취득 및 교체
            </span>
          </div>

          {/* 사전 등록된 후보 선택 드롭다운 */}
          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">교체 후보 차량 불러오기</label>
            <select
              value={selectedCandidateId}
              onChange={(e) => handleSelectCandidate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white font-medium"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({getFuelTypeLabel(c.fuel_type)}) - 정가 {formatCurrency(c.purchase_price)}
                </option>
              ))}
            </select>
          </div>

          {/* 신차 기본 스펙 */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">신차 모델명</label>
              <input
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">연료 종류</label>
              <select
                value={newFuelType}
                onChange={(e) => setNewFuelType(e.target.value as FuelType)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
              >
                <option value="electric">전기 (EV)</option>
                <option value="hydrogen">수소 (FCEV)</option>
                <option value="hybrid">하이브리드</option>
                <option value="gasoline">가솔린</option>
                <option value="diesel">디젤</option>
              </select>
            </div>
          </div>

          {/* 초기 취득비용 세부 항목 */}
          <div className="p-3 bg-teal-50/50 border border-teal-100 rounded-xl space-y-2 text-xs">
            <div className="font-semibold text-teal-900">신차 초기 순투자액 계산 요소</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5">구매가격</label>
                <input
                  type="number"
                  step="100000"
                  value={newPurchasePrice}
                  onChange={(e) => setNewPurchasePrice(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-right font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5">정부/지자체 보조금</label>
                <input
                  type="number"
                  step="100000"
                  value={newSubsidy}
                  onChange={(e) => setNewSubsidy(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-right text-emerald-700 font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-0.5">일회성 부대비용</label>
                <input
                  type="number"
                  step="50000"
                  value={newIncidental}
                  onChange={(e) => setNewIncidental(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-right font-medium"
                />
              </div>
            </div>
            <div className="text-[11px] text-teal-800 pt-1 flex justify-between font-semibold border-t border-teal-100">
              <span>초기 순현금유출액 (구매+부대-보조금-기존차매각):</span>
              <span className="text-teal-900">
                {formatCurrency(newPurchasePrice + newIncidental - newSubsidy - existingMarketValue)}
              </span>
            </div>
          </div>

          {/* 세부 수치 입력 (2열 그리드) */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {periodYears}년 후 예상 잔존가치
              </label>
              <input
                type="number"
                step="100000"
                value={newSalvage}
                onChange={(e) => setNewSalvage(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold text-right"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                {formatCurrency(newSalvage)}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                공인/예상 연비 ({getEfficiencyUnit(newFuelType)})
              </label>
              <input
                type="number"
                step="0.1"
                value={newEfficiency}
                onChange={(e) => setNewEfficiency(parseFloat(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-right"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                에너지가격 ({getEnergyPriceUnit(newFuelType)})
              </label>
              <input
                type="number"
                step="10"
                value={newEnergyPrice}
                onChange={(e) => setNewEnergyPrice(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-right"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">예상 연간 정비비</label>
              <input
                type="number"
                step="10000"
                value={newMaint}
                onChange={(e) => setNewMaint(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-right"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                {formatCurrency(newMaint)}
              </span>
            </div>

            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">예상 연간 세금/보험료</label>
              <input
                type="number"
                step="10000"
                value={newTax + newInsurance}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  setNewTax(Math.round(val * 0.2));
                  setNewInsurance(Math.round(val * 0.8));
                }}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-right"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                세금 {formatCurrency(newTax)} (전기차 13만원 감면 등) + 보험 {formatCurrency(newInsurance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 분석 결과 핵심 요약 리포트 카드 */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-4">
          <div>
            <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
              경제성 분석 결과 (현재가치 비교법)
            </span>
            <h3 className="text-xl font-bold mt-1">
              {periodYears}년간 총비용 현재가치(PV) 비교 평가
            </h3>
          </div>

          {/* 추천 대안 뱃지 */}
          <div>
            {analysisResult.recommended_alternative === 'replace' ? (
              <span className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-sm shadow">
                <CheckCircle2 className="w-5 h-5 text-slate-950" />
                <span>친환경차 [교체] 대안이 유리</span>
              </span>
            ) : analysisResult.recommended_alternative === 'keep' ? (
              <span className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm shadow">
                <CheckCircle2 className="w-5 h-5 text-slate-950" />
                <span>기존 차량 [유지] 대안이 유리</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-300 text-slate-950 font-bold text-sm shadow">
                <span>두 대안의 비용이 동등함 (무차별)</span>
              </span>
            )}
          </div>
        </div>

        {/* 3대 핵심 비용 지표 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
            <span className="text-xs text-slate-400 font-medium">대안 1: 기존 차량 유지 총비용 (PV)</span>
            <div className="text-2xl font-bold text-white mt-1.5">
              {formatCurrency(analysisResult.keep_breakdown.pv_total_cost)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              향후 {periodYears}년간 운영비 현가 - 잔존가치 현가
            </p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
            <span className="text-xs text-teal-300 font-medium">대안 2: 신차 교체 총비용 (PV)</span>
            <div className="text-2xl font-bold text-teal-400 mt-1.5">
              {formatCurrency(analysisResult.replace_breakdown.pv_total_cost)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              초기 순투자액 + 향후 운영비 현가 - 잔존가치 현가
            </p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
            <span className="text-xs text-amber-300 font-medium">현재가치 비용 차이 (ΔPV)</span>
            <div className="text-2xl font-bold text-amber-400 mt-1.5">
              {formatCurrency(Math.abs(analysisResult.delta_pv))}
            </div>
            <p className="text-[11px] text-slate-300 mt-1 font-semibold">
              {analysisResult.recommended_alternative === 'replace'
                ? `신차 교체 시 총 ${formatCurrency(analysisResult.savings_amount)} 절감`
                : analysisResult.recommended_alternative === 'keep'
                ? `기존차 유지 시 총 ${formatCurrency(analysisResult.savings_amount)} 절감`
                : '비용 차이 없음'}
            </p>
          </div>
        </div>

        {/* 비용 구성 비교 막대 차트 */}
        <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700">
          <h4 className="text-sm font-bold text-slate-200 mb-3">
            대안별 비용 구성 항목 현재가치(PV) 분해 비교
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis
                  tickFormatter={(val) => `${(val / 10000).toLocaleString()}만`}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                />
                <Tooltip
                  formatter={(val: number) => [`${val.toLocaleString()} 원`, '']}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    color: '#FFF',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#CBD5E1' }} />
                <Bar dataKey="기존유지" fill="#64748B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="신차교체" fill="#0D9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 상세 비용 명세표 */}
        <div className="bg-slate-800/40 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="p-3 bg-slate-800/80 font-bold text-xs text-slate-300">
            항목별 상세 비교 명세서 (단위: 원)
          </div>
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-800 text-slate-400 border-b border-slate-700 uppercase">
              <tr>
                <th className="py-2.5 px-4">비용 항목</th>
                <th className="py-2.5 px-4 text-right">기존 유지 대안 (A)</th>
                <th className="py-2.5 px-4 text-right">신차 교체 대안 (B)</th>
                <th className="py-2.5 px-4 text-right">차이 (B - A)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 text-slate-300">
              <tr>
                <td className="py-2 px-4 font-medium">초기 순투자액 (구매+부대-보조금-기존차매각)</td>
                <td className="py-2 px-4 text-right">0원</td>
                <td className="py-2 px-4 text-right font-semibold">
                  {formatCurrency(analysisResult.replace_breakdown.initial_net_investment)}
                </td>
                <td className="py-2 px-4 text-right text-teal-400">
                  +{formatCurrency(analysisResult.replace_breakdown.initial_net_investment)}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4">연간 예상 에너지비용 (연 {annualDistance.toLocaleString()}km)</td>
                <td className="py-2 px-4 text-right">
                  {formatCurrency(analysisResult.keep_breakdown.annual_energy_cost)}/년
                </td>
                <td className="py-2 px-4 text-right font-semibold text-teal-300">
                  {formatCurrency(analysisResult.replace_breakdown.annual_energy_cost)}/년
                </td>
                <td className="py-2 px-4 text-right text-emerald-400">
                  {formatCurrency(
                    analysisResult.replace_breakdown.annual_energy_cost -
                      analysisResult.keep_breakdown.annual_energy_cost
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4">연간 유지관리비 (정비+세금+보험)</td>
                <td className="py-2 px-4 text-right">
                  {formatCurrency(
                    analysisResult.keep_breakdown.annual_operating_total -
                      analysisResult.keep_breakdown.annual_energy_cost
                  )}/년
                </td>
                <td className="py-2 px-4 text-right">
                  {formatCurrency(
                    analysisResult.replace_breakdown.annual_operating_total -
                      analysisResult.replace_breakdown.annual_energy_cost
                  )}/년
                </td>
                <td className="py-2 px-4 text-right">
                  {formatCurrency(
                    analysisResult.replace_breakdown.annual_operating_total -
                      analysisResult.replace_breakdown.annual_energy_cost -
                      (analysisResult.keep_breakdown.annual_operating_total -
                        analysisResult.keep_breakdown.annual_energy_cost)
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-semibold text-white">
                  {periodYears}년간 총 운영비 현재가치 (PV)
                </td>
                <td className="py-2 px-4 text-right font-semibold">
                  {formatCurrency(analysisResult.keep_breakdown.pv_operating_costs)}
                </td>
                <td className="py-2 px-4 text-right font-semibold text-teal-300">
                  {formatCurrency(analysisResult.replace_breakdown.pv_operating_costs)}
                </td>
                <td className="py-2 px-4 text-right text-emerald-400">
                  {formatCurrency(
                    analysisResult.replace_breakdown.pv_operating_costs -
                      analysisResult.keep_breakdown.pv_operating_costs
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-slate-400">
                  {periodYears}년 후 잔존가치 회수 현재가치 (PV, 차감 항목)
                </td>
                <td className="py-2 px-4 text-right text-slate-400">
                  -{formatCurrency(analysisResult.keep_breakdown.pv_salvage_value)}
                </td>
                <td className="py-2 px-4 text-right text-slate-400">
                  -{formatCurrency(analysisResult.replace_breakdown.pv_salvage_value)}
                </td>
                <td className="py-2 px-4 text-right text-slate-400">
                  -{formatCurrency(
                    analysisResult.replace_breakdown.pv_salvage_value -
                      analysisResult.keep_breakdown.pv_salvage_value
                  )}
                </td>
              </tr>
              <tr className="bg-slate-800 text-white font-bold text-sm">
                <td className="py-3 px-4">최종 총비용 현재가치 (PV)</td>
                <td className="py-3 px-4 text-right">
                  {formatCurrency(analysisResult.keep_breakdown.pv_total_cost)}
                </td>
                <td className="py-3 px-4 text-right text-teal-400">
                  {formatCurrency(analysisResult.replace_breakdown.pv_total_cost)}
                </td>
                <td className="py-3 px-4 text-right text-amber-400">
                  {formatCurrency(analysisResult.delta_pv)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 학술적 한계 및 주의사항 배너 */}
      <div className="bg-slate-100 border border-slate-300 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-800 flex items-center gap-2 text-sm">
          <ShieldAlert className="w-5 h-5 text-slate-600" />
          <span>경제성 분석 결과 해석 시 필수 고려사항 (학술 고지)</span>
        </div>
        <p className="leading-relaxed">
          1. <strong>가정 조건에 따른 상대적 비교</strong>: 상기 산출 결과는 사용자가 설정한 향후 분석 기간({periodYears}년), 연간 주행거리({annualDistance.toLocaleString()}km), 할인율({discountRate}%) 및 예상 잔존가치 가정에 기초한 경제적 비교치이며, 미래의 확정적 예측이나 절대적 최적 교체 시점을 의미하지 않습니다.
        </p>
        <p className="leading-relaxed">
          2. <strong>세무 및 리스 배제</strong>: 본 프로토타입 시스템은 현금흐름 기준의 직접 소유 모델을 기반으로 하며, 법인세 절세 효과, 유류세 환급, 또는 금융 리스 조건은 반영하지 않았습니다.
        </p>
        <p className="leading-relaxed">
          3. <strong>배출량 분석 제외</strong>: 본 1차 버전은 순수 경제성(비용) 분석에 집중하며, 온실가스 전과정평가(LCA) 배출량 분석은 포함하지 않습니다.
        </p>
      </div>

      {/* 분석 저장 모달 */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-2">분석 이력 저장 (불변 스냅샷)</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              현재 입력하신 모든 파라미터와 산출 결과가 JSON 스냅샷 형태로 저장됩니다. 
              추후 차량 정보나 에너지가격이 변경되어도 저장된 분석 결과는 변하지 않습니다.
            </p>

            <div className="text-xs mb-4">
              <label className="block font-semibold text-slate-700 mb-1">분석 명칭</label>
              <input
                type="text"
                value={analysisTitle}
                onChange={(e) => setAnalysisTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveAnalysis}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow transition"
              >
                {isSaving ? '저장 중...' : '스냅샷 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
