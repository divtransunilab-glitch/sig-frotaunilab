import React from 'react';
import { TripStatus, StatusDeadline, TravelReportStatus } from '../../types';
import { CheckCircle2, Clock, XCircle, AlertTriangle, CalendarClock, FileCheck } from 'lucide-react';

interface StatusBadgeProps {
  status?: TripStatus;
  deadline?: StatusDeadline;
  reportStatus?: TravelReportStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, deadline, reportStatus, size = 'sm' }) => {
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5 font-medium',
    md: 'text-sm px-3 py-1 font-semibold',
    lg: 'text-base px-3.5 py-1.5 font-bold',
  };

  if (deadline) {
    if (deadline === 'Dentro do Prazo') {
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 ${sizeClasses[size]}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Dentro do Prazo
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 ${sizeClasses[size]}`}>
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
        Fora do Prazo (&lt; 5d)
      </span>
    );
  }

  if (reportStatus) {
    switch (reportStatus) {
      case 'Finalizado no Sistema':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 ${sizeClasses[size]}`}>
            <FileCheck className="w-3.5 h-3.5 text-blue-600" />
            Finalizado no Sistema
          </span>
        );
      case 'Aguardando a Apreciação do Gerente':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 border border-purple-300 ${sizeClasses[size]}`}>
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            Aguardando Parecer do Gerente
          </span>
        );
      case 'Aguardando Envio da Contratada':
        return (
          <span className={`inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 ${sizeClasses[size]}`}>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Aguardando Envio da Contratada
          </span>
        );
      default:
        return <span className="text-slate-400 text-xs">-</span>;
    }
  }

  if (!status) return null;

  switch (status) {
    case 'Confirmado ao Demandante':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 ${sizeClasses[size]}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          Confirmado ao Demandante
        </span>
      );
    case 'Pendente de Análise':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses[size]}`}>
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          Pendente de Análise
        </span>
      );
    case 'Indeferido':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses[size]}`}>
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          Indeferido
        </span>
      );
    case 'Alterado a Data da Demanda':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 ${sizeClasses[size]}`}>
          <CalendarClock className="w-3.5 h-3.5 text-indigo-500" />
          Data Alterada
        </span>
      );
    case 'Cancelado pelo Demandante':
    case 'Cancelado pela Unidade Executante':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses[size]}`}>
          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          {status === 'Cancelado pelo Demandante' ? 'Cancelado (Demandante)' : 'Cancelado (Executante)'}
        </span>
      );
    default:
      return <span className="text-slate-600">{status}</span>;
  }
};
