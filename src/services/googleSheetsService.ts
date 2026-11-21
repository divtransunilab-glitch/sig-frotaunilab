import { TripRequest } from '../types';
import { DistanceService } from './distanceService';
import { FleetService } from './fleetService';
import { safeFormatDate } from '../utils/dateUtils';

const STORAGE_KEY_URL = 'sigfrota_gsheets_webhook_url';
const STORAGE_KEY_TOKEN = 'sigfrota_gsheets_token';
const STORAGE_KEY_ENABLED = 'sigfrota_gsheets_enabled';
const STORAGE_KEY_LAST_SYNC = 'sigfrota_gsheets_last_sync';

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
   * Envia o payload JSON como text/plain (requisição CORS simples, sem preflight OPTIONS)
   * e verifica a resposta real retornada pelo Google Apps Script.
   */
  private static async postToAppsScript(
    webhookUrl: string,
    payload: Record<string, unknown>
  ): Promise<{ ok: boolean; error?: string; fallbackNoCors?: boolean }> {
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

      // Se o Google redirecionou para página de login HTML, faltou liberar "Qualquer pessoa"
      if (text.trim().startsWith('<')) {
        return {
          ok: false,
          error:
            'O Google Apps Script retornou uma página HTML em vez de JSON. Verifique se a implantação está publicada com "Quem pode acessar: Qualquer pessoa" e se a URL termina em /exec.',
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
    } catch (corsOrNetErr: any) {
      // Fallback com no-cors caso o navegador/proxy bloqueie a leitura da resposta redirecionada
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body,
        });
        return { ok: true, fallbackNoCors: true };
      } catch (err: any) {
        return {
          ok: false,
          error: err?.message || corsOrNetErr?.message || 'Falha de rede ao conectar ao Google Sheets.',
        };
      }
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

    return {
      id: trip.id,
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
   * Envia uma solicitação (nova ou atualizada) para a planilha Google Sheets via Apps Script Webhook.
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
        `Processo ${trip.process_number} salvo no Google Sheets (${action === 'create' ? 'novo' : 'atualizado'}).`
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
   * Envia todas as solicitações existentes em lote para criar um backup completo na planilha.
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

    this.setLastSync('success', `Backup completo enviado (${trips.length} solicitações).`);
    return { ok: true, sent: trips.length };
  }

  /**
   * Envia um registro de teste para validar a integração com a planilha.
   */
  static async sendTestPing(customUrl?: string, customToken?: string): Promise<{ ok: boolean; error?: string }> {
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

    const res = await this.postToAppsScript(webhookUrl, {
      token,
      action: 'test',
      trip: {
        id: 'TESTE-CONEXAO',
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
      this.setLastSync('success', 'Teste de conexão confirmado pelo Google Sheets.');
      return { ok: true };
    } else {
      this.setLastSync('error', res.error || 'Erro ao testar conexão.');
      return { ok: false, error: res.error };
    }
  }

  /**
   * Retorna o código Google Apps Script pronto para colar na planilha do Google Sheets.
   * Totalmente compatível com qualquer versão do runtime Apps Script.
   */
  static getAppsScriptCode(token = ''): string {
    const safeToken = token.replace(/'/g, "\\'");
    return `// =========================================================================
// SIG-FROTA UNILAB — Backup Automático no Google Sheets
// Cole este código em: Planilha Google > Extensões > Apps Script
// Depois clique em: Implantar > Nova implantação > App da Web
//   - Executar como: Eu
//   - Quem pode acessar: Qualquer pessoa
// =========================================================================

var SECRET_TOKEN = '${safeToken}';
var SHEET_NAME = 'Backup_Solicitacoes';

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

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Abra o Apps Script por dentro da planilha (Extensões > Apps Script).');
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
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

function upsertRow(sheet, trip) {
  var rowValues = tripToRow(trip);
  var lastRow = sheet.getLastRow();

  if (lastRow > 1 && trip.id) {
    var rawIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < rawIds.length; i++) {
      if (String(rawIds[i][0]) === String(trip.id)) {
        sheet.getRange(i + 2, 1, 1, rowValues.length).setValues([rowValues]);
        return;
      }
    }
  }

  sheet.appendRow(rowValues);
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'SIG-FROTA Google Sheets Backup' }))
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

    var sheet = getOrCreateSheet();

    if (payload.action === 'batch' && Array.isArray(payload.trips)) {
      for (var i = 0; i < payload.trips.length; i++) {
        upsertRow(sheet, payload.trips[i]);
      }
    } else if (payload.trip) {
      upsertRow(sheet, payload.trip);
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
