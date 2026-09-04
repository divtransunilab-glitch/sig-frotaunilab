import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bus, 
  RotateCcw, 
  Bell, 
  CheckCircle2, 
  LogOut, 
  Calendar,
  KeyRound,
  AlertTriangle,
  Clock,
  ChevronRight,
  X,
  Building
} from 'lucide-react';
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripRequest } from '../../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingCount: number;
  urgentCount: number;
  userName?: string;
  trips?: TripRequest[];
  onSelectTripDetail?: (trip: TripRequest) => void;
  onOpenDispatchModal?: (trip: TripRequest) => void;
  onResetData?: () => void;
  onOpenImportModal?: () => void;
  onOpenChangePasswordModal?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  urgentCount,
  userName,
  trips = [],
  onSelectTripDetail,
  onOpenDispatchModal,
  onOpenImportModal,
  onOpenChangePasswordModal,
  onLogout,
}) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentDateFormatted = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  // Fecha o dropdown de notificações ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Filtra demandas que faltam 3 dias ou menos para a saída e precisam de escalação (sem veículo ou sem motorista ou pendente de análise)
  const escalationNotifications = useMemo(() => {
    if (!trips || trips.length === 0) return [];

    const now = new Date();

    return trips
      .filter((t) => {
        // Ignora cancelados ou indeferidos
        if (t.status === 'Indeferido' || t.status.includes('Cancelado')) return false;

        // Requer escalação se estiver pendente de análise OU sem veículo alocado OU sem motorista alocado
        const needsEscalation = 
          t.status === 'Pendente de Análise' || 
          !t.allocated_vehicle_id || 
          !t.allocated_driver_id;

        if (!needsEscalation) return false;

        if (!t.departure_datetime) return false;
        let depDate: Date;
        try {
          depDate = parseISO(t.departure_datetime);
          if (!isValid(depDate)) depDate = new Date(t.departure_datetime);
        } catch {
          return false;
        }

        if (!isValid(depDate)) return false;

        const daysUntil = differenceInCalendarDays(depDate, now);
        // Notifica se faltar 3 dias ou menos para a saída da viagem (inclusive hoje ou em atraso)
        return daysUntil <= 3;
      })
      .map((t) => {
        let depDate: Date;
        try {
          depDate = parseISO(t.departure_datetime);
          if (!isValid(depDate)) depDate = new Date(t.departure_datetime);
        } catch {
          depDate = new Date();
        }

        const daysUntil = differenceInCalendarDays(depDate, now);

        let urgencyLabel = `Faltam ${daysUntil} dias`;
        let urgencyBadgeStyle = 'bg-amber-100 text-amber-800 border-amber-300';

        if (daysUntil < 0) {
          urgencyLabel = `Vencido (${Math.abs(daysUntil)}d atrás)`;
          urgencyBadgeStyle = 'bg-rose-600 text-white border-rose-700 font-bold';
        } else if (daysUntil === 0) {
          urgencyLabel = 'Saída HOJE!';
          urgencyBadgeStyle = 'bg-rose-500 text-white border-rose-600 font-bold animate-pulse';
        } else if (daysUntil === 1) {
          urgencyLabel = 'Falta 1 dia';
          urgencyBadgeStyle = 'bg-orange-500 text-white border-orange-600 font-bold';
        } else if (daysUntil === 2) {
          urgencyLabel = 'Faltam 2 dias';
          urgencyBadgeStyle = 'bg-amber-500 text-white border-amber-600 font-bold';
        } else if (daysUntil === 3) {
          urgencyLabel = 'Faltam 3 dias';
          urgencyBadgeStyle = 'bg-sky-500 text-white border-sky-600 font-bold';
        }

        const formattedDeparture = isValid(depDate) 
          ? format(depDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          : t.departure_datetime;

        const sector = t.requesting_unit 
          ? `${t.requesting_unit} (${t.macro_unit})`
          : t.macro_unit;

        return {
          trip: t,
          daysUntil,
          urgencyLabel,
          urgencyBadgeStyle,
          formattedDeparture,
          sector,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [trips]);

  const notificationCount = escalationNotifications.length;

  const handleNotificationClick = (trip: TripRequest) => {
    setIsNotificationsOpen(false);
    setActiveTab('dispatch');
    if (onSelectTripDetail) {
      onSelectTripDetail(trip);
    } else if (onOpenDispatchModal) {
      onOpenDispatchModal(trip);
    }
  };

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
            
            {/* Notification Bell with 3-Day Escalation Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`relative p-2 rounded-xl border transition-all flex items-center justify-center ${
                  notificationCount > 0
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-xs ring-2 ring-amber-400/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title={
                  notificationCount > 0
                    ? `${notificationCount} demanda(s) a 3 dias ou menos da saída pendente(s) de escalação`
                    : 'Central de Notificações'
                }
              >
                <Bell className={`w-5 h-5 ${notificationCount > 0 ? 'text-amber-600 animate-bounce' : 'text-slate-500'}`} />
                {notificationCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-white shadow-md animate-pulse">
                    {notificationCount}
                  </span>
                )}
              </button>

              {/* Popover Dropdown */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Dropdown Header */}
                  <div className="bg-gradient-to-r from-navy-900 to-brand-900 p-3.5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <div>
                        <h4 className="font-bold text-xs">Alertas de Escalação</h4>
                        <p className="text-[10px] text-slate-300">Faltando 3 dias ou menos para a saída</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-500/30 text-amber-200 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {notificationCount} urgente{notificationCount !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => setIsNotificationsOpen(false)}
                        className="text-slate-300 hover:text-white p-1 rounded-md"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Dropdown List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5">
                    {notificationCount === 0 ? (
                      <div className="py-8 text-center px-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">Tudo sob controle!</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Não há solicitações pendentes de escalação para os próximos 3 dias.
                        </p>
                      </div>
                    ) : (
                      escalationNotifications.map((item) => (
                        <div
                          key={item.trip.id}
                          onClick={() => handleNotificationClick(item.trip)}
                          className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer group"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-mono text-xs font-extrabold text-navy-950 group-hover:text-brand-600 transition-colors">
                              {item.trip.process_number}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border shadow-xs ${item.urgencyBadgeStyle}`}>
                              {item.urgencyLabel}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mb-1">
                            <Building className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            <span className="truncate">{item.sector}</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Saída: {item.formattedDeparture}</span>
                            </div>
                            <span className="text-brand-600 font-bold text-[10px] group-hover:translate-x-0.5 transition-transform flex items-center">
                              Escalar <ChevronRight className="w-3 h-3 ml-0.5" />
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="bg-slate-50 border-t border-slate-100 p-2.5 text-center">
                    <button
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        setActiveTab('dispatch');
                      }}
                      className="text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors inline-flex items-center gap-1"
                    >
                      <span>Ver todas no Quadro de Escalação</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar, Password Change & Logout */}
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

              {onOpenChangePasswordModal && (
                <button
                  onClick={onOpenChangePasswordModal}
                  title="Alterar sua senha de acesso no Supabase"
                  className="ml-1 p-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                >
                  <KeyRound className="w-4 h-4 text-brand-600" />
                  <span className="hidden sm:inline text-brand-800">Alterar Senha</span>
                </button>
              )}

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
