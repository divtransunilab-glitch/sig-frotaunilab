import React, { useState } from 'react';
import { Star, CheckCircle2, Loader2, MessageSquare, Sparkles, AlertCircle } from 'lucide-react';
import { TripRequest } from '../../types';
import { TripService } from '../../services/tripService';
import { safeFormatDate } from '../../utils/dateUtils';

interface PublicTripRatingCardProps {
  trip: TripRequest;
  onRated: (
    tripId: string,
    rating: {
      rating_overall: number;
      rating_punctuality: number;
      rating_vehicle: number;
      rating_driver: number;
      rating_comment?: string;
      rated_at: string;
    }
  ) => void;
}

const StarRow: React.FC<{
  label: string;
  value: number;
  onChange: (val: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/90">
    <span className="text-xs font-bold text-slate-700">{label}</span>
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
          aria-label={`${label}: ${n} de 5 estrelas`}
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              n <= value
                ? 'fill-amber-400 text-amber-500'
                : 'fill-slate-100 text-slate-300 hover:text-amber-300'
            }`}
          />
        </button>
      ))}
    </div>
  </div>
);

export const PublicTripRatingCard: React.FC<PublicTripRatingCardProps> = ({ trip, onRated }) => {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [punctuality, setPunctuality] = useState<number>(5);
  const [vehicle, setVehicle] = useState<number>(5);
  const [driver, setDriver] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [raterName, setRaterName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const alreadyRated = Boolean(trip.rating_overall && trip.rated_at);

  if (alreadyRated) {
    const overall = Number(trip.rating_overall || 0);
    return (
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-extrabold text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Avaliação da Viagem Registrada</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-extrabold">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-600" />
            <span>{overall.toFixed(1)} / 5.0</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="bg-white/90 rounded-xl px-2.5 py-1.5 border border-emerald-200/80 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Pontualidade</span>
            <strong className="text-navy-950">{trip.rating_punctuality ?? '-'} ★</strong>
          </div>
          <div className="bg-white/90 rounded-xl px-2.5 py-1.5 border border-emerald-200/80 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Veículo</span>
            <strong className="text-navy-950">{trip.rating_vehicle ?? '-'} ★</strong>
          </div>
          <div className="bg-white/90 rounded-xl px-2.5 py-1.5 border border-emerald-200/80 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Motorista</span>
            <strong className="text-navy-950">{trip.rating_driver ?? '-'} ★</strong>
          </div>
        </div>

        {trip.rating_comment && (
          <div className="bg-white/90 rounded-xl px-3 py-2 border border-emerald-200/70 text-slate-700 italic">
            &ldquo;{trip.rating_comment}&rdquo;
          </div>
        )}

        <div className="text-[10px] text-emerald-800/80">
          Obrigado por contribuir para a melhoria contínua do transporte institucional da UNILAB • Registrado em{' '}
          {safeFormatDate(trip.rated_at, "dd/MM/yyyy 'às' HH:mm", '')}.
        </div>
      </div>
    );
  }

  const avgPreview = ((punctuality + vehicle + driver) / 3).toFixed(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const res = await TripService.submitPublicTripRating({
      tripId: trip.id,
      processNumber: trip.process_number,
      punctuality,
      vehicle,
      driver,
      comment,
      raterName,
    });

    setIsSubmitting(false);

    if (!res.ok || !res.rating) {
      setErrorMsg(res.error || 'Não foi possível enviar a avaliação.');
      return;
    }

    onRated(trip.id, res.rating);
    setIsOpenForm(false);
  };

  return (
    <div className="bg-gradient-to-br from-amber-50/80 to-white border border-amber-200/90 rounded-2xl p-4 space-y-3 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 font-extrabold text-navy-950">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Como foi a experiência nesta viagem?</span>
          </div>
          <p className="text-[11px] text-slate-600">
            Avalie em 10 segundos a pontualidade, o veículo e o atendimento do motorista (sem precisar de login).
          </p>
        </div>

        {!isOpenForm && (
          <button
            type="button"
            onClick={() => setIsOpenForm(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <Star className="w-3.5 h-3.5 fill-white" />
            <span>Avaliar Viagem</span>
          </button>
        )}
      </div>

      {isOpenForm && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-amber-200/70">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <StarRow label="Pontualidade" value={punctuality} onChange={setPunctuality} />
            <StarRow label="Veículo / Conforto" value={vehicle} onChange={setVehicle} />
            <StarRow label="Motorista" value={driver} onChange={setDriver} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                <MessageSquare className="w-3 h-3" />
                <span>Comentário ou sugestão (opcional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Ex.: Motorista muito educado, veículo limpo e saída no horário..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Seu nome (opcional)
              </label>
              <input
                type="text"
                value={raterName}
                onChange={(e) => setRaterName(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Prof. João / Passageiro"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="mt-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-100/70 text-[11px] font-extrabold text-amber-950">
                <span>Nota Geral:</span>
                <span>{avgPreview} / 5.0 ★</span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsOpenForm(false);
                setErrorMsg('');
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-navy-950 hover:bg-navy-900 disabled:opacity-60 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Enviar Avaliação</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
