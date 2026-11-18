import React, { useState, useEffect, useMemo } from 'react';
import {
  Car,
  Gauge,
  Fuel,
  Wrench,
  Info,
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
  Cell,
} from 'recharts';
import { fleetRepository } from '../../services/repository';
import { Vehicle, TripLog, EnergyLog, MaintenanceLog } from '../../types';
import { calculateFleetMetrics } from '../../utils/metrics';
import { formatCurrency, formatDistance } from '../../utils/formatters';

export const DashboardView: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [energy, setEnergy] = useState<EnergyLog[]>([]);
  const [maint, setMaint] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 기간 필터: 'all' | '1m' | '3m' | '6m' | '1y' | 'custom'
  const [periodPreset, setPeriodPreset] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [vList, tList, eList, mList] = await Promise.all([
        fleetRepository.getVehicles(),
        fleetRepository.getTripLogs(),
        fleetRepository.getEnergyLogs(),
        fleetRepository.getMaintenanceLogs(),
      ]);
      setVehicles(vList);
      setTrips(tList);
      setEnergy(eList);
      setMaint(mList);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '클라우드 데이터베이스에서 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 기간 프리셋 변경 핸들러
  const handlePresetChange = (preset: string) => {
    setPeriodPreset(preset);
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    const start = new Date(today);
    if (preset === '1m') start.setMonth(today.getMonth() - 1);
    else if (preset === '3m') start.setMonth(today.getMonth() - 3);
    else if (preset === '6m') start.setMonth(today.getMonth() - 6);
    else if (preset === '1y') start.setFullYear(today.getFullYear() - 1);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(endStr);
  };

  // 통계 계산
  const metrics = useMemo(() => {
    return calculateFleetMetrics(vehicles, trips, energy, maint, startDate, endDate);
  }, [vehicles, trips, energy, maint, startDate, endDate]);

  // 차트 데이터 (km당 비용이 있는 차량 우선 정렬)
  const chartData = useMemo(() => {
    return metrics.vehicle_summaries
      .filter((s) => s.total_distance_km > 0)
      .map((s) => ({
        name: s.model_name.split('(')[0].trim(),
        plate: s.plate_number,
        costPerKm: s.cost_per_km || 0,
        fuelType: s.fuel_type,
        distance: s.total_distance_km,
        operatingCost: s.total_operating_cost,
      }))
      .sort((a, b) => (b.costPerKm || 0) - (a.costPerKm || 0));
  }, [metrics]);

  const getBarColor = (fuelType: string) => {
    switch (fuelType) {
      case 'electric':
        return '#0D9488'; // Teal
      case 'hydrogen':
        return '#0284C7'; // Sky
      case 'hybrid':
        return '#10B981'; // Emerald
      case 'diesel':
        return '#F59E0B'; // Amber
      case 'gasoline':
      default:
        return '#64748B'; // Slate
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 클라우드 오류 안내 배너 */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start space-x-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">클라우드 데이터베이스 통신 오류</div>
            <p className="text-rose-700">{errorMessage}</p>
            <p className="text-[11px] text-rose-600">
              * Supabase 프로젝트에 테이블이 생성되었는지 확인해주세요. (supabase/migrations SQL 실행 필요)
            </p>
          </div>
        </div>
      )}

      {/* 등록 차량 0대 안내 배너 */}
      {vehicles.length === 0 && !errorMessage && (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl text-teal-800 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <Info className="w-5 h-5 text-teal-600 shrink-0" />
            <span>
              현재 계정에 등록된 차량 데이터가 없습니다. 상단 <strong>[시연 데이터 생성]</strong> 버튼을 누르거나 [차량 관리]에서 첫 차량을 등록해보세요.
            </span>
          </div>
        </div>
      )}
      {/* 타이틀 및 기간 필터 바 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">플릿 운영 대시보드</h2>
          <p className="text-xs text-slate-500 mt-1">
            보유 차량의 실적 기반 총주행거리, 연료비, 정비비 및 km당 운영단가를 종합 분석합니다.
          </p>
        </div>

        {/* 기간 필터 컨트롤러 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
            {[
              { id: 'all', label: '전체' },
              { id: '1m', label: '최근 1개월' },
              { id: '3m', label: '3개월' },
              { id: '6m', label: '6개월' },
              { id: '1y', label: '1년' },
              { id: 'custom', label: '직접설정' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-2.5 py-1.5 rounded-lg transition ${
                  periodPreset === p.id
                    ? 'bg-white text-teal-700 shadow-sm font-semibold'
                    : 'hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodPreset === 'custom' && (
            <div className="flex items-center space-x-1 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <span className="text-slate-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI 요약 카드 4종 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 등록 차량 수 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              총 등록 차량
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {metrics.total_vehicles} <span className="text-sm font-normal text-slate-500">대</span>
            </div>
            <div className="text-xs text-teal-600 font-medium mt-1">
              친환경차(EV/수소/HEV) {vehicles.filter((v) => v.fuel_type !== 'gasoline' && v.fuel_type !== 'diesel').length}대 보유
            </div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <Car className="w-6 h-6" />
          </div>
        </div>

        {/* 선택 기간 총주행거리 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              기간 총 주행거리
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {formatDistance(metrics.total_distance_km)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              기록된 운행 일지 기준 합산
            </div>
          </div>
          <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
            <Gauge className="w-6 h-6" />
          </div>
        </div>

        {/* 선택 기간 에너지 비용 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              주유·충전 총비용
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {formatCurrency(metrics.total_energy_cost)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              에너지 결제 영수증 기준
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Fuel className="w-6 h-6" />
          </div>
        </div>

        {/* 선택 기간 정비 비용 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              정비·수리 총비용
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {formatCurrency(metrics.total_maintenance_cost)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              소모품 및 고장 수리비
            </div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <Wrench className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 차량별 km당 운영비 비교 차트 & 테이블 (2열 레이아웃) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 좌측 차트 (7열) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>차량별 km당 운영비 비교</span>
                <span className="text-xs font-normal text-slate-500">(주유·충전비 + 정비비 / 주행거리)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                단위 주행거리(km)당 소요된 총 운영단가를 비교합니다. (낮을수록 효율적)
              </p>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
              <AlertCircle className="w-8 h-8 mb-2 stroke-slate-300" />
              <span>선택된 기간 내 주행 기록이 있는 차량이 없습니다.</span>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    tickFormatter={(val) => `${val.toLocaleString()}원`}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 12, fill: '#1E293B', fontWeight: 500 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString()} 원/km`, 'km당 운영비']}
                    labelFormatter={(label) => `차량: ${label}`}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                  />
                  <Bar dataKey="costPerKm" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.fuelType)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 차트 하단 범례 */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span> 전기(EV)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span> 수소(FCEV)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 하이브리드
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> 디젤
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> 가솔린
            </span>
          </div>
        </div>

        {/* 우측 요약 테이블 (5열) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">차량별 기간 실적 상세</h3>
            <p className="text-xs text-slate-500 mb-3">
              기간 내 누적된 주행거리와 총 운영비용 내역입니다.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 border-y border-slate-200 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">차량(번호)</th>
                    <th className="py-2.5 px-2 text-right">주행(km)</th>
                    <th className="py-2.5 px-2 text-right">운영비</th>
                    <th className="py-2.5 px-3 text-right">km당 단가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.vehicle_summaries.map((s) => (
                    <tr key={s.vehicle_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{s.plate_number}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[120px]">
                          {s.model_name.split('(')[0]}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-medium text-slate-700">
                        {s.total_distance_km.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-600">
                        {formatCurrency(s.total_operating_cost)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {s.cost_per_km !== null ? (
                          <span className="font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                            {s.cost_per_km.toLocaleString()}원
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">계산 불가(주행 0)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 전체 평균 통계 띠 */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">플릿 전체 평균 km당 운영비:</span>
            <span className="text-sm font-bold text-slate-900">
              {metrics.average_cost_per_km !== null
                ? `${metrics.average_cost_per_km.toLocaleString()} 원/km`
                : '계산 불가'}
            </span>
          </div>
        </div>
      </div>

      {/* 산업공학 분석 관점 학술적 안내 배너 */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-start space-x-3">
        <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <div className="font-semibold text-slate-800">
            💡 산업공학 운영 지표 해석 시 유의사항
          </div>
          <div>
            1. <strong>시점 불일치</strong>: 주유·충전 기록은 결제 시점의 주입량이며, 해당 기간의 운행거리와 물리적으로 완전 일치하지 않을 수 있으므로 단기 집계치만으로 실제 연비를 정확하게 측정한 것으로 해석하지 않습니다.
          </div>
          <div>
            2. <strong>부분 기간 왜곡 방지</strong>: 특정 수개월간의 단기 실적을 임의로 곱하여 연간 실적으로 단정하지 않으며, 경제성 분석에는 연간 표준 주행거리 가정을 적용합니다.
          </div>
        </div>
      </div>
    </div>
  );
};
