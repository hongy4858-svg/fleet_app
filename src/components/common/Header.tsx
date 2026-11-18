import React, { useState } from 'react';
import {
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  User,
  PlusCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fleetRepository } from '../../services/repository';
import { AuthModal } from '../auth/AuthModal';

interface HeaderProps {
  onDataRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onDataRefresh }) => {
  const { user, isConfigured, configError, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 3500);
  };

  // 시연용 가상 데이터 생성 (현재 사용자 계정에만 주입)
  const handleSeedDemoData = async () => {
    if (!user) {
      showToast('로그인 후 시연 데이터를 생성할 수 있습니다.', 'error');
      return;
    }
    setIsSeeding(true);
    try {
      if (fleetRepository.seedDemoDataForUser) {
        await fleetRepository.seedDemoDataForUser();
      }
      showToast('현재 계정에 가상 시연 차량 5대 및 표준 실적 데이터가 중복 없이 등록되었습니다.');
      if (onDataRefresh) onDataRefresh();
    } catch (e: any) {
      console.error(e);
      showToast(`시연 데이터 주입 실패: ${e.message}`, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  // 현재 사용자 클라우드 데이터 초기화
  const handleReset = async () => {
    if (!user) return;
    setIsResetting(true);
    try {
      await fleetRepository.resetToDemoData();
      setShowResetConfirm(false);
      showToast('현재 계정의 클라우드 데이터가 깨끗한 시연 초기 상태로 복원되었습니다.');
      if (onDataRefresh) onDataRefresh();
    } catch (e: any) {
      console.error(e);
      showToast(`초기화 실패: ${e.message}`, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // 로그아웃
  const handleSignOut = async () => {
    try {
      await signOut();
      showToast('성공적으로 로그아웃되었습니다.');
      if (onDataRefresh) onDataRefresh();
    } catch (e: any) {
      showToast(`로그아웃 오류: ${e.message}`, 'error');
    }
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
        {/* 환경변수 미설정 시 경고 배너 (오류 숨김 방지) */}
        {!isConfigured && (
          <div className="bg-amber-600 text-white text-xs py-2 px-4 flex items-center justify-between font-medium">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-200" />
              <span>
                <strong>클라우드 DB 연결 대기:</strong> {configError || '.env.local 설정이 필요합니다.'}
              </span>
            </div>
            <span className="text-[11px] underline opacity-90 hidden sm:inline">
              .env.example을 참고하여 .env.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.
            </span>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* 로고 & 시스템 명칭 */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center shadow-md">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>기업 차량 운영 관리 및 친환경차 전환 경제성 분석 시스템</span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Fleet Operation & Green Transition Economic Evaluation System
              </p>
            </div>
          </div>

          {/* 우측 클라우드 상태 & 인증 & 시연 버튼 */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Supabase 클라우드 연결 상태 뱃지 */}
            {isConfigured ? (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-medium">
                <Cloud className="w-3.5 h-3.5 text-teal-400" />
                <span className="hidden sm:inline">Supabase DB</span>
                <span>연결됨</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                <CloudOff className="w-3.5 h-3.5 text-rose-400" />
                <span>환경변수 미설정</span>
              </div>
            )}

            {/* 사용자 로그인 상태에 따른 UI */}
            {user ? (
              <>
                {/* 사용자 이메일 표시 */}
                <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 text-xs text-slate-300">
                  <User className="w-3.5 h-3.5 text-teal-400" />
                  <span className="max-w-[140px] truncate">{user.email}</span>
                </div>

                {/* 시연용 샘플 데이터 생성 버튼 */}
                <button
                  onClick={handleSeedDemoData}
                  disabled={isSeeding}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-teal-200 bg-teal-950/60 hover:bg-teal-900 rounded-lg border border-teal-700/50 transition"
                  title="현재 계정에 가상 시연 차량 5대 및 표준 실적 데이터를 생성합니다"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-teal-400" />
                  <span className="hidden lg:inline">시연 데이터 생성</span>
                </button>

                {/* 내 클라우드 데이터 초기화 버튼 */}
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
                  title="내 계정의 클라우드 데이터를 시연 초기 상태로 복원합니다"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden lg:inline">데이터 초기화</span>
                </button>

                {/* 로그아웃 버튼 */}
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>로그인 / 회원가입</span>
              </button>
            )}
          </div>
        </div>

        {/* 피드백 토스트 알림 */}
        {actionMessage && (
          <div
            className={`text-white text-xs py-1.5 px-4 text-center flex items-center justify-center space-x-2 transition ${
              actionMessage.type === 'success' ? 'bg-teal-700' : 'bg-rose-700'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-teal-200" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-200" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}
      </header>

      {/* 인증 모달 */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* 데이터 초기화 확인 모달 (현재 사용자 전용) */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-amber-600 mb-4">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">내 클라우드 데이터 초기화</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              현재 계정(<strong>{user?.email}</strong>)에 등록된 모든 차량, 운행, 주유, 정비, 분석 이력이 삭제되고 
              <strong> 5대의 가상 시연 차량 및 표준 기록</strong>으로 다시 복원됩니다.
            </p>
            <p className="text-xs text-slate-500 bg-slate-100 p-2.5 rounded-lg mb-6">
              💡 RLS 정책에 의해 다른 사용자의 데이터에는 일절 영향을 주지 않으며 본인 계정 데이터만 초기화됩니다.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isResetting}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow transition flex items-center space-x-1.5"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>초기화 중...</span>
                  </>
                ) : (
                  <span>네, 초기화합니다</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
