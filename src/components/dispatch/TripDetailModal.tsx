import React, { useState } from 'react';
import { TripRequest } from '../../types';
import { DistanceService } from '../../services/distanceService';
import { FleetService } from '../../services/fleetService';
import { CostService } from '../../services/costService';
import { StatusBadge } from '../common/StatusBadge';
import { 
  X, 
  SendHorizontal, 
  MapPin, 
  Calendar, 
  Users, 
  FileText, 
  Building2, 
  Truck, 
  User, 
  Clock, 
  XCircle,
  CheckCircle2,
  Milestone,
  FileCheck,
  Copy,
  Check,
  ShieldAlert,
  FileCheck2,
  Phone,
  Printer,
  Trash2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExportService } from '../../services/exportService';

interface TripDetailModalProps {
  trip: TripRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDispatch: (trip: TripRequest) => void;
  onOpenReject: (trip: TripRequest) => void;
  onOpenChangeDate: (trip: TripRequest) => void;
  onOpenTrafficOrder?: (trip: TripRequest) => void;
  onOpenDelete?: (trip: TripRequest) => void;
}

export const TripDetailModal: React.FC<TripDetailModalProps> = ({
  trip,
  isOpen,
  onClose,
  onOpenDispatch,
  onOpenReject,
  onOpenChangeDate,
  onOpenTrafficOrder,
  onOpenDelete,
}) => {
  if (!isOpen || !trip) return null;

  const [copied, setCopied] = useState(false);

  const cities = DistanceService.getCities();
  const vehicle = FleetService.getVehicleById(trip.allocated_vehicle_id);
  const driver = FleetService.getDriverById(trip.allocated_driver_id);
  const contractor = FleetService.getContractorById(trip.allocated_contractor_id);

  const tripCost = CostService.calculateTripCost(trip, vehicle);

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? `${c.name} - ${c.state}` : id;
  };

  const safeFormatDate = (dateStr?: string, formatStr: string = 'dd/MM/yyyy', fallback: string = '-'): string => {
    if (!dateStr) return fallback;
    try {
      const d = parseISO(dateStr);
      if (isNaN(d.getTime())) return fallback;
      return format(d, formatStr, { locale: ptBR });
    } catch {
      return fallback;
    }
  };

  const diaPartida = safeFormatDate(trip.departure_datetime, 'dd/MM/yyyy', '-');
  const horarioPartida = safeFormatDate(trip.departure_datetime, 'HH:mm', '08:00');
  const diaRetorno = safeFormatDate(trip.return_datetime, 'dd/MM/yyyy', '-');
  const horarioRetorno = safeFormatDate(trip.return_datetime, 'HH:mm', '18:00');

  const departureFormatted = `${diaPartida} às ${horarioPartida}`;
  const returnFormatted = `${diaRetorno} às ${horarioRetorno}`;
  const receivedFormatted = safeFormatDate(trip.received_at, "dd/MM/yyyy 'às' HH:mm", '-');

  // Fallbacks seguros para exibição operacional
  const motoristaNome = driver ? driver.name : (trip.allocated_driver_id || 'Não alocado');
  const motoristaTelefone = driver?.phone || '(85) 3332-6100 (DIVTRANS)';
  const veiculoModelo = vehicle ? vehicle.model : 'Veículo Oficial UNILAB';
  const veiculoCapacidade = vehicle ? vehicle.capacity : trip.passenger_count;
  const veiculoPlaca = vehicle ? vehicle.plate : 'A definir';
  const intermediateNames = (trip.intermediate_cities || []).map((idOrName) => {
    const found = cities.find((c) => c.id === idOrName);
    return found ? found.name : idOrName;
  });

  const rotaItinerario = [
    getCityName(trip.origin_city_id),
    ...intermediateNames,
    getCityName(trip.destination_city_id)
  ].join(' ➔ ') + (trip.extra_km ? ` (+${trip.extra_km} km local)` : '');

  const enderecoOrigem = trip.origin_address ? ` (${trip.origin_address})` : '';
  const enderecoDestino = trip.destination_address ? ` (${trip.destination_address})` : '';

  // Texto oficial completo para cópia e envio
  const officialDispatchText = `Prezado(a),

Informa-se, por meio deste, que sua Solicitação de Veículo Oficial foi aprovada e será atendida conforme disposto abaixo:
- Processo SEI nº: ${trip.process_number}
- Dia de Partida: ${diaPartida}
- Horário de Partida: ${horarioPartida}
- Local de Embarque (Saída): ${trip.origin_address || getCityName(trip.origin_city_id)}
- Dia de Retorno: ${diaRetorno}
- Horário de retorno: ${horarioRetorno}
- Local de Desembarque (Destino): ${trip.destination_address || getCityName(trip.destination_city_id)}
- Motorista(s) escalado(s) (IDA): ${motoristaNome}
- Telefone(s) do(s) Motorista(s): ${motoristaTelefone}
- Veículo(s): ${veiculoModelo} (Capacidade máxima: ${veiculoCapacidade} passageiros)
- Placa: ${veiculoPlaca}
- Quantidade de Passageiros: ${trip.passenger_count}
- Rota/Itinerário: > ${rotaItinerario}

** Conforme art. 27 da Portaria PROADI nº 194, de 29 de janeiro de 2024, para todas as viagens em veículos da Universidade nas quais a distância do endereço de origem ao endereço de destino seja igual ou superior a 80 (oitenta) quilômetros rodoviários, partindo do Campus da Liberdade (no Ceará), e que envolvam o transporte coletivo de alunos, é obrigatório indicar o nome de um servidor para exercer o papel de responsável pelos passageiros durante o deslocamento.
§ 1º O responsável deverá estar presente durante toda a viagem.
§ 2º É facultada a presença de servidor responsável em deslocamentos inferiores a 80 (oitenta) quilômetros rodoviários, porém a ausência do mesmo não exime, do solicitante, a responsabilização de fatos que venham a ocorrer no trajeto da viagem.
§ 3º Nos casos de viagens não abrangidas pelo caput, em que a lista definitiva de passageiros possua mais de 25 (vinte e cinco) pessoas, será obrigatória a indicação de colaborador da unidade requisitante para realizar o acompanhamento do deslocamento.
** Haverá tolerância de 20 (vinte) minutos de espera para possíveis atrasos do solicitante, quando não informado anteriormente. Após esse período, a Divisão de Transportes poderá fazer uso do veículo e/ou do condutor em outra atividade demandada.
** Não serão permitidas paradas que não tenham sido informadas na Solicitação de Veículo Oficial.
** Em caso de cancelamento da viagem, deverá ser enviado e-mail, com o máximo de antecedência, à Divisão de Transportes.

** É obrigatório o uso de cinto de segurança pelos passageiros.`;

  const handleCopyText = () => {
    navigator.clipboard.writeText(officialDispatchText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-navy-900 via-navy-950 to-slate-900 p-6 text-white flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                Ficha Detalhada do Processo
              </span>
              <StatusBadge status={trip.status} />
              <StatusBadge deadline={trip.status_deadline} />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              {trip.process_number}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Seção 1: Itinerário & Prazos */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                  <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>{rotaItinerario}</span>
                </div>
                {(trip.origin_address || trip.destination_address || (trip.intermediate_cities && trip.intermediate_cities.length > 0)) && (
                  <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1 pl-6">
                    {trip.origin_address && (
                      <div><strong className="text-slate-700">Embarque:</strong> {trip.origin_address}</div>
                    )}
                    {trip.destination_address && (
                      <div><strong className="text-slate-700">Desembarque:</strong> {trip.destination_address}</div>
                    )}
                    {intermediateNames.length > 0 && (
                      <div><strong className="text-amber-800">Paradas Secundárias:</strong> {intermediateNames.join(', ')}</div>
                    )}
                    {trip.extra_km && (
                      <div><strong className="text-amber-800">Deslocamento Local:</strong> +{trip.extra_km} km</div>
                    )}
                  </div>
                )}
              </div>
              <span className="bg-brand-100 text-brand-800 font-bold px-2.5 py-0.5 rounded-full text-xs shrink-0">
                {trip.estimated_km} km Total
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-600">
              <div>
                <span className="text-slate-400 block font-medium">Saída Prevista:</span>
                <span className="font-bold text-slate-800">{departureFormatted}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Retorno Previsto:</span>
                <span className="font-bold text-slate-800">{returnFormatted}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Recebimento da Demanda:</span>
                <span className="font-semibold text-slate-700">{receivedFormatted} ({trip.advance_days}d de antecedência)</span>
              </div>
            </div>
          </div>

          {/* Seção 2: Solicitante & Finalidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-2">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-brand-600" />
                Dados do Solicitante
              </h4>
              <div className="space-y-1">
                <div>
                  <span className="text-slate-400">Nome:</span>{' '}
                  <strong className="text-slate-900">{trip.requester_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400">E-mail:</span>{' '}
                  <span className="text-slate-700 font-medium">{trip.requester_email}</span>
                </div>
                <div>
                  <span className="text-slate-400">Unidade:</span>{' '}
                  <span className="text-slate-700 font-medium">{trip.macro_unit} ({trip.requesting_unit})</span>
                </div>
                <div>
                  <span className="text-slate-400">Atividade:</span>{' '}
                  <span className="text-slate-700 font-medium">{trip.activity_type}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-2">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                Passageiros & Finalidade
              </h4>
              <div className="space-y-1">
                <div>
                  <span className="text-slate-400">Lotação:</span>{' '}
                  <strong className="text-slate-900">{trip.passenger_count} passageiros</strong>
                </div>
                {trip.passenger_names && (
                  <div>
                    <span className="text-slate-400">Relação:</span>{' '}
                    <span className="text-slate-700">{trip.passenger_names}</span>
                  </div>
                )}
                {trip.trip_objective && (
                  <div className="pt-1">
                    <span className="text-slate-400 block">Objetivo:</span>
                    <p className="text-slate-700 italic bg-slate-50 p-2 rounded-lg border border-slate-200/60 mt-0.5">
                      "{trip.trip_objective}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seção 3: Recursos Alocados (Despacho) & Gastos com Combustível */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-brand-600" />
              Recursos e Alocação Operacional
            </h4>

            {trip.status === 'Confirmado ao Demandante' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/60">
                  <div>
                    <span className="text-slate-400 block font-medium">Contratada:</span>
                    <strong className="text-slate-900">{contractor?.name || 'Não informada'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Motorista:</span>
                    <strong className="text-slate-900">{driver ? `${driver.name} (Cat. ${driver.cnh_category})` : 'Não alocado'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Veículo / Placa:</span>
                    <strong className="text-slate-900">{vehicle ? `${vehicle.model} - ${vehicle.plate}` : 'Não alocado'}</strong>
                  </div>
                </div>

                {/* Card de Gastos com Combustível e Custos por KM */}
                {vehicle && (
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block font-medium">Combustível & Autonomia:</span>
                      <strong className="text-navy-950">{vehicle.fuel_type || 'Diesel S10'} ({vehicle.avg_km_per_liter || (vehicle.type === 'Ônibus' ? 3.2 : vehicle.type === 'Micro-Ônibus' ? 5.8 : vehicle.type === 'Van' ? 8.5 : vehicle.type === 'Caminhonete' ? 9.2 : 13.8)} km/L)</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">Consumo Estimado:</span>
                      <strong className="text-amber-800">
                        {tripCost.fuelLiters.toFixed(1)} Litros
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">Gasto Combustível:</span>
                      <strong className="text-brand-700">
                        R$ {tripCost.fuelCost.toFixed(2)} ({tripCost.fuelCostPerKm.toFixed(2)}/km)
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">Custo Total da Viagem:</span>
                      <strong className="text-brand-700 font-extrabold">
                        R$ {tripCost.totalCost.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-center">
                Solicitação ainda não alocada / confirmada.
              </div>
            )}

            {trip.notes && (
              <div className="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <span className="font-bold block text-slate-700 mb-0.5">Observações Operacionais:</span>
                {trip.notes}
              </div>
            )}
          </div>

          {/* SEÇÃO OFICIAL: TERMO DE DEFERIMENTO & INSTRUÇÕES NORMATIVAS (PORTARIA PROADI Nº 194/2024) - EXIBIDO APENAS SE A DEMANDA JÁ ESTIVER ESCALADA */}
          {(trip.status === 'Confirmado ao Demandante' || Boolean(trip.allocated_driver_id && trip.allocated_vehicle_id)) && (
            <div className="bg-gradient-to-b from-slate-50 to-white p-5 rounded-2xl border-2 border-brand-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-500/15 text-brand-700 flex items-center justify-center">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-navy-950 uppercase tracking-wide">
                      Comunicado Oficial de Aprovação & Termo de Escalação
                    </h4>
                    <span className="text-[10px] text-slate-500">Portaria PROADI nº 194, de 29 de janeiro de 2024</span>
                  </div>
                </div>

                <button
                  onClick={handleCopyText}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-brand-600" />
                      <span className="text-brand-700">Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-brand-600" />
                      <span>Copiar Comunicado</span>
                    </>
                  )}
                </button>
              </div>

              {/* Corpo do Texto Formatado */}
              <div className="space-y-3 text-slate-800 text-xs leading-relaxed bg-white p-4 rounded-xl border border-slate-200/80 font-sans select-text">
                <p className="font-semibold text-slate-900">Prezado(a),</p>
                <p>
                  Informa-se, por meio deste, que sua Solicitação de Veículo Oficial foi aprovada e será atendida conforme disposto abaixo:
                </p>

                <div className="bg-slate-50/90 p-3 rounded-lg border border-slate-200 space-y-1 font-mono text-[11.5px] text-slate-900">
                  <div>• <strong>Processo SEI nº:</strong> {trip.process_number}</div>
                  <div>• <strong>Dia de Partida:</strong> {diaPartida}</div>
                  <div>• <strong>Horário de Partida:</strong> {horarioPartida}</div>
                  <div>• <strong>Dia de Retorno:</strong> {diaRetorno}</div>
                  <div>• <strong>Horário de retorno:</strong> {horarioRetorno}</div>
                  <div>• <strong>Motorista(s) escalado(s) (IDA):</strong> {motoristaNome}</div>
                  <div>• <strong>Telefone(s) do(s) Motorista(s):</strong> {motoristaTelefone}</div>
                  <div>• <strong>Veículo(s):</strong> {veiculoModelo} (Capacidade máxima: {veiculoCapacidade} passageiros)</div>
                  <div>• <strong>Placa:</strong> {veiculoPlaca}</div>
                  <div>• <strong>Quantidade de Passageiros:</strong> {trip.passenger_count}</div>
                  <div>• <strong>Rota/Itinerário: &gt;</strong> {rotaItinerario}</div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                  <p>
                    <strong>** Conforme art. 27 da Portaria PROADI nº 194, de 29 de janeiro de 2024</strong>, para todas as viagens em veículos da Universidade nas quais a distância do endereço de origem ao endereço de destino seja igual ou superior a 80 (oitenta) quilômetros rodoviários, partindo do Campus da Liberdade (no Ceará), e que envolvam o transporte coletivo de alunos, é obrigatório indicar o nome de um servidor para exercer o papel de responsável pelos passageiros durante o deslocamento.
                  </p>
                  <div className="pl-3 border-l-2 border-slate-300 space-y-1 text-slate-600 italic">
                    <p><strong>§ 1º</strong> O responsável deverá estar presente durante toda a viagem.</p>
                    <p><strong>§ 2º</strong> É facultada a presença de servidor responsável em deslocamentos inferiores a 80 (oitenta) quilômetros rodoviários, porém a ausência do mesmo não exime, do solicitante, a responsabilização de fatos que venham a ocorrer no trajeto da viagem.</p>
                    <p><strong>§ 3º</strong> Nos casos de viagens não abrangidas pelo caput, em que a lista definitiva de passageiros possua mais de 25 (vinte e cinco) pessoas, será obrigatória a indicação de colaborador da unidade requisitante para realizar o acompanhamento do deslocamento.</p>
                  </div>
                  <p><strong>**</strong> Haverá tolerância de <strong>20 (vinte) minutos de espera</strong> para possíveis atrasos do solicitante, quando não informado anteriormente. Após esse período, a Divisão de Transportes poderá fazer uso do veículo e/ou do condutor em outra atividade demandada.</p>
                  <p><strong>**</strong> Não serão permitidas paradas que não tenham sido informadas na Solicitação de Veículo Oficial.</p>
                  <p><strong>**</strong> Em caso de cancelamento da viagem, deverá ser enviado e-mail, com o máximo de antecedência, à Divisão de Transportes.</p>
                  <p className="font-bold text-rose-700"><strong>** É obrigatório o uso de cinto de segurança pelos passageiros.</strong></p>
                </div>
              </div>
            </div>
          )}

          {/* Seção 4: Motivo de Indeferimento (se aplicável) */}
          {trip.status === 'Indeferido' && (
            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 space-y-1 text-rose-900">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Solicitação Indeferida</span>
              </div>
              <div>
                <strong>Motivo:</strong> {trip.rejection_reason}
              </div>
              {trip.rejection_notes && (
                <div className="text-rose-700 italic">
                  <strong>Justificativa do Gestor:</strong> {trip.rejection_notes}
                </div>
              )}
            </div>
          )}

          {/* Seção 5: Pós-Viagem / Relatório (se aplicável) */}
          {trip.travel_report_status && trip.travel_report_status !== 'Não Aplicável' && (
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 space-y-2 text-blue-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-blue-800">
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  <span>Acompanhamento Pós-Viagem</span>
                </div>
                <StatusBadge reportStatus={trip.travel_report_status} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                <div>
                  <span className="text-slate-500 block">KM Previsto:</span>
                  <strong>{trip.estimated_km} km</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">KM Real Percorrido:</span>
                  <strong className="text-brand-700">{trip.real_km ?? '-'} km</strong>
                </div>
                {trip.fuel_liters && (
                  <div>
                    <span className="text-slate-500 block">Combustível:</span>
                    <strong>{trip.fuel_liters} L</strong>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors"
          >
            Fechar
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {(trip.status === 'Confirmado ao Demandante' || Boolean(trip.allocated_vehicle_id)) && (
              <button
                onClick={() => {
                  if (onOpenTrafficOrder) {
                    onOpenTrafficOrder(trip);
                  } else {
                    ExportService.exportTrafficOrderPDF(trip);
                  }
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-950/20 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
                title="Emitir Ordem de Tráfego Oficial em PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Ordem de Tráfego (PDF)</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onOpenChangeDate(trip);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
            >
              Alterar Data
            </button>

            {trip.status !== 'Indeferido' && (
              <button
                onClick={() => {
                  onClose();
                  onOpenReject(trip);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
              >
                Indeferir
              </button>
            )}

            {onOpenDelete && (
              <button
                onClick={() => {
                  onClose();
                  onOpenDelete(trip);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 flex items-center gap-1.5 transition-colors"
                title="Excluir solicitação definitivamente"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onOpenDispatch(trip);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-600/30 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
            >
              <SendHorizontal className="w-3.5 h-3.5" />
              <span>{trip.status === 'Confirmado ao Demandante' ? 'Re-escalar Recursos' : 'Escalar Demanda'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
