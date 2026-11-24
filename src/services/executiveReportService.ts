import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, isValid, getDay, getHours } from 'date-fns';
import { TripRequest } from '../types';
import { DistanceService } from './distanceService';
import { FleetService } from './fleetService';
import { CostService } from './costService';
import { safeFormatDate } from '../utils/dateUtils';

export interface ExecutiveReportOptions {
  periodLabel: string;
  title?: string;
  includeExecutiveSummary: boolean;
  includeHeatmapAndRankings: boolean;
  includeSectorAnalysis?: boolean;
  includeFinancialAndQuota: boolean;
  includeProcessTable: boolean;
}

const QUOTA_STORAGE_KEY = 'sigfrota_contractor_km_quotas_v1';

function loadQuotaSettings(): {
  defaultVehicleMonthlyKm: number;
  alertThresholdPercent: number;
  vehicleQuotas: Record<string, number>;
} {
  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        defaultVehicleMonthlyKm:
          Number(parsed.defaultVehicleMonthlyKm) > 0 ? Number(parsed.defaultVehicleMonthlyKm) : 3000,
        alertThresholdPercent:
          Number(parsed.alertThresholdPercent) > 0 ? Number(parsed.alertThresholdPercent) : 75,
        vehicleQuotas:
          parsed.vehicleQuotas && typeof parsed.vehicleQuotas === 'object' ? parsed.vehicleQuotas : {},
      };
    }
  } catch {
    // fallback
  }
  return { defaultVehicleMonthlyKm: 3000, alertThresholdPercent: 75, vehicleQuotas: {} };
}

function formatBRL(val: number): string {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export class ExecutiveReportService {
  static generateExecutivePDF(trips: TripRequest[], options: ExecutiveReportOptions): void {
    // Formato A4 Retrato Oficial (210 x 297 mm) — padrão SEI / PROADI / Reitoria
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const marginX = 12;
    const contentW = pageW - marginX * 2; // 186mm

    const cities = DistanceService.getCities();
    const vehicles = FleetService.getVehicles();
    const drivers = FleetService.getDrivers();
    const contractors = FleetService.getContractors();
    const quotaSettings = loadQuotaSettings();

    const includeSectors = options.includeSectorAnalysis !== false;

    const getCityName = (id: string) => {
      const c = cities.find((item) => item.id === id);
      return c ? c.name : id;
    };

    const drawPageHeader = (sectionTitle: string) => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 20, 'F');
      doc.setFillColor(5, 150, 105);
      doc.rect(0, 20, pageW, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(255, 255, 255);
      doc.text('UNIVERSIDADE DA INTEGRAÇÃO INTERNACIONAL DA LUSOFONIA AFRO-BRASILEIRA', marginX, 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text('PRÓ-REITORIA DE ADMINISTRAÇÃO E PLANEJAMENTO (PROADI) • DIVISÃO DE TRANSPORTES (DIVTRANS)', marginX, 13.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(167, 243, 208);
      doc.text(`SIG-FROTA  |  Período: ${options.periodLabel}`, marginX, 18);

      // Subtítulo da seção
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(sectionTitle, marginX, 28.5);

      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, 30.5, pageW - marginX, 30.5);
    };

    // =========================================================================
    // CÁLCULOS ANALÍTICOS CONSOLIDADOS
    // =========================================================================
    const total = trips.length;
    const confirmedTrips = trips.filter((t) => t.status === 'Confirmado ao Demandante');
    const pendingTrips = trips.filter((t) => t.status === 'Pendente de Análise');
    const rejectedTrips = trips.filter((t) => t.status === 'Indeferido');
    const cancelledTrips = trips.filter((t) => t.status.includes('Cancelado'));
    const alteredTrips = trips.filter((t) => t.status === 'Alterado a Data da Demanda');

    const confirmedCount = confirmedTrips.length;
    const attendanceRate = total > 0 ? Number(((confirmedCount / total) * 100).toFixed(1)) : 0;
    const inDeadlineCount = trips.filter((t) => t.status_deadline === 'Dentro do Prazo').length;
    const outDeadlineCount = trips.filter((t) => t.status_deadline === 'Fora do Prazo').length;
    const deadlineRate = total > 0 ? Number(((inDeadlineCount / total) * 100).toFixed(1)) : 0;

    const totalPassengers = confirmedTrips.reduce((acc, t) => acc + (Number(t.passenger_count) || 0), 0);
    const avgPassengers = confirmedCount > 0 ? Number((totalPassengers / confirmedCount).toFixed(1)) : 0;

    const totalKmEstimated = Number(
      confirmedTrips.reduce((acc, t) => acc + (Number(t.estimated_km) || 0), 0).toFixed(1)
    );
    const totalKmEffective = Number(
      confirmedTrips
        .reduce((acc, t) => acc + (t.real_km && t.real_km > 0 ? t.real_km : t.estimated_km || 0), 0)
        .toFixed(1)
    );

    // Custos financeiros por Unidade Macro e por Setor
    let totalFuelLiters = 0;
    let totalFuelCost = 0;
    let totalMaintCost = 0;
    let totalTollCost = 0;

    const costByUnit = new Map<
      string,
      { unit: string; trips: number; km: number; liters: number; fuelCost: number; maintCost: number; totalCost: number }
    >();

    // Análise completa por Setor / Unidade Solicitante (requesting_unit + macro_unit)
    const sectorMap = new Map<
      string,
      {
        sector: string;
        macroUnit: string;
        total: number;
        confirmed: number;
        rejected: number;
        cancelled: number;
        inDeadline: number;
        passengers: number;
        km: number;
        cost: number;
      }
    >();

    trips.forEach((t) => {
      const macro = t.macro_unit || 'Outros';
      const sectorName = (t.requesting_unit || '').trim() || `Setor Geral (${macro})`;
      const sectorKey = `${sectorName}__${macro}`;
      const curSec = sectorMap.get(sectorKey) || {
        sector: sectorName,
        macroUnit: macro,
        total: 0,
        confirmed: 0,
        rejected: 0,
        cancelled: 0,
        inDeadline: 0,
        passengers: 0,
        km: 0,
        cost: 0,
      };
      curSec.total += 1;
      if (t.status === 'Confirmado ao Demandante') curSec.confirmed += 1;
      if (t.status === 'Indeferido') curSec.rejected += 1;
      if (t.status.includes('Cancelado')) curSec.cancelled += 1;
      if (t.status_deadline === 'Dentro do Prazo') curSec.inDeadline += 1;

      if (t.status === 'Confirmado ao Demandante') {
        const v = vehicles.find((item) => item.id === t.allocated_vehicle_id);
        const breakdown = CostService.calculateTripCost(t, v);
        const toll = Number(t.toll_amount) || 0;
        const tripTotalCost = breakdown.totalCost + toll;

        curSec.passengers += Number(t.passenger_count) || 0;
        curSec.km += breakdown.km;
        curSec.cost += tripTotalCost;

        totalFuelLiters += breakdown.fuelLiters;
        totalFuelCost += breakdown.fuelCost;
        totalMaintCost += breakdown.operationalCost;
        totalTollCost += toll;

        const curUnit = costByUnit.get(macro) || {
          unit: macro,
          trips: 0,
          km: 0,
          liters: 0,
          fuelCost: 0,
          maintCost: 0,
          totalCost: 0,
        };
        curUnit.trips += 1;
        curUnit.km += breakdown.km;
        curUnit.liters += breakdown.fuelLiters;
        curUnit.fuelCost += breakdown.fuelCost;
        curUnit.maintCost += breakdown.operationalCost;
        curUnit.totalCost += tripTotalCost;
        costByUnit.set(macro, curUnit);
      }

      sectorMap.set(sectorKey, curSec);
    });

    const totalOperationalCost = totalFuelCost + totalMaintCost + totalTollCost;
    const sectorsSorted = Array.from(sectorMap.values()).sort(
      (a, b) => b.total - a.total || b.km - a.km
    );

    // Top Solicitantes nominais
    const requesterMap = new Map<string, { name: string; sector: string; total: number; confirmed: number; km: number }>();
    trips.forEach((t) => {
      const name = (t.requester_name || 'Não informado').trim();
      const cur = requesterMap.get(name) || {
        name,
        sector: `${t.requesting_unit || t.macro_unit} (${t.macro_unit})`,
        total: 0,
        confirmed: 0,
        km: 0,
      };
      cur.total += 1;
      if (t.status === 'Confirmado ao Demandante') {
        cur.confirmed += 1;
        cur.km += t.real_km && t.real_km > 0 ? t.real_km : t.estimated_km || 0;
      }
      requesterMap.set(name, cur);
    });
    const topRequesters = Array.from(requesterMap.values())
      .sort((a, b) => b.total - a.total || b.km - a.km)
      .slice(0, 8);

    // 3 Modos de Heatmap idênticos ao BI (Horas 05h-22h, Faixas Operacionais, Turnos)
    const dayLabels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const individualHours = Array.from({ length: 18 }, (_, i) => i + 5); // 5..22
    const timeSlotLabels = [
      '00-05h',
      '05-07h',
      '07-09h',
      '09-11h',
      '11-13h',
      '13-15h',
      '15-18h',
      '18-24h',
    ];
    const shiftLabels = [
      'Manhã (05h-12h)',
      'Tarde (12h-18h)',
      'Noite (18h-24h)',
      'Madrugada (00h-05h)',
    ];

    const getTimeSlotIndex = (hour: number) => {
      if (hour < 5) return 0;
      if (hour < 7) return 1;
      if (hour < 9) return 2;
      if (hour < 11) return 3;
      if (hour < 13) return 4;
      if (hour < 15) return 5;
      if (hour < 18) return 6;
      return 7;
    };

    const getShiftIndex = (hour: number) => {
      if (hour >= 5 && hour < 12) return 0;
      if (hour >= 12 && hour < 18) return 1;
      if (hour >= 18 && hour <= 23) return 2;
      return 3;
    };

    const heatHours: number[][] = Array.from({ length: 7 }, () => Array(18).fill(0));
    const heatSlots: number[][] = Array.from({ length: 7 }, () => Array(8).fill(0));
    const heatShifts: number[][] = Array.from({ length: 7 }, () => Array(4).fill(0));

    let maxHeatHour = 0;
    let maxHeatSlot = 0;
    let maxHeatCell = 0;
    let peakDayIdx = 0;
    let peakSlotIdx = 0;

    trips.forEach((t) => {
      try {
        const d = parseISO(t.departure_datetime);
        if (!isValid(d)) return;
        const jsDay = getDay(d);
        const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
        const h = getHours(d);

        if (h >= 5 && h <= 22) {
          const hIdx = h - 5;
          heatHours[dayIdx][hIdx] += 1;
          if (heatHours[dayIdx][hIdx] > maxHeatHour) maxHeatHour = heatHours[dayIdx][hIdx];
        }

        const slIdx = getTimeSlotIndex(h);
        heatSlots[dayIdx][slIdx] += 1;
        if (heatSlots[dayIdx][slIdx] > maxHeatSlot) maxHeatSlot = heatSlots[dayIdx][slIdx];

        const shIdx = getShiftIndex(h);
        heatShifts[dayIdx][shIdx] += 1;
        if (heatShifts[dayIdx][shIdx] > maxHeatCell) {
          maxHeatCell = heatShifts[dayIdx][shIdx];
          peakDayIdx = dayIdx;
          peakSlotIdx = shIdx;
        }
      } catch {
        // ignore
      }
    });

    // Unidades Macro
    const unitMap = new Map<string, { unit: string; total: number; inDeadline: number; outDeadline: number }>();
    trips.forEach((t) => {
      const u = t.macro_unit || 'Outros';
      const cur = unitMap.get(u) || { unit: u, total: 0, inDeadline: 0, outDeadline: 0 };
      cur.total += 1;
      if (t.status_deadline === 'Dentro do Prazo') cur.inDeadline += 1;
      else cur.outDeadline += 1;
      unitMap.set(u, cur);
    });
    const topUnits = Array.from(unitMap.values()).sort((a, b) => b.total - a.total);
    const worstDeadlineUnit = [...topUnits]
      .filter((u) => u.outDeadline > 0)
      .sort((a, b) => b.outDeadline - a.outDeadline)[0];

    // Finalidades
    const activityMap = new Map<string, number>();
    trips.forEach((t) => {
      const act = t.activity_type || 'Outros';
      activityMap.set(act, (activityMap.get(act) || 0) + 1);
    });
    const activitiesSorted = Array.from(activityMap.entries()).sort((a, b) => b[1] - a[1]);

    // Motivos de indeferimento
    const rejectionMap = new Map<string, number>();
    rejectedTrips.forEach((t) => {
      const reason = (t.rejection_reason || 'Não especificado').trim();
      rejectionMap.set(reason, (rejectionMap.get(reason) || 0) + 1);
    });
    const rejectionsSorted = Array.from(rejectionMap.entries()).sort((a, b) => b[1] - a[1]);

    // Franquia dos Veículos Contratados
    const contractedIds = new Set(
      contractors
        .filter((c) => {
          if (c.id === 'cont-4') return false;
          const n = c.name.toLowerCase();
          return !n.includes('frota própria') && !n.includes('frota propria') && !n.includes('própria / unilab');
        })
        .map((c) => c.id)
    );
    const contractedVehicleStats = vehicles
      .filter((v) => v.is_active && v.contractor_id && contractedIds.has(v.contractor_id))
      .map((v) => {
        const vTrips = confirmedTrips.filter((t) => t.allocated_vehicle_id === v.id);
        const usedKm = Number(
          vTrips.reduce((acc, t) => acc + (t.real_km && t.real_km > 0 ? t.real_km : t.estimated_km || 0), 0).toFixed(1)
        );
        const quotaKm =
          quotaSettings.vehicleQuotas[v.id] && quotaSettings.vehicleQuotas[v.id] > 0
            ? quotaSettings.vehicleQuotas[v.id]
            : quotaSettings.defaultVehicleMonthlyKm;
        const percent = quotaKm > 0 ? Number(((usedKm / quotaKm) * 100).toFixed(1)) : 0;
        const contractor = contractors.find((c) => c.id === v.contractor_id);
        return {
          vehicle: v,
          contractorName: contractor?.name || 'Contratada',
          trips: vTrips.length,
          usedKm,
          quotaKm,
          percent,
        };
      })
      .filter((s) => s.usedKm > 0)
      .sort((a, b) => b.percent - a.percent || b.usedKm - a.usedKm);

    const quotaAlertVehicles = contractedVehicleStats.filter(
      (s) => s.percent >= quotaSettings.alertThresholdPercent
    );

    // Auditoria KM Previsto × KM Real
    const realKmTrips = confirmedTrips.filter(
      (t) => t.real_km !== undefined && t.real_km !== null && t.real_km > 0
    );
    const auditEstSum = realKmTrips.reduce((acc, t) => acc + (t.estimated_km || 0), 0);
    const auditRealSum = realKmTrips.reduce((acc, t) => acc + (t.real_km || 0), 0);
    const auditDiffKm = Number((auditRealSum - auditEstSum).toFixed(1));
    const auditDiffPct = auditEstSum > 0 ? Number(((auditDiffKm / auditEstSum) * 100).toFixed(1)) : 0;
    const highDeviationTrips = realKmTrips.filter((t) => {
      const est = t.estimated_km || 0;
      if (est <= 0) return false;
      return Math.abs(((t.real_km! - est) / est) * 100) >= 15;
    });

    // Top 5 Rotas e Top Motoristas
    const routeMap = new Map<string, { route: string; count: number; km: number }>();
    const driverMap = new Map<string, { name: string; count: number; km: number }>();
    confirmedTrips.forEach((t) => {
      const label = `${getCityName(t.origin_city_id)} -> ${getCityName(t.destination_city_id)}`;
      const km = t.real_km && t.real_km > 0 ? t.real_km : t.estimated_km || 0;
      const curR = routeMap.get(label) || { route: label, count: 0, km: 0 };
      curR.count += 1;
      curR.km += km;
      routeMap.set(label, curR);

      if (t.allocated_driver_id) {
        const drv = drivers.find((d) => d.id === t.allocated_driver_id);
        const drvName = drv ? drv.name : t.allocated_driver_id;
        const curD = driverMap.get(drvName) || { name: drvName, count: 0, km: 0 };
        curD.count += 1;
        curD.km += km;
        driverMap.set(drvName, curD);
      }
    });
    const topRoutes = Array.from(routeMap.values())
      .sort((a, b) => b.count - a.count || b.km - a.km)
      .slice(0, 5);
    const topDrivers = Array.from(driverMap.values())
      .sort((a, b) => b.count - a.count || b.km - a.km)
      .slice(0, 5);

    let hasStartedPages = false;
    const ensureNewPage = () => {
      if (hasStartedPages) doc.addPage();
      hasStartedPages = true;
    };

    // =========================================================================
    // PÁGINA 1 (A4 RETRATO): SUMÁRIO EXECUTIVO + GRÁFICO STATUS + ANÁLISE INTELIGENTE
    // =========================================================================
    if (options.includeExecutiveSummary) {
      ensureNewPage();
      drawPageHeader('1. Sumário Executivo, Indicadores-Chave (KPIs) & Análise Inteligente');

      // 6 Cards de KPIs em grade 2 colunas x 3 linhas (otimizado para A4 Retrato)
      const cardW = (contentW - 4) / 2; // 91mm
      const cardH = 21;
      const kpis = [
        {
          label: 'TOTAL DE DEMANDAS & ATENDIMENTO',
          value: `${total} processos (${attendanceRate}%)`,
          sub: `${confirmedCount} confirmadas • ${pendingTrips.length} pendentes`,
          accent: [37, 99, 235] as [number, number, number],
        },
        {
          label: 'PASSAGEIROS TRANSPORTADOS',
          value: `${totalPassengers.toLocaleString('pt-BR')} pessoas`,
          sub: `Média de ${avgPassengers} passageiro(s) por viagem confirmada`,
          accent: [5, 150, 105] as [number, number, number],
        },
        {
          label: 'QUILOMETRAGEM CONSOLIDADA',
          value: `${totalKmEffective.toLocaleString('pt-BR')} km`,
          sub: `Previsto: ${totalKmEstimated.toLocaleString('pt-BR')} km • ${realKmTrips.length} com KM Real`,
          accent: [15, 23, 42] as [number, number, number],
        },
        {
          label: 'CUSTO OPERACIONAL ESTIMADO',
          value: formatBRL(totalOperationalCost),
          sub: `Combustível: ${formatBRL(totalFuelCost)} • Manut./Ped.: ${formatBRL(totalMaintCost + totalTollCost)}`,
          accent: [16, 185, 129] as [number, number, number],
        },
        {
          label: 'ADERÊNCIA AO PRAZO REGIMENTAL',
          value: `${deadlineRate}% dentro do prazo`,
          sub: `${inDeadlineCount} no prazo • ${outDeadlineCount} fora do prazo`,
          accent: [217, 119, 6] as [number, number, number],
        },
        {
          label: 'INDEFERIMENTOS & CANCELAMENTOS',
          value: `${rejectedTrips.length} indef. | ${cancelledTrips.length} cancel.`,
          sub: `${alteredTrips.length} demanda(s) com data alterada`,
          accent: [225, 29, 72] as [number, number, number],
        },
      ];

      kpis.forEach((k, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = marginX + col * (cardW + 4);
        const y = 34 + row * (cardH + 3.5);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');

        doc.setFillColor(k.accent[0], k.accent[1], k.accent[2]);
        doc.rect(x, y + 2, 2.2, cardH - 4, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(k.label, x + 5, y + 5.8);

        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(k.value, x + 5, y + 13);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(71, 85, 105);
        doc.text(k.sub, x + 5, y + 18.2);
      });

      // Gráfico de Distribuição por Situação (largura total)
      const statusY = 110;
      const statusH = 54;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, statusY, contentW, statusH, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('Distribuição das Solicitações por Situação Operacional', marginX + 4, statusY + 6.5);

      const statusBars = [
        { label: 'Confirmado ao Demandante', count: confirmedCount, color: [5, 150, 105] as [number, number, number] },
        { label: 'Pendente de Análise', count: pendingTrips.length, color: [245, 158, 11] as [number, number, number] },
        { label: 'Indeferido', count: rejectedTrips.length, color: [225, 29, 72] as [number, number, number] },
        { label: 'Cancelado (Demandante / Exec.)', count: cancelledTrips.length, color: [100, 116, 139] as [number, number, number] },
        { label: 'Alterado a Data da Demanda', count: alteredTrips.length, color: [59, 130, 246] as [number, number, number] },
      ];

      statusBars.forEach((bar, idx) => {
        const by = statusY + 13.5 + idx * 8;
        const pct = total > 0 ? Math.round((bar.count / total) * 100) : 0;
        const barX = marginX + 54;
        const barMaxW = contentW - 82;
        const barW = total > 0 ? Math.max(1.5, (bar.count / total) * barMaxW) : 0;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        doc.text(bar.label, marginX + 4, by + 3.5);

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(barX, by, barMaxW, 4.8, 1.2, 1.2, 'F');
        if (bar.count > 0) {
          doc.setFillColor(bar.color[0], bar.color[1], bar.color[2]);
          doc.roundedRect(barX, by, barW, 4.8, 1.2, 1.2, 'F');
        }

        doc.setTextColor(15, 23, 42);
        doc.text(`${bar.count} (${pct}%)`, marginX + contentW - 4, by + 3.5, { align: 'right' });
      });

      // Bloco de Análise Inteligente Automática
      const aiY = statusY + statusH + 6;
      const aiH = pageH - aiY - 16; // ~111mm
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(148, 163, 184);
      doc.roundedRect(marginX, aiY, contentW, aiH, 2.5, 2.5, 'FD');

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(marginX, aiY, contentW, 9.5, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('ANÁLISE INTELIGENTE & DIAGNÓSTICO GERENCIAL AUTOMÁTICO', marginX + 4.5, aiY + 6.3);

      const insights: string[] = [];
      if (total === 0) {
        insights.push('Nenhuma solicitação registrada no período selecionado para geração de diagnóstico.');
      } else {
        const attendanceEval =
          attendanceRate >= 80
            ? 'desempenho excelente de atendimento'
            : attendanceRate >= 60
            ? 'nível moderado de atendimento (recomenda-se atuar nos gargalos)'
            : 'nível crítico de atendimento (alta taxa de não atendimento)';
        const topUnit = topUnits[0];
        const topSector = sectorsSorted[0];

        insights.push(
          `1. Eficiência de Atendimento: Taxa de confirmação de ${attendanceRate}% (${confirmedCount} de ${total} demandas), indicando ${attendanceEval}.` +
            (topUnit ? ` A unidade macro líder foi ${topUnit.unit} (${topUnit.total} demandas — ${Math.round((topUnit.total / total) * 100)}%).` : '')
        );

        if (topSector) {
          insights.push(
            `2. Setor / Unidade Solicitante com Maior Demanda: "${topSector.sector}" (${topSector.macroUnit}) liderou com ${topSector.total} solicitações, ${topSector.confirmed} viagens confirmadas, ${topSector.km.toFixed(0)} km rodados e custo estimado de ${formatBRL(topSector.cost)}.`
          );
        }

        if (maxHeatCell > 0) {
          insights.push(
            `3. Pico Operacional (Gargalo de Frota): O maior volume de saídas ocorreu às ${dayLabels[peakDayIdx]}s no turno ${shiftLabels[peakSlotIdx]} (${maxHeatCell} viagens). Recomenda-se priorizar o agrupamento em Carona Solidária nessa janela.`
          );
        }

        if (quotaAlertVehicles.length > 0) {
          const plates = quotaAlertVehicles
            .slice(0, 5)
            .map((v) => `${v.vehicle.plate} (${v.percent}%)`)
            .join(', ');
          insights.push(
            `4. Alerta de Franquia Contratada (>= ${quotaSettings.alertThresholdPercent}%): ${quotaAlertVehicles.length} veículo(s) da contratada atingiram o limiar preventivo — ${plates}. Recomenda-se redistribuir escalas para placas com menor consumo.`
          );
        } else {
          insights.push(
            `4. Franquia Mensal Contratada: Todos os veículos vinculados às empresas contratadas permaneceram abaixo do limiar preventivo de ${quotaSettings.alertThresholdPercent}% da franquia no período.`
          );
        }

        insights.push(
          `5. Aderência ao Prazo Regimental: ${deadlineRate}% das solicitações foram enviadas dentro do prazo (${inDeadlineCount} no prazo vs. ${outDeadlineCount} fora do prazo).` +
            (worstDeadlineUnit
              ? ` A unidade ${worstDeadlineUnit.unit} concentrou ${worstDeadlineUnit.outDeadline} pedido(s) fora do prazo.`
              : '')
        );

        if (rejectionsSorted.length > 0) {
          const [topReason, topReasonCount] = rejectionsSorted[0];
          insights.push(
            `6. Principal Causa de Indeferimento: "${topReason}" representou ${topReasonCount} de ${rejectedTrips.length} indeferimento(s) (${Math.round((topReasonCount / rejectedTrips.length) * 100)}%).`
          );
        }

        if (realKmTrips.length > 0) {
          insights.push(
            `7. Auditoria KM Previsto × Real: Em ${realKmTrips.length} viagem(ns) com KM real apurado, a variação líquida foi de ${auditDiffKm > 0 ? '+' : ''}${auditDiffKm} km (${auditDiffPct > 0 ? '+' : ''}${auditDiffPct}%), com ${highDeviationTrips.length} viagem(ns) acima de ±15% de desvio.`
          );
        }
      }

      let iy = aiY + 15.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(30, 41, 59);
      insights.forEach((line) => {
        const wrapped = doc.splitTextToSize(line, contentW - 9);
        if (iy + wrapped.length * 4.2 < aiY + aiH - 3) {
          doc.text(wrapped, marginX + 4.5, iy);
          iy += wrapped.length * 4.2 + 3;
        }
      });
    }

    // =========================================================================
    // PÁGINA 2 (A4 RETRATO): OS 3 HEATMAPS OPERACIONAIS (HORAS, FAIXAS E TURNOS)
    // =========================================================================
    if (options.includeHeatmapAndRankings) {
      ensureNewPage();
      drawPageHeader('2. Heatmaps Operacionais de Saídas (Horas, Faixas Operacionais & Turnos)');

      const getHeatColor = (val: number, maxVal: number): [number, number, number] => {
        if (val <= 0 || maxVal <= 0) return [248, 250, 252];
        const ratio = val / maxVal;
        if (ratio >= 0.8) return [225, 29, 72]; // Pico (Rose 600)
        if (ratio >= 0.55) return [249, 115, 22]; // Alto (Orange 500)
        if (ratio >= 0.3) return [250, 204, 21]; // Médio (Yellow 400)
        return [186, 230, 253]; // Baixo (Sky 200)
      };

      // Helper genérico para desenhar qualquer matriz de Heatmap em A4 Retrato
      const drawHeatmapBlock = (params: {
        title: string;
        y: number;
        height: number;
        colLabels: string[];
        matrix: number[][];
        maxVal: number;
        labelColW: number;
        totalColW: number;
        headerFontSize: number;
        cellFontSize: number;
        showLegend?: boolean;
      }) => {
        const {
          title,
          y,
          height,
          colLabels,
          matrix,
          maxVal,
          labelColW,
          totalColW,
          headerFontSize,
          cellFontSize,
          showLegend,
        } = params;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(marginX, y, contentW, height, 2.5, 2.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(title, marginX + 3.5, y + 5.8);

        if (showLegend) {
          const legItems: Array<{ label: string; color: [number, number, number] }> = [
            { label: 'Baixo', color: [186, 230, 253] },
            { label: 'Médio', color: [250, 204, 21] },
            { label: 'Alto', color: [249, 115, 22] },
            { label: 'Pico', color: [225, 29, 72] },
          ];
          let lx = marginX + contentW - 60;
          doc.setFontSize(6.3);
          legItems.forEach((item) => {
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.rect(lx, y + 3, 3, 3, 'F');
            doc.setTextColor(71, 85, 105);
            doc.text(item.label, lx + 3.8, y + 5.5);
            lx += 14.5;
          });
        }

        const innerW = contentW - 7 - labelColW - totalColW;
        const cellW = innerW / colLabels.length;
        const cellH = 7;
        const gridTop = y + 13;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(headerFontSize);
        doc.setTextColor(71, 85, 105);
        colLabels.forEach((col, cIdx) => {
          doc.text(col, marginX + 3.5 + labelColW + cIdx * cellW + cellW / 2, gridTop - 1.8, {
            align: 'center',
          });
        });
        doc.text('Tot.', marginX + 3.5 + labelColW + colLabels.length * cellW + totalColW / 2, gridTop - 1.8, {
          align: 'center',
        });

        const colTotals = Array(colLabels.length).fill(0);
        let grandTotal = 0;

        dayLabels.forEach((day, dIdx) => {
          const cy = gridTop + dIdx * (cellH + 0.8);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.9);
          doc.setTextColor(51, 65, 85);
          doc.text(day.slice(0, 7), marginX + 3.5, cy + 4.8);

          let rowTotal = 0;
          for (let cIdx = 0; cIdx < colLabels.length; cIdx++) {
            const val = matrix[dIdx][cIdx];
            rowTotal += val;
            colTotals[cIdx] += val;
            grandTotal += val;

            const cx = marginX + 3.5 + labelColW + cIdx * cellW;
            const [r, g, b] = getHeatColor(val, maxVal);
            doc.setFillColor(r, g, b);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(cx + 0.35, cy, cellW - 0.7, cellH, 0.9, 0.9, 'FD');

            const isDarkBg = maxVal > 0 && val / maxVal >= 0.55;
            doc.setTextColor(isDarkBg ? 255 : 15, isDarkBg ? 255 : 23, isDarkBg ? 255 : 42);
            doc.setFont('helvetica', val > 0 ? 'bold' : 'normal');
            doc.setFontSize(cellFontSize);
            doc.text(val > 0 ? String(val) : '-', cx + cellW / 2, cy + 4.8, { align: 'center' });
          }

          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.9);
          doc.text(
            String(rowTotal),
            marginX + 3.5 + labelColW + colLabels.length * cellW + totalColW / 2,
            cy + 4.8,
            { align: 'center' }
          );
        });

        // Linha de totais por coluna
        const totY = gridTop + 7 * (cellH + 0.8) + 3.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.4);
        doc.setTextColor(15, 23, 42);
        doc.text('Total', marginX + 3.5, totY);
        colTotals.forEach((ct, cIdx) => {
          const cx = marginX + 3.5 + labelColW + cIdx * cellW;
          doc.text(String(ct), cx + cellW / 2, totY, { align: 'center' });
        });
        doc.text(
          String(grandTotal),
          marginX + 3.5 + labelColW + colLabels.length * cellW + totalColW / 2,
          totY,
          { align: 'center' }
        );
      };

      // 2.1 Heatmap por Horas Cheias (05h às 22h)
      drawHeatmapBlock({
        title: '2.1 Heatmap por Horas Individuais (05h às 22h)',
        y: 33,
        height: 76,
        colLabels: individualHours.map((h) => `${h}h`),
        matrix: heatHours,
        maxVal: maxHeatHour,
        labelColW: 16,
        totalColW: 10,
        headerFontSize: 5.8,
        cellFontSize: 6.1,
        showLegend: true,
      });

      // 2.2 Heatmap por Faixas Operacionais (00-05h .. 18-24h)
      drawHeatmapBlock({
        title: '2.2 Heatmap por Faixas Operacionais de Saída',
        y: 113,
        height: 76,
        colLabels: timeSlotLabels,
        matrix: heatSlots,
        maxVal: maxHeatSlot,
        labelColW: 18,
        totalColW: 12,
        headerFontSize: 6.6,
        cellFontSize: 7.2,
      });

      // 2.3 Heatmap por Turnos Operacionais (Manhã, Tarde, Noite, Madrugada)
      drawHeatmapBlock({
        title: '2.3 Heatmap por Turnos Operacionais da UNILAB',
        y: 193,
        height: 76,
        colLabels: shiftLabels,
        matrix: heatShifts,
        maxVal: maxHeatCell,
        labelColW: 18,
        totalColW: 12,
        headerFontSize: 7,
        cellFontSize: 7.6,
      });

      // =========================================================================
      // PÁGINA 2B (A4 RETRATO): UNIDADES MACRO, FINALIDADE & INDEFERIMENTOS
      // =========================================================================
      doc.addPage();
      drawPageHeader('2.4 Rankings Institucionais — Unidades Macro, Finalidades & Indeferimentos');

      // BLOCO 1: DEMANDA & ADERÊNCIA POR UNIDADE MACRO
      const unitY = 34;
      const unitH = 98;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, unitY, contentW, unitH, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('Demandas & Aderência ao Prazo por Unidade Macro', marginX + 4, unitY + 6.5);

      const unitsToShow = topUnits.slice(0, 10);
      const maxUnitTotal = unitsToShow[0]?.total || 1;
      unitsToShow.forEach((u, idx) => {
        const uy = unitY + 13 + idx * 8.2;
        const pctDeadline = u.total > 0 ? Math.round((u.inDeadline / u.total) * 100) : 0;
        const barMax = contentW - 60;
        const bw = Math.max(2, (u.total / maxUnitTotal) * barMax);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.6);
        doc.setTextColor(15, 23, 42);
        doc.text(u.unit, marginX + 4, uy + 3.8);

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(marginX + 24, uy, barMax, 5, 1.2, 1.2, 'F');
        doc.setFillColor(15, 118, 110);
        doc.roundedRect(marginX + 24, uy, bw, 5, 1.2, 1.2, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.3);
        doc.setTextColor(51, 65, 85);
        doc.text(`${u.total} dem. (${pctDeadline}% no prazo)`, marginX + contentW - 4, uy + 3.8, {
          align: 'right',
        });
      });

      // BLOCO 2: FINALIDADE INSTITUCIONAL (Esq) + MOTIVOS DE INDEFERIMENTO (Dir)
      const botY = unitY + unitH + 6;
      const botH = 120;
      const halfW = (contentW - 4) / 2;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, botY, halfW, botH, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      doc.text('Finalidade Institucional', marginX + 4, botY + 7);

      const maxAct = activitiesSorted[0]?.[1] || 1;
      activitiesSorted.slice(0, 8).forEach(([act, cnt], idx) => {
        const ay = botY + 15 + idx * 12;
        const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
        const barMax = halfW - 10;
        const bw = Math.max(2, (cnt / maxAct) * barMax);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        doc.text(act.slice(0, 26), marginX + 4, ay);
        doc.text(`${cnt} (${pct}%)`, marginX + halfW - 4, ay, { align: 'right' });

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(marginX + 4, ay + 1.8, barMax, 4.8, 1, 1, 'F');
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(marginX + 4, ay + 1.8, bw, 4.8, 1, 1, 'F');
      });

      const rejX = marginX + halfW + 4;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(rejX, botY, halfW, botH, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      doc.text(`Motivos de Indeferimento (${rejectedTrips.length})`, rejX + 4, botY + 7);

      if (rejectionsSorted.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.2);
        doc.setTextColor(5, 150, 105);
        doc.text('Nenhum indeferimento registrado neste período.', rejX + 4, botY + 20);
      } else {
        const maxRej = rejectionsSorted[0][1] || 1;
        rejectionsSorted.slice(0, 7).forEach(([reason, cnt], idx) => {
          const ry = botY + 15 + idx * 13;
          const pct = Math.round((cnt / rejectedTrips.length) * 100);
          const barMax = halfW - 10;
          const bw = Math.max(2, (cnt / maxRej) * barMax);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.3);
          doc.setTextColor(51, 65, 85);
          doc.text(reason.slice(0, 32), rejX + 4, ry);
          doc.text(`${cnt} (${pct}%)`, rejX + halfW - 4, ry, { align: 'right' });

          doc.setFillColor(254, 242, 242);
          doc.roundedRect(rejX + 4, ry + 1.8, barMax, 4.8, 1, 1, 'F');
          doc.setFillColor(225, 29, 72);
          doc.roundedRect(rejX + 4, ry + 1.8, bw, 4.8, 1, 1, 'F');
        });
      }
    }

    // =========================================================================
    // PÁGINA 3 (A4 RETRATO): ANÁLISE DETALHADA POR SETOR / UNIDADE SOLICITANTE
    // =========================================================================
    if (includeSectors) {
      ensureNewPage();
      drawPageHeader('3. Análise Detalhada por Setor / Unidade Solicitante & Maiores Demandantes');

      // Gráfico de Barras — Top 8 Setores Solicitantes
      const secChartY = 34;
      const secChartH = 68;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, secChartY, contentW, secChartH, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `Top Setores / Unidades Solicitantes (${sectorsSorted.length} setores ativos no período)`,
        marginX + 4,
        secChartY + 6.5
      );

      const topSectorsChart = sectorsSorted.slice(0, 7);
      const maxSecTotal = topSectorsChart[0]?.total || 1;
      topSectorsChart.forEach((sec, idx) => {
        const sy = secChartY + 12.5 + idx * 7.6;
        const barX = marginX + 68;
        const barMax = contentW - 102;
        const bw = Math.max(2, (sec.total / maxSecTotal) * barMax);
        const confRate = sec.total > 0 ? Math.round((sec.confirmed / sec.total) * 100) : 0;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.1);
        doc.setTextColor(15, 23, 42);
        const label = `${sec.sector.slice(0, 30)} (${sec.macroUnit})`;
        doc.text(label, marginX + 4, sy + 3.6);

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(barX, sy, barMax, 4.6, 1.2, 1.2, 'F');
        doc.setFillColor(79, 70, 229); // Indigo
        doc.roundedRect(barX, sy, bw, 4.6, 1.2, 1.2, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(`${sec.total} dem. (${confRate}% conf.)`, marginX + contentW - 4, sy + 3.6, {
          align: 'right',
        });
      });

      // Tabela Completa por Setor / Unidade Solicitante
      const secTableStartY = secChartY + secChartH + 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Quadro Consolidado por Setor Solicitante (Demandas, Prazo, KM e Custo)', marginX, secTableStartY);

      autoTable(doc, {
        startY: secTableStartY + 2,
        margin: { left: marginX, right: marginX, bottom: 16 },
        head: [[
          'Setor / Unidade Solicitante',
          'Macro',
          'Dem.',
          'Conf.',
          'Ind./Can.',
          'Prazo',
          'Pax',
          'KM',
          'Custo Est.',
        ]],
        body:
          sectorsSorted.length > 0
            ? sectorsSorted.map((s) => [
                s.sector.length > 34 ? `${s.sector.slice(0, 34)}...` : s.sector,
                s.macroUnit,
                String(s.total),
                `${s.confirmed} (${s.total > 0 ? Math.round((s.confirmed / s.total) * 100) : 0}%)`,
                `${s.rejected}/${s.cancelled}`,
                `${s.total > 0 ? Math.round((s.inDeadline / s.total) * 100) : 0}%`,
                String(s.passengers),
                `${s.km.toFixed(0)}`,
                formatBRL(s.cost),
              ])
            : [['Sem dados de setores no período', '-', '-', '-', '-', '-', '-', '-', '-']],
        styles: { fontSize: 6.9, cellPadding: 1.6 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 52 },
          1: { cellWidth: 16 },
          2: { cellWidth: 11, halign: 'center' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 15, halign: 'center' },
          5: { cellWidth: 13, halign: 'center' },
          6: { cellWidth: 12, halign: 'right' },
          7: { cellWidth: 18, halign: 'right' },
          8: { cellWidth: 29, halign: 'right', fontStyle: 'bold' },
        },
      });

      // Top Solicitantes Nominais (se couber na página atual, senão abre nova página)
      let afterSecY = ((doc as any).lastAutoTable?.finalY || 200) + 7;
      if (topRequesters.length > 0) {
        if (afterSecY > pageH - 65) {
          doc.addPage();
          drawPageHeader('3. Análise por Setor (Continuação) — Top Solicitantes do Período');
          afterSecY = 34;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text('Ranking dos Maiores Solicitantes Nominais no Período', marginX, afterSecY);

        autoTable(doc, {
          startY: afterSecY + 2,
          margin: { left: marginX, right: marginX, bottom: 16 },
          head: [['#', 'Solicitante', 'Setor / Unidade', 'Demandas', 'Confirmadas', 'KM Consolidado']],
          body: topRequesters.map((r, i) => [
            `${i + 1}º`,
            r.name,
            r.sector.slice(0, 38),
            String(r.total),
            String(r.confirmed),
            `${r.km.toFixed(0)} km`,
          ]),
          styles: { fontSize: 7.2, cellPadding: 1.7 },
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
      }
    }

    // =========================================================================
    // PÁGINA 4 (A4 RETRATO): CUSTOS, FRANQUIA CONTRATADA (≥75%) & AUDITORIA KM
    // =========================================================================
    if (options.includeFinancialAndQuota) {
      ensureNewPage();
      drawPageHeader('4. Centro de Custos, Franquia Contratada (>= 75%) & Auditoria de KM');

      const unitCosts = Array.from(costByUnit.values()).sort((a, b) => b.totalCost - a.totalCost);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Centro de Custos Operacionais por Unidade Macro (Viagens Confirmadas)', marginX, 35);

      autoTable(doc, {
        startY: 37,
        margin: { left: marginX, right: marginX, bottom: 16 },
        head: [['Unidade', 'Viagens', 'KM Total', 'Comb. (L)', 'Custo Comb.', 'Manutenção', 'Custo Total']],
        body:
          unitCosts.length > 0
            ? [
                ...unitCosts.map((u) => [
                  u.unit,
                  String(u.trips),
                  `${u.km.toFixed(1)} km`,
                  `${u.liters.toFixed(1)} L`,
                  formatBRL(u.fuelCost),
                  formatBRL(u.maintCost),
                  formatBRL(u.totalCost),
                ]),
                [
                  'TOTAL GERAL',
                  String(confirmedCount),
                  `${totalKmEffective.toFixed(1)} km`,
                  `${totalFuelLiters.toFixed(1)} L`,
                  formatBRL(totalFuelCost),
                  formatBRL(totalMaintCost),
                  formatBRL(totalOperationalCost),
                ],
              ]
            : [['Sem viagens confirmadas no período', '-', '-', '-', '-', '-', '-']],
        styles: { fontSize: 7.3, cellPadding: 1.8 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        didParseCell: (data) => {
          if (unitCosts.length > 0 && data.row.index === unitCosts.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [236, 253, 245];
            data.cell.styles.textColor = [6, 95, 70];
          }
        },
      });

      let afterCostY = ((doc as any).lastAutoTable?.finalY || 110) + 7;
      if (afterCostY > pageH - 85) {
        doc.addPage();
        drawPageHeader('4. Franquia Contratada (>= 75%), Rotas & Auditoria de KM');
        afterCostY = 35;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `Franquia Mensal — Veículos da Contratada (Alerta automático em >= ${quotaSettings.alertThresholdPercent}%)`,
        marginX,
        afterCostY
      );

      autoTable(doc, {
        startY: afterCostY + 2,
        margin: { left: marginX, right: marginX, bottom: 16 },
        head: [['Placa', 'Tipo', 'Contratada', 'Viag.', 'KM Rodado', 'Franquia', 'Uso', 'Situação']],
        body:
          contractedVehicleStats.length > 0
            ? contractedVehicleStats.slice(0, 12).map((s) => [
                s.vehicle.plate,
                s.vehicle.type,
                s.contractorName.slice(0, 26),
                String(s.trips),
                `${s.usedKm} km`,
                `${s.quotaKm} km`,
                `${s.percent}%`,
                s.percent >= 100
                  ? 'EXCEDIDO'
                  : s.percent >= quotaSettings.alertThresholdPercent
                  ? `ALERTA >=${quotaSettings.alertThresholdPercent}%`
                  : 'Normal',
              ])
            : [['Nenhum veículo contratado com rodagem registrada no período', '-', '-', '-', '-', '-', '-', '-']],
        styles: { fontSize: 7.1, cellPadding: 1.7 },
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 7) {
            const txt = String(data.cell.raw || '');
            if (txt.includes('EXCEDIDO')) {
              data.cell.styles.textColor = [190, 18, 60];
              data.cell.styles.fontStyle = 'bold';
            } else if (txt.includes('ALERTA')) {
              data.cell.styles.textColor = [180, 83, 9];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });

      let afterQuotaY = ((doc as any).lastAutoTable?.finalY || 180) + 7;
      if (afterQuotaY > pageH - 58) {
        doc.addPage();
        drawPageHeader('4. Rotas Frequentes, Motoristas & Auditoria KM Previsto × Real');
        afterQuotaY = 35;
      }

      // 2 Cards lado a lado: Top 5 Rotas (Esq) + Top 5 Motoristas (Dir)
      const halfW = (contentW - 4) / 2;
      const boxH = 38;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, afterQuotaY, halfW, boxH, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Top 5 Rotas mais Frequentes', marginX + 3.5, afterQuotaY + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(51, 65, 85);
      if (topRoutes.length === 0) {
        doc.text('Sem viagens confirmadas.', marginX + 3.5, afterQuotaY + 12);
      } else {
        topRoutes.forEach((rt, idx) => {
          doc.text(
            `${idx + 1}. ${rt.route.slice(0, 28)} — ${rt.count}x (${rt.km.toFixed(0)} km)`,
            marginX + 3.5,
            afterQuotaY + 11.5 + idx * 5.2
          );
        });
      }

      const rx = marginX + halfW + 4;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(rx, afterQuotaY, halfW, boxH, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Top 5 Motoristas Escalados', rx + 3.5, afterQuotaY + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(51, 65, 85);
      if (topDrivers.length === 0) {
        doc.text('Sem motoristas alocados.', rx + 3.5, afterQuotaY + 12);
      } else {
        topDrivers.forEach((dr, idx) => {
          doc.text(
            `${idx + 1}. ${dr.name.slice(0, 26)} — ${dr.count}x (${dr.km.toFixed(0)} km)`,
            rx + 3.5,
            afterQuotaY + 11.5 + idx * 5.2
          );
        });
      }

      // Faixa de Auditoria KM Previsto × Real
      const auditBoxY = afterQuotaY + boxH + 4;
      if (auditBoxY < pageH - 28) {
        doc.setFillColor(245, 243, 255);
        doc.setDrawColor(196, 181, 253);
        doc.roundedRect(marginX, auditBoxY, contentW, 18, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(91, 33, 182);
        doc.text('Auditoria de Desvios — KM Previsto × KM Real', marginX + 4, auditBoxY + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(
          `Viagens com KM Real: ${realKmTrips.length}  |  KM Previsto: ${auditEstSum.toFixed(1)} km  |  KM Real: ${auditRealSum.toFixed(1)} km  |  Variação: ${auditDiffKm > 0 ? '+' : ''}${auditDiffKm} km (${auditDiffPct > 0 ? '+' : ''}${auditDiffPct}%)  |  Desvios >= ±15%: ${highDeviationTrips.length}`,
          marginX + 4,
          auditBoxY + 13
        );
      }
    }

    // =========================================================================
    // PÁGINA 5+ (A4 RETRATO): ANEXO OPERACIONAL — GRADE COMPLETA DE PROCESSOS
    // =========================================================================
    if (options.includeProcessTable) {
      ensureNewPage();
      drawPageHeader(`5. Anexo Operacional — Grade Completa de Processos (${trips.length})`);

      const tableData = trips.map((t) => {
        const v = vehicles.find((item) => item.id === t.allocated_vehicle_id);
        const d = drivers.find((item) => item.id === t.allocated_driver_id);
        const saDate = safeFormatDate(t.departure_datetime, 'dd/MM HH:mm', '-');
        const kmLabel =
          t.real_km && t.real_km > 0 ? `${t.real_km} (R)` : `${t.estimated_km} (P)`;

        return [
          t.process_number,
          `${t.macro_unit}\n${(t.requesting_unit || '').slice(0, 14)}`,
          t.requester_name.length > 16 ? `${t.requester_name.slice(0, 16)}...` : t.requester_name,
          `${getCityName(t.origin_city_id)} -> ${getCityName(t.destination_city_id)}`,
          saDate,
          `${t.passenger_count}`,
          kmLabel,
          v ? `${v.plate}\n${d ? d.name.split(' ')[0] : ''}` : 'Pendente',
          t.status.replace(' ao Demandante', '').replace(' pela Unidade Executante', ' (Exec)'),
        ];
      });

      autoTable(doc, {
        startY: 33,
        head: [[
          'Processo SEI',
          'Unid./Setor',
          'Solicitante',
          'Trecho',
          'Saída',
          'Pax',
          'KM',
          'Placa/Mot.',
          'Situação',
        ]],
        body:
          tableData.length > 0
            ? tableData
            : [['Nenhum processo no período', '-', '-', '-', '-', '-', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 6.8, fontStyle: 'bold' },
        styles: { fontSize: 6.4, cellPadding: 1.4, overflow: 'linebreak' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: marginX, right: marginX, bottom: 15 },
        columnStyles: {
          0: { cellWidth: 27 },
          1: { cellWidth: 20 },
          2: { cellWidth: 22 },
          3: { cellWidth: 32 },
          4: { cellWidth: 16 },
          5: { cellWidth: 8, halign: 'center' },
          6: { cellWidth: 14, halign: 'right' },
          7: { cellWidth: 21 },
          8: { cellWidth: 26 },
        },
      });
    }

    // Rodapé oficial em TODAS as páginas ("Página X de Y")
    const totalPages = doc.getNumberOfPages();
    const emittedAt = format(new Date(), 'dd/MM/yyyy HH:mm');
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, pageH - 11, pageW - marginX, pageH - 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `SIG-FROTA UNILAB • PROADI / DIVTRANS — Relatório Executivo (A4) | Emitido em ${emittedAt}`,
        marginX,
        pageH - 6.5
      );
      doc.setFont('helvetica', 'bold');
      doc.text(`Página ${p} de ${totalPages}`, pageW - marginX, pageH - 6.5, { align: 'right' });
    }

    const safePeriod = options.periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`SIG-FROTA_Relatorio_Executivo_A4_${safePeriod}.pdf`);
  }
}
