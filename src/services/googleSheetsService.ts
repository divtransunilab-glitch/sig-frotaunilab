import { TripRequest } from '../types';
import { DistanceService } from './distanceService';
import { FleetService } from './fleetService';
import { safeFormatDate } from '../utils/dateUtils';
import { parseISO, isValid, getMonth, getYear } from 'date-fns';

const STORAGE_KEY_URL = 'sigfrota_gsheets_webhook_url';
const STORAGE_KEY_TOKEN = 'sigfrota_gsheets_token';
const STORAGE_KEY_ENABLED = 'sigfrota_gsheets_enabled';
const STORAGE_KEY_LAST_SYNC = 'sigfrota_gsheets_last_sync';

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export interface GoogleSheetsConfig {
  webhookUrl: string;
  token: string;
  enabled: boolean;
}

export interface GoogleSheetsLastSync {
  timestamp: string;
  status: 'success' | 'error';
  message: string;
}

export interface SheetTripRow {
  id: string;
  aba_mes: string;
  data_backup: string;
  acao: string;
  numero_processo: string;
  data_recebimento: string;
  status_prazo: string;
  dias_antecedencia: number;
  status: string;
  natureza_atividade: string;
  solicitante_nome: string;
  solicitante_email: string;
  solicitante_telefone: string;
  unidade_macro: string;
  unidade_requisitante: string;
  cidade_origem: string;
  endereco_origem: string;
  cidade_destino: string;
  endereco_destino: string;
  paradas_intermediarias: string;
  data_partida: string;
  data_retorno: string;
  qtd_passageiros: number;
  objetivo_viagem: string;
  km_estimado: number;
  km_extra: number;
  veiculo_alocado: string;
  motorista_alocado: string;
  contratada_alocada: string;
  motivo_indeferimento: string;
  observacoes: string;
}

const getEnvVar = (key: string): string => {
  try {
    return (import.meta as any).env?.[key] || '';
  } catch {
    return '';
  }
};

export class GoogleSheetsService {
  static getConfig(): GoogleSheetsConfig {
    const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);

    const webhookUrl = (savedUrl !== null ? savedUrl : getEnvVar('VITE_GOOGLE_SHEETS_WEBHOOK_URL')).trim();
    const token = (savedToken !== null ? savedToken : getEnvVar('VITE_GOOGLE_SHEETS_TOKEN')).trim();
    const enabled = savedEnabled !== null ? savedEnabled === 'true' : Boolean(webhookUrl);

    return { webhookUrl, token, enabled };
  }

  static saveConfig(config: GoogleSheetsConfig): void {
    localStorage.setItem(STORAGE_KEY_URL, config.webhookUrl.trim());
    localStorage.setItem(STORAGE_KEY_TOKEN, config.token.trim());
    localStorage.setItem(STORAGE_KEY_ENABLED, String(config.enabled));
    try {
      window.dispatchEvent(new Event('sigfrota:gsheets-config-changed'));
    } catch {
      // ignore
    }
  }

  static isConfigured(): boolean {
    const { webhookUrl, enabled } = this.getConfig();
    return enabled && webhookUrl.startsWith('https://script.google.com/');
  }

  static getLastSync(): GoogleSheetsLastSync | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private static setLastSync(status: 'success' | 'error', message: string): void {
    const entry: GoogleSheetsLastSync = {
      timestamp: new Date().toISOString(),
      status,
      message,
    };
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, JSON.stringify(entry));
  }

  static validateWebhookUrl(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) {
      return 'Informe a URL do Web App do Google Apps Script.';
    }
    if (!trimmed.startsWith('https://script.google.com/')) {
      return 'A URL deve começar com https://script.google.com/macros/s/...';
    }
    if (trimmed.endsWith('/dev')) {
      return 'Você colou a URL de teste (/dev). Use a URL de produção da implantação que termina com /exec.';
    }
    return null;
  }

  /**
   * Calcula o nome da aba mensal com base na data da demanda (departure_datetime).
   * Exemplo: "11-2026 (Novembro)"
   */
  static getMonthTabName(dateStr?: string): string {
    try {
      const d = dateStr ? parseISO(dateStr) : new Date();
      if (isValid(d)) {
        const monthIdx = getMonth(d);
        const monthNum = String(monthIdx + 1).padStart(2, '0');
        const year = getYear(d);
        return `${monthNum}-${year} (${MONTH_NAMES_PT[monthIdx]})`;
      }
    } catch {
      // fallback
    }
    const now = new Date();
    const mIdx = getMonth(now);
    return `${String(mIdx + 1).padStart(2, '0')}-${getYear(now)} (${MONTH_NAMES_PT[mIdx]})`;
  }

  /**
   * Envia o payload JSON como text/plain (requisição CORS simples, sem preflight OPTIONS)
   * e valida a resposta real do Google Apps Script sem mascarar erros 401/permissão.
   */
  private static async postToAppsScript(
    webhookUrl: string,
    payload: Record<string, unknown>
  ): Promise<{ ok: boolean; error?: string }> {
    const body = JSON.stringify(payload);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body,
      });

      const text = await response.text();

      if (response.status === 401 || response.status === 403 || text.trim().startsWith('<')) {
        return {
          ok: false,
          error:
            'Acesso negado pelo Google Apps Script (HTTP 401). Na implantação do App da Web, "Quem pode acessar" precisa estar como "Qualquer pessoa" (e não "Somente eu" ou "Qualquer pessoa na UNILAB"). Se sua conta institucional não liberar "Qualquer pessoa", crie a planilha em uma conta @gmail.com.',
        };
      }

      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.ok === false) {
          return {
            ok: false,
            error: parsed.error || 'O Apps Script recusou a requisição.',
          };
        }
        return { ok: true };
      } catch {
        if (response.ok) {
          return { ok: true };
        }
        return {
          ok: false,
          error: `Resposta inesperada do Apps Script (HTTP ${response.status}).`,
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        error:
          'Bloqueio de permissão/CORS no Google Apps Script (geralmente HTTP 401). Reimplante o App da Web com "Executar como: Eu" e "Quem pode acessar: Qualquer pessoa". Se estiver em conta institucional (@unilab.edu.br), use uma conta @gmail.com caso o domínio bloqueie acesso público.',
      };
    }
  }

  static buildTripRow(trip: TripRequest, action: 'create' | 'update' | 'batch'): SheetTripRow {
    const cities = DistanceService.getCities();
    const vehicles = FleetService.getVehicles();
    const drivers = FleetService.getDrivers();
    const contractors = FleetService.getContractors();

    const getCityName = (cityId?: string) => {
      if (!cityId) return '';
      const found = cities.find((c) => c.id === cityId);
      return found ? `${found.name}/${found.state}` : cityId;
    };

    const intermediateNames = (trip.intermediate_cities || [])
      .map((cId) => getCityName(cId))
      .filter(Boolean)
      .join(', ');

    const vehicle = trip.allocated_vehicle_id
      ? vehicles.find((v) => v.id === trip.allocated_vehicle_id)
      : undefined;
    const driver = trip.allocated_driver_id
      ? drivers.find((d) => d.id === trip.allocated_driver_id)
      : undefined;
    const contractor = trip.allocated_contractor_id
      ? contractors.find((c) => c.id === trip.allocated_contractor_id)
      : undefined;

    const nowBr = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date());

    const actionLabel =
      action === 'create'
        ? 'Nova Solicitação'
        : action === 'update'
        ? 'Atualização'
        : 'Backup em Lote';

    const abaMes = this.getMonthTabName(trip.departure_datetime || trip.received_at);

    return {
      id: trip.id,
      aba_mes: abaMes,
      data_backup: nowBr,
      acao: actionLabel,
      numero_processo: trip.process_number || '',
      data_recebimento: safeFormatDate(trip.received_at, 'dd/MM/yyyy HH:mm'),
      status_prazo: trip.status_deadline || '',
      dias_antecedencia: trip.advance_days ?? 0,
      status: trip.status || '',
      natureza_atividade: trip.activity_type || '',
      solicitante_nome: trip.requester_name || '',
      solicitante_email: trip.requester_email || '',
      solicitante_telefone: trip.requester_phone || '',
      unidade_macro: trip.macro_unit || '',
      unidade_requisitante: trip.requesting_unit || '',
      cidade_origem: getCityName(trip.origin_city_id),
      endereco_origem: trip.origin_address || '',
      cidade_destino: getCityName(trip.destination_city_id),
      endereco_destino: trip.destination_address || '',
      paradas_intermediarias: intermediateNames,
      data_partida: safeFormatDate(trip.departure_datetime, 'dd/MM/yyyy HH:mm'),
      data_retorno: safeFormatDate(trip.return_datetime, 'dd/MM/yyyy HH:mm'),
      qtd_passageiros: trip.passenger_count ?? 1,
      objetivo_viagem: trip.trip_objective || '',
      km_estimado: trip.estimated_km ?? 0,
      km_extra: trip.extra_km ?? 0,
      veiculo_alocado: vehicle ? `${vehicle.model} (${vehicle.plate})` : '',
      motorista_alocado: driver ? driver.name : '',
      contratada_alocada: contractor ? contractor.name : '',
      motivo_indeferimento: trip.rejection_reason
        ? `${trip.rejection_reason}${trip.rejection_notes ? ` - ${trip.rejection_notes}` : ''}`
        : '',
      observacoes: trip.notes || '',
    };
  }

  /**
   * Envia uma solicitação (nova ou atualizada) para a aba mensal correspondente no Google Sheets.
   * Executa de forma não bloqueante para nunca impedir o salvamento principal.
   */
  static async syncTripToSheets(
    trip: TripRequest,
    action: 'create' | 'update' = 'create'
  ): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
    const { webhookUrl, token, enabled } = this.getConfig();
    if (!enabled || !webhookUrl) {
      return { ok: false, skipped: true };
    }

    const row = this.buildTripRow(trip, action);
    const result = await this.postToAppsScript(webhookUrl, {
      token,
      action,
      trip: row,
    });

    if (result.ok) {
      this.setLastSync(
        'success',
        `Processo ${trip.process_number} salvo na aba "${row.aba_mes}" (${action === 'create' ? 'novo' : 'atualizado'}).`
      );
      return { ok: true };
    } else {
      const msg = result.error || 'Falha ao enviar para o Google Sheets';
      this.setLastSync('error', msg);
      console.warn('Google Sheets backup sync error:', msg);
      return { ok: false, error: msg };
    }
  }

  /**
   * Envia todas as solicitações existentes em lote, separando automaticamente cada uma na aba do seu mês.
   */
  static async syncAllTripsToSheets(
    trips: TripRequest[]
  ): Promise<{ ok: boolean; sent: number; error?: string }> {
    const { webhookUrl, token } = this.getConfig();
    const urlError = this.validateWebhookUrl(webhookUrl);
    if (urlError) {
      return { ok: false, sent: 0, error: urlError };
    }

    if (trips.length === 0) {
      return { ok: true, sent: 0 };
    }

    const rows = trips.map((t) => this.buildTripRow(t, 'batch'));
    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const res = await this.postToAppsScript(webhookUrl, {
        token,
        action: 'batch',
        trips: chunk,
      });
      if (!res.ok) {
        this.setLastSync('error', res.error || 'Falha ao enviar backup em lote.');
        return { ok: false, sent: i, error: res.error };
      }
    }

    this.setLastSync('success', `Backup completo enviado (${trips.length} solicitações separadas por mês).`);
    return { ok: true, sent: trips.length };
  }

  /**
   * Envia um registro de teste na aba do mês atual para validar a integração com a planilha.
   */
  static async sendTestPing(customUrl?: string, customToken?: string): Promise<{ ok: boolean; tabName?: string; error?: string }> {
    const config = this.getConfig();
    const webhookUrl = (customUrl ?? config.webhookUrl).trim();
    const token = (customToken ?? config.token).trim();

    const urlError = this.validateWebhookUrl(webhookUrl);
    if (urlError) {
      return { ok: false, error: urlError };
    }

    const nowBr = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date());

    const tabName = this.getMonthTabName();

    const res = await this.postToAppsScript(webhookUrl, {
      token,
      action: 'test',
      trip: {
        id: 'TESTE-CONEXAO',
        aba_mes: tabName,
        data_backup: nowBr,
        acao: 'Teste de Conexão',
        numero_processo: 'TESTE-SIG-FROTA',
        data_recebimento: nowBr,
        status_prazo: 'Dentro do Prazo',
        dias_antecedencia: 0,
        status: 'Teste OK',
        natureza_atividade: 'Administrativo',
        solicitante_nome: 'Teste Automático SIG-FROTA',
        solicitante_email: 'divtrans@unilab.edu.br',
        solicitante_telefone: '',
        unidade_macro: 'PROADI',
        unidade_requisitante: 'DIVTRANS',
        cidade_origem: 'Redenção/CE',
        endereco_origem: 'Campus da Liberdade',
        cidade_destino: 'Redenção/CE',
        endereco_destino: 'Teste de Backup Google Sheets',
        paradas_intermediarias: '',
        data_partida: nowBr,
        data_retorno: nowBr,
        qtd_passageiros: 1,
        objetivo_viagem: 'Verificação de conexão do backup automático SIG-FROTA.',
        km_estimado: 0,
        km_extra: 0,
        veiculo_alocado: '',
        motorista_alocado: '',
        contratada_alocada: '',
        motivo_indeferimento: '',
        observacoes: 'Pode apagar esta linha de teste após confirmar o recebimento.',
      },
    });

    if (res.ok) {
      this.setLastSync('success', `Teste confirmado! Linha gravada na aba "${tabName}".`);
      return { ok: true, tabName };
    } else {
      this.setLastSync('error', res.error || 'Erro ao testar conexão.');
      return { ok: false, error: res.error };
    }
  }

  /**
   * Retorna o código Google Apps Script pronto para colar na planilha do Google Sheets.
   * Separa automaticamente as solicitações em abas por mês com base na data da demanda.
   */
  static getAppsScriptCode(token = ''): string {
    const safeToken = token.replace(/'/g, "\\'");
    return `// =========================================================================
// SIG-FROTA UNILAB — Backup Automático no Google Sheets (Abas por Mês)
// Cole este código em: Planilha Google > Extensões > Apps Script
// Depois clique em: Implantar > Nova implantação > App da Web
//   - Executar como: Eu
//   - Quem pode acessar: Qualquer pessoa
// =========================================================================

var SECRET_TOKEN = '${safeToken}';

var HEADERS = [
  'ID',
  'Data do Backup',
  'Ação',
  'Nº Processo SEI',
  'Data Recebimento',
  'Status Prazo',
  'Dias Antecedência',
  'Status',
  'Natureza da Atividade',
  'Solicitante',
  'E-mail Solicitante',
  'Telefone',
  'Unidade Macro',
  'Unidade Requisitante',
  'Cidade Origem',
  'Endereço Origem',
  'Cidade Destino',
  'Endereço Destino',
  'Paradas Intermediárias',
  'Data/Hora Partida',
  'Data/Hora Retorno',
  'Qtd. Passageiros',
  'Objetivo da Viagem',
  'KM Estimado',
  'KM Extra',
  'Veículo Alocado',
  'Motorista Alocado',
  'Contratada',
  'Motivo Indeferimento',
  'Observações'
];

var MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function getTabNameForTrip(trip) {
  if (trip && trip.aba_mes) {
    return String(trip.aba_mes).replace(/[\\\\\\/\\?\\*\\[\\]:]/g, '-').substring(0, 90);
  }
  if (trip && trip.data_partida) {
    var m = String(trip.data_partida).match(/(\\d{2})\\/(\\d{2})\\/(\\d{4})/);
    if (m) {
      var idx = parseInt(m[2], 10) - 1;
      var nomeMes = MESES_PT[idx] || m[2];
      return m[2] + '-' + m[3] + ' (' + nomeMes + ')';
    }
  }
  var now = new Date();
  var mm = ('0' + (now.getMonth() + 1)).slice(-2);
  return mm + '-' + now.getFullYear() + ' (' + MESES_PT[now.getMonth()] + ')';
}

function getOrCreateSheet(tabName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Abra o Apps Script por dentro da planilha (Extensões > Apps Script).');
  }
  var name = tabName || 'Backup_Solicitacoes';
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function safeNum(val, fallback) {
  return (val !== undefined && val !== null && val !== '') ? val : fallback;
}

function tripToRow(t) {
  return [
    t.id || '',
    t.data_backup || '',
    t.acao || '',
    t.numero_processo || '',
    t.data_recebimento || '',
    t.status_prazo || '',
    safeNum(t.dias_antecedencia, 0),
    t.status || '',
    t.natureza_atividade || '',
    t.solicitante_nome || '',
    t.solicitante_email || '',
    t.solicitante_telefone || '',
    t.unidade_macro || '',
    t.unidade_requisitante || '',
    t.cidade_origem || '',
    t.endereco_origem || '',
    t.cidade_destino || '',
    t.endereco_destino || '',
    t.paradas_intermediarias || '',
    t.data_partida || '',
    t.data_retorno || '',
    safeNum(t.qtd_passageiros, 1),
    t.objetivo_viagem || '',
    safeNum(t.km_estimado, 0),
    safeNum(t.km_extra, 0),
    t.veiculo_alocado || '',
    t.motorista_alocado || '',
    t.contratada_alocada || '',
    t.motivo_indeferimento || '',
    t.observacoes || ''
  ];
}

function applyRowStatusStyle(sheet, rowIndex, numCols, status) {
  var range = sheet.getRange(rowIndex, 1, 1, numCols);
  var s = String(status || '').toLowerCase();

  if (s.indexOf('confirmado') !== -1) {
    // Verde (Confirmado ao Demandante)
    range.setBackground('#bbf7d0');
    range.setFontColor('#14532d');
  } else if (s.indexOf('cancelado') !== -1) {
    // Vermelho (Cancelado pelo Demandante / Unidade Executante)
    range.setBackground('#fecaca');
    range.setFontColor('#7f1d1d');
  } else if (s.indexOf('indeferido') !== -1) {
    // Preto com texto branco (Indeferido)
    range.setBackground('#111827');
    range.setFontColor('#ffffff');
  } else {
    // Padrão (Pendente de Análise / outros)
    range.setBackground('#ffffff');
    range.setFontColor('#0f172a');
  }
}

function upsertTrip(trip) {
  var tabName = getTabNameForTrip(trip);
  var sheet = getOrCreateSheet(tabName);
  var rowValues = tripToRow(trip);
  var lastRow = sheet.getLastRow();

  if (lastRow > 1 && trip.id) {
    var rawIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < rawIds.length; i++) {
      if (String(rawIds[i][0]) === String(trip.id)) {
        var existingRow = i + 2;
        sheet.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
        applyRowStatusStyle(sheet, existingRow, rowValues.length, trip.status);
        return tabName;
      }
    }
  }

  sheet.appendRow(rowValues);
  var newRow = sheet.getLastRow();
  applyRowStatusStyle(sheet, newRow, rowValues.length, trip.status);
  return tabName;
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'SIG-FROTA Google Sheets Backup (Abas Mensais)' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var payload = JSON.parse(e.postData.contents);

    if (SECRET_TOKEN && payload.token !== SECRET_TOKEN) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Token inválido' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'batch' && Array.isArray(payload.trips)) {
      for (var i = 0; i < payload.trips.length; i++) {
        upsertTrip(payload.trips[i]);
      }
    } else if (payload.trip) {
      upsertTrip(payload.trip);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}`;
  }
}
