import React, { useState, useEffect } from 'react';
import { TripRequest, Vehicle, Driver, Contractor } from '../../types';
import { FleetService } from '../../services/fleetService';
import { DistanceService } from '../../services/distanceService';
import { ConflictDetector } from '../../services/conflictDetector';
import { 
  X, 
  SendHorizontal, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  User, 
  Building2, 
  Calendar, 
  Users, 
  Milestone,
  Info,
  ShieldAlert
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeFormatDate } from '../../utils/dateUtils';

interface QuickDispatchModalProps {
  trip: TripRequest | null;
  allTrips: TripRequest[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmDispatch: (
    tripId: string,
    allocation: {
      contractorId: string;
      driverId: string;
      vehicleId: string;
      notes?: string;
    }
  ) => void;
}

export const QuickDispatchModal: React.FC<QuickDispatchModalProps> = ({
  trip,
  allTrips,
  isOpen,
  onClose,
  onConfirmDispatch,
}) => {
  if (!isOpen || !trip) return null;

  const contractors = FleetService.getContractors().filter((c) => c.active);
  const allDrivers = FleetService.getDrivers().filter((d) => d.is_active);
  const allVehicles = FleetService.getVehicles().filter((v) => v.is_active);
  const cities = DistanceService.getCities();

  const [selectedContractorId, setSelectedContractorId] = useState<string>(
    trip.allocated_contractor_id || (contractors[0]?.id ?? '')
  );
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    trip.allocated_driver_id || ''
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    trip.allocated_vehicle_id || ''
  );
  const [dispatchNotes, setDispatchNotes] = useState<string>('');

  // Sugestão de veículo com base no número de passageiros
  const recommendation = FleetService.recommendVehicleType(trip.passenger_count);

  // Filtrar motoristas e veículos pela contratada selecionada
  const availableDrivers = allDrivers.filter((d) => d.contractor_id === selectedContractorId);
  const availableVehicles = allVehicles.filter(
    (v) => !v.contractor_id || v.contractor_id === selectedContractorId
  );

  // Auto-selecionar primeiro motorista e veículo disponível caso não selecionados
  useEffect(() => {
    if (availableDrivers.length > 0 && !availableDrivers.some((d) => d.id === selectedDriverId)) {
      setSelectedDriverId(availableDrivers[0].id);
    }
    if (availableVehicles.length > 0 && !availableVehicles.some((v) => v.id === selectedVehicleId)) {
      // Priorizar veículo compatível com a capacidade recomendada
      const bestVehicle =
        availableVehicles.find((v) => v.capacity >= trip.passenger_count) || availableVehicles[0];
      setSelectedVehicleId(bestVehicle.id);
    }
  }, [selectedContractorId]);

  // Detector de Conflitos em Tempo Real (Overbooking Prevention)
  const conflictResult = ConflictDetector.checkConflict(allTrips, {
    tripId: trip.id,
    driverId: selectedDriverId,
    vehicleId: selectedVehicleId,
    departureDatetime: trip.departure_datetime,
    returnDatetime: trip.return_datetime,
  });

  const selectedVehicle = allVehicles.find((v) => v.id === selectedVehicleId);
  const isUnderCapacity = selectedVehicle && selectedVehicle.capacity < trip.passenger_count;

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? c.name : id;
  };

  const departureFormatted = safeFormatDate(trip.departure_datetime, "dd/MM/yyyy 'às' HH:mm", '-');
  const returnFormatted = safeFormatDate(trip.return_datetime, "dd/MM/yyyy 'às' HH:mm", '-');

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractorId || !selectedDriverId || !selectedVehicleId) {
      alert('Selecione a contratada, o motorista e o veículo.');
      return;
    }

    onConfirmDispatch(trip.id, {
      contractorId: selectedContractorId,
      driverId: selectedDriverId,
      vehicleId: selectedVehicleId,
      notes: dispatchNotes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-navy-900 to-slate-900 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-brand-400">
              <SendHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                Escalação de Frota, Motorista & Contratada
              </div>
              <h3 className="text-lg font-bold text-white">
                Escalar Demanda: {trip.process_number}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Form */}
        <form onSubmit={handleDispatch} className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Trip Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Solicitante:</span>
              <div className="font-bold text-slate-800 text-sm">{trip.requester_name}</div>
              <span className="text-slate-500 font-medium">{trip.macro_unit} • {trip.requesting_unit}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Trecho / Distância:</span>
              <div className="font-bold text-slate-800 text-sm">
                {getCityName(trip.origin_city_id)} ➔ {getCityName(trip.destination_city_id)}
              </div>
              <span className="text-brand-700 font-bold">{trip.estimated_km} km (Ida e Volta)</span>
            </div>
            <div className="sm:col-span-2 pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Saída: <strong>{departureFormatted}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span>Retorno: <strong>{returnFormatted}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Passageiros: <strong>{trip.passenger_count}</strong></span>
              </div>
            </div>
          </div>

          {/* Smart Recommendation Banner */}
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900">
              <span className="font-bold">Recomendação do Sistema:</span> Para <strong>{trip.passenger_count} passageiros</strong>, sugerimos veículo do tipo <strong>{recommendation.recommendedType}</strong>. {recommendation.description}
            </div>
          </div>

          {/* OVERBOOKING CONFLICT WARNING (IF DETECTED) */}
          {conflictResult.hasConflict && (
            <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 space-y-2 animate-pulse">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-700">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <span>ALERTA DE CONFLITO DE AGENDA (OVERBOOKING DETECTADO!)</span>
              </div>
              <p className="text-xs text-rose-800 leading-relaxed">
                {conflictResult.reason}. O motorista ou veículo já está comprometido em outra viagem confirmada no mesmo intervalo de datas/horários.
              </p>
              <div className="text-[11px] font-semibold text-rose-700">
                Recomendação: Escolha outro motorista ou veículo disponível para evitar colisão na escala.
              </div>
            </div>
          )}

          {/* Capacity Under-allocation Warning */}
          {isUnderCapacity && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Atenção:</strong> O veículo selecionado comporta apenas {selectedVehicle?.capacity} lugares, mas a solicitação tem {trip.passenger_count} passageiros!
              </span>
            </div>
          )}

          {/* Resource Selection Fields */}
          <div className="space-y-4">
            
            {/* 1. Empresa Contratada */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                1. Empresa Contratada / Prestadora
              </label>
              <select
                value={selectedContractorId}
                onChange={(e) => setSelectedContractorId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 shadow-xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
              >
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Motorista */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                2. Motorista Escalado
              </label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 shadow-xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
              >
                {availableDrivers.length === 0 ? (
                  <option value="">Nenhum motorista vinculado a esta contratada</option>
                ) : (
                  availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — CNH Cat. {d.cnh_category} ({d.driver_category})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* 3. Veículo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-500" />
                3. Veículo Alocado
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 shadow-xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
              >
                {availableVehicles.length === 0 ? (
                  <option value="">Nenhum veículo disponível</option>
                ) : (
                  availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} — {v.model} ({v.type} • {v.capacity} Lugares • {v.fuel_type})
                    </option>
                  ))
                )}
              </select>

              {/* Detalhe de Combustível do Veículo Selecionado */}
              {selectedVehicle && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-[11px]">
                  <div className="text-slate-600">
                    Autonomia: <strong className="text-slate-800">{selectedVehicle.avg_km_per_liter} km/L</strong> ({selectedVehicle.fuel_type})
                  </div>
                  <div className="text-brand-700 font-bold">
                    Consumo Estimado: ~{(trip.estimated_km / (selectedVehicle.avg_km_per_liter || 9)).toFixed(1)} Litros
                  </div>
                </div>
              )}
            </div>

            {/* Observações de Despacho */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Observações Operacionais para o Motorista / Contratada
              </label>
              <textarea
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                rows={2}
                placeholder="Ex: Ponto de encontro no Campus Liberdade às 06:45. Levar lista de passageiros..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 transition-all ${
                conflictResult.hasConflict
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-brand-600 hover:bg-brand-700 active:scale-95 shadow-brand-600/30'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {conflictResult.hasConflict ? 'Confirmar Escalação Mesmo com Conflito' : 'Confirmar Escalação da Demanda'}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
