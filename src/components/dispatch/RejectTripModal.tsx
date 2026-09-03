import React, { useState } from 'react';
import { TripRequest, RejectionReason } from '../../types';
import { X, XCircle, AlertTriangle } from 'lucide-react';

interface RejectTripModalProps {
  trip: TripRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmReject: (tripId: string, data: { reason: RejectionReason | string; rejection_notes?: string }) => void;
}

const REJECTION_REASONS: RejectionReason[] = [
  'Indisponibilidade de veículo',
  'Indisponibilidade de veículo e KM',
  'Fora do prazo',
  'Inconsistência nas informações',
  'Outros',
];

export const RejectTripModal: React.FC<RejectTripModalProps> = ({
  trip,
  isOpen,
  onClose,
  onConfirmReject,
}) => {
  if (!isOpen || !trip) return null;

  const [selectedReason, setSelectedReason] = useState<RejectionReason>('Indisponibilidade de veículo');
  const [rejectionNotes, setRejectionNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmReject(trip.id, {
      reason: selectedReason,
      rejection_notes: rejectionNotes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-800 to-rose-950 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-rose-300">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider">
                Despacho Negativo
              </span>
              <h3 className="text-lg font-bold text-white">
                Indeferir Solicitação {trip.process_number}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-rose-200 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>
              Ao indeferir, o status do processo será atualizado e o solicitante ({trip.requester_name}) receberá o parecer motivado.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Motivo Padronizado de Indeferimento *
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value as RejectionReason)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-800 focus:border-rose-500 focus:outline-hidden"
            >
              {REJECTION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Justificativa / Parecer Técnico Complementar
            </label>
            <textarea
              rows={3}
              placeholder="Descreva a motivação detalhada para registro no histórico..."
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-rose-500 focus:outline-hidden"
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
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition-all active:scale-95"
            >
              Confirmar Indeferimento
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
