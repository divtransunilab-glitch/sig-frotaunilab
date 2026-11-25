import React, { useEffect, useState } from 'react';
import { TripRequest } from '../../types';
import { X, XCircle, Building2, ShieldAlert } from 'lucide-react';

interface CancelTripModalProps {
  trip: TripRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (
    tripId: string,
    data: { isExecutante: boolean; reason: string; notes: string }
  ) => void;
}

const DEMANDANTE_REASONS = [
  'Desistência / Cancelamento da atividade acadêmica ou administrativa',
  'Adiamento ou remarcação do evento pela unidade solicitante',
  'Alteração de cronograma / ausência de participantes',
  'Viagem atendida por outro meio de transporte',
  'Solicitação aberta em duplicidade',
  'Outros',
];

const EXECUTANTE_REASONS = [
  'Indisponibilidade operacional de veículo / manutenção emergencial',
  'Indisponibilidade de motorista',
  'Condições climáticas adversas / força maior',
  'Inconsistência ou falta de informações no processo SEI',
  'Restrição orçamentária / franquia de quilometragem',
  'Outros',
];

export const CancelTripModal: React.FC<CancelTripModalProps> = ({
  trip,
  isOpen,
  onClose,
  onConfirmCancel,
}) => {
  const [origin, setOrigin] = useState<'demandante' | 'executante'>('demandante');
  const [reason, setReason] = useState<string>(DEMANDANTE_REASONS[0]);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setOrigin('demandante');
      setReason(DEMANDANTE_REASONS[0]);
      setNotes('');
    }
  }, [isOpen, trip?.id]);

  if (!isOpen || !trip) return null;

  const reasonList = origin === 'executante' ? EXECUTANTE_REASONS : DEMANDANTE_REASONS;

  const handleOriginChange = (nextOrigin: 'demandante' | 'executante') => {
    setOrigin(nextOrigin);
    setReason(nextOrigin === 'executante' ? EXECUTANTE_REASONS[0] : DEMANDANTE_REASONS[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmCancel(trip.id, {
      isExecutante: origin === 'executante',
      reason,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-rose-200 w-full max-w-lg max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header Vermelho (Padrão Oficial: Cancelado = Vermelho) */}
        <div className="bg-rose-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">Cancelar Solicitação</h3>
              <p className="text-xs text-rose-100 font-mono">
                {trip.process_number} • {trip.macro_unit}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-rose-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Origem do Cancelamento */}
          <div>
            <label className="block font-bold text-slate-700 mb-2">
              Quem solicitou / realizou o cancelamento? *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleOriginChange('demandante')}
                className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                  origin === 'demandante'
                    ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-200 text-rose-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Building2
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    origin === 'demandante' ? 'text-rose-600' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="font-extrabold">Unidade Demandante</div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">
                    Cancelado a pedido do solicitante / setor
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleOriginChange('executante')}
                className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                  origin === 'executante'
                    ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-200 text-rose-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ShieldAlert
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    origin === 'executante' ? 'text-rose-600' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="font-extrabold">Unidade Executante</div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">
                    Cancelado pela DIVTRANS / gestão de frota
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Motivo Estruturado */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Motivo do Cancelamento *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 font-semibold focus:border-rose-500 focus:outline-hidden"
            >
              {reasonList.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Justificativa / Detalhamento */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Detalhamento / Justificativa do Cancelamento *
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              rows={3}
              placeholder="Descreva o motivo do cancelamento (ex.: ofício/e-mail do solicitante, indisponibilidade emergencial, etc.)..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 focus:border-rose-500 focus:outline-hidden"
            />
          </div>

          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900">
            Status final:{' '}
            <strong>
              {origin === 'executante'
                ? 'Cancelado pela Unidade Executante'
                : 'Cancelado pelo Demandante'}
            </strong>
            . O registro ficará salvo no histórico e visível na consulta do processo.
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Voltar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold shadow-md flex items-center gap-1.5 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              <span>Confirmar Cancelamento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
