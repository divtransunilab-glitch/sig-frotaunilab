import React, { useState, useMemo } from 'react';
import { TripRequest, Vehicle, Driver, Contractor, AuditLog, AuditAction } from '../../types';
import { AuditService } from '../../services/auditService';
import { safeFormatDate } from '../../utils/dateUtils';
import { 
  ShieldCheck, 
  History, 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  User, 
  FileText, 
  SendHorizontal, 
  Sliders, 
  Ban, 
  XCircle, 
  Info, 
  Eye, 
  Sparkles,
  ExternalLink,
  Shield,
  Layers,
  Activity
} from 'lucide-react';

interface AuditViewProps {
  trips: TripRequest[];
  vehicles: Vehicle[];
  drivers: Driver[];
  contractors: Contractor[];
}

export const AuditView: React.FC<AuditViewProps> = ({
  trips,
  vehicles,
  drivers,
  contractors,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedLogDetail, setSelectedLogDetail] = useState<AuditLog | null>(null);

  // Carrega e filtra os logs de auditoria
  const auditLogs = useMemo(() => {
    return AuditService.getLogs({
      action: selectedAction,
      compliance_status: selectedStatus,
      entity_type: selectedEntity,
      searchTerm: searchTerm,
    });
  }, [selectedAction, selectedStatus, selectedEntity, searchTerm]);

  // Indicadores de conformidade institucional
  const compliance = useMemo(() => {
    return AuditService.getComplianceMetrics(trips);
  }, [trips]);

  const handleExportCSV = () => {
    AuditService.exportAuditCSV(auditLogs);
  };

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'Despacho & Escala':
        return 'bg-brand-50 text-brand-800 border-brand-300';
      case 'Indeferimento de Demanda':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Cancelamento de Demanda':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      case 'Parametrização Financeira':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Importação em Lote':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Criação de Solicitação':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getComplianceBadge = (status: string) => {
    switch (status) {
      case 'Conforme':
        return (
          <span className="inline-flex items-center gap-1 bg-brand-50 text-brand-800 border border-brand-200 px-2 py-0.5 rounded-full text-[10.5px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-brand-600" />
            Conforme
          </span>
        );
      case 'Exceção Justificada':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10.5px] font-bold">
            <Info className="w-3 h-3 text-blue-600" />
            Exceção Justificada
          </span>
        );
      case 'Alerta':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10.5px] font-bold">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Alerta
          </span>
        );
      case 'Crítico':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10.5px] font-bold">
            <AlertOctagon className="w-3 h-3 text-rose-600" />
            Crítico
          </span>
        );
      default:
        return <span className="text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header do Módulo de Auditoria */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-navy-950">
                Auditoria, Rastreabilidade & Conformidade
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                Trilha de Governança DIVTRANS
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro cronológico e imutável de todas as ações de despacho, indeferimentos, cancelamentos e alterações institucionais.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-all active:scale-95 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Relatório de Auditoria (CSV)</span>
          </button>
        </div>
      </div>

      {/* 4 CARDS DE CONFORMIDADE E GOVERNANÇA REGULATÓRIA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. Índice Geral de Conformidade */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Índice de Governança</span>
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-navy-950">{compliance.complianceRate}%</span>
            <span className="text-xs font-bold text-brand-700">em conformidade</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>{compliance.conformes} conformes</span>
            <span>•</span>
            <span className="text-blue-600 font-bold">{compliance.excecoes} justificadas</span>
          </div>
        </div>

        {/* 2. Aderência ao Prazo de Antecedência (5 dias) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aderência ao Prazo</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-navy-950">{compliance.deadlineAdherenceRate}%</span>
            <span className="text-xs font-semibold text-slate-500">no prazo (≥ 5d)</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span className="text-brand-800 font-bold">{compliance.inDeadlineCount} no prazo</span>
            <span>•</span>
            <span className="text-rose-600 font-bold">{compliance.outDeadlineCount} fora do prazo</span>
          </div>
        </div>

        {/* 3. Fechamento de Relatórios de Bordo (KM Real) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prestação de Contas</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-navy-950">{compliance.reportAdherenceRate}%</span>
            <span className="text-xs font-semibold text-purple-700">relatórios apurados</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span className="text-emerald-700 font-bold">{compliance.reportsFinished} finalizados</span>
            <span>•</span>
            <span className="text-amber-600 font-bold">{compliance.reportsPending} pendentes</span>
          </div>
        </div>

        {/* 4. Total de Registros de Trilha */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Trilha de Auditoria</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-navy-950">{compliance.totalLogs}</span>
            <span className="text-xs font-semibold text-slate-500">eventos logados</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>Rastreabilidade IP & Agente ativa</span>
          </div>
        </div>

      </div>

      {/* BARRA DE FILTROS E BUSCA DE AUDITORIA */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Campo de Busca Rápida */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Nº de Processo SEI, Agente, Detalhes ou Ação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-navy-950 placeholder-slate-400 focus:outline-hidden focus:border-brand-500 focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Filtros Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Ação */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
              <span className="font-bold text-slate-500 text-[11px]">Ação:</span>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="bg-transparent font-extrabold text-navy-950 focus:outline-hidden cursor-pointer text-xs max-w-[150px] truncate"
              >
                <option value="ALL">Todas as Ações</option>
                <option value="Despacho & Escala">Despacho & Escala</option>
                <option value="Indeferimento de Demanda">Indeferimento de Demanda</option>
                <option value="Cancelamento de Demanda">Cancelamento de Demanda</option>
                <option value="Alteração de Datas">Alteração de Datas</option>
                <option value="Criação de Solicitação">Criação de Solicitação</option>
                <option value="Parametrização Financeira">Parametrização Financeira</option>
                <option value="Importação em Lote">Importação em Lote</option>
              </select>
            </div>

            {/* Conformidade */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
              <span className="font-bold text-slate-500 text-[11px]">Conformidade:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent font-extrabold text-navy-950 focus:outline-hidden cursor-pointer text-xs"
              >
                <option value="ALL">Todos os Status</option>
                <option value="Conforme">Conforme</option>
                <option value="Exceção Justificada">Exceção Justificada</option>
                <option value="Alerta">Alerta</option>
                <option value="Crítico">Crítico</option>
              </select>
            </div>

            {/* Entidade */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
              <span className="font-bold text-slate-500 text-[11px]">Entidade:</span>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="bg-transparent font-extrabold text-navy-950 focus:outline-hidden cursor-pointer text-xs"
              >
                <option value="ALL">Todas</option>
                <option value="Viagem">Viagem</option>
                <option value="Veículo">Veículo</option>
                <option value="Motorista">Motorista</option>
                <option value="Contratada">Contratada</option>
                <option value="Unidade">Unidade</option>
                <option value="Parâmetros">Parâmetros</option>
              </select>
            </div>

          </div>
        </div>
      </div>

      {/* TABELA DE REGISTROS DE AUDITORIA */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden space-y-0">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-sm sm:text-base text-navy-950">
              Trilha de Eventos & Logs de Auditoria ({auditLogs.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Registros ordenados cronologicamente do mais recente ao mais antigo
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-extrabold border-b border-slate-200 text-[10.5px] uppercase tracking-wider">
                <th className="py-3 px-4">Data & Hora</th>
                <th className="py-3 px-3">Agente / Usuário</th>
                <th className="py-3 px-3">Ação Realizada</th>
                <th className="py-3 px-3">Nº Processo SEI</th>
                <th className="py-3 px-3">Detalhes da Operação</th>
                <th className="py-3 px-3 text-center">Conformidade</th>
                <th className="py-3 px-3 text-center">IP</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nenhum registro de auditoria encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-navy-950">
                        {safeFormatDate(log.timestamp, "dd/MM/yyyy", '-')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {safeFormatDate(log.timestamp, "HH:mm:ss 'BRT'", '-')}
                      </div>
                    </td>

                    {/* Agente / Usuário */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {log.user_name}
                      </div>
                      <div className="text-[10px] text-slate-500">{log.user_role}</div>
                    </td>

                    {/* Ação */}
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-block ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Processo */}
                    <td className="py-3 px-3 font-mono font-bold text-navy-900 whitespace-nowrap">
                      {log.process_number || '-'}
                    </td>

                    {/* Detalhes */}
                    <td className="py-3 px-3 max-w-xs truncate text-slate-700" title={log.details}>
                      {log.details}
                    </td>

                    {/* Conformidade */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {getComplianceBadge(log.compliance_status)}
                    </td>

                    {/* IP */}
                    <td className="py-3 px-3 text-center font-mono text-[10px] text-slate-400">
                      {log.ip_address || '10.20.4.15'}
                    </td>

                    {/* Botão Ver Detalhes */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLogDetail(log)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors inline-flex items-center gap-1 text-[11px] font-bold"
                        title="Ver detalhes completos do log"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver</span>
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALHADO DO LOG DE AUDITORIA */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-navy-950">Detalhes do Evento de Auditoria</h3>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {selectedLogDetail.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 font-bold block text-[10.5px]">Data e Hora:</span>
                  <strong className="text-navy-950">
                    {safeFormatDate(selectedLogDetail.timestamp, "dd/MM/yyyy 'às' HH:mm:ss", '-')}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10.5px]">Status de Conformidade:</span>
                  <div className="mt-0.5">{getComplianceBadge(selectedLogDetail.compliance_status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 font-bold block text-[10.5px]">Agente Responsável:</span>
                  <strong className="text-navy-950">{selectedLogDetail.user_name}</strong>
                  <div className="text-[10.5px] text-slate-500">{selectedLogDetail.user_role}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10.5px]">Endereço IP de Origem:</span>
                  <span className="font-mono text-slate-700 font-bold">{selectedLogDetail.ip_address || '10.20.4.15'}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold block text-[10.5px]">Ação & Processo SEI:</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadge(selectedLogDetail.action)}`}>
                    {selectedLogDetail.action}
                  </span>
                  {selectedLogDetail.process_number && (
                    <span className="font-mono font-bold text-navy-950">{selectedLogDetail.process_number}</span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-slate-500 font-bold block text-[10.5px]">Descrição Completa da Operação:</span>
                <p className="text-slate-800 leading-relaxed font-medium bg-white p-3 rounded-lg border border-slate-200">
                  {selectedLogDetail.details}
                </p>
              </div>

            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AuditView;
