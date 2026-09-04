import React from 'react';
import { 
  Bus, 
  RotateCcw, 
  Bell, 
  CheckCircle2, 
  UserCheck, 
  LogOut, 
  Building2,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingCount: number;
  urgentCount: number;
  userName?: string;
  onResetData?: () => void;
  onOpenImportModal?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  urgentCount,
  userName,
  onOpenImportModal,
  onLogout,
}) => {
  const currentDateFormatted = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const getSavedUserName = (): string => {
    if (userName) return userName;
    try {
      const saved = localStorage.getItem('sigfrota_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) return parsed.name;
        if (parsed.email) {
          const prefix = parsed.email.split('@')[0].replace(/[._-]/g, ' ');
          return prefix.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      }
    } catch {
      // fallback
    }
    return 'Gestor de Frotas';
  };

  const displayName = getSavedUserName();
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'GF';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all w-full">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Institution Branding */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-900 via-brand-700 to-brand-500 flex items-center justify-center text-white shadow-md shadow-brand-700/30 ring-2 ring-brand-500/20">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-navy-950">
                  SIG<span className="text-brand-600">-FROTA</span>
                </span>
                <span className="bg-brand-50 text-brand-700 border border-brand-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  UNILAB
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Gestão Integrada de Transporte e Frotas Oficiais (DIVTRANS / PROADI)
              </p>
            </div>
          </div>

          {/* Quick Date / Live Info */}
          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <Calendar className="w-3.5 h-3.5 text-brand-600" />
            <span className="capitalize">{currentDateFormatted}</span>
          </div>

          {/* Actions & Profile Mode Switcher */}
          <div className="flex items-center gap-2.5">
            
            {/* Import Spreadsheet Shortcut Button */}
            {onOpenImportModal && (
              <button
                onClick={onOpenImportModal}
                className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white shadow-xs px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
                title="Subir planilha institucional com dados reais de Janeiro a Dezembro"
              >
                <RotateCcw className="w-3.5 h-3.5 hidden" />
                <span>Subir Planilha (.xlsx)</span>
              </button>
            )}

            {/* Urgent / Pending Notification Pill */}
            {pendingCount > 0 && (
              <button
                onClick={() => setActiveTab('dispatch')}
                className="relative flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs whitespace-nowrap"
                title={`${pendingCount} solicitações aguardando escalação`}
              >
                <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                <span>{pendingCount} Pendentes</span>
                {urgentCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {urgentCount} urgentes
                  </span>
                )}
              </button>
            )}

            {/* User Avatar & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-navy-800 text-white flex items-center justify-center font-bold text-xs shadow-xs uppercase">
                {initials}
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[180px]" title={displayName}>
                  {displayName}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">DIVTRANS / PROADI</div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Encerrar sessão e voltar ao Portal do Solicitante"
                  className="ml-1 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
