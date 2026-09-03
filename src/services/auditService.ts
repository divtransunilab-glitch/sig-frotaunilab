import { AuditLog, AuditAction, AuditFilterOptions, TripRequest } from '../types';
import { INITIAL_AUDIT_LOGS } from '../data/initialData';
import { parseISO, isWithinInterval, isValid } from 'date-fns';

const STORAGE_KEY_AUDIT = 'sigfrota_audit_logs';

export class AuditService {
  /**
   * Obtém todos os logs de auditoria armazenados ou inicializa com os dados iniciais
   */
  static getLogs(filter?: AuditFilterOptions): AuditLog[] {
    let logs: AuditLog[] = [];
    const saved = localStorage.getItem(STORAGE_KEY_AUDIT);
    
    if (saved) {
      try {
        logs = JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler logs de auditoria do storage', e);
        logs = INITIAL_AUDIT_LOGS;
      }
    } else {
      logs = INITIAL_AUDIT_LOGS;
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(logs));
    }

    if (!filter) {
      return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    return logs
      .filter((log) => {
        if (filter.action && filter.action !== 'ALL' && log.action !== filter.action) {
          return false;
        }
        if (filter.entity_type && filter.entity_type !== 'ALL' && log.entity_type !== filter.entity_type) {
          return false;
        }
        if (filter.compliance_status && filter.compliance_status !== 'ALL' && log.compliance_status !== filter.compliance_status) {
          return false;
        }
        if (filter.searchTerm && filter.searchTerm.trim() !== '') {
          const term = filter.searchTerm.toLowerCase();
          const matchProcess = log.process_number?.toLowerCase().includes(term);
          const matchUser = log.user_name.toLowerCase().includes(term);
          const matchDetails = log.details.toLowerCase().includes(term);
          const matchAction = log.action.toLowerCase().includes(term);
          if (!matchProcess && !matchUser && !matchDetails && !matchAction) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Registra um novo evento no log de auditoria
   */
  static logEvent(
    entry: Partial<AuditLog> & {
      action: AuditAction;
      entity_type: AuditLog['entity_type'];
      details: string;
    }
  ): AuditLog {
    const logs = this.getLogs();
    const newLog: AuditLog = {
      id: entry.id || `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      user_name: entry.user_name || 'Gestor DIVTRANS',
      user_role: entry.user_role || 'Administrador de Transportes',
      action: entry.action,
      target_id: entry.target_id,
      process_number: entry.process_number,
      entity_type: entry.entity_type,
      details: entry.details,
      ip_address: entry.ip_address || '10.20.4.15',
      compliance_status: entry.compliance_status || 'Conforme',
      notes: entry.notes,
    };

    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(logs));
    return newLog;
  }

  /**
   * Calcula métricas e indicadores de conformidade e integridade institucional
   */
  static getComplianceMetrics(trips: TripRequest[]) {
    const logs = this.getLogs();
    const totalLogs = logs.length;

    const conformes = logs.filter((l) => l.compliance_status === 'Conforme').length;
    const alertas = logs.filter((l) => l.compliance_status === 'Alerta').length;
    const excecoes = logs.filter((l) => l.compliance_status === 'Exceção Justificada').length;
    const criticos = logs.filter((l) => l.compliance_status === 'Crítico').length;

    const complianceRate = totalLogs > 0 ? Math.round(((conformes + excecoes) / totalLogs) * 100) : 100;

    // Aderência ao prazo de 5 dias
    const inDeadlineCount = trips.filter((t) => t.status_deadline === 'Dentro do Prazo').length;
    const outDeadlineCount = trips.filter((t) => t.status_deadline === 'Fora do Prazo').length;
    const totalTrips = trips.length;
    const deadlineAdherenceRate = totalTrips > 0 ? Math.round((inDeadlineCount / totalTrips) * 100) : 100;

    // Viagens confirmadas com relatórios de bordo
    const confirmedTrips = trips.filter((t) => t.status === 'Confirmado ao Demandante');
    const reportsFinished = confirmedTrips.filter((t) => t.travel_report_status === 'Finalizado no Sistema').length;
    const reportsPending = confirmedTrips.filter((t) => t.travel_report_status === 'Aguardando a Apreciação do Gerente' || t.travel_report_status === 'Aguardando Envio da Contratada').length;
    const reportAdherenceRate = confirmedTrips.length > 0 ? Math.round((reportsFinished / confirmedTrips.length) * 100) : 100;

    return {
      totalLogs,
      complianceRate,
      conformes,
      alertas,
      excecoes,
      criticos,
      deadlineAdherenceRate,
      inDeadlineCount,
      outDeadlineCount,
      confirmedCount: confirmedTrips.length,
      reportsFinished,
      reportsPending,
      reportAdherenceRate,
    };
  }

  /**
   * Exporta os registros de auditoria em CSV
   */
  static exportAuditCSV(logs: AuditLog[]): void {
    const headers = [
      'ID Auditoria',
      'Data/Hora',
      'Agente / Usuário',
      'Perfil',
      'Ação Realizada',
      'Nº Processo SEI',
      'Entidade',
      'Status Conformidade',
      'IP Origem',
      'Detalhes da Operação'
    ];

    const rows = logs.map((log) => [
      log.id,
      new Date(log.timestamp).toLocaleString('pt-BR'),
      `"${log.user_name}"`,
      `"${log.user_role}"`,
      `"${log.action}"`,
      `"${log.process_number || '-'}"`,
      `"${log.entity_type}"`,
      `"${log.compliance_status}"`,
      `"${log.ip_address || '-'}"`,
      `"${log.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Auditoria_SIG_Frota_UNILAB_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(INITIAL_AUDIT_LOGS));
  }
}
