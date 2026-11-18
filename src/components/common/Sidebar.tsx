import React from 'react';
import {
  LayoutDashboard,
  Car,
  FileSpreadsheet,
  Scale,
  History,
  ShieldCheck,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'vehicles' | 'logs' | 'analysis' | 'history';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const menuItems = [
    {
      id: 'dashboard' as NavTab,
      label: '대시보드',
      desc: '플릿 운영 지표 및 비용 분석',
      icon: LayoutDashboard,
    },
    {
      id: 'vehicles' as NavTab,
      label: '차량 관리',
      desc: '보유 차량 등록 및 마스터 관리',
      icon: Car,
    },
    {
      id: 'logs' as NavTab,
      label: '운행·비용 기록',
      desc: '주행, 주유·충전, 정비 내역',
      icon: FileSpreadsheet,
    },
    {
      id: 'analysis' as NavTab,
      label: '유지·교체 비교',
      desc: '친환경차 전환 경제성 분석',
      icon: Scale,
    },
    {
      id: 'history' as NavTab,
      label: '분석 이력',
      desc: '과거 분석 스냅샷 및 비교 리포트',
      icon: History,
    },
  ];

  return (
    <aside className="w-full lg:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
      <div className="p-4 border-b border-slate-800/80">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-400">
          시스템 메뉴
        </span>
      </div>

      <nav className="p-3 space-y-1.5 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-start space-x-3 px-3.5 py-3 rounded-xl transition text-left ${
                isActive
                  ? 'bg-teal-600/20 text-white font-medium border border-teal-500/40 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Icon
                className={`w-5 h-5 mt-0.5 shrink-0 ${
                  isActive ? 'text-teal-400' : 'text-slate-400'
                }`}
              />
              <div>
                <div className={`text-sm ${isActive ? 'text-white font-semibold' : ''}`}>
                  {item.label}
                </div>
                <div className="text-xs text-slate-400 leading-tight mt-0.5 line-clamp-1">
                  {item.desc}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* 하단 시스템 정보 카드 */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
        <div className="flex items-center space-x-2 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span className="font-medium">산업공학 과제 시연용</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-normal">
          경제성공학(현가비교법)과 데이터베이스 관계형 설계가 결합된 프로토타입 시스템입니다.
        </p>
      </div>
    </aside>
  );
};

