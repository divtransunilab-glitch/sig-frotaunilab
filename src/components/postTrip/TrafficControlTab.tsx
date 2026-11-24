import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, isValid } from 'date-fns';
import { TripRequest, Vehicle } from '../../types';
import { DistanceService } from '../../services/distanceService';
import { FleetService } from '../../services/fleetService';
import { safeFormatDate } from '../../utils/dateUtils';
import { formatTripLegsSummary } from '../../utils/driverLinkUtils';
import {
  Truck,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  Milestone,
  Users,
  Filter,
  RotateCcw,
} from 'lucide-react';

interface TrafficControlTabProps {
  trips: TripRequest[];
}

const MONTHS = [
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

export const TrafficControlTab: React.FC<TrafficControlTabProps> = ({ trips }) => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const cities = DistanceService.getCities();
  const vehicles = FleetService.getVehicles();
  const drivers = FleetService.getDrivers();
  const contractors = FleetService.getContractors();

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? c.name : id;
  };

  const getDriverName = (id?: string) => {
    if (!id) return 'Não informado';
    const d = drivers.find((item) => item.id === id);
    return d ? d.name : id;
  };

  const getContractorName = (id?: string) => {
    if (!id) return 'Frota Oficial / Terceirizada';
    const c = contractors.find((item) => item.id === id);
    return c ? c.name : id;
  };

  const getEffectiveKm = (t: TripRequest) => {
    if (t.real_km !== undefined && t.real_km !== null && t.real_km > 0) return t.real_km;
    return t.estimated_km ?? 0;
  };

  const getLegsText = (t: TripRequest) => {
    if (Array.isArray(t.trip_legs) && t.trip_legs.length > 0) {
      return formatTripLegsSummary(t.trip_legs);
    }
    const orig = getCityName(t.origin_city_id);
    const dest = getCityName(t.destination_city_id);
    const km = getEffectiveKm(t);
    const suffix = t.real_km ? ' (Real)' : ' (Prev.)';
    return `${orig} ➔ ${dest} ➔ ${orig}: ${km} km${suffix}`;
  };

  const getObservationsText = (t: TripRequest) => {
    const parts: string[] = [];
    if (t.report_notes && t.report_notes.trim()) {
      parts.push(t.report_notes.trim());
    }
    if (t.notes && t.notes.trim() && t.notes.trim() !== t.report_notes?.trim()) {
      parts.push(t.notes.trim());
    }
    return parts.length > 0 ? parts.join(' • ') : '-';
  };

  const availableYears = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    trips.forEach((t) => {
      try {
        const d = parseISO(t.departure_datetime);
        if (isValid(d)) set.add(d.getFullYear());
      } catch {
        // ignore
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [trips]);

  // Filtra viagens confirmadas do mês/ano selecionado
  const filteredTrips = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return trips
      .filter((t) => {
        if (t.status !== 'Confirmado ao Demandante') return false;
        try {
          const d = parseISO(t.departure_datetime);
          if (!isValid(d)) return false;
          if (d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear) return false;
        } catch {
          return false;
        }

        if (vehicleFilter !== 'all' && (t.allocated_vehicle_id || 'sem-veiculo') !== vehicleFilter) {
          return false;
        }
        if (driverFilter !== 'all' && (t.allocated_driver_id || 'sem-motorista') !== driverFilter) {
          return false;
        }
        if (term) {
          const v = vehicles.find((item) => item.id === t.allocated_vehicle_id);
          const haystack = [
            t.process_number,
            t.requester_name,
            getDriverName(t.allocated_driver_id),
            v?.model || '',
            v?.plate || '',
            getCityName(t.origin_city_id),
            getCityName(t.destination_city_id),
            t.report_notes || '',
            t.notes || '',
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(term)) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime()
      );
  }, [trips, selectedMonth, selectedYear, vehicleFilter, driverFilter, searchTerm, vehicles, drivers, cities]);

  // Agrupa por Veículo (para saber quem utilizou cada veículo e o total mensal por placa)
  const groupedByVehicle = useMemo(() => {
    const map = new Map<
      string,
      {
        vehicleId: string;
        vehicle?: Vehicle;
        model: string;
        plate: string;
        contractorName: string;
        trips: TripRequest[];
        totalKm: number;
        realKmCount: number;
      }
    >();

    filteredTrips.forEach((t) => {
      const vId = t.allocated_vehicle_id || 'sem-veiculo';
      const v = vehicles.find((item) => item.id === vId);

      if (!map.has(vId)) {
        map.set(vId, {
          vehicleId: vId,
          vehicle: v,
          model: v ? v.model : 'Veículo Não Alocado / A Definir',
          plate: v ? v.plate : 'SEM PLACA',
          contractorName: getContractorName(v?.contractor_id || t.allocated_contractor_id),
          trips: [],
          totalKm: 0,
          realKmCount: 0,
        });
      }

      const group = map.get(vId)!;
      group.trips.push(t);
      group.totalKm = Number((group.totalKm + getEffectiveKm(t)).toFixed(1));
      if (t.real_km !== undefined && t.real_km !== null && t.real_km > 0) {
        group.realKmCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.plate.localeCompare(b.plate));
  }, [filteredTrips, vehicles, contractors]);

  const totalMonthKm = useMemo(
    () => Number(groupedByVehicle.reduce((acc, g) => acc + g.totalKm, 0).toFixed(1)),
    [groupedByVehicle]
  );

  const monthLabel = `${MONTHS[selectedMonth]?.label || ''} / ${selectedYear}`;

  const handleExportExcel = () => {
    if (groupedByVehicle.length === 0) return;

    const wb = XLSX.utils.book_new();

    // Aba 1: Resumo por Veículo
    const summaryRows = groupedByVehicle.map((g) => ({
      Veículo: g.model,
      Placa: g.plate,
      Contratada: g.contractorName,
      'Qtd. Viagens': g.trips.length,
      'KM Total no Mês': g.totalKm,
      'Motoristas que Utilizaram': Array.from(
        new Set(g.trips.map((t) => getDriverName(t.allocated_driver_id)))
      ).join(', '),
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo por Veículo');

    // Aba 2: Controle Completo (ordenado por veículo e data)
    const allRows: Record<string, string | number>[] = [];
    groupedByVehicle.forEach((g) => {
      g.trips.forEach((t) => {
        allRows.push({
          Veículo: g.model,
          Placa: g.plate,
          Data: safeFormatDate(t.departure_datetime, 'dd/MM/yyyy', '-'),
          'Horário da Demanda': `${safeFormatDate(t.departure_datetime, 'HH:mm', '-')} às ${safeFormatDate(t.return_datetime, 'HH:mm', '-')}`,
          Motorista: getDriverName(t.allocated_driver_id),
          'Processo SEI': t.process_number,
          Solicitante: `${t.requester_name} (${t.macro_unit})`,
          'KM por Trecho': getLegsText(t),
          'KM Total': getEffectiveKm(t),
          Observações: getObservationsText(t),
        });
      });
    });
    const wsAll = XLSX.utils.json_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Controle Completo');

    // Abas individuais por Placa de Veículo
    groupedByVehicle.forEach((g) => {
      const sheetName = g.plate.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 28) || 'SEM_PLACA';
      const rows = g.trips.map((t) => ({
        Data: safeFormatDate(t.departure_datetime, 'dd/MM/yyyy', '-'),
        'Horário da Demanda': `${safeFormatDate(t.departure_datetime, 'HH:mm', '-')} às ${safeFormatDate(t.return_datetime, 'HH:mm', '-')}`,
        Motorista: getDriverName(t.allocated_driver_id),
        Veículo: g.model,
        Placa: g.plate,
        'Processo SEI': t.process_number,
        'KM por Trecho': getLegsText(t),
        'KM Total': getEffectiveKm(t),
        Observações: getObservationsText(t),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const safeMonth = `${MONTHS[selectedMonth]?.label}_${selectedYear}`;
    XLSX.writeFile(wb, `Controle_Trafego_Por_Veiculo_${safeMonth}.xlsx`);
  };

  const handleExportPDF = () => {
    if (groupedByVehicle.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('UNILAB • PROADI / DIVTRANS — CONTROLE DE TRÁFEGO MENSAL POR VEÍCULO', 14, 14);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Período: ${monthLabel}  |  Veículos Utilizados: ${groupedByVehicle.length}  |  Viagens: ${filteredTrips.length}  |  KM Total: ${totalMonthKm} km  |  Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
      14,
      20
    );

    let currentY = 26;

    groupedByVehicle.forEach((g, groupIndex) => {
      if (groupIndex > 0 && currentY > 165) {
        doc.addPage();
        currentY = 16;
      }

      doc.setFillColor(15, 23, 42);
      doc.rect(14, currentY, 269, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `VEÍCULO: ${g.model}  |  PLACA: ${g.plate}  |  CONTRATADA: ${g.contractorName}  |  ${g.trips.length} VIAGEM(NS)  |  TOTAL: ${g.totalKm} KM`,
        16,
        currentY + 4.8
      );
      doc.setTextColor(15, 23, 42);

      autoTable(doc, {
        startY: currentY + 8,
        margin: { left: 14, right: 14 },
        head: [[
          'Data',
          'Horário Demanda',
          'Motorista',
          'Veículo / Placa',
          'KM por Trecho',
          'KM Total',
          'Observações',
        ]],
        body: g.trips.map((t) => [
          safeFormatDate(t.departure_datetime, 'dd/MM/yyyy', '-'),
          `${safeFormatDate(t.departure_datetime, 'HH:mm', '-')} - ${safeFormatDate(t.return_datetime, 'HH:mm', '-')}`,
          `${getDriverName(t.allocated_driver_id)}\n(${t.process_number})`,
          `${g.model}\n${g.plate}`,
          getLegsText(t),
          `${getEffectiveKm(t)} km`,
          getObservationsText(t),
        ]),
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 26 },
          2: { cellWidth: 42 },
          3: { cellWidth: 34 },
          4: { cellWidth: 72 },
          5: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
          6: { cellWidth: 57 },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || currentY + 25;
      currentY = finalY + 8;
    });

    const safeMonth = `${MONTHS[selectedMonth]?.label}_${selectedYear}`;
    doc.save(`Controle_Trafego_${safeMonth}.pdf`);
  };

  const hasFilters = vehicleFilter !== 'all' || driverFilter !== 'all' || searchTerm.trim() !== '';

  return (
    <div className="space-y-5">
      {/* Barra de Período + Filtros + Exportação */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-navy-950 flex items-center gap-2">
              <Truck className="w-5 h-5 text-brand-600" />
              <span>Controle de Tráfego Mensal — Separado por Veículo</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Histórico mensal de utilização por placa: quem conduziu, horários, KM por trecho e observações
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl text-xs">
              <Calendar className="w-4 h-4 text-brand-600" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="bg-transparent font-bold text-slate-800 focus:outline-hidden"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-transparent font-bold text-slate-800 focus:outline-hidden"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={groupedByVehicle.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Baixar Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={groupedByVehicle.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-navy-950 hover:bg-navy-900 disabled:opacity-50 text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Baixar PDF</span>
            </button>
          </div>
        </div>

        {/* Filtros adicionais */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar placa, motorista, cidade, processo..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-hidden"
            />
          </div>

          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-hidden font-semibold text-slate-800"
          >
            <option value="all">Todos os veículos</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate} — {v.model}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-hidden font-semibold text-slate-800"
            >
              <option value="all">Todos os motoristas</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setVehicleFilter('all');
                  setDriverFilter('all');
                  setSearchTerm('');
                }}
                className="p-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
                title="Limpar filtros"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs Consolidados do Mês */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 block">
              Veículos Utilizados ({monthLabel})
            </span>
            <span className="text-2xl font-extrabold text-navy-950 mt-0.5 block">
              {groupedByVehicle.length}
            </span>
          </div>
          <Truck className="w-7 h-7 text-brand-600 opacity-70" />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 block">
              Viagens Confirmadas no Mês
            </span>
            <span className="text-2xl font-extrabold text-navy-950 mt-0.5 block">
              {filteredTrips.length}
            </span>
          </div>
          <Users className="w-7 h-7 text-blue-600 opacity-70" />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 block">
              KM Total Consolidado no Mês
            </span>
            <span className="text-2xl font-extrabold text-emerald-700 mt-0.5 block">
              {totalMonthKm.toLocaleString('pt-BR')} km
            </span>
          </div>
          <Milestone className="w-7 h-7 text-emerald-600 opacity-70" />
        </div>
      </div>

      {/* Blocos Separados por Veículo */}
      {groupedByVehicle.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
          <Filter className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-600">
            Nenhuma viagem confirmada encontrada para {monthLabel}.
          </p>
          <p className="text-xs text-slate-400">
            Selecione outro mês/ano ou limpe os filtros acima.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByVehicle.map((group) => (
            <div
              key={group.vehicleId}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden"
            >
              {/* Cabeçalho do Veículo */}
              <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="px-2.5 py-1 rounded-lg bg-white text-navy-950 font-mono font-black text-xs tracking-wider shadow-xs">
                    {group.plate}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold leading-tight">{group.model}</h4>
                    <p className="text-[11px] text-slate-300">
                      {group.contractorName}
                      {group.vehicle?.type ? ` • ${group.vehicle.type}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 font-bold">
                    {group.trips.length} viagem{group.trips.length > 1 ? 'ns' : ''}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-extrabold">
                    Total: {group.totalKm.toLocaleString('pt-BR')} km
                  </span>
                </div>
              </div>

              {/* Tabela de Utilização do Veículo */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="p-3 pl-4">Data</th>
                      <th className="p-3">Horário da Demanda</th>
                      <th className="p-3">Motorista</th>
                      <th className="p-3">Veículo / Placa</th>
                      <th className="p-3">KM por Trecho</th>
                      <th className="p-3 text-right">KM Total</th>
                      <th className="p-3 pr-4">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.trips.map((t) => {
                      const hasLegs = Array.isArray(t.trip_legs) && t.trip_legs.length > 0;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80 align-top">
                          <td className="p-3 pl-4 font-bold text-navy-950 whitespace-nowrap">
                            {safeFormatDate(t.departure_datetime, 'dd/MM/yyyy', '-')}
                          </td>
                          <td className="p-3 whitespace-nowrap text-slate-700 font-medium">
                            <div>
                              {safeFormatDate(t.departure_datetime, 'HH:mm', '-')} ➔{' '}
                              {safeFormatDate(t.return_datetime, 'HH:mm', '-')}
                            </div>
                            <div className="text-[10px] text-slate-400">{t.process_number}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">
                              {getDriverName(t.allocated_driver_id)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Solic.: {t.requester_name} ({t.macro_unit})
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{group.model}</div>
                            <div className="text-[10px] font-mono font-bold text-slate-500">
                              {group.plate}
                            </div>
                          </td>
                          <td className="p-3 min-w-[220px]">
                            {hasLegs ? (
                              <div className="space-y-1">
                                {t.trip_legs!.map((leg, i) => (
                                  <div
                                    key={leg.id || i}
                                    className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200/70"
                                  >
                                    <span className="font-semibold text-slate-700">
                                      {leg.origin} ➔ {leg.destination}
                                    </span>
                                    <span className="font-extrabold text-emerald-700 whitespace-nowrap">
                                      {leg.distance_km ?? '-'} km
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-600">
                                {getCityName(t.origin_city_id)} ➔ {getCityName(t.destination_city_id)}
                                <span className="block text-[10px] text-slate-400">
                                  {t.real_km ? 'KM real consolidado' : 'KM estimado (sem lançamento por trecho)'}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap font-extrabold text-brand-700">
                            {getEffectiveKm(t)} km
                          </td>
                          <td className="p-3 pr-4 text-slate-600 max-w-xs whitespace-pre-wrap">
                            {getObservationsText(t)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
