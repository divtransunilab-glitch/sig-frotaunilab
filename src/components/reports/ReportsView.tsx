import React, { useState } from 'react';
import { TripRequest } from '../../types';
import { TripService } from '../../services/tripService';
import { ExportService } from '../../services/exportService';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Milestone, 
  Building2, 
  TrendingUp,
  Filter
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportsViewProps {
  trips: TripRequest[];
  onOpenImportModal?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ trips, onOpenImportModal }) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const months = [
    { value: 0, label: 'Janeiro' },
    { value: 1, label: 'Fevereiro' },
    { value: 2, label: 'Março' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Maio' },
    { value: 5, label: 'Junho' },
    { value: 6, label: 'Julho' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Setembro' },
    { value: 9, label: 'Outubro' },
    { value: 10, label: 'Novembro' },
    { value: 11, label: 'Dezembro' },
  ];

  const monthTrips = trips.filter((t) => {
    const d = parseISO(t.departure_datetime);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const monthLabel = `${months.find((m) => m.value === selectedMonth)?.label} de ${selectedYear}`;
  const metrics = TripService.getMetrics(selectedMonth, selectedYear);

  const handleExportExcel = () => {
    ExportService.exportToExcel(
      monthTrips.length > 0 ? monthTrips : trips,
      `SIG-FROTA_Relatorio_${monthLabel.replace(/\s+/g, '_')}.xlsx`
    );
  };

  const handleExportPDF = () => {
    ExportService.exportToPDF(
      monthTrips.length > 0 ? monthTrips : trips,
      'Relatório Mensal de Gestão de Frotas e Viagens Oficiais',
      monthLabel
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-brand-600" />
            <h2 className="text-xl font-extrabold text-navy-950">
              Central de Relatórios & Exportação
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gere relatórios gerenciais consolidados e planilhas mensais compatíveis com o padrão UNILAB
          </p>
        </div>

        {/* Month & Year Selectors */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-brand-600" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden ml-1"
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>
        </div>
      </div>

      {/* Export & Import Action Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Excel Import Card */}
        <div className="bg-gradient-to-br from-brand-950 via-navy-950 to-brand-900 rounded-2xl p-6 text-white shadow-card flex flex-col justify-between space-y-4 border border-brand-500/20">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-brand-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Subir Planilha 2026 (.xlsx)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Importe a planilha oficial contendo as abas de Janeiro a Dezembro para carregar dados reais no sistema.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onOpenImportModal}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md shadow-brand-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Importar Dados Reais (XLSX)</span>
            </button>
          </div>
        </div>

        {/* Excel Export Card */}
        <div className="bg-gradient-to-br from-navy-900 to-slate-900 rounded-2xl p-6 text-white shadow-card flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-brand-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Exportar Planilha Excel (.xlsx)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Arquivo estruturado com todas as colunas de controle: Processo, Solicitante, Origem/Destino, KM, Contratada, Motorista e Veículo.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleExportExcel}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Excel ({monthTrips.length} viagens)</span>
            </button>
          </div>
        </div>

        {/* PDF Export Card */}
        <div className="bg-gradient-to-br from-slate-900 to-navy-950 rounded-2xl p-6 text-white shadow-card flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Gerar Relatório Executivo em PDF
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Documento formatado em paisagem (A4) com cabeçalho oficial da UNILAB, sumário executivo e grade completa de processos.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleExportPDF}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Gerar Relatório PDF ({monthLabel})</span>
            </button>
          </div>
        </div>

      </div>

      {/* Monthly Metrics Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-sm text-navy-950 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-600" />
            Resumo Analítico de {monthLabel}
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            Total de demandas apuradas: <strong>{monthTrips.length}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Viagens Confirmadas</span>
            <strong className="text-2xl text-emerald-700 font-extrabold">{metrics.confirmed}</strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">KM Total Previsto</span>
            <strong className="text-2xl text-navy-950 font-extrabold">{metrics.totalKmEstimated} km</strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">KM Real Apurado</span>
            <strong className="text-2xl text-brand-700 font-extrabold">{metrics.totalKmReal} km</strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Indeferidas por Frota</span>
            <strong className="text-2xl text-rose-700 font-extrabold">{metrics.rejectedUnavailability} ({metrics.unavailabilityRate}%)</strong>
          </div>
        </div>
      </div>

    </div>
  );
};
