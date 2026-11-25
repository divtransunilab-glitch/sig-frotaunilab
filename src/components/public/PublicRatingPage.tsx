import React, { useEffect, useState } from 'react';
import {
  Star,
  CheckCircle2,
  Loader2,
  Lock,
  AlertTriangle,
  ArrowLeft,
  Bus,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { TripRequest } from '../../types';
import { TripService } from '../../services/tripService';
import { DistanceService } from '../../services/distanceService';
import { safeFormatDate } from '../../utils/dateUtils';

interface PublicRatingPageProps {
  tripId: string;
  ratingToken: string;
  onExitRatingMode: () => void;
}

const StarSelector: React.FC<{
  label: string;
  description: string;
  value: number;
  onChange: (val: number) => void;
}> = ({ label, description, value, onChange }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
    <div>
      <div className="text-xs font-extrabold text-navy-950">{label}</div>
      <div className="text-[11px] text-slate-500">{description}</div>
    </div>
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-1 transition-transform hover:scale-110 focus:outline-none"
          aria-label={`${label}: ${n} de 5 estrelas`}
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              n <= value
                ? 'fill-amber-400 text-amber-500'
                : 'fill-white text-slate-300 hover:text-amber-300'
            }`}
          />
        </button>
      ))}
    </div>
  </div>
);

export const PublicRatingPage: React.FC<PublicRatingPageProps> = ({
  tripId,
  ratingToken,
  onExitRatingMode,
}) => {
  const [pageState, setPageState] = useState<'loading' | 'ok' | 'already_rated' | 'invalid_token' | 'not_found' | 'error'>('loading');
  const [trip, setTrip] = useState<(Partial<TripRequest> & { driver_public_name?: string }) | null>(null);

  const [punctuality, setPunctuality] = useState<number>(5);
  const [vehicle, setVehicle] = useState<number>(5);
  const [driver, setDriver] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [raterName, setRaterName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const cities = DistanceService.getCities();
  const getCityName = (id?: string) => {
    if (!id) return '-';
    const found = cities.find((c) => c.id === id);
    return found ? `${found.name}-${found.state}` : id;
  };

  useEffect(() => {
    let active = true;
    TripService.fetchTripForRating(tripId, ratingToken).then((res) => {
      if (!active) return;
      setPageState(res.status);
      if (res.trip) {
        setTrip(res.trip);
      }
    });
    return () => {
      active = false;
    };
  }, [tripId, ratingToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    const res = await TripService.submitPublicTripRating({
      tripId,
      ratingToken,
      punctuality,
      vehicle,
      driver,
      comment,
      raterName,
    });

    setIsSubmitting(false);

    if (!res.ok || !res.rating) {
      setSubmitError(res.error || 'Não foi possível registrar sua avaliação.');
      return;
    }

    setTrip((prev) => ({ ...(prev || {}), ...res.rating }));
    setPageState('already_rated');
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 max-w-sm w-full text-center space-y-3">
          <Loader2 className="w-10 h-10 text-amber-600 animate-spin mx-auto" />
          <h1 className="text-base font-extrabold text-navy-950">Validando Link de Avaliação...</h1>
          <p className="text-xs text-slate-500">Verificando a autenticidade do token no SIG-FROTA UNILAB.</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid_token' || pageState === 'not_found' || pageState === 'error') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-rose-200 p-8 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
            {pageState === 'invalid_token' ? <Lock className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
          </div>
          <h1 className="text-lg font-extrabold text-navy-950">
            {pageState === 'invalid_token'
              ? 'Link de Avaliação Inválido ou Expirado'
              : 'Viagem não encontrada'}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Este link exclusivo não é válido ou já foi utilizado. Caso ainda não tenha avaliado, acesse o
            Portal Público e solicite o envio de um novo link para o e-mail cadastrado na solicitação.
          </p>
          <button
            type="button"
            onClick={onExitRatingMode}
            className="w-full py-3 px-4 rounded-xl bg-navy-950 hover:bg-navy-900 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ir para o Portal Público SIG-FROTA</span>
          </button>
        </div>
      </div>
    );
  }

  if (pageState === 'already_rated') {
    const overall = Number(trip?.rating_overall || 0);
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-emerald-200 p-8 max-w-md w-full text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-navy-950">Avaliação Registrada!</h1>
            <p className="text-xs text-slate-500">
              Processo <strong>{trip?.process_number}</strong> • {trip?.macro_unit}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-extrabold text-lg">
            <Star className="w-5 h-5 fill-amber-400 text-amber-600" />
            <span>{overall.toFixed(1)} / 5.0</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold">Pontualidade</div>
              <div className="font-extrabold text-navy-950 mt-0.5">{trip?.rating_punctuality ?? '-'} ★</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold">Veículo</div>
              <div className="font-extrabold text-navy-950 mt-0.5">{trip?.rating_vehicle ?? '-'} ★</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold">Motorista</div>
              <div className="font-extrabold text-navy-950 mt-0.5">{trip?.rating_driver ?? '-'} ★</div>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Obrigado! Sua avaliação foi registrada com segurança e ajuda a DIVTRANS / UNILAB a aprimorar continuamente a qualidade do transporte institucional.
          </p>

          <button
            type="button"
            onClick={onExitRatingMode}
            className="w-full py-3 px-4 rounded-xl bg-navy-950 hover:bg-navy-900 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Portal SIG-FROTA</span>
          </button>
        </div>
      </div>
    );
  }

  const avgPreview = ((punctuality + vehicle + driver) / 3).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
        {/* Header */}
        <div className="bg-navy-950 text-white p-6 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
                <Bus className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-sm tracking-tight">
                SIG<span className="text-brand-400">-FROTA</span> • UNILAB
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              <ShieldCheck className="w-3 h-3" />
              Link Exclusivo Verificado
            </span>
          </div>
          <h1 className="text-xl font-extrabold">Avaliação de Satisfação da Viagem</h1>
          <p className="text-xs text-slate-300">
            Processo <strong className="text-white">{trip?.process_number}</strong> •{' '}
            {getCityName(trip?.origin_city_id)} ➔ {getCityName(trip?.destination_city_id)} •{' '}
            {safeFormatDate(trip?.departure_datetime, 'dd/MM/yyyy', '-')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2.5">
            <StarSelector
              label="Pontualidade"
              description="Cumprimento dos horários de saída e retorno"
              value={punctuality}
              onChange={setPunctuality}
            />
            <StarSelector
              label="Veículo & Conforto"
              description="Conservação, limpeza, ar-condicionado e segurança"
              value={vehicle}
              onChange={setVehicle}
            />
            <StarSelector
              label="Atendimento do Motorista"
              description={
                trip?.driver_public_name
                  ? `Cordialidade e condução segura (${trip.driver_public_name})`
                  : 'Cordialidade, postura e condução segura'
              }
              value={driver}
              onChange={setDriver}
            />
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Comentário, elogio ou sugestão (opcional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Conte como foi sua experiência..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Seu nome (opcional)
                </label>
                <input
                  type="text"
                  value={raterName}
                  onChange={(e) => setRaterName(e.target.value)}
                  maxLength={120}
                  placeholder={trip?.requester_name || 'Ex.: Prof. Maria'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Média Geral:</span>
                <span className="text-base font-black text-amber-700">{avgPreview} / 5.0 ★</span>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {submitError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onExitRatingMode}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-navy-950 hover:bg-navy-900 disabled:opacity-60 text-white text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Confirmar e Enviar Avaliação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
