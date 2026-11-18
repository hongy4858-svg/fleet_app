import React, { useState, useEffect } from 'react';
import {
  History,
  Download,
  Copy,
  Trash2,
  Eye,
  X,
  AlertCircle,
} from 'lucide-react';
import { fleetRepository } from '../../services/repository';
import { AnalysisInputSnapshot, AnalysisRecord } from '../../types';
import { exportToCsv, formatCurrency, formatDistance, getFuelTypeLabel } from '../../utils/formatters';

interface HistoryViewProps {
  onCloneAnalysis: (snapshot: AnalysisInputSnapshot) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onCloneAnalysis }) => {
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const loadAnalyses = async () => {
    setLoading(true);
    setCloudError(null);
    try {
      const list = await fleetRepository.getAnalyses();
      setAnalyses(list);
    } catch (e: any) {
      console.error(e);
      setCloudError(e.message || '분석 이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyses();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 분석 이력을 삭제하시겠습니까?')) return;
    try {
      await fleetRepository.deleteAnalysis(id);
      loadAnalyses();
    } catch (e) {
      console.error(e);
      alert('삭제 실패');
    }
  };

  // CSV 전체 다운로드
  const handleExportCsv = () => {
    if (analyses.length === 0) {
      alert('내보낼 분석 이력이 없습니다.');
      return;
    }

    const headers = [
      '분석 ID',
      '분석 명칭',
      '생성 일시',
      '기존 차량 번호',
      '기존 모델명',
      '기존 연료',
      '교체 후보 모델명',
      '교체 연료',
      '분석 기간(년)',
      '연간 주행거리(km)',
      '할인율(%)',
      '기존 유지 총비용(PV)',
      '신차 교체 총비용(PV)',
      '비용 차이(ΔPV)',
      '추천 대안',
      '절감액',
    ];

    const rows = analyses.map((a) => {
      const inp = a.input_snapshot;
      const res = a.result_snapshot;
      return [
        a.id,
        a.title,
        a.created_at.replace('T', ' ').substring(0, 19),
        inp.existing.plate_number,
        inp.existing.model_name,
        getFuelTypeLabel(inp.existing.fuel_type),
        inp.replacement.model_name,
        getFuelTypeLabel(inp.replacement.fuel_type),
        inp.analysis_period_years,
        inp.annual_distance_km,
        inp.discount_rate_pct,
        res.keep_breakdown.pv_total_cost,
        res.replace_breakdown.pv_total_cost,
        res.delta_pv,
        res.recommended_alternative === 'replace'
          ? '신차 교체 유리'
          : res.recommended_alternative === 'keep'
          ? '기존 유지 유리'
          : '무차별',
        res.savings_amount,
      ];
    });

    const todayStr = new Date().toISOString().split('T')[0];
    exportToCsv(`차량_경제성_분석이력_${todayStr}.csv`, [headers, ...rows]);
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
              * Supabase 프로젝트에 `analyses` 테이블이 생성되어 있는지 확인해주세요.
            </p>
          </div>
        </div>
      )}
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-teal-600" />
            <span>경제성 분석 이력 관리</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            저장된 경제성 분석 스냅샷을 조회, 복제하여 재분석하거나 CSV 파일로 내보냅니다.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={analyses.length === 0}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <Download className="w-4 h-4" />
          <span>전체 이력 CSV 내보내기</span>
        </button>
      </div>

      {/* 분석 이력 목록 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">분석 명칭 및 생성일</th>
                <th className="py-3 px-4">기존 차량 (유지)</th>
                <th className="py-3 px-4">교체 대상 (신차)</th>
                <th className="py-3 px-3 text-center">조건 (기간/할인)</th>
                <th className="py-3 px-4 text-right">기존 유지 PV</th>
                <th className="py-3 px-4 text-right">신차 교체 PV</th>
                <th className="py-3 px-4 text-center">유리한 대안</th>
                <th className="py-3 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analyses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    저장된 분석 이력이 없습니다. [유지·교체 비교] 탭에서 분석 결과를 저장해 보세요.
                  </td>
                </tr>
              ) : (
                analyses.map((a) => {
                  const inp = a.input_snapshot;
                  const res = a.result_snapshot;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{a.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {a.created_at.replace('T', ' ').substring(0, 16)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {inp.existing.plate_number}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {inp.existing.model_name.split('(')[0]}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-teal-800">
                          {inp.replacement.model_name.split('(')[0]}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {getFuelTypeLabel(inp.replacement.fuel_type)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-600 font-medium">
                          {inp.analysis_period_years}년 / {inp.discount_rate_pct}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700 whitespace-nowrap">
                        {formatCurrency(res.keep_breakdown.pv_total_cost)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-teal-700 whitespace-nowrap">
                        {formatCurrency(res.replace_breakdown.pv_total_cost)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {res.recommended_alternative === 'replace' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                            교체 유리
                          </span>
                        ) : res.recommended_alternative === 'keep' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            유지 유리
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                            무차별
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setSelectedRecord(a)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100"
                            title="상세 스냅샷 조회"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onCloneAnalysis(a.input_snapshot)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"
                            title="조건 복제하여 재분석"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
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
        </div>
      </div>

      {/* 스냅샷 상세 조회 모달 */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedRecord.title}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  분석일시: {selectedRecord.created_at.replace('T', ' ').substring(0, 19)} (불변 스냅샷)
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 기본 조건 */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 mb-4 text-center">
              <div>
                <span className="text-slate-500 block text-[11px]">분석 기간</span>
                <span className="font-bold text-slate-800">
                  {selectedRecord.input_snapshot.analysis_period_years}년
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">연간 주행거리</span>
                <span className="font-bold text-slate-800">
                  {formatDistance(selectedRecord.input_snapshot.annual_distance_km)}/년
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">할인율</span>
                <span className="font-bold text-slate-800">
                  {selectedRecord.input_snapshot.discount_rate_pct}%
                </span>
              </div>
            </div>

            {/* 입력 파라미터 대조표 */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">파라미터</th>
                    <th className="p-2.5">
                      기존차 ({selectedRecord.input_snapshot.existing.plate_number})
                    </th>
                    <th className="p-2.5">
                      교체차 ({selectedRecord.input_snapshot.replacement.model_name.split('(')[0]})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="p-2.5 font-medium">연료 종류</td>
                    <td className="p-2.5">
                      {getFuelTypeLabel(selectedRecord.input_snapshot.existing.fuel_type)}
                    </td>
                    <td className="p-2.5">
                      {getFuelTypeLabel(selectedRecord.input_snapshot.replacement.fuel_type)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">차량 가격 / 매각가</td>
                    <td className="p-2.5">
                      현재 매각가: {formatCurrency(selectedRecord.input_snapshot.existing.current_market_value)}
                    </td>
                    <td className="p-2.5">
                      구매: {formatCurrency(selectedRecord.input_snapshot.replacement.purchase_price)} (보조금: {formatCurrency(selectedRecord.input_snapshot.replacement.subsidy)})
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">연비 및 에너지가격</td>
                    <td className="p-2.5">
                      {selectedRecord.input_snapshot.existing.efficiency} km/단위 ({selectedRecord.input_snapshot.existing.energy_price}원)
                    </td>
                    <td className="p-2.5">
                      {selectedRecord.input_snapshot.replacement.efficiency} km/단위 ({selectedRecord.input_snapshot.replacement.energy_price}원)
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">연간 정비/세금/보험</td>
                    <td className="p-2.5">
                      정비 {formatCurrency(selectedRecord.input_snapshot.existing.annual_maintenance)}, 세금+보험 {formatCurrency(selectedRecord.input_snapshot.existing.annual_tax + selectedRecord.input_snapshot.existing.annual_insurance)}
                    </td>
                    <td className="p-2.5">
                      정비 {formatCurrency(selectedRecord.input_snapshot.replacement.annual_maintenance)}, 세금+보험 {formatCurrency(selectedRecord.input_snapshot.replacement.annual_tax + selectedRecord.input_snapshot.replacement.annual_insurance)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">예상 잔존가치</td>
                    <td className="p-2.5">
                      {formatCurrency(selectedRecord.input_snapshot.existing.expected_salvage_value)}
                    </td>
                    <td className="p-2.5">
                      {formatCurrency(selectedRecord.input_snapshot.replacement.expected_salvage_value)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 산출 결과 명세 */}
            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-sm font-bold border-b border-slate-700 pb-2">
                <span>최종 경제성 판정:</span>
                <span className="text-teal-400">
                  {selectedRecord.result_snapshot.recommended_alternative === 'replace'
                    ? `친환경차 교체 유리 (${formatCurrency(selectedRecord.result_snapshot.savings_amount)} 절감)`
                    : selectedRecord.result_snapshot.recommended_alternative === 'keep'
                    ? `기존차 유지 유리 (${formatCurrency(selectedRecord.result_snapshot.savings_amount)} 절감)`
                    : '동등'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  기존 유지 총비용(PV):{' '}
                  <strong className="text-white">
                    {formatCurrency(selectedRecord.result_snapshot.keep_breakdown.pv_total_cost)}
                  </strong>
                </div>
                <div>
                  신차 교체 총비용(PV):{' '}
                  <strong className="text-teal-400">
                    {formatCurrency(selectedRecord.result_snapshot.replace_breakdown.pv_total_cost)}
                  </strong>
                </div>
              </div>
            </div>

            {/* 하단 모달 액션 */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
              <button
                onClick={() => {
                  onCloneAnalysis(selectedRecord.input_snapshot);
                  setSelectedRecord(null);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>이 분석을 복제하여 수정하기</span>
              </button>

              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
