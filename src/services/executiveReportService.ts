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
        defaultVehicleMonthlyKm: Number(parsed.defaultVehicleMonthlyKm) > 0 ? Number(parsed.defaultVehicleMonthlyKm) : 3000,
        alertThresholdPercent: Number(parsed.alertThresholdPercent) > 0 ? Number(parsed.alertThresholdPercent) : 75,
        vehicleQuotas: parsed.vehicleQuotas && typeof parsed.vehicleQuotas === 'object' ? parsed.vehicleQuotas : {},
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
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    const pageH = 210;
    const marginX = 14;
    const contentW = pageW - marginX * 2; // 269mm

    const cities = DistanceService.getCities();
    const vehicles = FleetService.getVehicles();
    const drivers = FleetService.getDrivers();
    const contractors = FleetService.getContractors();
    const quotaSettings = loadQuotaSettings();

    const getCityName = (id: string) => {
      const c = cities.find((item) => item.id === id);
      return c ? c.name : id;
    };

    const drawPageHeader = (sectionTitle: string) => {
      // Faixa superior Navy + detalhe Esmeralda
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 17, 'F');
      doc.setFillColor(5, 150, 105);
      doc.rect(0, 17, pageW, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(255, 255, 255);
      doc.text('SIG-FROTA UNILAB  |  RELATÓRIO EXECUTIVO DE GESTÃO DE FROTAS (PROADI / DIVTRANS)', marginX, 10.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(167, 243, 208);
      doc.text(`Período: ${options.periodLabel}`, pageW - marginX, 10.5, { align: 'right' });

      // Subtítulo da Seção
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(sectionTitle, marginX, 25);

      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, 27.2, pageW - marginX, 27.2);
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

    // Custos financeiros via CostService
    let totalFuelLiters = 0;
    let totalFuelCost = 0;
    let totalMaintCost = 0;
    let totalTollCost = 0;
    const costByUnit = new Map<
      string,
      { unit: string; trips: number; km: number; liters: number; fuelCost: number; maintCost: number; totalCost: number }
    >();

    confirmedTrips.forEach((t) => {
      const v = vehicles.find((item) => item.id === t.allocated_vehicle_id);
      const breakdown = CostService.calculateTripCost(t, v);
      const toll = Number(t.toll_amount) || 0;
      totalFuelLiters += breakdown.fuelLiters;
      totalFuelCost += breakdown.fuelCost;
      totalMaintCost += breakdown.operationalCost;
      totalTollCost += toll;

      const u = t.macro_unit || 'Outros';
      const cur = costByUnit.get(u) || {
        unit: u,
        trips: 0,
        km: 0,
        liters: 0,
        fuelCost: 0,
        maintCost: 0,
        totalCost: 0,
      };
      cur.trips += 1;
      cur.km += breakdown.km;
      cur.liters += breakdown.fuelLiters;
      cur.fuelCost += breakdown.fuelCost;
      cur.maintCost += breakdown.operationalCost;
      cur.totalCost += breakdown.totalCost + toll;
      costByUnit.set(u, cur);
    });
    const totalOperationalCost = totalFuelCost + totalMaintCost + totalTollCost;

    // Heatmap Dia da Semana (Seg=0..Dom=6) × Faixa de Horário (0: 00-06, 1: 06-12, 2: 12-18, 3: 18-24)
    const dayLabels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const slotLabels = ['Madrugada (00h–06h)', 'Manhã (06h–12h)', 'Tarde (12h–18h)', 'Noite (18h–24h)'];
    const heatmap: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    let maxHeatCell = 0;
    let peakDayIdx = 0;
    let peakSlotIdx = 1;

    trips.forEach((t) => {
      try {
        const d = parseISO(t.departure_datetime);
        if (!isValid(d)) return;
        const jsDay = getDay(d); // 0=Dom, 1=Seg...
        const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
        const h = getHours(d);
        const slotIdx = h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;
        heatmap[dayIdx][slotIdx] += 1;
        if (heatmap[dayIdx][slotIdx] > maxHeatCell) {
          maxHeatCell = heatmap[dayIdx][slotIdx];
          peakDayIdx = dayIdx;
          peakSlotIdx = slotIdx;
        }
      } catch {
        // ignore
      }
    });

    // Unidades Macro (Demanda + Aderência ao prazo)
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
        return { vehicle: v, contractorName: contractor?.name || 'Contratada', trips: vTrips.length, usedKm, quotaKm, percent };
      })
      .filter((s) => s.usedKm > 0)
      .sort((a, b) => b.percent - a.percent || b.usedKm - a.usedKm);

    const quotaAlertVehicles = contractedVehicleStats.filter(
      (s) => s.percent >= quotaSettings.alertThresholdPercent
    );

    // Auditoria KM Previsto × KM Real
    const realKmTrips = confirmedTrips.filter((t) => t.real_km !== undefined && t.real_km !== null && t.real_km > 0);
    const auditEstSum = realKmTrips.reduce((acc, t) => acc + (t.estimated_km || 0), 0);
    const auditRealSum = realKmTrips.reduce((acc, t) => acc + (t.real_km || 0), 0);
    const auditDiffKm = Number((auditRealSum - auditEstSum).toFixed(1));
    const auditDiffPct = auditEstSum > 0 ? Number(((auditDiffKm / auditEstSum) * 100).toFixed(1)) : 0;
    const highDeviationTrips = realKmTrips.filter((t) => {
      const est = t.estimated_km || 0;
      if (est <= 0) return false;
      return Math.abs(((t.real_km! - est) / est) * 100) >= 15;
    });

    // Top 5 Rotas
    const routeMap = new Map<string, { route: string; count: number; km: number }>();
    confirmedTrips.forEach((t) => {
      const label = `${getCityName(t.origin_city_id)} -> ${getCityName(t.destination_city_id)}`;
      const cur = routeMap.get(label) || { route: label, count: 0, km: 0 };
      cur.count += 1;
      cur.km += t.real_km && t.real_km > 0 ? t.real_km : t.estimated_km || 0;
      routeMap.set(label, cur);
    });
    const topRoutes = Array.from(routeMap.values())
      .sort((a, b) => b.count - a.count || b.km - a.km)
      .slice(0, 5);

    let hasStartedPages = false;
    const ensureNewPage = () => {
      if (hasStartedPages) {
        doc.addPage();
      }
      hasStartedPages = true;
    };

    // =========================================================================
    // PÁGINA 1: SUMÁRIO EXECUTIVO + ANÁLISE INTELIGENTE + DISTRIBUIÇÃO STATUS
    // =========================================================================
    if (options.includeExecutiveSummary) {
      ensureNewPage();
      drawPageHeader('1. Sumário Executivo, Indicadores-Chave (KPIs) & Análise Inteligente');

      // 6 KPI Cards (3 colunas x 2 linhas)
      const cardW = (contentW - 8) / 3; // ~87mm
      const cardH = 22;
      const kpis = [
        {
          label: 'TOTAL DE DEMANDAS',
          value: `${total} processos`,
          sub: `${confirmedCount} confirmadas (${attendanceRate}% de atendimento)`,
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
          label: 'ADERÊNCIA AO PRAZO',
          value: `${deadlineRate}% no prazo`,
          sub: `${inDeadlineCount} dentro do prazo • ${outDeadlineCount} fora do prazo`,
          accent: [217, 119, 6] as [number, number, number],
        },
        {
          label: 'INDEFERIMENTOS & CANCELAMENTOS',
          value: `${rejectedTrips.length} indef. | ${cancelledTrips.length} cancel.`,
          sub: `${pendingTrips.length} pendente(s) de análise no período`,
          accent: [225, 29, 72] as [number, number, number],
        },
      ];

      kpis.forEach((k, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = marginX + col * (cardW + 4);
        const y = 31 + row * (cardH + 4);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');

        doc.setFillColor(k.accent[0], k.accent[1], k.accent[2]);
        doc.rect(x, y + 2, 2, cardH - 4, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(100, 116, 139);
        doc.text(k.label, x + 5, y + 6);

        doc.setFontSize(12.5);
        doc.setTextColor(15, 23, 42);
        doc.text(k.value, x + 5, y + 13.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(71, 85, 105);
        doc.text(k.sub, x + 5, y + 19);
      });

      // Gráfico de Barras Horizontais: Distribuição por Status (Esquerda) + Análise Inteligente (Direita)
      const splitY = 84;
      const leftW = 108;
      const rightX = marginX + leftW + 6;
      const rightW = contentW - leftW - 6;

      // Esquerda: Distribuição por Status
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, splitY, leftW, 106, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('Distribuição das Solicitações por Situação', marginX + 4, splitY + 7);

      const statusBars = [
        { label: 'Confirmado ao Demandante', count: confirmedCount, color: [5, 150, 105] as [number, number, number] },
        { label: 'Pendente de Análise', count: pendingTrips.length, color: [245, 158, 11] as [number, number, number] },
        { label: 'Indeferido', count: rejectedTrips.length, color: [225, 29, 72] as [number, number, number] },
        { label: 'Cancelado (Dem./Exec.)', count: cancelledTrips.length, color: [100, 116, 139] as [number, number, number] },
        { label: 'Alterado Data Demanda', count: alteredTrips.length, color: [59, 130, 246] as [number, number, number] },
      ];

      statusBars.forEach((bar, idx) => {
        const by = splitY + 16 + idx * 17;
        const pct = total > 0 ? Math.round((bar.count / total) * 100) : 0;
        const barMaxW = leftW - 12;
        const barW = total > 0 ? Math.max(1.5, (bar.count / total) * barMaxW) : 0;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(51, 65, 85);
        doc.text(bar.label, marginX + 5, by);
        doc.text(`${bar.count} (${pct}%)`, marginX + leftW - 5, by, { align: 'right' });

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(marginX + 5, by + 2.2, barMaxW, 5.5, 1.5, 1.5, 'F');
        if (bar.count > 0) {
          doc.setFillColor(bar.color[0], bar.color[1], bar.color[2]);
          doc.roundedRect(marginX + 5, by + 2.2, barW, 5.5, 1.5, 1.5, 'F');
        }
      });

      // Direita: Bloco de Análise Inteligente Automática
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(148, 163, 184);
      doc.roundedRect(rightX, splitY, rightW, 106, 2.5, 2.5, 'FD');

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(rightX, splitY, rightW, 9, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('ANÁLISE INTELIGENTE & DIAGNÓSTICO GERENCIAL AUTOMÁTICO', rightX + 4, splitY + 6);

      const insights: string[] = [];
      if (total === 0) {
        insights.push('Nenhuma solicitação registrada no período selecionado para geração de diagnóstico.');
      } else {
        const attendanceEval =
          attendanceRate >= 80
            ? 'desempenho excelente de atendimento'
            : attendanceRate >= 60
            ? 'nível moderado de atendimento (recomenda-se revisar gargalos)'
            : 'nível crítico de atendimento (alta taxa de não atendimento)';
        const topUnit = topUnits[0];
        insights.push(
          `1. Eficiência de Atendimento: A taxa de confirmação foi de ${attendanceRate}% (${confirmedCount} de ${total} demandas), indicando ${attendanceEval}.` +
            (topUnit
              ? ` A unidade macro com maior volume foi ${topUnit.unit}, concentrando ${topUnit.total} solicitações (${Math.round((topUnit.total / total) * 100)}% do total).`
              : '')
        );

        if (maxHeatCell > 0) {
          insights.push(
            `2. Pico Operacional (Gargalo de Frota): O maior congestionamento de saídas ocorreu às ${dayLabels[peakDayIdx]}s no turno ${slotLabels[peakSlotIdx]} (${maxHeatCell} viagens). Recomenda-se priorizar o agrupamento em Carona Solidária nessa janela.`
          );
        }

        if (quotaAlertVehicles.length > 0) {
          const plates = quotaAlertVehicles
            .slice(0, 4)
            .map((v) => `${v.vehicle.plate} (${v.percent}%)`)
            .join(', ');
          insights.push(
            `3. Alerta de Franquia Contratada (>= ${quotaSettings.alertThresholdPercent}%): ${quotaAlertVehicles.length} veículo(s) da contratada atingiram o limiar preventivo — destaque para ${plates}. Recomenda-se redistribuir escalas para placas com menor consumo.`
          );
        } else {
          insights.push(
            `3. Franquia Mensal Contratada: Todos os veículos vinculados às empresas contratadas permaneceram abaixo do limiar preventivo de ${quotaSettings.alertThresholdPercent}% da franquia no período.`
          );
        }

        insights.push(
          `4. Aderência ao Prazo Regimental: ${deadlineRate}% das demandas foram protocoladas dentro do prazo (${inDeadlineCount} no prazo vs. ${outDeadlineCount} fora do prazo).` +
            (worstDeadlineUnit
              ? ` A unidade ${worstDeadlineUnit.unit} concentrou o maior número de pedidos fora do prazo (${worstDeadlineUnit.outDeadline}), sugerindo ação educativa junto às chefias.`
              : '')
        );

        if (rejectionsSorted.length > 0) {
          const [topReason, topReasonCount] = rejectionsSorted[0];
          insights.push(
            `5. Principal Causa de Indeferimento: "${topReason}" representou ${topReasonCount} de ${rejectedTrips.length} indeferimento(s) (${Math.round((topReasonCount / rejectedTrips.length) * 100)}%).`
          );
        }

        if (realKmTrips.length > 0) {
          insights.push(
            `6. Auditoria KM Previsto x Real: Em ${realKmTrips.length} viagem(ns) com KM real apurado, a variação líquida foi de ${auditDiffKm > 0 ? '+' : ''}${auditDiffKm} km (${auditDiffPct > 0 ? '+' : ''}${auditDiffPct}%), com ${highDeviationTrips.length} viagem(ns) acima de ±15% de desvio.`
          );
        }
      }

      let iy = splitY + 15;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.1);
      doc.setTextColor(30, 41, 59);
      insights.forEach((line) => {
        const wrapped = doc.splitTextToSize(line, rightW - 9);
        if (iy + wrapped.length * 4.1 < splitY + 103) {
          doc.text(wrapped, rightX + 4.5, iy);
          iy += wrapped.length * 4.1 + 3.2;
        }
      });
    }

    // =========================================================================
    // PÁGINA 2: HEATMAP OPERACIONAL + UNIDADES MACRO + FINALIDADE & INDEFERIMENTOS
    // =========================================================================
    if (options.includeHeatmapAndRankings) {
      ensureNewPage();
      drawPageHeader('2. Heatmap Operacional (Dia × Turno), Unidades Macro & Indeferimentos');

      // BLOCO SUPERIOR ESQUERDO: HEATMAP VETORIAL COLORIDO
      const heatX = marginX;
      const heatY = 31;
      const heatW = 148;
      const heatH = 82;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(heatX, heatY, heatW, heatH, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      doc.text('Heatmap de Saídas (Dia da Semana × Turno)', heatX + 4, heatY + 6.5);

      const labelColW = 24;
      const totalColW = 16;
      const cellW = (heatW - 8 - labelColW - totalColW) / 4;
      const cellH = 8.2;
      const gridTop = heatY + 15;

      // Cabeçalhos de turno
      doc.setFontSize(6.6);
      doc.setTextColor(71, 85, 105);
      ['00h–06h', '06h–12h', '12h–18h', '18h–24h'].forEach((sl, sIdx) => {
        doc.text(sl, heatX + 4 + labelColW + sIdx * cellW + cellW / 2, gridTop - 2, { align: 'center' });
      });
      doc.text('Total', heatX + 4 + labelColW + 4 * cellW + totalColW / 2, gridTop - 2, { align: 'center' });

      const getHeatColor = (val: number): [number, number, number] => {
        if (val <= 0 || maxHeatCell <= 0) return [248, 250, 252];
        const ratio = val / maxHeatCell;
        if (ratio >= 0.8) return [225, 29, 72]; // Rose 600
        if (ratio >= 0.55) return [249, 115, 22]; // Orange 500
        if (ratio >= 0.3) return [250, 204, 21]; // Yellow 400
        return [186, 230, 253]; // Sky 200
      };

      dayLabels.forEach((day, dIdx) => {
        const cy = gridTop + dIdx * (cellH + 1);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(51, 65, 85);
        doc.text(day, heatX + 4, cy + 5.5);

        let rowTotal = 0;
        for (let sIdx = 0; sIdx < 4; sIdx++) {
          const val = heatmap[dIdx][sIdx];
          rowTotal += val;
          const cx = heatX + 4 + labelColW + sIdx * cellW;
          const [r, g, b] = getHeatColor(val);
          doc.setFillColor(r, g, b);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(cx + 0.5, cy, cellW - 1, cellH, 1.2, 1.2, 'FD');

          const isDarkBg = maxHeatCell > 0 && val / maxHeatCell >= 0.55;
          doc.setTextColor(isDarkBg ? 255 : 15, isDarkBg ? 255 : 23, isDarkBg ? 255 : 42);
          doc.setFont('helvetica', val > 0 ? 'bold' : 'normal');
          doc.setFontSize(7.5);
          doc.text(val > 0 ? String(val) : '-', cx + cellW / 2, cy + 5.5, { align: 'center' });
        }

        // Total da linha
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(String(rowTotal), heatX + 4 + labelColW + 4 * cellW + totalColW / 2, cy + 5.5, {
          align: 'center',
        });
      });

      // BLOCO SUPERIOR DIREITO: TOP UNIDADES MACRO (Gráfico de Barras)
      const unitX = heatX + heatW + 5;
      const unitW = contentW - heatW - 5;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(unitX, heatY, unitW, heatH, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      doc.text('Demandas & Aderência por Unidade Macro', unitX + 4, heatY + 6.5);

      const unitsToShow = topUnits.slice(0, 7);
      const maxUnitTotal = unitsToShow[0]?.total || 1;
      unitsToShow.forEach((u, idx) => {
        const uy = heatY + 14 + idx * 9.5;
        const pctDeadline = u.total > 0 ? Math.round((u.inDeadline / u.total) * 100) : 0;
        const barMax = unitW - 44;
        const bw = Math.max(2, (u.total / maxUnitTotal) * barMax);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.3);
        doc.setTextColor(15, 23, 42);
        doc.text(u.unit, unitX + 4, uy + 3.8);

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(unitX + 20, uy, barMax, 5, 1.2, 1.2, 'F');
        doc.setFillColor(15, 118, 110);
        doc.roundedRect(unitX + 20, uy, bw, 5, 1.2, 1.2, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(51, 65, 85);
        doc.text(`${u.total} (${pctDeadline}% pr.)`, unitX + unitW - 3, uy + 3.8, { align: 'right' });
      });

      // BLOCO INFERIOR: FINALIDADE INSTITUCIONAL (Esq) + MOTIVOS DE INDEFERIMENTO (Dir)
      const bottomY = heatY + heatH + 5;
      const bottomH = 72;
      const halfW = (contentW - 5) / 2;

      // Finalidades
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, bottomY, halfW, bottomH, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      doc.text('Finalidade Institucional das Viagens', marginX + 4, bottomY + 6.5);

      const maxAct = activitiesSorted[0]?.[1] || 1;
      activitiesSorted.slice(0, 6).forEach(([act, cnt], idx) => {
        const ay = bottomY + 14 + idx * 9.5;
        const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
        const barMax = halfW - 56;
        const bw = Math.max(2, (cnt / maxAct) * barMax);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.4);
        doc.setTextColor(51, 65, 85);
        doc.text(act.slice(0, 20), marginX + 4, ay + 3.8);

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(marginX + 36, ay, barMax, 5, 1.2, 1.2, 'F');
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(marginX + 36, ay, bw, 5, 1.2, 1.2, 'F');

        doc.text(`${cnt} (${pct}%)`, marginX + halfW - 4, ay + 3.8, { align: 'right' });
      });

      // Motivos de Indeferimento
      const rejX = marginX + halfW + 5;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(rejX, bottomY, halfW, bottomH, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      doc.text(`Motivos de Indeferimento (${rejectedTrips.length})`, rejX + 4, bottomY + 6.5);

      if (rejectionsSorted.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.2);
        doc.setTextColor(5, 150, 105);
        doc.text('Nenhum indeferimento registrado neste período.', rejX + 4, bottomY + 20);
      } else {
        const maxRej = rejectionsSorted[0][1] || 1;
        rejectionsSorted.slice(0, 5).forEach(([reason, cnt], idx) => {
          const ry = bottomY + 14 + idx * 10.5;
          const pct = Math.round((cnt / rejectedTrips.length) * 100);
          const barMax = halfW - 12;
          const bw = Math.max(2, (cnt / maxRej) * barMax);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.2);
          doc.setTextColor(51, 65, 85);
          doc.text(reason.slice(0, 48), rejX + 4, ry);
          doc.text(`${cnt} (${pct}%)`, rejX + halfW - 4, ry, { align: 'right' });

          doc.setFillColor(254, 242, 242);
          doc.roundedRect(rejX + 4, ry + 1.8, barMax, 4.5, 1.2, 1.2, 'F');
          doc.setFillColor(225, 29, 72);
          doc.roundedRect(rejX + 4, ry + 1.8, bw, 4.5, 1.2, 1.2, 'F');
        });
      }
    }

    // =========================================================================
    // PÁGINA 3: FINANCEIRO, FRANQUIA CONTRATADA (≥75%) & AUDITORIA DE KM
    // =========================================================================
    if (options.includeFinancialAndQuota) {
      ensureNewPage();
      drawPageHeader('3. Centro de Custos, Franquia Contratada (Alerta >= 75%) & Auditoria de KM');

      // Tabela 1: Centro de Custos por Unidade Macro
      const unitCosts = Array.from(costByUnit.values()).sort((a, b) => b.totalCost - a.totalCost);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Centro de Custos Operacionais por Unidade Macro (Viagens Confirmadas)', marginX, 32);

      autoTable(doc, {
        startY: 34,
        margin: { left: marginX, right: marginX },
        head: [['Unidade Macro', 'Viagens', 'KM Total', 'Combustível (L)', 'Custo Combustível', 'Manutenção', 'Custo Total']],
        body:
          unitCosts.length > 0
            ? [
                ...unitCosts.slice(0, 8).map((u) => [
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
        styles: { fontSize: 7.4, cellPadding: 1.8 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        didParseCell: (data) => {
          if (unitCosts.length > 0 && data.row.index === Math.min(unitCosts.length, 8)) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [236, 253, 245];
            data.cell.styles.textColor = [6, 95, 70];
          }
        },
      });

      const afterCostY = ((doc as any).lastAutoTable?.finalY || 90) + 7;

      // Tabela 2: Franquia Mensal dos Veículos da Contratada
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `Franquia de KM — Veículos da Contratada (Limiar de Alerta: ${quotaSettings.alertThresholdPercent}%)`,
        marginX,
        afterCostY
      );

      autoTable(doc, {
        startY: afterCostY + 2,
        margin: { left: marginX, right: marginX },
        head: [['Placa', 'Tipo / Modelo', 'Contratada', 'Viagens', 'KM Rodado', 'Franquia', 'Utilização', 'Situação']],
        body:
          contractedVehicleStats.length > 0
            ? contractedVehicleStats.slice(0, 8).map((s) => [
                s.vehicle.plate,
                s.vehicle.type,
                s.contractorName.slice(0, 34),
                String(s.trips),
                `${s.usedKm} km`,
                `${s.quotaKm} km`,
                `${s.percent}%`,
                s.percent >= 100
                  ? 'EXCEDIDO'
                  : s.percent >= quotaSettings.alertThresholdPercent
                  ? `ALERTA (>=${quotaSettings.alertThresholdPercent}%)`
                  : 'Normal',
              ])
            : [['Nenhum veículo contratado com rodagem registrada no período', '-', '-', '-', '-', '-', '-', '-']],
        styles: { fontSize: 7.3, cellPadding: 1.7 },
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

      const afterQuotaY = ((doc as any).lastAutoTable?.finalY || 145) + 6;
      if (afterQuotaY < pageH - 28) {
        // Resumo rápido: Top Rotas (Esq) + Auditoria KM Real (Dir)
        const boxH = Math.min(34, pageH - afterQuotaY - 12);
        const halfW = (contentW - 5) / 2;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(marginX, afterQuotaY, halfW, boxH, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text('Top Rotas mais Frequentes', marginX + 3.5, afterQuotaY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(51, 65, 85);
        topRoutes.slice(0, 4).forEach((rt, idx) => {
          doc.text(
            `${idx + 1}. ${rt.route} — ${rt.count} viagem(ns) (${rt.km.toFixed(0)} km)`,
            marginX + 3.5,
            afterQuotaY + 11 + idx * 5
          );
        });

        const rx = marginX + halfW + 5;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(rx, afterQuotaY, halfW, boxH, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text('Auditoria de Desvios (KM Previsto × KM Real)', rx + 3.5, afterQuotaY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.4);
        doc.setTextColor(51, 65, 85);
        doc.text(`Viagens com KM Real lançado: ${realKmTrips.length}`, rx + 3.5, afterQuotaY + 11.5);
        doc.text(
          `KM Previsto: ${auditEstSum.toFixed(1)} km  |  KM Real: ${auditRealSum.toFixed(1)} km`,
          rx + 3.5,
          afterQuotaY + 17
        );
        doc.text(
          `Variação Líquida: ${auditDiffKm > 0 ? '+' : ''}${auditDiffKm} km (${auditDiffPct > 0 ? '+' : ''}${auditDiffPct}%)  |  Desvios >= ±15%: ${highDeviationTrips.length}`,
          rx + 3.5,
          afterQuotaY + 22.5
        );
      }
    }

    // =========================================================================
    // PÁGINA 4+: ANEXO OPERACIONAL — LISTAGEM COMPLETA DE PROCESSOS
    // =========================================================================
    if (options.includeProcessTable) {
      ensureNewPage();
      drawPageHeader(`4. Anexo Operacional — Grade Completa de Processos (${trips.length})`);

      const tableData = trips.map((t) => {
        const v = vehicles.find((item) => item.id === t.allocated_vehicle_id);
        const d = drivers.find((item) => item.id === t.allocated_driver_id);
        const saDate = safeFormatDate(t.departure_datetime, 'dd/MM HH:mm', '-');
        const kmLabel =
          t.real_km && t.real_km > 0 ? `${t.real_km} km (R)` : `${t.estimated_km} km (P)`;

        return [
          t.process_number,
          t.macro_unit,
          t.requester_name.length > 20 ? `${t.requester_name.substring(0, 20)}...` : t.requester_name,
          `${getCityName(t.origin_city_id)} -> ${getCityName(t.destination_city_id)}`,
          saDate,
          `${t.passenger_count}`,
          kmLabel,
          v ? `${v.plate} (${v.type})` : 'Pendente',
          d ? `${d.name.split(' ')[0]} ${d.name.split(' ')[1] || ''}`.trim() : 'Pendente',
          t.status.replace(' ao Demandante', '').replace(' pela Unidade Executante', ' (Exec)'),
        ];
      });

      autoTable(doc, {
        startY: 31,
        head: [[
          'Nº Processo',
          'Unid.',
          'Solicitante',
          'Trecho',
          'Saída',
          'Pax',
          'KM (R/P)',
          'Veículo',
          'Motorista',
          'Situação',
        ]],
        body: tableData.length > 0 ? tableData : [['Nenhum processo no período', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
        styles: { fontSize: 7.1, cellPadding: 1.8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: marginX, right: marginX, bottom: 14 },
      });
    }

    // Rodapé institucional em TODAS as páginas ("Página X de Y")
    const totalPages = doc.getNumberOfPages();
    const emittedAt = format(new Date(), 'dd/MM/yyyy HH:mm');
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, pageH - 10, pageW - marginX, pageH - 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `SIG-FROTA UNILAB • PROADI / DIVTRANS — Relatório Executivo de Gestão de Frotas | Emitido em ${emittedAt}`,
        marginX,
        pageH - 6
      );
      doc.setFont('helvetica', 'bold');
      doc.text(`Página ${p} de ${totalPages}`, pageW - marginX, pageH - 6, { align: 'right' });
    }

    const safePeriod = options.periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`SIG-FROTA_Relatorio_Executivo_${safePeriod}.pdf`);
  }
}
