import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/common/Header';
import { Sidebar, NavTab } from './components/common/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { VehicleListView } from './components/vehicles/VehicleListView';
import { LogsView } from './components/logs/LogsView';
import { AnalysisView } from './components/analysis/AnalysisView';
import { HistoryView } from './components/history/HistoryView';
import { AuthModal } from './components/auth/AuthModal';
import { AnalysisInputSnapshot } from './types';
import { CloudOff, LogIn, Database, AlertCircle, Key, FileCode } from 'lucide-react';

const FleetAppInner: React.FC = () => {
  const { user, isConfigured, configError, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [clonedInput, setClonedInput] = useState<AnalysisInputSnapshot | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleDataRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleCloneAnalysis = (snapshot: AnalysisInputSnapshot) => {
    setClonedInput(snapshot);
    setCurrentTab('analysis');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 상단 글로벌 헤더 */}
      <Header onDataRefresh={handleDataRefresh} />

      {/* 메인 본체 (사이드바 + 콘텐츠) */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
        {/* 좌측 사이드바 */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            if (tab !== 'analysis') {
              setClonedInput(undefined);
            }
            setCurrentTab(tab);
          }}
        />

        {/* 우측 메인 콘텐츠 영역 */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {/* 1. 환경변수 미설정 오류 상태 (오류 숨김이나 로컬 fallback 금지) */}
          {!isConfigured ? (
            <div className="bg-white rounded-3xl p-8 border border-rose-200 shadow-sm max-w-2xl mx-auto my-8 text-center space-y-4">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <CloudOff className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Supabase 클라우드 데이터베이스 설정 필요
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-lg mx-auto">
                {configError || '본 시스템은 Supabase 클라우드 데이터베이스와 연동하도록 구성되었습니다. 올바른 환경변수 설정이 필요합니다.'}
              </p>

              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-left text-xs font-mono space-y-2">
                <div className="text-slate-400 font-sans font-semibold flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>.env.local 설정 파일 생성:</span>
                </div>
                <div className="text-teal-300">VITE_SUPABASE_URL=https://your-project.supabase.co</div>
                <div className="text-teal-300">VITE_SUPABASE_ANON_KEY=your-anon-public-key</div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <span>DB 스키마 마이그레이션 안내</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  <code className="text-slate-700 bg-slate-200 px-1 py-0.5 rounded">
                    supabase/migrations/20240101000000_create_fleet_schema.sql
                  </code>
                  파일의 SQL 내용을 Supabase SQL Editor에서 실행하시면 6대 테이블 및 RLS 보안 정책이 자동 생성됩니다.
                </p>
              </div>
            </div>
          ) : loading ? (
            /* 로딩 상태 */
            <div className="p-16 flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              <span className="text-xs text-slate-500">인증 세션 확인 중...</span>
            </div>
          ) : !user ? (
            /* 2. 미로그인 상태 안내 (비로그인 시 데이터 격리 안내) */
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm max-w-xl mx-auto my-12 text-center space-y-5">
              <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto">
                <Database className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  클라우드 차량 관리 및 분석 시스템 로그인
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Supabase RLS(Row Level Security)가 적용되어 있어, 로그인하신 사용자 본인의 차량 및 비용 데이터만 안전하게 관리됩니다.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs text-slate-600 space-y-2">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-teal-600" />
                  <span>로그인 후 사용 가능한 기능</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500">
                  <li>보유 차량 등록 및 마스터 관리 (본인 계정 격리)</li>
                  <li>운행 일지, 주유·충전 영수증, 정비 비용 실적 기록</li>
                  <li>친환경차 전환 경제성 분석 및 불변 스냅샷 저장</li>
                  <li>상단 [시연 데이터 생성] 버튼으로 가상 차량 5대 즉시 주입 가능</li>
                </ul>
              </div>

              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow transition flex items-center justify-center space-x-2 text-xs"
              >
                <LogIn className="w-4 h-4" />
                <span>로그인 또는 신규 회원가입</span>
              </button>
            </div>
          ) : (
            /* 3. 정상 로그인 상태 (사용자별 ID와 refreshKey를 복합 키로 주어 사용자 변경/로그아웃 시 화면 완전 초기화) */
            <div key={`${user.id}_${refreshKey}`} className="space-y-6">
              {currentTab === 'dashboard' && <DashboardView />}
              {currentTab === 'vehicles' && <VehicleListView />}
              {currentTab === 'logs' && <LogsView />}
              {currentTab === 'analysis' && (
                <AnalysisView
                  initialInput={clonedInput}
                  onSaved={() => {
                    // 저장 성공 콜백
                  }}
                />
              )}
              {currentTab === 'history' && (
                <HistoryView onCloneAnalysis={handleCloneAnalysis} />
              )}
            </div>
          )}
        </main>
      </div>

      {/* 인증 모달 */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* 하단 푸터 */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <p>
          기업 차량 운영 관리 및 친환경차 전환 경제성 분석 시스템 &copy; {new Date().getFullYear()} 산업공학과 데이터베이스 과제용 (Supabase Cloud DB)
        </p>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <FleetAppInner />
    </AuthProvider>
  );
};

export default App;
