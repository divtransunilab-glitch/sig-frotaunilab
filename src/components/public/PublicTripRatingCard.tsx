import React, { useState } from 'react';
import {
  Star,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { TripRequest } from '../../types';
import { TripService } from '../../services/tripService';
import { safeFormatDate } from '../../utils/dateUtils';

interface PublicTripRatingCardProps {
  trip: TripRequest;
  onSentCountUpdated?: (tripId: string, newSentCount: number) => void;
}

export const PublicTripRatingCard: React.FC<PublicTripRatingCardProps> = ({
  trip,
  onSentCountUpdated,
}) => {
  const [sentCount, setSentCount] = useState<number>(Number(trip.rating_link_sent_count || 0));
  const [isSending, setIsSending] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const alreadyRated = Boolean(trip.rating_overall && trip.rated_at);
  const limitReached = sentCount >= 3;
  const missingEmail = trip.has_requester_email === false;

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

  const handleRequestLink = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSending(true);

    const res = await TripService.requestPublicRatingEmailLink(trip.id, trip.process_number);
    setIsSending(false);

    if (!res.ok) {
      if (typeof res.sentCount === 'number') {
        setSentCount(res.sentCount);
        onSentCountUpdated?.(trip.id, res.sentCount);
      }
      setErrorMsg(res.error || 'Não foi possível enviar o link de avaliação.');
      return;
    }

    const updatedCount = typeof res.sentCount === 'number' ? res.sentCount : sentCount + 1;
    setSentCount(updatedCount);
    onSentCountUpdated?.(trip.id, updatedCount);
    setMaskedEmail(res.maskedEmail || 'o e-mail cadastrado');
    setSuccessMsg(
      `Link exclusivo enviado para ${res.maskedEmail || 'o e-mail cadastrado na solicitação'}! Verifique sua caixa de entrada ou spam.`
    );
  };

  return (
    <div className="bg-gradient-to-br from-amber-50/80 to-white border border-amber-200/90 rounded-2xl p-4 space-y-3 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-extrabold text-navy-950">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Avaliar Experiência da Viagem</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Por segurança, o link exclusivo de avaliação é enviado diretamente para o{' '}
            <strong>e-mail do solicitante cadastrado no pedido</strong> (máximo de 3 envios por viagem).
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
          <button
            type="button"
            disabled={isSending || limitReached || missingEmail}
            onClick={handleRequestLink}
            className={`px-3.5 py-2.5 rounded-xl font-extrabold text-xs shadow-xs flex items-center gap-1.5 transition-colors ${
              limitReached || missingEmail
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {isSending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Enviando e-mail...</span>
              </>
            ) : limitReached ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Limite de 3 envios atingido</span>
              </>
            ) : (
              <>
                <Mail className="w-3.5 h-3.5" />
                <span>{sentCount > 0 ? 'Reenviar Link por E-mail' : 'Enviar Link de Avaliação'}</span>
              </>
            )}
          </button>

          <span className="text-[10px] font-bold text-slate-500">
            Envios utilizados: <strong className={limitReached ? 'text-rose-600' : 'text-navy-950'}>{sentCount} / 3</strong>
          </span>
        </div>
      </div>

      {missingEmail && (
        <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            Esta solicitação não possui e-mail do solicitante cadastrado. Solicite a atualização à DIVTRANS para habilitar a avaliação.
          </span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-semibold flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div>{successMsg}</div>
            {maskedEmail && (
              <div className="text-[10px] text-emerald-700 font-normal mt-0.5">
                Restam {Math.max(0, 3 - sentCount)} {3 - sentCount === 1 ? 'envio disponível' : 'envios disponíveis'} para este processo.
              </div>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
