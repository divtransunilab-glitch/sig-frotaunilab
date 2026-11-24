import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { TripRequest } from '../../types';
import { DistanceService } from '../../services/distanceService';
import { FleetService } from '../../services/fleetService';
import { safeFormatDate } from '../../utils/dateUtils';
import { parsePassengerList } from '../../utils/textUtils';
import {
  X,
  Printer,
  Download,
  FileCheck2,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface TravelReportDocumentModalProps {
  trip: TripRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

const escapeHtml = (value?: string | number | null): string => {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

export const TravelReportDocumentModal: React.FC<TravelReportDocumentModalProps> = ({
  trip,
  isOpen,
  onClose,
}) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  if (!isOpen || !trip) return null;

  const cities = DistanceService.getCities();
  const vehicle = FleetService.getVehicleById(trip.allocated_vehicle_id);
  const driver = FleetService.getDriverById(trip.allocated_driver_id);
  const contractor = FleetService.getContractorById(trip.allocated_contractor_id);

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? `${c.name} - ${c.state}` : id;
  };

  const parsedPassengers = parsePassengerList(trip.passenger_names, trip.passenger_list);
  const passengerCols = parsedPassengers.length > 20 ? '1fr 1fr 1fr' : '1fr 1fr';
  const passengerFontSize = parsedPassengers.length > 20 ? '8.5px' : '9.5px';

  const depScheduled = safeFormatDate(trip.departure_datetime, "dd/MM/yyyy 'às' HH:mm", '-');
  const retScheduled = safeFormatDate(trip.return_datetime, "dd/MM/yyyy 'às' HH:mm", '-');
  const checkinReal = safeFormatDate(trip.driver_checkin_at, "dd/MM/yyyy 'às' HH:mm", 'Não registrado');
  const checkoutReal = safeFormatDate(
    trip.driver_checkout_at || trip.report_submitted_at,
    "dd/MM/yyyy 'às' HH:mm",
    'Não registrado'
  );
  const approvedAt = safeFormatDate(trip.report_approved_at, "dd/MM/yyyy 'às' HH:mm", 'Pendente');

  const estimatedKm = trip.estimated_km ?? 0;
  const realKm = trip.real_km ?? null;
  const kmDiff = realKm !== null ? Number((realKm - estimatedKm).toFixed(1)) : null;
  const kmDiffLabel =
    kmDiff === null
      ? '-'
      : `${kmDiff > 0 ? '+' : ''}${kmDiff} km${
          estimatedKm > 0 ? ` (${((kmDiff / estimatedKm) * 100).toFixed(1)}%)` : ''
        }`;

  const intermediateNames = (trip.intermediate_cities || []).map((c) => getCityName(c));

  const passengerHTML =
    parsedPassengers.length > 0
      ? `<div style="display: grid; grid-template-columns: ${passengerCols}; gap: 3px 12px; margin-top: 4px; font-size: ${passengerFontSize}; color: #0f172a;">
          ${parsedPassengers
            .map(
              (p) =>
                `<div style="padding: 2px 0; border-bottom: 1px dotted #cbd5e1;">&#10003; ${escapeHtml(p)}</div>`
            )
            .join('')}
        </div>`
      : `<div style="color: #475569; font-size: 10px; margin-top: 4px;">Comitiva institucional de <strong>${trip.passenger_count}</strong> passageiro(s) sob responsabilidade de <strong>${escapeHtml(trip.requester_name)}</strong> (lista nominal não informada no processo).</div>`;

  const isFinalized = trip.travel_report_status === 'Finalizado no Sistema';
  const statusBg = isFinalized ? '#ecfdf5' : '#f5f3ff';
  const statusColor = isFinalized ? '#047857' : '#6d28d9';
  const statusBorder = isFinalized ? '#a7f3d0' : '#ddd6fe';

  const generateReportHTML = () => `
    <div style="width: 760px; background-color: #ffffff; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; box-sizing: border-box; line-height: 1.38;">

      <!-- Cabeçalho Institucional -->
      <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
          UNIVERSIDADE DA INTEGRAÇÃO INTERNACIONAL DA LUSOFONIA AFRO-BRASILEIRA
        </div>
        <div style="font-size: 10.5px; font-weight: 700; color: #334155; text-transform: uppercase; margin-top: 3px;">
          PRÓ-REITORIA DE ADMINISTRAÇÃO E PLANEJAMENTO • PROADI | DIVISÃO DE TRANSPORTE • DIVTRANS
        </div>
        <div style="font-size: 9.5px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
          SISTEMA INTEGRADO DE GESTÃO DE FROTAS (SIG-FROTA) • RELATÓRIO CONSOLIDADO DE VIAGEM
        </div>
      </div>

      <!-- Banner do Relatório -->
      <table style="width: 100%; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px;">
        <tr>
          <td style="vertical-align: middle;">
            <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Prestação de Contas & Encerramento:</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a;">RELATÓRIO DE VIAGEM — PROCESSO SEI ${escapeHtml(trip.process_number)}</div>
          </td>
          <td style="text-align: right; vertical-align: middle; font-size: 10px; white-space: nowrap;">
            <span style="display: inline-block; background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; border-radius: 4px; padding: 2px 8px; font-weight: 800; font-size: 9.5px; text-transform: uppercase;">
              ${escapeHtml(trip.travel_report_status || 'Relatório')}
            </span>
            <div style="color: #64748b; margin-top: 3px;">Emitido em: <strong style="color: #0f172a;">${format(new Date(), 'dd/MM/yyyy HH:mm')}</strong></div>
          </td>
        </tr>
      </table>

      <!-- 1. Dados da Viagem e Solicitante -->
      <div style="margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          1. Identificação da Viagem & Itinerário
        </div>
        <table style="width: 100%; background-color: #f8fafc; font-size: 10.5px; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 8px; width: 50%;"><span style="color: #64748b; font-weight: 600;">Solicitante:</span> <strong style="color: #0f172a;">${escapeHtml(trip.requester_name)}</strong></td>
            <td style="padding: 5px 8px; width: 50%;"><span style="color: #64748b; font-weight: 600;">Unidade:</span> <strong style="color: #0f172a;">${escapeHtml(trip.requesting_unit)} (${escapeHtml(trip.macro_unit)})</strong></td>
          </tr>
          <tr>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Tipo de Atividade:</span> <span style="color: #334155;">${escapeHtml(trip.activity_type)}</span></td>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Lotação Solicitada:</span> <strong style="color: #0f172a;">${trip.passenger_count} passageiro(s)</strong></td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0; background-color: #ffffff;">
            <td colspan="2" style="padding: 6px 8px;">
              <span style="color: #64748b; font-weight: 700; font-size: 9px; text-transform: uppercase;">Trajeto:</span>
              &nbsp;<strong style="color: #0f172a;">${escapeHtml(getCityName(trip.origin_city_id))}</strong>
              ${
                intermediateNames.length > 0
                  ? ` &nbsp;<span style="color: #2563eb; font-weight: bold;">➔</span>&nbsp; <span style="color: #334155; font-weight: 600;">${escapeHtml(intermediateNames.join(' ➔ '))}</span>`
                  : ''
              }
              &nbsp;<span style="color: #2563eb; font-weight: bold;">➔</span>&nbsp;
              <strong style="color: #0f172a;">${escapeHtml(getCityName(trip.destination_city_id))}</strong>
            </td>
          </tr>
          ${
            trip.origin_address || trip.destination_address
              ? `<tr style="border-top: 1px solid #e2e8f0;">
                  <td style="padding: 4px 8px;"><span style="color: #64748b; font-weight: 600;">Embarque:</span> <span style="color: #0f172a;">${escapeHtml(trip.origin_address || 'Campus UNILAB')}</span></td>
                  <td style="padding: 4px 8px;"><span style="color: #64748b; font-weight: 600;">Desembarque:</span> <span style="color: #0f172a;">${escapeHtml(trip.destination_address || 'Conforme itinerário')}</span></td>
                </tr>`
              : ''
          }
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Saída Prevista:</span> <span style="color: #334155;">${depScheduled}</span></td>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Retorno Previsto:</span> <span style="color: #334155;">${retScheduled}</span></td>
          </tr>
          <tr>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Check-in Real (Saída):</span> <strong style="color: #065f46;">${checkinReal}</strong></td>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Check-out Real (Retorno):</span> <strong style="color: #065f46;">${checkoutReal}</strong></td>
          </tr>
          ${
            trip.trip_objective
              ? `<tr style="border-top: 1px solid #e2e8f0;">
                  <td colspan="2" style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Finalidade / Objetivo:</span> <span style="color: #334155;">${escapeHtml(trip.trip_objective)}</span></td>
                </tr>`
              : ''
          }
        </table>
      </div>

      <!-- 2. Recursos Alocados -->
      <div style="margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          2. Veículo, Motorista & Contratada
        </div>
        <table style="width: 100%; background-color: #f8fafc; font-size: 10.5px; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 8px; width: 50%;"><span style="color: #64748b; font-weight: 600;">Veículo:</span> <strong style="color: #0f172a;">${escapeHtml(vehicle ? vehicle.model : 'Não informado')}</strong></td>
            <td style="padding: 5px 8px; width: 50%;"><span style="color: #64748b; font-weight: 600;">Placa:</span> <strong style="font-family: monospace; color: #0f172a; background: #ffffff; border: 1px solid #cbd5e1; padding: 1px 6px; border-radius: 4px;">${escapeHtml(vehicle ? vehicle.plate : 'A definir')}</strong></td>
          </tr>
          <tr>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Motorista:</span> <strong style="color: #0f172a;">${escapeHtml(driver ? driver.name : trip.allocated_driver_id || 'Não informado')}</strong></td>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Empresa / Contratada:</span> <span style="color: #334155;">${escapeHtml(contractor ? contractor.name : 'Frota Oficial / Terceirizada')}</span></td>
          </tr>
        </table>
      </div>

      <!-- 3. Apuração de Quilometragem e Despesas -->
      <div style="margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #047857; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          3. Apuração de Quilometragem (KM) & Despesas de Viagem
        </div>
        <table style="width: 100%; background-color: #ffffff; font-size: 10.5px; border-collapse: collapse; text-align: center;">
          <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase;">
            <td style="padding: 5px 6px; border-right: 1px solid #e2e8f0;">KM Previsto</td>
            <td style="padding: 5px 6px; border-right: 1px solid #e2e8f0;">Hodômetro Saída</td>
            <td style="padding: 5px 6px; border-right: 1px solid #e2e8f0;">Hodômetro Chegada</td>
            <td style="padding: 5px 6px; border-right: 1px solid #e2e8f0;">KM Real Percorrido</td>
            <td style="padding: 5px 6px;">Variação</td>
          </tr>
          <tr style="font-size: 12px; font-weight: 800; color: #0f172a;">
            <td style="padding: 8px 6px; border-right: 1px solid #e2e8f0;">${estimatedKm} km</td>
            <td style="padding: 8px 6px; border-right: 1px solid #e2e8f0;">${trip.odometer_start !== undefined && trip.odometer_start !== null ? `${trip.odometer_start} km` : '-'}</td>
            <td style="padding: 8px 6px; border-right: 1px solid #e2e8f0;">${trip.odometer_end !== undefined && trip.odometer_end !== null ? `${trip.odometer_end} km` : '-'}</td>
            <td style="padding: 8px 6px; border-right: 1px solid #e2e8f0; color: #047857; background-color: #ecfdf5;">${realKm !== null ? `${realKm} km` : '-'}</td>
            <td style="padding: 8px 6px; font-size: 10.5px; color: #334155;">${kmDiffLabel}</td>
          </tr>
        </table>
        <table style="width: 100%; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 10.5px; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 8px; width: 33%;"><span style="color: #64748b; font-weight: 600;">Combustível:</span> <strong style="color: #0f172a;">${trip.fuel_liters ? `${trip.fuel_liters} L` : 'Não informado'}</strong></td>
            <td style="padding: 5px 8px; width: 33%;"><span style="color: #64748b; font-weight: 600;">Pedágio / Taxas:</span> <strong style="color: #0f172a;">${trip.toll_amount ? `R$ ${trip.toll_amount.toFixed(2)}` : 'R$ 0,00'}</strong></td>
            <td style="padding: 5px 8px; width: 34%;"><span style="color: #64748b; font-weight: 600;">Homologado em:</span> <strong style="color: #047857;">${approvedAt}</strong></td>
          </tr>
        </table>
      </div>

      <!-- 4. Relação de Passageiros -->
      <div style="margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          4. Relação de Passageiros da Viagem (${parsedPassengers.length > 0 ? parsedPassengers.length : trip.passenger_count})
        </div>
        <div style="background-color: #f8fafc; padding: 6px 8px;">
          ${passengerHTML}
        </div>
      </div>

      <!-- 5. Observações do Motorista e Operacionais -->
      <div style="margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #334155; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          5. Observações & Ocorrências Registradas pelo Motorista
        </div>
        <div style="background-color: #ffffff; padding: 8px 10px; font-size: 10.5px; color: #1e293b; min-height: 44px; white-space: pre-wrap;">${
          trip.report_notes && trip.report_notes.trim()
            ? escapeHtml(trip.report_notes.trim())
            : '<span style="color: #64748b; font-style: italic;">Nenhuma ocorrência ou observação registrada pelo motorista nesta viagem.</span>'
        }</div>
        ${
          trip.notes && trip.notes.trim()
            ? `<div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 6px 10px; font-size: 10px; color: #475569;">
                <strong>Observações Operacionais da DIVTRANS:</strong> ${escapeHtml(trip.notes.trim())}
              </div>`
            : ''
        }
      </div>

      <!-- 6. Homologação / Assinaturas -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 12px;">
        <table style="width: 100%; border-collapse: collapse; text-align: center;">
          <tr>
            <td style="width: 50%; padding: 0 14px; vertical-align: top;">
              <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: 700; font-size: 10px; color: #0f172a;">Motorista / Contratada</div>
              <div style="font-size: 9px; color: #475569; margin-top: 2px;">${escapeHtml(driver ? driver.name : 'Responsável pela Execução')}</div>
            </td>
            <td style="width: 50%; padding: 0 14px; vertical-align: top;">
              <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: 700; font-size: 10px; color: #0f172a;">Homologação — DIVTRANS / PROADI</div>
              <div style="font-size: 9px; color: #475569; margin-top: 2px;">${isFinalized ? `Homologado no SIG-FROTA em ${approvedAt}` : 'Aguardando homologação do gestor'}</div>
            </td>
          </tr>
        </table>
      </div>

    </div>
  `;

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '760px';
    container.style.backgroundColor = '#ffffff';
    container.style.overflow = 'visible';
    container.innerHTML = generateReportHTML();
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollY: 0,
        scrollX: 0,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const maxW = pdfWidth - margin * 2;
      const maxH = pdfHeight - margin * 2;
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
      const renderW = canvas.width * ratio;
      const renderH = canvas.height * ratio;
      const posX = (pdfWidth - renderW) / 2;
      const posY = margin;

      pdf.addImage(imgData, 'PNG', posX, posY, renderW, renderH);
      const safeProc = trip.process_number.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Relatorio_Viagem_${safeProc}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF do relatório:', error);
      alert('Não foi possível gerar o PDF automaticamente. Use o botão Imprimir para salvar em PDF.');
    } finally {
      document.body.removeChild(container);
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Top Action Header */}
        <div className="p-3.5 bg-navy-950 text-white flex items-center justify-between gap-3 border-b border-navy-900 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <span>Relatório Consolidado de Viagem</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-slate-200">
                  {trip.process_number}
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Dados completos da viagem, passageiros, apuração de KM e observações do motorista
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
              title="Imprimir relatório"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/30"
              title="Baixar Relatório em PDF"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isGeneratingPDF ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 print:bg-white print:p-0 print:overflow-visible flex justify-center items-start">
          <div
            className="bg-white rounded-xl shadow-sm border border-slate-300 h-fit shrink-0 print:border-none print:shadow-none"
            dangerouslySetInnerHTML={{ __html: generateReportHTML() }}
          />
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Documento oficial pronto para anexar ao processo SEI.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
