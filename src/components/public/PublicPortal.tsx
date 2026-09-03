import React, { useState, useMemo } from 'react';
import { TripRequest } from '../../types';
import { TripService } from '../../services/tripService';
import { DistanceService } from '../../services/distanceService';
import { FleetService } from '../../services/fleetService';
import { StatusBadge } from '../common/StatusBadge';
import { PublicTransparencyView } from './PublicTransparencyView';
import { 
  Search, 
  SendHorizontal, 
  CheckCircle2, 
  Clock, 
  Truck, 
  User, 
  Calendar, 
  MapPin, 
  Milestone, 
  FileText, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  AlertCircle,
  XCircle,
  Lock,
  KeyRound,
  Bus,
  Printer,
  Info,
  Building2,
  Phone,
  Mail,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeFormatDate } from '../../utils/dateUtils';

interface PublicPortalProps {
  onLoginSuccess?: () => void;
  onNewTripCreated?: (trip: TripRequest) => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  onLoginSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'track' | 'transparency' | 'login'>('track');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TripRequest[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Carrega todas as viagens para métricas de transparência
  const allTrips = useMemo(() => TripService.getTrips(), []);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('gestor.frota@unilab.edu.br');
  const [loginPassword, setLoginPassword] = useState('••••••••');
  const [loginError, setLoginError] = useState('');

  const cities = DistanceService.getCities();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const results = TripService.searchPublicTrips(searchQuery.trim());
    setSearchResults(results);
    setHasSearched(true);
  };

  const handleQuickSearchDemo = (num: string) => {
    setSearchQuery(num);
    const results = TripService.searchPublicTrips(num);
    setSearchResults(results);
    setHasSearched(true);
    setActiveTab('track');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setLoginError('Por favor, informe seu e-mail ou usuário institucional.');
      return;
    }
    setLoginError('');
    if (onLoginSuccess) {
      onLoginSuccess();
    }
  };

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? `${c.name}-${c.state}` : id;
  };

  const currentDateFormatted = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-900">
      
      {/* Top Public Portal Institutional Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            
            {/* UNILAB Logo & Identity */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-900 via-brand-700 to-brand-500 flex items-center justify-center text-white shadow-md shadow-brand-700/30 ring-2 ring-brand-500/20">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg sm:text-xl tracking-tight text-navy-950">
                    SIG<span className="text-brand-600">-FROTA</span>
                  </span>
                  <span className="bg-brand-50 text-brand-700 border border-brand-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                    UNILAB
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                  Portal Público de Solicitação e Acompanhamento de Transportes
                </p>
              </div>
            </div>

            {/* Quick Actions & Manager Login Link */}
            <div className="flex items-center gap-2.5">
              <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                <span className="capitalize">{currentDateFormatted}</span>
              </div>

              <button
                onClick={() => setActiveTab('login')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  activeTab === 'login'
                    ? 'bg-navy-900 text-white shadow-md'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-brand-400" />
                <span>Acesso do Gestor</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        
        {/* Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-navy-950 via-navy-900 to-brand-900 p-6 sm:p-8 text-white shadow-xl text-center space-y-4 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              Universidade da Integração Internacional da Lusofonia Afro-Brasileira
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Portal de Serviços de Transporte Oficial
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
              Consulte o andamento da sua solicitação de viagem pelo número do processo SEI ou acompanhe os despachos da frota institucional.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="relative z-10 inline-flex p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 max-w-full overflow-x-auto">
            <button
              onClick={() => setActiveTab('track')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'track'
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Acompanhar Solicitação</span>
            </button>
            <button
              onClick={() => setActiveTab('transparency')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'transparency'
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Painel de Transparência</span>
            </button>
            <button
              onClick={() => setActiveTab('login')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'login'
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Área do Gestor (DIVTRANS)</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: CONSULTA / ACOMPANHAMENTO DE PROCESSOS (DEMANDANTE)               */}
        {/* ========================================================================= */}
        {activeTab === 'track' && (
          <div className="space-y-6">
            
            {/* Search Box */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-navy-950">
                    Consultar Andamento da Demanda
                  </h2>
                  <p className="text-xs text-slate-500">
                    Digite o número completo do processo ou o e-mail institucional do solicitante.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: 23282.000859/2026-42 ou seu-email@unilab.edu.br"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:border-brand-500 focus:outline-hidden shadow-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-brand-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap"
                >
                  <Search className="w-4 h-4" />
                  <span>Pesquisar Processo</span>
                </button>
              </form>

              {/* Quick Demo Shortcuts */}
              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap pt-1 border-t border-slate-100">
                <span className="font-semibold text-slate-600">Exemplos para consulta rápida:</span>
                <button
                  type="button"
                  onClick={() => handleQuickSearchDemo('23282.000859/2026-42')}
                  className="text-emerald-700 hover:underline font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                >
                  23282.000859/2026-42 (Confirmada)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSearchDemo('23282.000930/2026-71')}
                  className="text-amber-700 hover:underline font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                >
                  23282.000930/2026-71 (Pendente)
                </button>
              </div>
            </div>

            {/* Results List */}
            {hasSearched && (
              <div className="space-y-4">
                {searchResults.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-500 space-y-2">
                    <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                    <div className="font-bold text-slate-800 text-sm">Nenhum processo localizado</div>
                    <p className="text-xs max-w-md mx-auto">
                      Não encontramos solicitações com a chave <strong>"{searchQuery}"</strong>. Verifique o número do processo (formato <code>23282.xxxxxx/2026-xx</code>) ou confirme o e-mail informado.
                    </p>
                  </div>
                ) : (
                  searchResults.map((trip) => {
                    const vehicle = FleetService.getVehicleById(trip.allocated_vehicle_id);
                    const driver = FleetService.getDriverById(trip.allocated_driver_id);
                    const contractor = FleetService.getContractorById(trip.allocated_contractor_id);
                    const departureFormatted = safeFormatDate(trip.departure_datetime, "dd/MM/yyyy 'às' HH:mm", '-');
                    const returnFormatted = safeFormatDate(trip.return_datetime, "dd/MM/yyyy 'às' HH:mm", '-');

                    const isConfirmed = trip.status === 'Confirmado ao Demandante';
                    const isPending = trip.status === 'Pendente de Análise';
                    const isRejected = trip.status === 'Indeferido';
                    const isDateChanged = trip.status === 'Alterado a Data da Demanda';

                    return (
                      <div key={trip.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-5 sm:p-7 space-y-6">
                        
                        {/* Process Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Processo Oficial</span>
                              <StatusBadge status={trip.status} />
                              <StatusBadge deadline={trip.status_deadline} />
                            </div>
                            <h2 className="text-xl sm:text-2xl font-extrabold text-navy-950 mt-1 font-mono tracking-tight">
                              {trip.process_number}
                            </h2>
                          </div>

                          <div className="text-xs text-slate-500 sm:text-right flex flex-col gap-1">
                            <div>Solicitante: <strong className="text-slate-800">{trip.requester_name}</strong></div>
                            <div>Unidade: <span className="font-semibold text-slate-700">{trip.macro_unit}</span> ({trip.requesting_unit})</div>
                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="mt-1 inline-flex items-center gap-1.5 text-brand-700 hover:text-brand-900 font-bold self-start sm:self-end"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Imprimir Comprovante</span>
                            </button>
                          </div>
                        </div>

                        {/* Visual Timeline of Progress */}
                        <div>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                            Linha do Tempo da Demanda
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 relative">
                            
                            {/* Step 1: Recebimento */}
                            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>1. Recebido</span>
                              </div>
                              <div className="text-[11px] text-emerald-700">Demanda protocolada no sistema</div>
                            </div>

                            {/* Step 2: Análise Técnica */}
                            <div className={`p-3.5 rounded-2xl border space-y-1 ${
                              isRejected
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}>
                              <div className="flex items-center gap-2 font-bold text-xs">
                                {isRejected ? <XCircle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                                <span>2. Análise Técnica</span>
                              </div>
                              <div className="text-[11px]">{isRejected ? 'Indeferido pela gestão' : 'Viabilidade confirmada'}</div>
                            </div>

                            {/* Step 3: Despacho & Escala */}
                            <div className={`p-3.5 rounded-2xl border space-y-1 ${
                              isConfirmed
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}>
                              <div className="flex items-center gap-2 font-bold text-xs">
                                <Truck className="w-4 h-4" />
                                <span>3. Despacho & Escala</span>
                              </div>
                              <div className="text-[11px]">
                                {isConfirmed ? 'Veículo & Motorista alocados' : 'Aguardando escala'}
                              </div>
                            </div>

                            {/* Step 4: Execução & Relatório */}
                            <div className={`p-3.5 rounded-2xl border space-y-1 ${
                              trip.travel_report_status === 'Finalizado no Sistema'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}>
                              <div className="flex items-center gap-2 font-bold text-xs">
                                <ShieldCheck className="w-4 h-4" />
                                <span>4. Conclusão</span>
                              </div>
                              <div className="text-[11px]">
                                {trip.travel_report_status === 'Finalizado no Sistema' ? 'Viagem Finalizada' : 'Pendente de execução'}
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Travel Details Box */}
                        <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block font-medium">Itinerário Oficial:</span>
                            <strong className="text-slate-900 text-sm block">
                              {getCityName(trip.origin_city_id)} ➔ {getCityName(trip.destination_city_id)}
                            </strong>
                            <span className="text-brand-700 font-bold block">{trip.estimated_km} km (Estimado Total)</span>
                          </div>

                          <div>
                            <span className="text-slate-400 block font-medium">Cronograma de Saída:</span>
                            <strong className="text-slate-800 block">{departureFormatted}</strong>
                            <span className="text-slate-500 block">Retorno: {returnFormatted}</span>
                          </div>

                          <div>
                            <span className="text-slate-400 block font-medium">Capacidade / Passageiros:</span>
                            <strong className="text-slate-800 block">{trip.passenger_count} passageiros</strong>
                            <span className="text-slate-500 block">Finalidade: {trip.activity_type}</span>
                          </div>

                          <div>
                            <span className="text-slate-400 block font-medium">Recursos Escalados:</span>
                            {isConfirmed && vehicle ? (
                              <div className="space-y-0.5">
                                <div className="font-bold text-navy-950">{vehicle.model} ({vehicle.plate})</div>
                                <div className="text-slate-600 font-medium">Motorista: {driver?.name}</div>
                                {contractor && <div className="text-[10px] text-slate-500">{contractor.name}</div>}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic font-medium">Pendente de escalação pela DIVTRANS</span>
                            )}
                          </div>
                        </div>

                        {/* Justificativa / Objetivo */}
                        {trip.trip_objective && (
                          <div className="bg-slate-50/60 rounded-xl p-3.5 border border-slate-200 text-xs">
                            <span className="font-bold text-slate-700 block mb-0.5">Objetivo / Justificativa da Viagem:</span>
                            <p className="text-slate-600 leading-relaxed">{trip.trip_objective}</p>
                          </div>
                        )}

                        {/* Rejection Note */}
                        {isRejected && (
                          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1">
                            <strong className="block font-bold text-rose-950">Motivo do Indeferimento: {trip.rejection_reason}</strong>
                            {trip.rejection_notes && <p className="italic text-rose-800">{trip.rejection_notes}</p>}
                          </div>
                        )}

                        {/* Date Changed Note */}
                        {isDateChanged && (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                            <strong className="block font-bold text-amber-950">Aviso: Data da Viagem Ajustada pela Gestão de Frota</strong>
                            <p className="text-amber-800">Verifique as novas datas de saída e retorno informadas acima.</p>
                          </div>
                        )}

                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Institutional Information Accordion / Notice Box */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-navy-950">
                <Info className="w-4 h-4 text-brand-600" />
                <span>Normas Institucionais de Transporte (DIVTRANS / UNILAB)</span>
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li>As solicitações devem ser enviadas com antecedência mínima de <strong>5 (cinco) dias úteis</strong>.</li>
                <li>Demandas com antecedência inferior estarão sujeitas a avaliação prioritária e justificativa formal de urgência.</li>
                <li>Veículos e motoristas serão alocados de acordo com a disponibilidade contratual da frota oficial e capacidade de passageiros.</li>
              </ul>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PAINEL PÚBLICO DE TRANSPARÊNCIA (ESTATÍSTICAS & DADOS ABERTOS)      */}
        {/* ========================================================================= */}
        {activeTab === 'transparency' && (
          <PublicTransparencyView trips={allTrips} />
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ÁREA RESTRITA / LOGIN DO GESTOR DE FROTAS (DIVTRANS / PROADI)        */}
        {/* ========================================================================= */}
        {activeTab === 'login' && (
          <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 sm:p-8 space-y-6">
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-navy-950 text-white flex items-center justify-center mx-auto shadow-md">
                <Lock className="w-6 h-6 text-brand-400" />
              </div>
              <h2 className="text-xl font-extrabold text-navy-950">
                Acesso Restrito ao Sistema
              </h2>
              <p className="text-xs text-slate-500">
                Exclusivo para Gestores de Frotas, DIVTRANS e Pró-Reitoria de Administração da UNILAB.
              </p>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail ou Usuário Institucional</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Senha de Acesso</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-md shadow-brand-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Entrar no SIG-FROTA Gestão</span>
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-slate-200"></div>
              <span className="shrink mx-3 text-[10px] text-slate-400 uppercase font-bold tracking-wider">Acesso Demonstrativo</span>
              <div className="grow border-t border-slate-200"></div>
            </div>

            {/* Quick Demo Login Button */}
            <button
              type="button"
              onClick={handleLoginSubmit}
              className="w-full py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-300 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <ShieldCheck className="w-4 h-4 text-brand-700" />
              <span>Acessar Diretamente como Gestor (DIVTRANS)</span>
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setActiveTab('track')}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
              >
                ← Voltar para Consulta de Demandantes
              </button>
            </div>

          </div>
        )}

      </main>

      {/* Public Footer */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <div className="font-bold text-slate-700">UNILAB - Divisão de Transportes (DIVTRANS / PROADI)</div>
            <p className="text-[11px] text-slate-400">Campus da Liberdade - Redenção/CE • Frotas Oficiais e Locadas</p>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Suporte: divtrans@unilab.edu.br</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default PublicPortal;
