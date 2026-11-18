import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Fuel,
  Wrench,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
} from 'lucide-react';
import { fleetRepository } from '../../services/repository';
import { Vehicle, TripLog, EnergyLog, MaintenanceLog } from '../../types';
import {
  formatCurrency,
  formatDistance,
  getFuelTypeLabel,
  getFuelUnit,
} from '../../utils/formatters';

type LogTab = 'trips' | 'energy' | 'maintenance';

export const LogsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LogTab>('trips');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [energy, setEnergy] = useState<EnergyLog[]>([]);
  const [maint, setMaint] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  // 공통 필터
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 토스트 피드백
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 모달 제어
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  // 운행 폼 상태
  const [tripForm, setTripForm] = useState({
    vehicle_id: '',
    trip_date: new Date().toISOString().split('T')[0],
    distance_km: 100,
    memo: '',
  });

  // 주유·충전 폼 상태
  const [energyForm, setEnergyForm] = useState({
    vehicle_id: '',
    log_date: new Date().toISOString().split('T')[0],
    amount: 40,
    total_cost: 68000,
    unit_price: 1700,
    memo: '',
  });

  // 정비 폼 상태
  const [maintForm, setMaintForm] = useState({
    vehicle_id: '',
    maintenance_date: new Date().toISOString().split('T')[0],
    item_name: '정기 점검 및 엔진오일 교환',
    cost: 120000,
    memo: '',
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [cloudError, setCloudError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setCloudError(null);
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

      if (vList.length > 0 && !tripForm.vehicle_id) {
        setTripForm((prev) => ({ ...prev, vehicle_id: vList[0].id }));
        setEnergyForm((prev) => ({ ...prev, vehicle_id: vList[0].id }));
        setMaintForm((prev) => ({ ...prev, vehicle_id: vList[0].id }));
      }
    } catch (e: any) {
      console.error(e);
      setCloudError(e.message || '기록 데이터를 불러오는 데 실패했습니다.');
      showToast(e.message || '기록 데이터를 불러오는 데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 차량 맵 생성
  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((v) => map.set(v.id, v));
    return map;
  }, [vehicles]);

  // 주유/충전 폼에서 선택된 차량 정보
  const selectedEnergyVehicle = useMemo(() => {
    return vehicleMap.get(energyForm.vehicle_id) || vehicles[0];
  }, [energyForm.vehicle_id, vehicleMap, vehicles]);

  // 날짜 필터링 함수
  const filterByDateAndVehicle = (itemDate: string, itemVehId: string, memo?: string) => {
    if (selectedVehicleId !== 'all' && itemVehId !== selectedVehicleId) return false;
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    if (searchKeyword.trim()) {
      const v = vehicleMap.get(itemVehId);
      const text = `${v?.plate_number} ${v?.model_name} ${memo || ''}`.toLowerCase();
      if (!text.includes(searchKeyword.toLowerCase())) return false;
    }
    return true;
  };

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => filterByDateAndVehicle(t.trip_date, t.vehicle_id, t.memo));
  }, [trips, selectedVehicleId, startDate, endDate, searchKeyword, vehicleMap]);

  const filteredEnergy = useMemo(() => {
    return energy.filter((e) => filterByDateAndVehicle(e.log_date, e.vehicle_id, e.memo));
  }, [energy, selectedVehicleId, startDate, endDate, searchKeyword, vehicleMap]);

  const filteredMaint = useMemo(() => {
    return maint.filter((m) =>
      filterByDateAndVehicle(m.maintenance_date, m.vehicle_id, `${m.item_name} ${m.memo || ''}`)
    );
  }, [maint, selectedVehicleId, startDate, endDate, searchKeyword, vehicleMap]);

  // 모달 열기
  const handleOpenModal = (mode: 'create' | 'edit', item?: any) => {
    setModalMode(mode);
    setFormErrors({});
    const defaultVehId = selectedVehicleId !== 'all' ? selectedVehicleId : vehicles[0]?.id || '';

    if (activeTab === 'trips') {
      if (mode === 'edit' && item) {
        setEditingId(item.id);
        setTripForm({
          vehicle_id: item.vehicle_id,
          trip_date: item.trip_date,
          distance_km: item.distance_km,
          memo: item.memo || '',
        });
      } else {
        setEditingId(null);
        setTripForm({
          vehicle_id: defaultVehId,
          trip_date: new Date().toISOString().split('T')[0],
          distance_km: 100,
          memo: '',
        });
      }
    } else if (activeTab === 'energy') {
      if (mode === 'edit' && item) {
        setEditingId(item.id);
        setEnergyForm({
          vehicle_id: item.vehicle_id,
          log_date: item.log_date,
          amount: item.amount,
          total_cost: item.total_cost,
          unit_price: item.unit_price,
          memo: item.memo || '',
        });
      } else {
        setEditingId(null);
        const targetV = vehicleMap.get(defaultVehId);
        let defaultPrice = 1700;
        let defaultAmount = 40;
        if (targetV?.fuel_type === 'electric') {
          defaultPrice = 340;
          defaultAmount = 50;
        } else if (targetV?.fuel_type === 'hydrogen') {
          defaultPrice = 9500;
          defaultAmount = 5;
        } else if (targetV?.fuel_type === 'diesel') {
          defaultPrice = 1550;
        }

        setEnergyForm({
          vehicle_id: defaultVehId,
          log_date: new Date().toISOString().split('T')[0],
          amount: defaultAmount,
          unit_price: defaultPrice,
          total_cost: Math.round(defaultAmount * defaultPrice),
          memo: '',
        });
      }
    } else if (activeTab === 'maintenance') {
      if (mode === 'edit' && item) {
        setEditingId(item.id);
        setMaintForm({
          vehicle_id: item.vehicle_id,
          maintenance_date: item.maintenance_date,
          item_name: item.item_name,
          cost: item.cost,
          memo: item.memo || '',
        });
      } else {
        setEditingId(null);
        setMaintForm({
          vehicle_id: defaultVehId,
          maintenance_date: new Date().toISOString().split('T')[0],
          item_name: '정기 점검 및 오일 교환',
          cost: 120000,
          memo: '',
        });
      }
    }
    setIsModalOpen(true);
  };

  // 모달 저장 처리
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    try {
      if (activeTab === 'trips') {
        if (!tripForm.vehicle_id) errors.vehicle_id = '차량을 선택해 주세요.';
        if (!tripForm.trip_date) errors.trip_date = '운행일자를 입력해 주세요.';
        if (tripForm.distance_km <= 0) errors.distance_km = '주행거리는 0km보다 커야 합니다.';
        if (Object.keys(errors).length > 0) {
          setFormErrors(errors);
          return;
        }

        if (modalMode === 'create') {
          await fleetRepository.createTripLog({
            vehicle_id: tripForm.vehicle_id,
            trip_date: tripForm.trip_date,
            distance_km: Number(tripForm.distance_km),
            memo: tripForm.memo.trim(),
            owner_id: 'demo-user-001',
          });
          showToast('운행 기록이 성공적으로 추가되었습니다.');
        } else if (modalMode === 'edit' && editingId) {
          await fleetRepository.updateTripLog(editingId, {
            vehicle_id: tripForm.vehicle_id,
            trip_date: tripForm.trip_date,
            distance_km: Number(tripForm.distance_km),
            memo: tripForm.memo.trim(),
          });
          showToast('운행 기록이 수정되었습니다.');
        }
      } else if (activeTab === 'energy') {
        if (!energyForm.vehicle_id) errors.vehicle_id = '차량을 선택해 주세요.';
        if (!energyForm.log_date) errors.log_date = '주입일자를 입력해 주세요.';
        if (energyForm.amount <= 0) errors.amount = '주입량은 0보다 커야 합니다.';
        if (energyForm.total_cost < 0) errors.total_cost = '결제금액은 0원 이상이어야 합니다.';
        if (Object.keys(errors).length > 0) {
          setFormErrors(errors);
          return;
        }

        const calculatedUnitPrice =
          energyForm.amount > 0 ? Math.round(energyForm.total_cost / energyForm.amount) : 0;

        if (modalMode === 'create') {
          await fleetRepository.createEnergyLog({
            vehicle_id: energyForm.vehicle_id,
            log_date: energyForm.log_date,
            amount: Number(energyForm.amount),
            total_cost: Number(energyForm.total_cost),
            unit_price: calculatedUnitPrice,
            memo: energyForm.memo.trim(),
            owner_id: 'demo-user-001',
          });
          showToast('주유·충전 기록이 성공적으로 추가되었습니다.');
        } else if (modalMode === 'edit' && editingId) {
          await fleetRepository.updateEnergyLog(editingId, {
            vehicle_id: energyForm.vehicle_id,
            log_date: energyForm.log_date,
            amount: Number(energyForm.amount),
            total_cost: Number(energyForm.total_cost),
            unit_price: calculatedUnitPrice,
            memo: energyForm.memo.trim(),
          });
          showToast('주유·충전 기록이 수정되었습니다.');
        }
      } else if (activeTab === 'maintenance') {
        if (!maintForm.vehicle_id) errors.vehicle_id = '차량을 선택해 주세요.';
        if (!maintForm.maintenance_date) errors.maintenance_date = '정비일자를 입력해 주세요.';
        if (!maintForm.item_name.trim()) errors.item_name = '정비 항목을 입력해 주세요.';
        if (maintForm.cost < 0) errors.cost = '정비 비용은 0원 이상이어야 합니다.';
        if (Object.keys(errors).length > 0) {
          setFormErrors(errors);
          return;
        }

        if (modalMode === 'create') {
          await fleetRepository.createMaintenanceLog({
            vehicle_id: maintForm.vehicle_id,
            maintenance_date: maintForm.maintenance_date,
            item_name: maintForm.item_name.trim(),
            cost: Number(maintForm.cost),
            memo: maintForm.memo.trim(),
            owner_id: 'demo-user-001',
          });
          showToast('정비 기록이 성공적으로 추가되었습니다.');
        } else if (modalMode === 'edit' && editingId) {
          await fleetRepository.updateMaintenanceLog(editingId, {
            vehicle_id: maintForm.vehicle_id,
            maintenance_date: maintForm.maintenance_date,
            item_name: maintForm.item_name.trim(),
            cost: Number(maintForm.cost),
            memo: maintForm.memo.trim(),
          });
          showToast('정비 기록이 수정되었습니다.');
        }
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || '저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // 삭제 처리
  const handleDelete = async (id: string) => {
    if (!window.confirm('해당 기록을 삭제하시겠습니까?')) return;
    try {
      if (activeTab === 'trips') {
        await fleetRepository.deleteTripLog(id);
        showToast('운행 기록이 삭제되었습니다.');
      } else if (activeTab === 'energy') {
        await fleetRepository.deleteEnergyLog(id);
        showToast('주유·충전 기록이 삭제되었습니다.');
      } else if (activeTab === 'maintenance') {
        await fleetRepository.deleteMaintenanceLog(id);
        showToast('정비 기록이 삭제되었습니다.');
      }
      loadData();
    } catch (err: any) {
      showToast(err.message || '삭제에 실패했습니다.', 'error');
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
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">클라우드 데이터베이스 통신 오류</div>
            <p className="text-rose-700">{cloudError}</p>
            <p className="text-[11px] text-rose-600">
              * Supabase 프로젝트에 `trip_logs`, `energy_logs`, `maintenance_logs` 테이블이 생성되어 있는지 확인해주세요.
            </p>
          </div>
        </div>
      )}
      {/* 토스트 */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 text-sm text-white animate-in slide-in-from-top-4 duration-200 ${
            toastMessage.type === 'success' ? 'bg-teal-700' : 'bg-rose-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-teal-200" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-200" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 헤더 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">운행 및 비용 기록</h2>
          <p className="text-xs text-slate-500 mt-1">
            차량별 일상 운행거리, 주유 및 전기/수소 충전 영수증, 정비 내역을 기록·관리합니다.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal('create')}
          disabled={vehicles.length === 0}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>
            {activeTab === 'trips'
              ? '운행 기록 추가'
              : activeTab === 'energy'
              ? '주유·충전 기록 추가'
              : '정비 기록 추가'}
          </span>
        </button>
      </div>

      {/* 3대 탭 셀렉터 */}
      <div className="flex items-center space-x-2 border-b border-slate-200 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('trips')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition ${
            activeTab === 'trips'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>A. 운행 기록 ({trips.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('energy')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition ${
            activeTab === 'energy'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Fuel className="w-4 h-4" />
          <span>B. 주유·충전 기록 ({energy.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition ${
            activeTab === 'maintenance'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>C. 정비 기록 ({maint.length})</span>
        </button>
      </div>

      {/* 공통 필터 영역 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* 차량 선택 필터 */}
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-600">차량:</span>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
            >
              <option value="all">전체 차량 ({vehicles.length}대)</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} - {v.model_name.split('(')[0]}
                </option>
              ))}
            </select>
          </div>

          {/* 기간 필터 */}
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-600">기간:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <span className="text-slate-400">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* 검색창 */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="메모, 차량번호 검색..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* 테이블 영역 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {/* A. 운행 기록 탭 테이블 */}
          {activeTab === 'trips' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">운행일자</th>
                  <th className="py-3 px-4">차량번호</th>
                  <th className="py-3 px-4">모델명</th>
                  <th className="py-3 px-4 text-right">주행거리</th>
                  <th className="py-3 px-5">운행 목적 및 메모</th>
                  <th className="py-3 px-4 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      등록된 운행 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((t) => {
                    const v = vehicleMap.get(t.vehicle_id);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {t.trip_date}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {v?.plate_number || '알 수 없음'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {v?.model_name || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-teal-700 whitespace-nowrap">
                          {formatDistance(t.distance_km)}
                        </td>
                        <td className="py-3 px-5 text-slate-600 max-w-[280px] truncate" title={t.memo}>
                          {t.memo || '-'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleOpenModal('edit', t)}
                              className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100"
                              title="수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* B. 주유·충전 기록 탭 테이블 */}
          {activeTab === 'energy' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">주입일자</th>
                  <th className="py-3 px-4">차량번호</th>
                  <th className="py-3 px-3">연료</th>
                  <th className="py-3 px-4 text-right">주입량(단위)</th>
                  <th className="py-3 px-4 text-right">환산 단가</th>
                  <th className="py-3 px-4 text-right">결제금액</th>
                  <th className="py-3 px-5">충전소 및 메모</th>
                  <th className="py-3 px-4 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEnergy.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      등록된 주유·충전 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredEnergy.map((e) => {
                    const v = vehicleMap.get(e.vehicle_id);
                    const fuelType = v?.fuel_type || 'gasoline';
                    const unit = getFuelUnit(fuelType);
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {e.log_date}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {v?.plate_number || '알 수 없음'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                            {getFuelTypeLabel(fuelType)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-800 whitespace-nowrap">
                          {e.amount.toLocaleString()} {unit}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                          {formatCurrency(e.unit_price)}/{unit}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-700 whitespace-nowrap">
                          {formatCurrency(e.total_cost)}
                        </td>
                        <td className="py-3 px-5 text-slate-600 max-w-[240px] truncate" title={e.memo}>
                          {e.memo || '-'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleOpenModal('edit', e)}
                              className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100"
                              title="수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* C. 정비 기록 탭 테이블 */}
          {activeTab === 'maintenance' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">정비일자</th>
                  <th className="py-3 px-4">차량번호</th>
                  <th className="py-3 px-4">모델명</th>
                  <th className="py-3 px-5">정비 항목</th>
                  <th className="py-3 px-4 text-right">정비 비용</th>
                  <th className="py-3 px-5">정비소 및 비고</th>
                  <th className="py-3 px-4 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaint.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      등록된 정비 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredMaint.map((m) => {
                    const v = vehicleMap.get(m.vehicle_id);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {m.maintenance_date}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {v?.plate_number || '알 수 없음'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {v?.model_name || '-'}
                        </td>
                        <td className="py-3 px-5 font-semibold text-slate-800">
                          {m.item_name}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-700 whitespace-nowrap">
                          {formatCurrency(m.cost)}
                        </td>
                        <td className="py-3 px-5 text-slate-600 max-w-[240px] truncate" title={m.memo}>
                          {m.memo || '-'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleOpenModal('edit', m)}
                              className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100"
                              title="수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 등록/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {activeTab === 'trips'
                  ? modalMode === 'create'
                    ? '새 운행 기록 등록'
                    : '운행 기록 수정'
                  : activeTab === 'energy'
                  ? modalMode === 'create'
                    ? '새 주유·충전 영수증 등록'
                    : '주유·충전 기록 수정'
                  : modalMode === 'create'
                  ? '새 정비 내역 등록'
                  : '정비 내역 수정'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {Object.keys(formErrors).length > 0 && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px]">
                  {Object.values(formErrors)[0]}
                </div>
              )}
              {/* 대상 차량 선택 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  대상 차량 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={
                    activeTab === 'trips'
                      ? tripForm.vehicle_id
                      : activeTab === 'energy'
                      ? energyForm.vehicle_id
                      : maintForm.vehicle_id
                  }
                  onChange={(e) => {
                    const vId = e.target.value;
                    if (activeTab === 'trips') setTripForm({ ...tripForm, vehicle_id: vId });
                    else if (activeTab === 'energy') {
                      const v = vehicleMap.get(vId);
                      let price = 1700;
                      if (v?.fuel_type === 'electric') price = 340;
                      else if (v?.fuel_type === 'hydrogen') price = 9500;
                      else if (v?.fuel_type === 'diesel') price = 1550;
                      setEnergyForm({
                        ...energyForm,
                        vehicle_id: vId,
                        unit_price: price,
                        total_cost: Math.round(energyForm.amount * price),
                      });
                    } else setMaintForm({ ...maintForm, vehicle_id: vId });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number} - {v.model_name} ({getFuelTypeLabel(v.fuel_type)})
                    </option>
                  ))}
                </select>
              </div>

              {/* A. 운행 폼 필드 */}
              {activeTab === 'trips' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      운행일자 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tripForm.trip_date}
                      onChange={(e) => setTripForm({ ...tripForm, trip_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      주행거리 (km) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={tripForm.distance_km}
                      onChange={(e) =>
                        setTripForm({ ...tripForm, distance_km: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">운행 목적 및 메모</label>
                    <input
                      type="text"
                      placeholder="예: 판교 본사-대전 고객사 출장 왕복"
                      value={tripForm.memo}
                      onChange={(e) => setTripForm({ ...tripForm, memo: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </>
              )}

              {/* B. 주유·충전 폼 필드 */}
              {activeTab === 'energy' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      주입일자 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={energyForm.log_date}
                      onChange={(e) => setEnergyForm({ ...energyForm, log_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  {/* 연료 종류에 따른 단위 자동 안내 표시 */}
                  <div className="p-2.5 bg-teal-50 border border-teal-100 rounded-lg text-teal-800 text-[11px] flex items-center justify-between">
                    <span>
                      차량 연료: <strong>{getFuelTypeLabel(selectedEnergyVehicle?.fuel_type || 'gasoline')}</strong>
                    </span>
                    <span className="font-bold">
                      적용 단위: {getFuelUnit(selectedEnergyVehicle?.fuel_type || 'gasoline')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        주입량 ({getFuelUnit(selectedEnergyVehicle?.fuel_type || 'gasoline')}){' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={energyForm.amount}
                        onChange={(e) => {
                          const amt = parseFloat(e.target.value) || 0;
                          setEnergyForm({
                            ...energyForm,
                            amount: amt,
                            total_cost: Math.round(amt * energyForm.unit_price),
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        총 결제금액 (원) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={energyForm.total_cost}
                        onChange={(e) => {
                          const cost = parseInt(e.target.value, 10) || 0;
                          setEnergyForm({
                            ...energyForm,
                            total_cost: cost,
                            unit_price:
                              energyForm.amount > 0 ? Math.round(cost / energyForm.amount) : 0,
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    자동 계산 환산단가:{' '}
                    <strong className="text-slate-800">
                      {energyForm.amount > 0
                        ? `${Math.round(energyForm.total_cost / energyForm.amount).toLocaleString()} 원/${getFuelUnit(
                            selectedEnergyVehicle?.fuel_type || 'gasoline'
                          )}`
                        : '0원'}
                    </strong>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">주유소/충전소 및 메모</label>
                    <input
                      type="text"
                      placeholder="예: GS칼텍스 판교주유소"
                      value={energyForm.memo}
                      onChange={(e) => setEnergyForm({ ...energyForm, memo: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </>
              )}

              {/* C. 정비 폼 필드 */}
              {activeTab === 'maintenance' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      정비일자 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={maintForm.maintenance_date}
                      onChange={(e) =>
                        setMaintForm({ ...maintForm, maintenance_date: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      정비 항목 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="예: 엔진오일 및 브레이크 패드 교체"
                      value={maintForm.item_name}
                      onChange={(e) => setMaintForm({ ...maintForm, item_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      정비 비용 (원) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={maintForm.cost}
                      onChange={(e) =>
                        setMaintForm({ ...maintForm, cost: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">정비업체 및 비고</label>
                    <input
                      type="text"
                      placeholder="예: 현대 블루핸즈 판교점"
                      value={maintForm.memo}
                      onChange={(e) => setMaintForm({ ...maintForm, memo: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </>
              )}

              {/* 버튼 바 */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow transition"
                >
                  저장 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
