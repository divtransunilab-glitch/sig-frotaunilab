import React, { useState } from 'react';
import { TripRequest } from '../../types';
import { X, CalendarClock, Calendar } from 'lucide-react';

interface ChangeDateModalProps {
  trip: TripRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmChangeDate: (tripId: string, data: { departureDatetime: string; returnDatetime: string; notes?: string }) => void;
}

export const ChangeDateModal: React.FC<ChangeDateModalProps> = ({
  trip,
  isOpen,
  onClose,
  onConfirmChangeDate,
}) => {
  if (!isOpen || !trip) return null;

  const [departureDatetime, setDepartureDatetime] = useState(trip.departure_datetime.substring(0, 16));
  const [returnDatetime, setReturnDatetime] = useState(trip.return_datetime.substring(0, 16));
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(departureDatetime).getTime() >= new Date(returnDatetime).getTime()) {
      alert('A data de retorno deve ser posterior à saída.');
      return;
    }
    onConfirmChangeDate(trip.id, {
      departureDatetime,
      returnDatetime,
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-800 to-navy-900 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-indigo-300">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                Reprogramação de Agenda
              </span>
              <h3 className="text-lg font-bold text-white">
                Alterar Datas da Demanda
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            Processo: <strong>{trip.process_number}</strong> ({trip.requester_name})
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              Nova Data/Hora de Saída *
            </label>
            <input
              type="datetime-local"
              required
              value={departureDatetime}
              onChange={(e) => setDepartureDatetime(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              Nova Data/Hora Prevista de Retorno *
            </label>
            <input
              type="datetime-local"
              required
              value={returnDatetime}
              onChange={(e) => setReturnDatetime(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Motivo da Alteração de Data
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Demanda reagendada a pedido do coordenador devido a choque com prova..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all active:scale-95"
            >
              Salvar Novas Datas
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
