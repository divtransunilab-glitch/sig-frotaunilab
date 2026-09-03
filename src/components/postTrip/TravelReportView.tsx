import React, { useState } from 'react';
import { TripRequest, TravelReportStatus } from '../../types';
import { TripService } from '../../services/tripService';
import { DistanceService } from '../../services/distanceService';
import { FleetService } from '../../services/fleetService';
import { StatusBadge } from '../common/StatusBadge';
import { 
  ClipboardCheck, 
  Clock, 
  CheckCircle2, 
  FileCheck, 
  UploadCloud, 
  Milestone, 
  Fuel, 
  DollarSign, 
  X,
  SendHorizontal
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeFormatDate } from '../../utils/dateUtils';

interface TravelReportViewProps {
  trips: TripRequest[];
  onTripUpdated: () => void;
}

export const TravelReportView: React.FC<TravelReportViewProps> = ({ trips, onTripUpdated }) => {
  const [selectedTrip, setSelectedTrip] = useState<TripRequest | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Form State
  const [realKm, setRealKm] = useState<string>('');
  const [fuelLiters, setFuelLiters] = useState<string>('');
  const [tollAmount, setTollAmount] = useState<string>('');
  const [reportNotes, setReportNotes] = useState<string>('');

  const cities = DistanceService.getCities();
  const vehicles = FleetService.getVehicles();
  const drivers = FleetService.getDrivers();

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? c.name : id;
  };

  const getVehiclePlate = (id?: string) => {
    if (!id) return '-';
    const v = vehicles.find((item) => item.id === id);
    return v ? `${v.model} (${v.plate})` : '-';
  };

  const getDriverName = (id?: string) => {
    if (!id) return '-';
    const d = drivers.find((item) => item.id === id);
    return d ? d.name : '-';
  };

  const handleOpenSubmitModal = (trip: TripRequest) => {
    setSelectedTrip(trip);
    setRealKm(trip.real_km?.toString() || trip.estimated_km.toString());
    setFuelLiters(trip.fuel_liters?.toString() || '');
    setTollAmount(trip.toll_amount?.toString() || '');
    setReportNotes(trip.report_notes || '');
    setIsSubmitModalOpen(true);
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;

    TripService.submitTravelReport(selectedTrip.id, {
      real_km: parseFloat(realKm) || selectedTrip.estimated_km,
      fuel_liters: fuelLiters ? parseFloat(fuelLiters) : undefined,
      toll_amount: tollAmount ? parseFloat(tollAmount) : undefined,
      report_notes: reportNotes,
    });

    setIsSubmitModalOpen(false);
    onTripUpdated();
  };

  const handleApproveReport = (tripId: string) => {
    TripService.approveTravelReport(tripId);
    onTripUpdated();
  };

  // Filtrar apenas viagens confirmadas
  const eligibleTrips = trips.filter(
    (t) => t.status === 'Confirmado ao Demandante' && t.travel_report_status
  );

  const awaitingContractor = eligibleTrips.filter(
    (t) => t.travel_report_status === 'Aguardando Envio da Contratada'
  );
  const awaitingManager = eligibleTrips.filter(
    (t) => t.travel_report_status === 'Aguardando a Apreciação do Gerente'
  );
  const finalized = eligibleTrips.filter(
    (t) => t.travel_report_status === 'Finalizado no Sistema'
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-brand-600" />
            <h2 className="text-xl font-extrabold text-navy-950">
              Relatórios de Viagem & Apuração de KM Real
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Fluxo de encerramento pós-viagem: prestação de contas da contratada e homologação pelo gestor
          </p>
        </div>
      </div>

      {/* KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
              Aguardando Contratada
            </span>
            <span className="text-2xl font-extrabold text-amber-950 mt-1 block">
              {awaitingContractor.length}
            </span>
          </div>
          <Clock className="w-8 h-8 text-amber-500 opacity-60" />
        </div>

        <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider block">
              Aguardando Homologação do Gerente
            </span>
            <span className="text-2xl font-extrabold text-purple-950 mt-1 block">
              {awaitingManager.length}
            </span>
          </div>
          <FileCheck className="w-8 h-8 text-purple-500 opacity-60" />
        </div>

        <div className="bg-brand-50/70 border border-brand-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-brand-800 uppercase tracking-wider block">
              Finalizados no Sistema
            </span>
            <span className="text-2xl font-extrabold text-brand-950 mt-1 block">
              {finalized.length}
            </span>
          </div>
          <CheckCircle2 className="w-8 h-8 text-brand-600 opacity-60" />
        </div>
      </div>

      {/* Table of Trips */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Viagens em Ciclo de Fechamento ({eligibleTrips.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-3.5 pl-4">Nº Processo</th>
                <th className="p-3.5">Solicitante</th>
                <th className="p-3.5">Trecho</th>
                <th className="p-3.5">Retorno</th>
                <th className="p-3.5">Veículo / Motorista</th>
                <th className="p-3.5 text-center">KM Previsto</th>
                <th className="p-3.5 text-center">KM Real</th>
                <th className="p-3.5">Status Relatório</th>
                <th className="p-3.5 text-right pr-4">Ação de Encerramento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eligibleTrips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Nenhuma viagem confirmada com relatório pendente.
                  </td>
                </tr>
              ) : (
                eligibleTrips.map((trip) => {
                  const returnFormatted = safeFormatDate(trip.return_datetime, "dd/MM/yy HH:mm", '-');
                  const isAwaitingManager = trip.travel_report_status === 'Aguardando a Apreciação do Gerente';
                  const isAwaitingContractor = trip.travel_report_status === 'Aguardando Envio da Contratada';
                  const isFinalized = trip.travel_report_status === 'Finalizado no Sistema';

                  return (
                    <tr key={trip.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 pl-4 font-bold text-navy-950 whitespace-nowrap">
                        {trip.process_number}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{trip.requester_name}</div>
                        <div className="text-[10px] text-slate-500">{trip.macro_unit}</div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {getCityName(trip.origin_city_id)} ➔ {getCityName(trip.destination_city_id)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-medium text-slate-700">
                        {returnFormatted}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{getVehiclePlate(trip.allocated_vehicle_id)}</div>
                        <div className="text-[10px] text-slate-500">{getDriverName(trip.allocated_driver_id)}</div>
                      </td>
                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {trip.estimated_km} km
                      </td>
                      <td className="p-3.5 text-center font-extrabold text-brand-700 bg-brand-50/50">
                        {trip.real_km ? `${trip.real_km} km` : '-'}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <StatusBadge reportStatus={trip.travel_report_status} />
                      </td>
                      <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Botão Envio da Contratada */}
                          <button
                            onClick={() => handleOpenSubmitModal(trip)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1"
                          >
                            <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                            <span>{isFinalized ? 'Editar KM' : 'Lançar KM Real'}</span>
                          </button>

                          {/* Botão de Homologação do Gerente */}
                          {isAwaitingManager && (
                            <button
                              onClick={() => handleApproveReport(trip.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-all flex items-center gap-1 active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Homologar Parecer</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lançamento do Relatório */}
      {isSubmitModalOpen && selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">Prestação de Contas</span>
                <h3 className="font-bold text-base text-navy-950">
                  Lançar Relatório: {selectedTrip.process_number}
                </h3>
              </div>
              <button onClick={() => setIsSubmitModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700">
                Trecho: <strong>{getCityName(selectedTrip.origin_city_id)} ➔ {getCityName(selectedTrip.destination_city_id)}</strong> (KM Previsto: {selectedTrip.estimated_km} km)
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Milestone className="w-3.5 h-3.5 text-brand-600" />
                  Quilometragem Real Percorrida (KM Total) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step={0.1}
                  value={realKm}
                  onChange={(e) => setRealKm(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Fuel className="w-3.5 h-3.5 text-amber-600" />
                    Combustível (Litros)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    placeholder="Ex: 24.5"
                    value={fuelLiters}
                    onChange={(e) => setFuelLiters(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    Pedágio / Taxas (R$)
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    placeholder="Ex: 12.00"
                    value={tollAmount}
                    onChange={(e) => setTollAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observações do Motorista / Ocorrências no Percurso
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Viagem realizada sem intercorrências, chegada no horário previsto..."
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-bold shadow-md flex items-center gap-1.5"
                >
                  <SendHorizontal className="w-3.5 h-3.5" />
                  <span>Enviar para Parecer do Gerente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
