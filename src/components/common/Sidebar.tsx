import React from 'react';
import { 
  LayoutDashboard, 
  SendHorizontal, 
  CalendarDays, 
  BarChart3,
  Milestone, 
  FileSpreadsheet, 
  Truck, 
  ClipboardCheck, 
  ShieldCheck,
  LogOut,
  ExternalLink
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingCount: number;
  reportPendingCount: number;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  reportPendingCount,
  onLogout,
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Visão Geral & Painel',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'dispatch',
      label: 'Fila de Solicitações & Escala',
      icon: SendHorizontal,
      badge: pendingCount > 0 ? pendingCount : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'analytics',
      label: 'Análise & Inteligência (BI)',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'calendar',
      label: 'Agenda & Linha do Tempo',
      icon: CalendarDays,
      badge: null,
    },
    {
      id: 'matrix',
      label: 'Matriz de Quilometragem',
      icon: Milestone,
      badge: null,
    },
    {
      id: 'postTrip',
      label: 'Relatórios de Viagem (KM Real)',
      icon: ClipboardCheck,
      badge: reportPendingCount > 0 ? reportPendingCount : null,
      badgeColor: 'bg-purple-500 text-white',
    },
    {
      id: 'fleet',
      label: 'Frota, Motoristas & Unidades',
      icon: Truck,
      badge: null,
    },
    {
      id: 'audit',
      label: 'Auditoria & Rastreabilidade',
      icon: ShieldCheck,
      badge: null,
    },
    {
      id: 'reports',
      label: 'Exportação & Planilhas (Excel/PDF)',
      icon: FileSpreadsheet,
      badge: null,
    },
  ];

  return (
    <aside className="w-72 shrink-0 hidden lg:block bg-white border-r border-slate-200/80 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <div className="space-y-6">
        
        {/* Navigation Section */}
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2.5">
            Módulos de Gestão
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all group whitespace-nowrap ${
                    isActive
                      ? 'bg-brand-50 text-brand-800 font-bold shadow-xs border border-brand-200/70'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== null && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                        item.badgeColor || 'bg-brand-500 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

      </div>

      {/* Logout / Portal do Solicitante Button at Bottom of Sidebar */}
      {onLogout && (
        <div className="pt-4 border-t border-slate-200 mt-6">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-navy-950 hover:bg-slate-100 transition-colors border border-slate-200 shadow-xs"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Voltar ao Portal do Solicitante</span>
          </button>
        </div>
      )}
    </aside>
  );
};
