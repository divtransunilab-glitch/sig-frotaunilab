import React, { useState, useEffect } from 'react';
import { 
  TripRequest, 
  ActivityType, 
  MacroUnit, 
  VehicleType,
  TripStatus,
  TravelReportStatus,
  DriverCategory
} from '../../types';
import { DistanceService } from '../../services/distanceService';
import { TripService } from '../../services/tripService';
import { FleetService } from '../../services/fleetService';
import { 
  X, 
  PlusCircle, 
  Calendar, 
  MapPin, 
  Users, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Milestone,
  Building2,
  SendHorizontal,
  Truck,
  User,
  ShieldCheck,
  Clock,
  Info
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeFormatDate } from '../../utils/dateUtils';

interface NewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTrip: (tripData: Partial<TripRequest>) => void;
}

const MACRO_UNITS: MacroUnit[] = [
  'ICS',
  'IDR',
  'PROADI',
  'PROPAE',
  'ICEN',
  'GR',
  'PROEX',
  'IH',
  'PROINTER',
  'ICSA',
  'SECOM',
  'PROPPG',
  'DTI'
];

const ACTIVITY_TYPES: ActivityType[] = [
  'Graduação',
  'Pós Graduação',
  'Pesquisa',
  'Extensão',
  'Administrativo'
];

const VEHICLE_TYPES: VehicleType[] = [
  'Sedan',
  'Caminhonete',
  'Van',
  'Micro-Ônibus',
  'Ônibus',
  'Caminhão'
];

export const NewTripModal: React.FC<NewTripModalProps> = ({
  isOpen,
  onClose,
  onSaveTrip,
}) => {
  if (!isOpen) return null;

  const cities = DistanceService.getCities();
  const contractors = FleetService.getContractors();
  const allDrivers = FleetService.getDrivers();
  const allVehicles = FleetService.getVehicles();

  // Geração automática de número de processo padrão UNILAB
  const defaultProcessNumber = `23282.${Math.floor(100000 + Math.random() * 900000)}/2026-${Math.floor(10 + Math.random() * 89)}`;
  const defaultDepartureDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  const defaultDepartureTime = '08:00';
  const defaultReturnDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  const defaultReturnTime = '17:00';
  const defaultReceivedDate = format(new Date(), 'yyyy-MM-dd');
  const defaultReceivedTime = format(new Date(), 'HH:mm');

  // --- DADOS OBRIGATÓRIOS (Até Quantidade de Passageiros) ---
  const [processNumber, setProcessNumber] = useState(defaultProcessNumber);
  const [receivedDate, setReceivedDate] = useState(defaultReceivedDate);
  const [receivedTime, setReceivedTime] = useState(defaultReceivedTime);
  const [activityType, setActivityType] = useState<ActivityType>('Graduação');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [macroUnit, setMacroUnit] = useState<MacroUnit>('IDR');
  const [requestingUnit, setRequestingUnit] = useState('');
  const [originCityId, setOriginCityId] = useState(cities[0]?.id || 'city-1');
  const [originAddress, setOriginAddress] = useState('');
  const [destinationCityId, setDestinationCityId] = useState(cities[2]?.id || 'city-3');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [departureDate, setDepartureDate] = useState(defaultDepartureDate);
  const [departureTime, setDepartureTime] = useState(defaultDepartureTime);
  const [returnDate, setReturnDate] = useState(defaultReturnDate);
  const [returnTime, setReturnTime] = useState(defaultReturnTime);
  const [passengerCount, setPassengerCount] = useState<number>(4);

  // --- DADOS OPCIONAIS / DESPACHO ---
  const [allocatedContractorId, setAllocatedContractorId] = useState<string>('');
  const [allocatedDriverId, setAllocatedDriverId] = useState<string>('');
  const [driverCategory, setDriverCategory] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<string>('');
  const [allocatedVehicleId, setAllocatedVehicleId] = useState<string>('');
  const [status, setStatus] = useState<TripStatus>('Pendente de Análise');
  const [travelReportStatus, setTravelReportStatus] = useState<TravelReportStatus>('Não Aplicável');
  const [passengerNames, setPassengerNames] = useState('');
  const [tripObjective, setTripObjective] = useState('');
  const [notes, setNotes] = useState('');

  // Sincroniza campos combinados de datetime
  const departureDatetime = `${departureDate}T${departureTime}`;
  const returnDatetime = `${returnDate}T${returnTime}`;
  const receivedAt = `${receivedDate}T${receivedTime}`;

  // Cálculo de Dia da Semana da Saída
  const departureDayOfWeek = safeFormatDate(`${departureDate}T00:00:00`, 'EEEE', '');

  // Cálculo instantâneo de KM
  const [estimatedKm, setEstimatedKm] = useState<number>(0);

  useEffect(() => {
    const km = DistanceService.calculateTotalKm(originCityId, destinationCityId);
    setEstimatedKm(km);
  }, [originCityId, destinationCityId]);

  // Cálculo instantâneo de Prazo de Antecedência
  const { advanceDays, statusDeadline } = TripService.calculateDeadline(
    receivedAt,
    departureDatetime
  );

  // Sugestão de Veículo por capacidade
  const recommendation = FleetService.recommendVehicleType(passengerCount);

  // Filtragem de motoristas e veículos quando contratada é selecionada
  const availableDrivers = allDrivers.filter((d) => !allocatedContractorId || d.contractor_id === allocatedContractorId);
  const availableVehicles = allVehicles.filter(
    (v) => !allocatedContractorId || !v.contractor_id || v.contractor_id === allocatedContractorId
  );

  // Atualizar categoria do motorista quando motorista é selecionado
  const handleDriverChange = (driverId: string) => {
    setAllocatedDriverId(driverId);
    const d = allDrivers.find((item) => item.id === driverId);
    if (d) {
      setDriverCategory(`CNH Cat. ${d.cnh_category} (${d.driver_category})`);
    } else {
      setDriverCategory('');
    }
  };

  // Atualizar dados do veículo quando selecionado
  const handleVehicleChange = (vehId: string) => {
    setAllocatedVehicleId(vehId);
    const v = allVehicles.find((item) => item.id === vehId);
    if (v) {
      setVehicleType(v.type);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validação estrita dos campos obrigatórios (até Quantidade de Passageiros)
    if (!processNumber.trim()) {
      alert('Informe o número do processo.');
      return;
    }
    if (!receivedDate || !receivedTime) {
      alert('Informe a data e horário de recebimento.');
      return;
    }
    if (!requesterName.trim()) {
      alert('Informe o nome do solicitante.');
      return;
    }
    if (!requestingUnit.trim()) {
      alert('Informe a unidade requisitante.');
      return;
    }
    if (!originCityId || !destinationCityId) {
      alert('Selecione as cidades de partida e destino.');
      return;
    }
    if (!departureDate || !departureTime || !returnDate || !returnTime) {
      alert('Preencha todas as datas e horários de saída e retorno.');
      return;
    }
    if (new Date(departureDatetime).getTime() >= new Date(returnDatetime).getTime()) {
      alert('A data/horário de retorno deve ser posterior à data/horário de saída.');
      return;
    }
    if (passengerCount < 1) {
      alert('A quantidade de passageiros deve ser no mínimo 1.');
      return;
    }

    onSaveTrip({
      process_number: processNumber.trim(),
      received_at: receivedAt,
      activity_type: activityType,
      requester_name: requesterName.trim(),
      requester_email: requesterEmail.trim(),
      macro_unit: macroUnit,
      requesting_unit: requestingUnit.trim(),
      origin_city_id: originCityId,
      origin_address: originAddress.trim() || undefined,
      destination_city_id: destinationCityId,
      destination_address: destinationAddress.trim() || undefined,
      departure_datetime: departureDatetime,
      return_datetime: returnDatetime,
      passenger_count: passengerCount,
      estimated_km: estimatedKm,
      
      // Opcionais
      allocated_contractor_id: allocatedContractorId || undefined,
      allocated_driver_id: allocatedDriverId || undefined,
      allocated_vehicle_id: allocatedVehicleId || undefined,
      status: allocatedVehicleId && allocatedDriverId ? 'Confirmado ao Demandante' : status,
      travel_report_status: travelReportStatus,
      passenger_names: passengerNames.trim() || undefined,
      trip_objective: tripObjective.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-800 via-brand-700 to-navy-900 p-5 sm:p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-xs">
              <PlusCircle className="w-5 h-5 text-brand-300" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-brand-300 uppercase tracking-wider">
                SIG-FROTA • Protocolo Institucional
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Cadastro de Solicitação de Transporte Oficial
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Status de Prazo & KM Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              statusDeadline === 'Dentro do Prazo'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {statusDeadline === 'Dentro do Prazo' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
              )}
              <div className="text-[11px]">
                <span className="font-bold block">Status do Prazo: {statusDeadline}</span>
                <span>{advanceDays} dias de antecedência • Saída em dia de {departureDayOfWeek}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-2.5">
              <Milestone className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="text-[11px]">
                <span className="font-bold block">Quilometragem Total: {estimatedKm} km</span>
                <span>Ida e Volta calculada automaticamente ({estimatedKm / 2} km / trecho)</span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SEÇÃO 1: DADOS OBRIGATÓRIOS (Processo até Passageiros)    */}
          {/* ======================================================== */}
          <div className="bg-slate-50/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-600"></span>
                <h4 className="text-xs font-bold text-navy-950 uppercase tracking-wider">
                  1. Dados Obrigatórios da Solicitação (Campos Obrigatórios *)
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-800">
                Obrigatório até Quant. Passageiros
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              
              {/* 1. Processo */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1. Nº do Processo *
                </label>
                <input
                  type="text"
                  required
                  value={processNumber}
                  onChange={(e) => setProcessNumber(e.target.value)}
                  placeholder="23282.000000/2026-00"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono font-bold text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {/* 2. Data do Recebimento */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  2. Data do Recebimento *
                </label>
                <input
                  type="date"
                  required
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {/* Horário de Recebimento */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Horário de Recebimento *
                </label>
                <input
                  type="time"
                  required
                  value={receivedTime}
                  onChange={(e) => setReceivedTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {/* 3. Tipo de Atividade */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  3. Tipo de Atividade *
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as ActivityType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 focus:border-brand-500 focus:outline-hidden"
                >
                  {ACTIVITY_TYPES.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Solicitante */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  4. Solicitante (Nome Completo) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prof. Dr. Francisco Silva"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {/* E-mail Institucional */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  E-mail do Solicitante
                </label>
                <input
                  type="email"
                  placeholder="solicitante@unilab.edu.br"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {/* 5. Unidade Macro */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  5. Unidade Macro *
                </label>
                <select
                  value={macroUnit}
                  onChange={(e) => setMacroUnit(e.target.value as MacroUnit)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 focus:border-brand-500 focus:outline-hidden"
                >
                  {MACRO_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Unidade Requisitante */}
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  6. Unidade Requisitante / Setor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Coordenação de Agronomia (IDR)"
                  value={requestingUnit}
                  onChange={(e) => setRequestingUnit(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {/* Bloco Integrado de Itinerário (Origem e Destino Alinhados) */}
              <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                
                {/* Lado Esquerdo: Origem / Partida */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-brand-600"></span>
                    <span className="text-xs font-bold text-brand-950 uppercase tracking-wider">
                      Origem / Partida
                    </span>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-600" />
                      7. Município de Partida *
                    </label>
                    <select
                      value={originCityId}
                      onChange={(e) => setOriginCityId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-hidden"
                    >
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} - {c.state}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Endereço / Local de Embarque
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Campus das Auroras, Pátio Central"
                      value={originAddress}
                      onChange={(e) => setOriginAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Lado Direito: Destino / Chegada */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                    <span className="text-xs font-bold text-rose-950 uppercase tracking-wider">
                      Destino / Chegada
                    </span>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-600" />
                      8. Município de Destino *
                    </label>
                    <select
                      value={destinationCityId}
                      onChange={(e) => setDestinationCityId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-hidden"
                    >
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} - {c.state}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Endereço / Local de Desembarque
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Aeroporto Pinto Martins / Terminal 1"
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden"
                    />
                  </div>
                </div>

              </div>

              {/* 9. Data e Horário de Saída */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  9. Data da Saída *
                </label>
                <input
                  type="date"
                  required
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  10. Horário de Saída *
                </label>
                <input
                  type="time"
                  required
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {/* 11. Data e Horário de Retorno */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  11. Data de Retorno *
                </label>
                <input
                  type="date"
                  required
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  12. Horário de Retorno *
                </label>
                <input
                  type="time"
                  required
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {/* 13. Quantidade de Passageiros (Último campo obrigatório) */}
              <div className="sm:col-span-2 lg:col-span-1 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                <label className="block font-bold text-amber-950 mb-1 flex items-center justify-between">
                  <span>13. Quant. de Passageiros *</span>
                  <span className="text-[10px] text-amber-700 font-bold">(Obrigatório)</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={60}
                  value={passengerCount}
                  onChange={(e) => setPassengerCount(parseInt(e.target.value) || 1)}
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-bold text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-brand-800 font-semibold block mt-1">
                  Sugestão: {recommendation.recommendedType}
                </span>
              </div>

            </div>
          </div>

          {/* ======================================================== */}
          {/* SEÇÃO 2: DADOS DE DESPACHO E ALOCAÇÃO (Opcionais)        */}
          {/* ======================================================== */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Recursos Alocados & Situação (Campos Opcionais)
                </h4>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                Pode ser preenchido agora ou na Central de Despacho
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              
              {/* Contratada */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contratada
                </label>
                <select
                  value={allocatedContractorId}
                  onChange={(e) => setAllocatedContractorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="">Não alocada / Pendente</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Motorista */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motorista
                </label>
                <select
                  value={allocatedDriverId}
                  onChange={(e) => handleDriverChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="">Não alocado / Pendente</option>
                  {availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.driver_category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Categoria do Motorista */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Categoria
                </label>
                <input
                  type="text"
                  readOnly
                  placeholder="Preenchido ao escolher motorista"
                  value={driverCategory}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
                />
              </div>

              {/* Tipo de Veículo */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tipo de Veículo
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="">Selecione o tipo...</option>
                  {VEHICLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Veículo / Placa */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Veículo (Modelo / Placa)
                </label>
                <select
                  value={allocatedVehicleId}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="">Não alocado / Pendente</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} — {v.model} ({v.type} • {v.capacity}L)
                    </option>
                  ))}
                </select>
              </div>

              {/* Situação da Demanda */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Situação da Demanda
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TripStatus)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="Pendente de Análise">Pendente de Análise</option>
                  <option value="Confirmado ao Demandante">Confirmado ao Demandante</option>
                  <option value="Alterado a Data da Demanda">Alterado a Data da Demanda</option>
                  <option value="Indeferido">Indeferido</option>
                </select>
              </div>

              {/* Situação do Relatório de Viagem */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Situação do Relatório de Viagem
                </label>
                <select
                  value={travelReportStatus}
                  onChange={(e) => setTravelReportStatus(e.target.value as TravelReportStatus)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="Não Aplicável">Não Aplicável</option>
                  <option value="Aguardando Envio da Contratada">Aguardando Envio da Contratada</option>
                  <option value="Aguardando a Apreciação do Gerente">Aguardando Parecer do Gerente</option>
                  <option value="Finalizado no Sistema">Finalizado no Sistema</option>
                </select>
              </div>

              {/* Lista de Passageiros */}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Relação / Lista de Passageiros
                </label>
                <input
                  type="text"
                  placeholder="Nomes dos passageiros ou turma..."
                  value={passengerNames}
                  onChange={(e) => setPassengerNames(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {/* Observação */}
              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">
                  Observações Operacionais / Justificativa
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais sobre o percurso, ponto de embarque, etc..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Cadastrar Solicitação</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
