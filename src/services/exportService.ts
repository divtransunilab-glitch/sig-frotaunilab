import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { TripRequest } from '../types';
import { DistanceService } from './distanceService';
import { FleetService } from './fleetService';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeFormatDate } from '../utils/dateUtils';

export class ExportService {
  /**
   * Exporta a lista de viagens para formato Excel (.xlsx) compatível com a planilha institucional
   */
  static exportToExcel(trips: TripRequest[], fileName = 'SIG-FROTA_Controle_Viagens.xlsx'): void {
    const cities = DistanceService.getCities();
    const vehicles = FleetService.getVehicles();
    const drivers = FleetService.getDrivers();
    const contractors = FleetService.getContractors();

    const getCityName = (id: string) => {
      const city = cities.find((c) => c.id === id);
      return city ? `${city.name}-${city.state}` : id;
    };

    const data = trips.map((t, idx) => {
      const vehicle = vehicles.find((v) => v.id === t.allocated_vehicle_id);
      const driver = drivers.find((d) => d.id === t.allocated_driver_id);
      const contractor = contractors.find((c) => c.id === t.allocated_contractor_id);

      const departureFormatted = safeFormatDate(t.departure_datetime, 'dd/MM/yyyy HH:mm', '');
      const returnFormatted = safeFormatDate(t.return_datetime, 'dd/MM/yyyy HH:mm', '');
      const receivedFormatted = safeFormatDate(t.received_at, 'dd/MM/yyyy HH:mm', '');

      return {
        'Item': idx + 1,
        'Nº Processo': t.process_number,
        'Data Recebimento': receivedFormatted,
        'Antecedência (Dias)': t.advance_days,
        'Status do Prazo': t.status_deadline,
        'Tipo de Atividade': t.activity_type,
        'Nome do Solicitante': t.requester_name,
        'E-mail': t.requester_email,
        'Unidade Macro': t.macro_unit,
        'Unidade Solicitante': t.requesting_unit,
        'Origem': getCityName(t.origin_city_id),
        'Destino': getCityName(t.destination_city_id),
        'Data e Horário de Saída': departureFormatted,
        'Data e Horário de Retorno': returnFormatted,
        'Qtd Passageiros': t.passenger_count,
        'KM Previsto (Ida e Volta)': t.estimated_km,
        'KM Real Percorrido': t.real_km ?? t.estimated_km,
        'Contratada Alocada': contractor?.name || 'Não alocada',
        'Motorista': driver?.name || 'Não alocado',
        'Veículo / Modelo': vehicle ? `${vehicle.model} (${vehicle.plate})` : 'Não alocado',
        'Situação da Solicitação': t.status,
        'Motivo de Indeferimento': t.rejection_reason || '',
        'Status do Relatório de Viagem': t.travel_report_status || 'Não Aplicável',
        'Observações': t.notes || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Ajustar largura automática das colunas
    const colWidths = [
      { wch: 6 },  // Item
      { wch: 24 }, // Nº Processo
      { wch: 18 }, // Data Recebimento
      { wch: 18 }, // Antecedência
      { wch: 16 }, // Status do Prazo
      { wch: 16 }, // Tipo de Atividade
      { wch: 28 }, // Solicitante
      { wch: 26 }, // E-mail
      { wch: 14 }, // Unidade Macro
      { wch: 22 }, // Unidade Solicitante
      { wch: 18 }, // Origem
      { wch: 18 }, // Destino
      { wch: 22 }, // Saída
      { wch: 22 }, // Retorno
      { wch: 15 }, // Qtd Passageiros
      { wch: 24 }, // KM Previsto
      { wch: 20 }, // KM Real
      { wch: 30 }, // Contratada
      { wch: 26 }, // Motorista
      { wch: 28 }, // Veículo
      { wch: 26 }, // Situação
      { wch: 24 }, // Motivo Indeferimento
      { wch: 28 }, // Relatório
      { wch: 35 }, // Observações
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Controle de Viagens');

    XLSX.writeFile(workbook, fileName);
  }

  /**
   * Gera e faz o download de um relatório gerencial oficial em PDF
   */
  static exportToPDF(
    trips: TripRequest[],
    title = 'Relatório Mensal de Gestão de Frotas e Viagens Oficiais',
    periodText = 'Setembro / 2026'
  ): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const cities = DistanceService.getCities();
    const vehicles = FleetService.getVehicles();
    const drivers = FleetService.getDrivers();

    const getCityName = (id: string) => {
      const city = cities.find((c) => c.id === id);
      return city ? `${city.name}` : id;
    };

    // Cabeçalho institucional
    doc.setFillColor(0, 135, 90); // Verde Institucional
    doc.rect(0, 0, 297, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('SIG-FROTA | SISTEMA DE GESTÃO DE TRANSPORTE E FROTAS OFICIAIS - UNILAB', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Documento: ${title}`, 14, 26);
    doc.text(`Período de Referência: ${periodText}`, 14, 31);
    doc.text(`Data de Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 220, 31);

    // Sumário Executivo
    const confirmedCount = trips.filter((t) => t.status === 'Confirmado ao Demandante').length;
    const pendingCount = trips.filter((t) => t.status === 'Pendente de Análise').length;
    const rejectedCount = trips.filter((t) => t.status === 'Indeferido').length;
    const totalKm = trips.reduce((sum, t) => sum + (t.real_km || t.estimated_km || 0), 0);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 35, 269, 14, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de Processos: ${trips.length}`, 20, 43);
    doc.text(`Confirmadas: ${confirmedCount}`, 75, 43);
    doc.text(`Pendentes: ${pendingCount}`, 125, 43);
    doc.text(`Indeferidas: ${rejectedCount}`, 175, 43);
    doc.text(`KM Total Percorrido: ${totalKm} km`, 220, 43);

    // Tabela de Viagens
    const tableData = trips.map((t) => {
      const v = vehicles.find((item) => item.id === t.allocated_vehicle_id);
      const d = drivers.find((item) => item.id === t.allocated_driver_id);
      const saDate = safeFormatDate(t.departure_datetime, 'dd/MM HH:mm', '-');

      return [
        t.process_number,
        t.macro_unit,
        t.requester_name.length > 18 ? `${t.requester_name.substring(0, 18)}...` : t.requester_name,
        `${getCityName(t.origin_city_id)} > ${getCityName(t.destination_city_id)}`,
        saDate,
        `${t.passenger_count} p.`,
        `${t.estimated_km} km`,
        v ? `${v.plate} (${v.type})` : 'Pendente',
        d ? d.name.split(' ')[0] + ' ' + (d.name.split(' ')[1] || '') : 'Pendente',
        t.status.replace(' ao Demandante', '').replace(' pela Unidade Executante', ' (Exec)'),
      ];
    });

    autoTable(doc, {
      startY: 53,
      head: [
        [
          'Nº Processo',
          'Unid.',
          'Solicitante',
          'Trecho (Origem > Dest.)',
          'Saída',
          'Pax',
          'KM',
          'Veículo',
          'Motorista',
          'Situação',
        ],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [16, 42, 67], // Navy Dark
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });

    // Salvar arquivo
    doc.save(`SIG-FROTA_Relatorio_${periodText.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  }

  /**
   * Gera e faz download da Ordem de Tráfego Oficial / Ficha de Viagem em PDF idêntica à pré-visualização
   */
  static async exportTrafficOrderPDF(trip: TripRequest): Promise<void> {
    const safeProc = trip.process_number.replace(/[^a-zA-Z0-9]/g, '_');

    // Se o elemento do modal já existir ativo no DOM (#traffic-order-sheet)
    const existingElement = document.getElementById('traffic-order-sheet');
    if (existingElement) {
      try {
        const canvas = await html2canvas(existingElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 794,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = 210;
        const pdfHeight = 297;
        const margin = 8;
        const maxW = pdfWidth - margin * 2;
        const maxH = pdfHeight - margin * 2;

        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const ratio = Math.min(maxW / canvasW, maxH / canvasH);
        const renderW = canvasW * ratio;
        const renderH = canvasH * ratio;

        const posX = (pdfWidth - renderW) / 2;
        const posY = margin + (maxH - renderH) / 2;

        pdf.addImage(imgData, 'PNG', posX, posY, renderW, renderH);
        pdf.save(`Ordem_Trafego_${safeProc}.pdf`);
        return;
      } catch (err) {
        console.warn('Falha no elemento existente, usando gerador DOM temporário:', err);
      }
    }

    // Caso não exista o modal aberto
    const cities = DistanceService.getCities();
    const vehicle = FleetService.getVehicleById(trip.allocated_vehicle_id);
    const driver = FleetService.getDriverById(trip.allocated_driver_id);
    const contractor = FleetService.getContractorById(trip.allocated_contractor_id);

    const getCityName = (id: string) => {
      const city = cities.find((c) => c.id === id);
      return city ? `${city.name} - ${city.state}` : id;
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

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '760px';
    tempContainer.style.backgroundColor = '#ffffff';
    tempContainer.style.overflow = 'visible';

    tempContainer.innerHTML = `
      <div style="width: 760px; background-color: #ffffff; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; box-sizing: border-box; line-height: 1.35;">
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

    document.body.appendChild(tempContainer);

    try {
      const canvas = await html2canvas(tempContainer, {
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

      const canvasW = canvas.width;
      const canvasH = canvas.height;
      const ratio = Math.min(maxW / canvasW, maxH / canvasH);
      const renderW = canvasW * ratio;
      const renderH = canvasH * ratio;

      const posX = (pdfWidth - renderW) / 2;
      const posY = margin + (maxH - renderH) / 2;

      pdf.addImage(imgData, 'PNG', posX, posY, renderW, renderH);
      const safeProc = trip.process_number.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Ordem_Trafego_${safeProc}.pdf`);
    } catch (err) {
      console.error('Erro ao renderizar PDF:', err);
    } finally {
      document.body.removeChild(tempContainer);
    }
  }
}
