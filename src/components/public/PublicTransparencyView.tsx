import React, { useState, useMemo } from 'react';
import { TripRequest, ActivityType } from '../../types';
import { DistanceService } from '../../services/distanceService';
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Ban, 
  Milestone, 
  Users, 
  ShieldCheck, 
  MapPin, 
  GraduationCap, 
  Microscope, 
  HeartHandshake, 
  Building2
} from 'lucide-react';
import { parseISO, isValid, getYear, getMonth } from 'date-fns';

interface PublicTransparencyViewProps {
  trips: TripRequest[];
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const PublicTransparencyView: React.FC<PublicTransparencyViewProps> = ({ trips }) => {
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL'); // 'ALL' or '0'..'11'
  const [selectedActivity, setSelectedActivity] = useState<string>('ALL');

  const cities = DistanceService.getCities();
  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? `${c.name}-${c.state}` : id;
  };

  // Anos disponíveis nos dados
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    trips.forEach((t) => {
      try {
        const d = parseISO(t.departure_datetime);
        if (isValid(d)) {
          years.add(getYear(d).toString());
        }
      } catch {}
    });
    if (years.size === 0) years.add('2026');
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [trips]);

  // Filtragem dos dados públicos anonimizados
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      try {
        const d = parseISO(t.departure_datetime);
        if (!isValid(d)) return false;

        const y = getYear(d).toString();
        const m = getMonth(d).toString();

        if (selectedYear !== 'ALL' && y !== selectedYear) return false;
        if (selectedMonth !== 'ALL' && m !== selectedMonth) return false;
        if (selectedActivity !== 'ALL' && t.activity_type !== selectedActivity) return false;

        return true;
      } catch {
        return false;
      }
    });
  }, [trips, selectedYear, selectedMonth, selectedActivity]);

  // Métricas agregadas
  const metrics = useMemo(() => {
    const total = filteredTrips.length;
    const confirmed = filteredTrips.filter((t) => t.status === 'Confirmado ao Demandante').length;
    const pending = filteredTrips.filter((t) => t.status === 'Pendente de Análise').length;
    const rejected = filteredTrips.filter((t) => t.status === 'Indeferido').length;
    const cancelled = filteredTrips.filter((t) => 
      t.status === 'Cancelado pelo Demandante' || t.status === 'Cancelado pela Unidade Executante'
    ).length;

    const inDeadline = filteredTrips.filter((t) => t.status_deadline === 'Dentro do Prazo').length;
    const deadlineRate = total > 0 ? Math.round((inDeadline / total) * 100) : 0;

    const confirmationRate = total > 0 ? ((confirmed / total) * 100).toFixed(1) : '0';
    const pendingRate = total > 0 ? ((pending / total) * 100).toFixed(1) : '0';
    const rejectionRate = total > 0 ? ((rejected / total) * 100).toFixed(1) : '0';
    const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0';

    // Total de passageiros atendidos (nas viagens confirmadas)
    const totalPassengers = filteredTrips
      .filter((t) => t.status === 'Confirmado ao Demandante')
      .reduce((acc, t) => acc + (t.passenger_count || 1), 0);

    // Total de KM percorrido a serviço público
    const totalKm = filteredTrips
      .filter((t) => t.status === 'Confirmado ao Demandante')
      .reduce((acc, t) => acc + (t.estimated_km || 0), 0);

    // Agrupamento por Finalidade
    const byActivity: Record<string, number> = {};
    filteredTrips.forEach((t) => {
      const act = t.activity_type || 'Administrativo';
      byActivity[act] = (byActivity[act] || 0) + 1;
    });

    // Agrupamento por Rota
    const byRoute: Record<string, { count: number; km: number }> = {};
    filteredTrips.forEach((t) => {
      const orig = getCityName(t.origin_city_id);
      const dest = getCityName(t.destination_city_id);
      const routeKey = `${orig} ➔ ${dest}`;
      if (!byRoute[routeKey]) {
        byRoute[routeKey] = { count: 0, km: 0 };
      }
      byRoute[routeKey].count += 1;
      byRoute[routeKey].km += t.estimated_km || 0;
    });

    const sortedRoutes = Object.entries(byRoute)
      .map(([route, data]) => ({ route, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      total,
      confirmed,
      pending,
      rejected,
      cancelled,
      confirmationRate,
      pendingRate,
      rejectionRate,
      cancellationRate,
      totalPassengers,
      totalKm,
      inDeadline,
      deadlineRate,
      byActivity,
      sortedRoutes,
    };
  }, [filteredTrips]);

  const getActivityIcon = (act: string) => {
    switch (act) {
      case 'Graduação':
        return <GraduationCap className="w-4 h-4 text-blue-600" />;
      case 'Pesquisa':
      case 'Pós Graduação':
        return <Microscope className="w-4 h-4 text-emerald-600" />;
      case 'Extensão':
        return <HeartHandshake className="w-4 h-4 text-amber-600" />;
      default:
        return <Building2 className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner de Transparência & Governança */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-5 sm:p-7 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Painel de Transparência Ativa & Gestão Aberta</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
              Indicadores de Transporte Oficial da UNILAB
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Consulte dados estatísticos agregados sobre as demandas, atendimento da frota e rotas universitárias.
              <strong className="text-slate-700"> Em total conformidade com a LAI (Lei nº 12.527/2011) e LGPD (Lei nº 13.709/2018).</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Atualizado em Tempo Real</span>
          </div>
        </div>

        {/* Filtros de Escopo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          
          {/* Ano */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Ano
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-hidden"
            >
              <option value="ALL">Todos os Anos</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Mês */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Mês
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-hidden"
            >
              <option value="ALL">Ano Completo (Todos os Meses)</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx.toString()}>{name}</option>
              ))}
            </select>
          </div>

          {/* Finalidade */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Finalidade
            </label>
            <select
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-hidden"
            >
              <option value="ALL">Todas as Finalidades</option>
              <option value="Graduação">Graduação (Aulas Práticas)</option>
              <option value="Pesquisa">Pesquisa Científica</option>
              <option value="Extensão">Extensão Universitária</option>
              <option value="Pós Graduação">Pós Graduação</option>
              <option value="Administrativo">Administrativo / Reuniões</option>
            </select>
          </div>

        </div>
      </div>

      {/* 4 CARDS DE STATUS PRINCIPAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Recebidas */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total de Demandas</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-navy-950">{metrics.total}</span>
            <span className="text-xs text-slate-500 font-semibold">solicitações</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            {metrics.inDeadline} enviadas no prazo regulamentar ({metrics.deadlineRate}%)
          </div>
        </div>

        {/* Atendidas / Confirmadas (Sempre Verde) */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 shadow-card space-y-2 bg-gradient-to-b from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Demandas Atendidas</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700">{metrics.confirmed}</span>
            <span className="text-xs text-emerald-800 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-md">
              {metrics.confirmationRate}% atendidas
            </span>
          </div>
          <div className="text-[11px] text-emerald-700 pt-2 border-t border-emerald-100">
            Frota e condutores alocados com sucesso
          </div>
        </div>

        {/* Em Análise (Amarelo) */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-card space-y-2 bg-gradient-to-b from-white to-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Em Análise Técnica</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-700">{metrics.pending}</span>
            <span className="text-xs text-amber-800 font-bold bg-amber-100/80 px-2 py-0.5 rounded-md">
              {metrics.pendingRate}%
            </span>
          </div>
          <div className="text-[11px] text-amber-700 pt-2 border-t border-amber-100">
            Aguardando escala operacional / data da viagem
          </div>
        </div>

        {/* Indeferidas (Vermelho) */}
        <div className="bg-white rounded-2xl p-5 border border-rose-200/80 shadow-card space-y-2 bg-gradient-to-b from-white to-rose-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Indeferidas</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-700">{metrics.rejected}</span>
            <span className="text-xs text-rose-800 font-bold bg-rose-100/80 px-2 py-0.5 rounded-md">
              {metrics.rejectionRate}%
            </span>
          </div>
          <div className="text-[11px] text-rose-700 pt-2 border-t border-rose-100">
            Por indisponibilidade de veículo ou prazo
          </div>
        </div>

      </div>

      {/* METRICAS COMPLEMENTARES DE IMPACTO SOCIAL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pessoas Atendidas</span>
            <strong className="text-2xl font-black text-navy-950">{metrics.totalPassengers.toLocaleString('pt-BR')}</strong>
            <span className="text-xs text-slate-500 ml-1">passageiros</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Milestone className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Quilometragem Atendida</span>
            <strong className="text-2xl font-black text-emerald-700">{metrics.totalKm.toLocaleString('pt-BR')}</strong>
            <span className="text-xs text-slate-500 ml-1">km percorridos</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Ban className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Demandas Canceladas</span>
            <strong className="text-2xl font-black text-slate-800">{metrics.cancelled}</strong>
            <span className="text-xs text-slate-500 ml-1">({metrics.cancellationRate}%)</span>
          </div>
        </div>

      </div>

      {/* BARRA DE DISTRIBUIÇÃO PROPORCIONAL DE STATUS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <span className="font-extrabold text-navy-950">Distribuição Visual de Atendimento da Frota</span>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Atendidas: {metrics.confirmed} ({metrics.confirmationRate}%)
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              Em Análise: {metrics.pending} ({metrics.pendingRate}%)
            </span>
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Indeferidas: {metrics.rejected} ({metrics.rejectionRate}%)
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
              Canceladas: {metrics.cancelled} ({metrics.cancellationRate}%)
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden flex shadow-inner">
          <div
            title={`Confirmadas: ${metrics.confirmed} (${metrics.confirmationRate}%)`}
            className="bg-emerald-500 hover:bg-emerald-600 transition-all duration-500"
            style={{ width: `${metrics.confirmationRate}%` }}
          ></div>
          <div
            title={`Em Análise: ${metrics.pending} (${metrics.pendingRate}%)`}
            className="bg-amber-400 hover:bg-amber-500 transition-all duration-500"
            style={{ width: `${metrics.pendingRate}%` }}
          ></div>
          <div
            title={`Indeferidas: ${metrics.rejected} (${metrics.rejectionRate}%)`}
            className="bg-rose-500 hover:bg-rose-600 transition-all duration-500"
            style={{ width: `${metrics.rejectionRate}%` }}
          ></div>
          <div
            title={`Canceladas: ${metrics.cancelled} (${metrics.cancellationRate}%)`}
            className="bg-slate-400 hover:bg-slate-500 transition-all duration-500"
            style={{ width: `${metrics.cancellationRate}%` }}
          ></div>
        </div>
      </div>

      {/* DUAS COLUNAS: DESTINAÇÃO ACADÊMICA & ROTAS FREQUENTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Coluna 1: Destinação por Finalidade Acadêmica */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-navy-950 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-brand-600" />
              Destinação por Finalidade Institucional
            </h3>
            <span className="text-[11px] text-slate-400 font-semibold">{metrics.total} demandas</span>
          </div>

          <div className="space-y-3 pt-1">
            {Object.entries(metrics.byActivity).length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">Nenhum dado no período</div>
            ) : (
              Object.entries(metrics.byActivity).map(([act, count]) => {
                const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                return (
                  <div key={act} className="space-y-1.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        {getActivityIcon(act)}
                        <span>{act}</span>
                      </div>
                      <span className="text-slate-600 font-bold">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-brand-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna 2: Principais Rotas e Destinos Regionais */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-navy-950 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-600" />
              Rotas & Deslocamentos Mais Demandados
            </h3>
            <span className="text-[11px] text-slate-400 font-semibold">Top Rotas</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {metrics.sortedRoutes.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">Nenhum trajeto no período</div>
            ) : (
              metrics.sortedRoutes.map((r, idx) => {
                const pct = metrics.total > 0 ? Math.round((r.count / metrics.total) * 100) : 0;
                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-navy-100 text-navy-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800 truncate">{r.route}</span>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="font-extrabold text-brand-700">{r.count} viagens</div>
                      <div className="text-[10px] text-slate-400">{r.km.toLocaleString('pt-BR')} km ({pct}%)</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* SELO DE CONFORMIDADE LEGAL LAI & LGPD */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-3.5 text-slate-600 text-xs">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="space-y-1 text-center sm:text-left flex-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <strong className="text-slate-900 block font-bold">
              Compromisso Institucional de Transparência & Privacidade
            </strong>
            <span className="bg-brand-50 text-brand-800 border border-brand-200 font-bold text-[10.5px] px-2.5 py-0.5 rounded-full">
              📅 Dados referentes a partir de Agosto de 2026
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Os dados deste painel são públicos, referentes ao período a partir de <strong>Agosto de 2026</strong>, e atualizados automaticamente pela Divisão de Transportes (DIVTRANS/PROADI).
            Em observância ao art. 31 da Lei nº 12.527/2011 (LAI) e à Lei Geral de Proteção de Dados (Lei nº 13.709/2018), 
            informações pessoais de solicitantes e passageiros são mantidas em sigilo institucional.
          </p>
        </div>
      </div>

    </div>
  );
};
