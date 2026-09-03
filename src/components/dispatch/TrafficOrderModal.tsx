import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { TripRequest } from '../../types';
import { DistanceService } from '../../services/distanceService';
import { FleetService } from '../../services/fleetService';
import { ExportService } from '../../services/exportService';
import { safeFormatDate } from '../../utils/dateUtils';
import { 
  X, 
  Printer, 
  Download, 
  FileText, 
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface TrafficOrderModalProps {
  trip: TripRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TrafficOrderModal: React.FC<TrafficOrderModalProps> = ({
  trip,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !trip) return null;

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const cities = DistanceService.getCities();
  const vehicle = FleetService.getVehicleById(trip.allocated_vehicle_id);
  const driver = FleetService.getDriverById(trip.allocated_driver_id);
  const contractor = FleetService.getContractorById(trip.allocated_contractor_id);

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? `${c.name} - ${c.state}` : id;
  };

  const depFormatted = safeFormatDate(trip.departure_datetime, "dd/MM/yyyy 'às' HH:mm", '-');
  const retFormatted = safeFormatDate(trip.return_datetime, "dd/MM/yyyy 'às' HH:mm", '-');
  const recFormatted = safeFormatDate(trip.received_at, "dd/MM/yyyy 'às' HH:mm", '-');

  const motoristaNome = driver ? driver.name : (trip.allocated_driver_id || 'Não alocado / A definir');
  const motoristaCnh = driver ? `Cat. ${driver.cnh_category} (${driver.driver_category})` : 'A definir';
  const motoristaTel = driver?.phone || '(85) 3332-6100 (DIVTRANS)';

  const veiculoModelo = vehicle ? vehicle.model : 'Veículo Oficial UNILAB';
  const veiculoPlaca = vehicle ? vehicle.plate : 'A definir';
  const veiculoCapacidade = vehicle ? `${vehicle.capacity} passageiros` : `${trip.passenger_count} passageiros`;
  const contratadaNome = contractor ? contractor.name : 'Frota Oficial / Terceirizada UNILAB';

  const generateSheetHTML = () => `
    <div style="width: 760px; background-color: #ffffff; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; box-sizing: border-box; line-height: 1.35;">

      <!-- Header Institucional -->
      <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
          UNIVERSIDADE DA INTEGRAÇÃO INTERNACIONAL DA LUSOFONIA AFRO-BRASILEIRA
        </div>
        <div style="font-size: 10.5px; font-weight: 700; color: #334155; text-transform: uppercase; margin-top: 3px;">
          PRÓ-REITORIA DE ADMINISTRAÇÃO E PLANEJAMENTO • PROADI | DIVISÃO DE TRANSPORTE • DIVTRANS
        </div>
        <div style="font-size: 9.5px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
          SISTEMA INTEGRADO DE GESTÃO DE FROTAS (SIG-FROTA) • ORDEM DE TRÁFEGO OFICIAL
        </div>
      </div>

      <!-- Document Title Banner -->
      <table style="width: 100%; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px;">
        <tr>
          <td style="vertical-align: middle;">
            <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Documento de Tráfego:</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a;">ORDEM DE TRÁFEGO / AUTORIZAÇÃO DE SAÍDA Nº ${trip.process_number.replace('23282.', '')}</div>
          </td>
          <td style="text-align: right; vertical-align: middle; font-size: 10.5px; white-space: nowrap;">
            <span style="color: #64748b;">Processo SEI:</span> <strong style="color: #0f172a;">${trip.process_number}</strong>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <span style="color: #64748b;">Emissão:</span> <strong style="color: #0f172a;">${format(new Date(), 'dd/MM/yyyy HH:mm')}</strong>
          </td>
        </tr>
      </table>

      <!-- 1. Identificação -->
      <div style="margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          1. Identificação da Solicitação & Finalidade
        </div>
        <table style="width: 100%; background-color: #f8fafc; font-size: 10.5px; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 8px; width: 50%;"><span style="color: #64748b; font-weight: 600;">Solicitante:</span> <strong style="color: #0f172a;">${trip.requester_name}</strong></td>
            <td style="padding: 5px 8px; width: 50%;"><span style="color: #64748b; font-weight: 600;">E-mail:</span> <span style="color: #334155;">${trip.requester_email || 'Não informado'}</span></td>
          </tr>
          <tr>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Unidade Solicitante:</span> <strong style="color: #0f172a;">${trip.requesting_unit} (${trip.macro_unit})</strong></td>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Tipo de Atividade:</span> <span style="color: #334155;">${trip.activity_type}</span></td>
          </tr>
          <tr>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Data da Demanda:</span> <span style="color: #334155;">${recFormatted}</span></td>
            <td style="padding: 5px 8px;">
              <span style="color: #64748b; font-weight: 600;">Situação:</span> 
              <span style="display: inline-block; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 4px; padding: 1px 6px; font-weight: 800; font-size: 9.5px; text-transform: uppercase;">
                ${trip.status}
              </span>
            </td>
          </tr>
          ${trip.notes ? `<tr><td colspan="2" style="padding: 5px 8px; border-top: 1px solid #e2e8f0;"><span style="color: #64748b; font-weight: 600;">Finalidade / Observações:</span> <span style="color: #334155; font-style: italic;">${trip.notes}</span></td></tr>` : ''}
        </table>
      </div>

      <!-- 2. Recursos Alocados -->
      <div style="margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          2. Recursos Alocados & Equipe de Condução
        </div>
        <table style="width: 100%; background-color: #f8fafc; font-size: 10.5px; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 8px; width: 50%;"><span style="color: #64748b; font-weight: 600;">Veículo / Modelo:</span> <strong style="color: #0f172a;">${veiculoModelo}</strong></td>
            <td style="padding: 5px 8px; width: 50%;">
              <span style="color: #64748b; font-weight: 600;">Placa Oficial:</span> 
              <span style="display: inline-block; background-color: #ffffff; color: #0f172a; border: 1px solid #94a3b8; border-radius: 4px; padding: 1px 6px; font-family: monospace; font-weight: 800; font-size: 11px;">
                ${veiculoPlaca}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Lotação / Capacidade:</span> <span style="color: #334155;">${veiculoCapacidade}</span></td>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Empresa / Fornecedor:</span> <span style="color: #334155;">${contratadaNome}</span></td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Motorista Escalado:</span> <strong style="color: #0f172a;">${motoristaNome}</strong></td>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Habilitação & Contato:</span> <span style="color: #334155;">${motoristaCnh} • ${motoristaTel}</span></td>
          </tr>
        </table>
      </div>

      <!-- 3. Itinerário -->
      <div style="margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          3. Itinerário, Horários & Passageiros
        </div>
        <table style="width: 100%; background-color: #f8fafc; font-size: 10.5px; border-collapse: collapse;">
          <tr>
            <td colspan="2" style="padding: 5px 8px; background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-weight: bold; font-size: 9px; text-transform: uppercase;">Trajeto:</span>
              &nbsp;<strong style="color: #0f172a;">${getCityName(trip.origin_city_id)}</strong>
              &nbsp;<span style="color: #2563eb; font-weight: bold;">➔</span>&nbsp;
              <strong style="color: #0f172a;">${getCityName(trip.destination_city_id)}</strong>
            </td>
          </tr>
          ${(trip.origin_address || trip.destination_address) ? `
          <tr>
            <td style="padding: 4px 8px; width: 50%; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #475569; font-weight: 700; font-size: 9.5px;">📍 Local de Saída (Embarque):</span><br/>
              <span style="color: #0f172a; font-weight: 600;">${trip.origin_address || 'Campus Institucional UNILAB'}</span>
            </td>
            <td style="padding: 4px 8px; width: 50%; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #475569; font-weight: 700; font-size: 9.5px;">🏁 Local de Chegada (Desembarque):</span><br/>
              <span style="color: #0f172a; font-weight: 600;">${trip.destination_address || 'Conforme Itinerário Oficial'}</span>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 5px 8px; width: 50%;"><span style="color: #64748b; font-weight: 600;">Saída Prevista:</span> <strong style="color: #065f46;">${depFormatted}</strong></td>
            <td style="padding: 5px 8px; width: 50%;"><span style="color: #64748b; font-weight: 600;">Retorno Previsto:</span> <strong style="color: #065f46;">${retFormatted}</strong></td>
          </tr>
          <tr>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Distância Estimada:</span> <strong style="color: #0f172a;">${trip.estimated_km} km (Ida e Volta)</strong></td>
            <td style="padding: 5px 8px;"><span style="color: #64748b; font-weight: 600;">Lotação Solicitada:</span> <strong style="color: #0f172a;">${trip.passenger_count} passageiro(s)</strong></td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td colspan="2" style="padding: 5px 8px;">
              <span style="color: #64748b; font-weight: 600;">Relação de Passageiros:</span> 
              <span style="color: #334155;">${trip.passenger_list && trip.passenger_list.length > 0 ? trip.passenger_list.join(', ') : `${trip.requester_name} e comitiva institucional (${trip.passenger_count} pessoas)`}</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- 4. Diário de Bordo -->
      <div style="margin-bottom: 12px; border: 1px solid #94a3b8; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #334155; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          4. Controle de Campo & Diário de Bordo (Preenchimento pelo Motorista)
        </div>
        <div style="background-color: #ffffff; padding: 6px 8px; font-size: 10px; line-height: 1.8;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0;">
            <tr>
              <td style="padding: 3px; width: 30%;">KM Saída: <span style="border-bottom: 1px solid #64748b; display: inline-block; width: 75px;">&nbsp;</span></td>
              <td style="padding: 3px; width: 30%;">Horário Saída: <span style="border-bottom: 1px solid #64748b; display: inline-block; width: 55px;">&nbsp;</span></td>
              <td style="padding: 3px; width: 40%;">Visto Solicitante Saída: <span style="border-bottom: 1px solid #64748b; display: inline-block; width: 95px;">&nbsp;</span></td>
            </tr>
          </table>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0;">
            <tr>
              <td style="padding: 3px; width: 30%;">KM Chegada: <span style="border-bottom: 1px solid #64748b; display: inline-block; width: 75px;">&nbsp;</span></td>
              <td style="padding: 3px; width: 30%;">Horário Chegada: <span style="border-bottom: 1px solid #64748b; display: inline-block; width: 55px;">&nbsp;</span></td>
              <td style="padding: 3px; width: 40%;">Visto Solicitante Retorno: <span style="border-bottom: 1px solid #64748b; display: inline-block; width: 95px;">&nbsp;</span></td>
            </tr>
          </table>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 3px;">
            <tr>
              <td style="padding: 3px; width: 40%;">KM Total Percorrido: <span style="border-bottom: 1px solid #64748b; display: inline-block; width: 75px;">&nbsp;</span> km</td>
              <td style="padding: 3px; width: 60%;">Abastecimento / Posto: <span style="border-bottom: 1px solid #64748b; display: inline-block; width: 140px;">&nbsp;</span></td>
            </tr>
          </table>
          <div style="padding: 3px;">
            Ocorrências / Desvios de Rota: <span style="border-bottom: 1px solid #64748b; display: inline-block; width: 72%;">&nbsp;</span>
          </div>
        </div>
      </div>

      <!-- 5. Assinaturas -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 6px;">
        <div style="text-align: center; font-size: 8.5px; color: #64748b; font-style: italic; margin-bottom: 16px;">
          Declaro que a viagem acima discriminada foi realizada em estrito cumprimento do interesse público institucional da UNILAB.
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: center;">
          <tr>
            <td style="width: 33%; padding: 0 8px; vertical-align: top;">
              <div style="border-top: 1px solid #0f172a; padding-top: 3px; font-weight: 700; font-size: 10px; color: #0f172a;">Motorista / Condutor</div>
              <div style="font-size: 9px; color: #475569; margin-top: 2px;">${motoristaNome}</div>
            </td>
            <td style="width: 33%; padding: 0 8px; vertical-align: top;">
              <div style="border-top: 1px solid #0f172a; padding-top: 3px; font-weight: 700; font-size: 10px; color: #0f172a;">Solicitante / Responsável</div>
              <div style="font-size: 9px; color: #475569; margin-top: 2px;">${trip.requester_name}</div>
            </td>
            <td style="width: 33%; padding: 0 8px; vertical-align: top;">
              <div style="border-top: 1px solid #0f172a; padding-top: 3px; font-weight: 700; font-size: 10px; color: #0f172a;">Divisão de Transporte / DIVTRANS</div>
              <div style="font-size: 9px; color: #475569; margin-top: 2px;">Visto da Chefia / Despacho</div>
            </td>
          </tr>
        </table>
      </div>

    </div>
  `;

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);

    // Cria um elemento temporário desanexado do scroll da tela para renderização 100% precisa
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '760px';
    container.style.backgroundColor = '#ffffff';
    container.style.overflow = 'visible';
    container.innerHTML = generateSheetHTML();
    document.body.appendChild(container);

    try {
      // Captura o elemento isolado com resolução ultra nítida (3x)
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
      
      const pdfWidth = 210; // largura A4 mm
      const pdfHeight = 297; // altura A4 mm
      const margin = 10; // margem superior/inferior de 10mm
      const maxW = pdfWidth - (margin * 2); // 190mm
      const maxH = pdfHeight - (margin * 2); // 277mm

      const canvasW = canvas.width;
      const canvasH = canvas.height;

      // Fator de escala proporcional exato (Garante 100% da folha sem NENHUM corte)
      const ratio = Math.min(maxW / canvasW, maxH / canvasH);
      const renderW = canvasW * ratio;
      const renderH = canvasH * ratio;

      // Centraliza perfeitamente no centro da página A4
      const posX = (pdfWidth - renderW) / 2;
      const posY = margin + (maxH - renderH) / 2;

      pdf.addImage(imgData, 'PNG', posX, posY, renderW, renderH);
      const safeProc = trip.process_number.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Ordem_Trafego_${safeProc}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF visual:', error);
      alert('Ocorreu um erro ao gerar o PDF. Você também pode clicar no botão Imprimir para salvar em PDF pelo navegador.');
    } finally {
      document.body.removeChild(container);
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Top Action Header (Hidden on Print) */}
        <div className="p-3.5 bg-navy-950 text-white flex items-center justify-between gap-3 border-b border-navy-900 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <span>Ordem de Tráfego / Ficha de Viagem</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-slate-200">
                  {trip.process_number}
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Guia de autorização e controle de bordo para condutor e fiscalização
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
              title="Imprimir documento ou salvar em PDF pelo navegador"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/30"
              title="Baixar PDF oficial"
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-slate-800 text-xs bg-slate-100/70 print:bg-white print:p-0 print:overflow-visible flex justify-center">
          
          {/* Exact Printable A4 Container Rendered with pure HTML */}
          <div 
            id="traffic-order-sheet"
            className="bg-white rounded-xl shadow-sm border border-slate-300 overflow-hidden print:border-none print:shadow-none"
            dangerouslySetInnerHTML={{ __html: generateSheetHTML() }}
          />

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Documento calibrado com proporções A4 oficiais e alta definição (300 DPI).</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isGeneratingPDF ? 'Gerando PDF...' : 'Baixar PDF Oficial'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
