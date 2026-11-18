import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
} from 'lucide-react';
import { fleetRepository, VehicleDeletionCheck } from '../../services/repository';
import { FuelType, Vehicle } from '../../types';
import {
  formatCurrency,
  getEfficiencyUnit,
  getFuelTypeLabel,
} from '../../utils/formatters';

interface VehicleFormData {
  plate_number: string;
  model_name: string;
  fuel_type: FuelType;
  purchase_date: string;
  purchase_price: number;
  official_efficiency: number;
  memo: string;
}

const initialForm: VehicleFormData = {
  plate_number: '',
  model_name: '',
  fuel_type: 'gasoline',
  purchase_date: new Date().toISOString().split('T')[0],
  purchase_price: 30000000,
  official_efficiency: 12.0,
  memo: '',
};

export const VehicleListView: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fuelFilter, setFuelFilter] = useState<string>('all');

  // 모달 제어 상태
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VehicleFormData>(initialForm);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // 삭제 확인 모달
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [deletionCheck, setDeletionCheck] = useState<VehicleDeletionCheck | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // 피드백 메시지
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [cloudError, setCloudError] = useState<string | null>(null);

  const loadVehicles = async () => {
    setLoading(true);
    setCloudError(null);
    try {
      const list = await fleetRepository.getVehicles();
      setVehicles(list);
    } catch (e: any) {
      console.error(e);
      setCloudError(e.message || '차량 목록을 불러오는 중 오류가 발생했습니다.');
      showToast(e.message || '차량 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  // 등록/수정 모달 열기
  const handleOpenModal = (mode: 'create' | 'edit', vehicle?: Vehicle) => {
    setModalMode(mode);
    setFormErrors({});
    if (mode === 'edit' && vehicle) {
      setEditingId(vehicle.id);
      setFormData({
        plate_number: vehicle.plate_number,
        model_name: vehicle.model_name,
        fuel_type: vehicle.fuel_type,
        purchase_date: vehicle.purchase_date,
        purchase_price: vehicle.purchase_price,
        official_efficiency: vehicle.official_efficiency,
        memo: vehicle.memo || '',
      });
    } else {
      setEditingId(null);
      setFormData({
        ...initialForm,
        purchase_date: new Date().toISOString().split('T')[0],
      });
    }
  };

  // 폼 검증
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!formData.plate_number.trim()) {
      errors.plate_number = '차량번호를 입력해 주세요.';
    } else {
      // 중복 체크
      const norm = formData.plate_number.replace(/\s+/g, '');
      const duplicate = vehicles.some(
        (v) => v.id !== editingId && v.plate_number.replace(/\s+/g, '') === norm
      );
      if (duplicate) {
        errors.plate_number = '이미 등록된 차량번호입니다.';
      }
    }

    if (!formData.model_name.trim()) {
      errors.model_name = '차량 모델명을 입력해 주세요.';
    }
    if (!formData.purchase_date) {
      errors.purchase_date = '구매일자를 선택해 주세요.';
    }
    if (formData.purchase_price < 0) {
      errors.purchase_price = '구매가격은 0원 이상이어야 합니다.';
    }
    if (formData.official_efficiency <= 0) {
      errors.official_efficiency = '공인연비는 0보다 커야 합니다.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (modalMode === 'create') {
        await fleetRepository.createVehicle({
          plate_number: formData.plate_number.trim(),
          model_name: formData.model_name.trim(),
          fuel_type: formData.fuel_type,
          purchase_date: formData.purchase_date,
          purchase_price: Number(formData.purchase_price),
          official_efficiency: Number(formData.official_efficiency),
          memo: formData.memo.trim(),
          owner_id: 'demo-user-001',
        });
        showToast(`차량 "${formData.plate_number}"이(가) 성공적으로 등록되었습니다.`);
      } else if (modalMode === 'edit' && editingId) {
        await fleetRepository.updateVehicle(editingId, {
          plate_number: formData.plate_number.trim(),
          model_name: formData.model_name.trim(),
          fuel_type: formData.fuel_type,
          purchase_date: formData.purchase_date,
          purchase_price: Number(formData.purchase_price),
          official_efficiency: Number(formData.official_efficiency),
          memo: formData.memo.trim(),
        });
        showToast(`차량 정보가 성공적으로 수정되었습니다.`);
      }
      setModalMode(null);
      loadVehicles();
    } catch (err: any) {
      showToast(err.message || '저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // 삭제 버튼 클릭 시 검사
  const handleOpenDelete = async (v: Vehicle) => {
    try {
      const check = await fleetRepository.checkVehicleDeletion(v.id);
      setDeletingVehicle(v);
      setDeletionCheck(check);
      setConfirmInput('');
    } catch (e) {
      console.error(e);
      showToast('삭제 가능 여부를 확인하지 못했습니다.', 'error');
    }
  };

  // 최종 삭제 실행
  const handleConfirmDelete = async () => {
    if (!deletingVehicle) return;
    if (deletionCheck && deletionCheck.totalRelatedCount > 0) {
      if (confirmInput.trim() !== deletingVehicle.plate_number.replace(/\s+/g, '')) {
        alert('차량번호가 일치하지 않습니다.');
        return;
      }
    }

    setIsDeleting(true);
    try {
      await fleetRepository.deleteVehicle(deletingVehicle.id, true);
      showToast(`차량 "${deletingVehicle.plate_number}" 및 관련 기록이 모두 삭제되었습니다.`);
      setDeletingVehicle(null);
      loadVehicles();
    } catch (err: any) {
      showToast(err.message || '삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // 검색 및 필터링된 차량 목록
  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.memo && v.memo.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFuel = fuelFilter === 'all' || v.fuel_type === fuelFilter;
    return matchesSearch && matchesFuel;
  });

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
              * Supabase 프로젝트에 `vehicles` 테이블이 생성되어 있는지 확인해주세요.
            </p>
          </div>
        </div>
      )}
      {/* 토스트 피드백 */}
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

      {/* 상단 액션 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">차량 관리</h2>
          <p className="text-xs text-slate-500 mt-1">
            기업이 보유한 업무용 차량의 마스터 정보와 연료별 공인 기준연비를 관리합니다.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal('create')}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>신규 차량 등록</span>
        </button>
      </div>

      {/* 필터 및 검색 바 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="차량번호, 모델명 또는 메모 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 font-medium">연료 종류:</span>
          <select
            value={fuelFilter}
            onChange={(e) => setFuelFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
          >
            <option value="all">전체보기</option>
            <option value="gasoline">가솔린</option>
            <option value="diesel">디젤</option>
            <option value="hybrid">하이브리드</option>
            <option value="electric">전기(EV)</option>
            <option value="hydrogen">수소(FCEV)</option>
          </select>
        </div>
      </div>

      {/* 차량 목록 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">차량번호</th>
                <th className="py-3 px-4">모델명</th>
                <th className="py-3 px-3">연료</th>
                <th className="py-3 px-3 text-right">공인 기준연비</th>
                <th className="py-3 px-3 text-right">구매일 / 구매가격</th>
                <th className="py-3 px-4">메모</th>
                <th className="py-3 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    등록된 차량이 없거나 검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {v.plate_number}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {v.model_name}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          v.fuel_type === 'electric'
                            ? 'bg-teal-100 text-teal-800'
                            : v.fuel_type === 'hydrogen'
                            ? 'bg-sky-100 text-sky-800'
                            : v.fuel_type === 'hybrid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : v.fuel_type === 'diesel'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {getFuelTypeLabel(v.fuel_type)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                      {v.official_efficiency} {getEfficiencyUnit(v.fuel_type)}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="text-slate-800 font-semibold">{formatCurrency(v.purchase_price)}</div>
                      <div className="text-[11px] text-slate-400">{v.purchase_date}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate" title={v.memo}>
                      {v.memo || '-'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => handleOpenModal('edit', v)}
                          className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(v)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 등록/수정 모달 */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
              <h3 className="text-lg font-bold text-slate-900">
                {modalMode === 'create' ? '새 차량 등록' : '차량 마스터 정보 수정'}
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* 차량번호 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  차량번호 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 12가 3456"
                  value={formData.plate_number}
                  onChange={(e) =>
                    setFormData({ ...formData, plate_number: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                    formErrors.plate_number
                      ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/30'
                      : 'border-slate-300 focus:ring-teal-500'
                  }`}
                />
                {formErrors.plate_number && (
                  <p className="text-rose-500 text-[11px] mt-1">{formErrors.plate_number}</p>
                )}
              </div>

              {/* 모델명 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  차량 모델명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 현대 아이오닉 6 Long Range"
                  value={formData.model_name}
                  onChange={(e) =>
                    setFormData({ ...formData, model_name: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                    formErrors.model_name
                      ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/30'
                      : 'border-slate-300 focus:ring-teal-500'
                  }`}
                />
                {formErrors.model_name && (
                  <p className="text-rose-500 text-[11px] mt-1">{formErrors.model_name}</p>
                )}
              </div>

              {/* 연료 종류 & 공인연비 (2열) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    연료 종류 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.fuel_type}
                    onChange={(e) =>
                      setFormData({ ...formData, fuel_type: e.target.value as FuelType })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                  >
                    <option value="gasoline">가솔린</option>
                    <option value="diesel">디젤</option>
                    <option value="hybrid">하이브리드</option>
                    <option value="electric">전기 (EV)</option>
                    <option value="hydrogen">수소 (FCEV)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    공인 기준연비 ({getEfficiencyUnit(formData.fuel_type)}){' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.official_efficiency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        official_efficiency: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  {formErrors.official_efficiency && (
                    <p className="text-rose-500 text-[11px] mt-1">
                      {formErrors.official_efficiency}
                    </p>
                  )}
                </div>
              </div>

              {/* 구매일자 & 구매가격 (2열) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    구매일자 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) =>
                      setFormData({ ...formData, purchase_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  {formErrors.purchase_date && (
                    <p className="text-rose-500 text-[11px] mt-1">
                      {formErrors.purchase_date}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    취득 가격 (원) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="100000"
                    min="0"
                    value={formData.purchase_price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        purchase_price: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  {formErrors.purchase_price && (
                    <p className="text-rose-500 text-[11px] mt-1">
                      {formErrors.purchase_price}
                    </p>
                  )}
                </div>
              </div>

              {/* 관리 메모 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">관리 메모</label>
                <textarea
                  rows={2}
                  placeholder="용도, 부서, 특이사항 등..."
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* 하단 버튼 바 */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow transition"
                >
                  {modalMode === 'create' ? '등록 완료' : '수정 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 차량 삭제 경고 및 확인 모달 */}
      {deletingVehicle && deletionCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <div className="p-2 bg-rose-100 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">차량 삭제 확인 및 영향도 안내</h3>
            </div>

            <div className="text-xs text-slate-600 space-y-3 mb-5">
              <p>
                선택하신 차량 <strong>[{deletingVehicle.plate_number}] {deletingVehicle.model_name}</strong>을(를) 삭제하시겠습니까?
              </p>

              {deletionCheck.totalRelatedCount > 0 ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-800">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    연관된 운영 데이터가 존재합니다:
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 ml-2">
                    <li>운행 기록: {deletionCheck.tripCount}건</li>
                    <li>주유·충전 기록: {deletionCheck.energyCount}건</li>
                    <li>정비 기록: {deletionCheck.maintCount}건</li>
                    <li>연계된 경제성 분석: {deletionCheck.analysisCount}건</li>
                  </ul>
                  <p className="text-[11px] pt-1 font-semibold text-rose-900">
                    차량을 삭제하면 위 연관 기록들이 모두 영구 삭제(Cascade)됩니다.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
                  연결된 운행/비용 기록이 없어 안전하게 삭제할 수 있습니다.
                </div>
              )}

              {deletionCheck.totalRelatedCount > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    삭제 확인을 위해 차량번호 <strong>[{deletingVehicle.plate_number.replace(/\s+/g, '')}]</strong>를 띄어쓰기 없이 입력하세요:
                  </label>
                  <input
                    type="text"
                    placeholder={deletingVehicle.plate_number.replace(/\s+/g, '')}
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-rose-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeletingVehicle(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={
                  isDeleting ||
                  (deletionCheck.totalRelatedCount > 0 &&
                    confirmInput.trim() !== deletingVehicle.plate_number.replace(/\s+/g, ''))
                }
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow transition"
              >
                {isDeleting ? '삭제 중...' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
