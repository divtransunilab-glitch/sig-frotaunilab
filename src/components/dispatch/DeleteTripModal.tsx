import React, { useState } from 'react';
import { TripRequest } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { Trash2, X, AlertTriangle, Lock, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface DeleteTripModalProps {
  trip: TripRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (tripId: string) => void;
}

export const DeleteTripModal: React.FC<DeleteTripModalProps> = ({
  trip,
  isOpen,
  onClose,
  onConfirmDelete,
}) => {
  if (!isOpen || !trip) return null;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleClose = () => {
    setPassword('');
    setErrorMsg(null);
    setIsVerifying(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!password) {
      setErrorMsg('Por favor, digite sua senha de acesso para autorizar a exclusão.');
      return;
    }

    setIsVerifying(true);

    try {
      // Obter usuário salvo no localStorage ou sessão Supabase
      const savedUserStr = localStorage.getItem('sigfrota_user');
      let userEmail = '';

      if (savedUserStr) {
        try {
          const u = JSON.parse(savedUserStr);
          userEmail = u.email || '';
        } catch {
          // fallback
        }
      }

      if (!userEmail) {
        const { data: sessionData } = await supabase.auth.getUser();
        userEmail = sessionData.user?.email || '';
      }

      // Se houver e-mail autenticado no Supabase, valida a senha com o banco
      if (userEmail) {
        const { error } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: password,
        });

        if (error) {
          setErrorMsg('Senha de acesso incorreta! A exclusão foi cancelada por segurança.');
          setIsVerifying(false);
          return;
        }
      } else {
        // Validação local de contingência caso esteja em modo offline/sem e-mail
        if (password.length < 4) {
          setErrorMsg('Senha inválida. Digite a senha de acesso cadastrada.');
          setIsVerifying(false);
          return;
        }
      }

      // Senha validada com sucesso! Conclui exclusão.
      onConfirmDelete(trip.id);
      handleClose();
    } catch (err: any) {
      setErrorMsg(`Falha na verificação de segurança: ${err?.message || 'Erro de autenticação'}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-rose-100 w-full max-w-md overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-red-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-rose-200">
              <Trash2 className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                Exclusão Definitiva
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">
                Excluir Solicitação de Viagem
              </h3>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-rose-200 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">

          {/* Warning Box */}
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-1">
            <div className="flex items-center gap-2 font-bold text-rose-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Atenção: Ação Irreversível</span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-800">
              Esta solicitação será <strong>removida permanentemente</strong> da fila de viagens e do banco de dados Supabase.
            </p>
          </div>

          {/* Trip Summary Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-navy-950 text-xs">{trip.process_number}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                {trip.status}
              </span>
            </div>
            <div className="text-slate-700 font-semibold truncate">
              {trip.requester_name} ({trip.macro_unit})
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Destino: <strong>{trip.destination_city_id}</strong>
            </div>
          </div>

          {/* Password Prompt */}
          <div className="space-y-1.5 pt-1">
            <label className="block font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Confirme sua Senha de Acesso para Excluir *</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha do sistema"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-rose-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-[11px] font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 shadow-md shadow-rose-600/30 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Verificando Senha...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirmar e Excluir</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
