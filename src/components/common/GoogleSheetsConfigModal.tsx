import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  CloudUpload,
  Lock,
  Link2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { TripRequest } from '../../types';
import { GoogleSheetsService, GoogleSheetsLastSync } from '../../services/googleSheetsService';
import { AuditService } from '../../services/auditService';

interface GoogleSheetsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  trips: TripRequest[];
  onNotify: (message: string, type?: 'success' | 'warning' | 'info') => void;
}

export const GoogleSheetsConfigModal: React.FC<GoogleSheetsConfigModalProps> = ({
  isOpen,
  onClose,
  trips,
  onNotify,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [token, setToken] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [lastSync, setLastSync] = useState<GoogleSheetsLastSync | null>(null);
  const [copied, setCopied] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = GoogleSheetsService.getConfig();
      setWebhookUrl(cfg.webhookUrl);
      setToken(cfg.token);
      setEnabled(cfg.enabled);
      setLastSync(GoogleSheetsService.getLastSync());
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedUrl = webhookUrl.trim();
    if (enabled && trimmedUrl) {
      const urlError = GoogleSheetsService.validateWebhookUrl(trimmedUrl);
      if (urlError) {
        setFeedback({ type: 'error', text: urlError });
        return;
      }
    }

    GoogleSheetsService.saveConfig({
      webhookUrl: trimmedUrl,
      token: token.trim(),
      enabled,
    });

    AuditService.logEvent({
      action: 'Configuração de Backup Google Sheets',
      entity_type: 'Sistema',
      compliance_status: 'Conforme',
      details: `Backup automático Google Sheets ${enabled && trimmedUrl ? 'ativado' : 'desativado/atualizado'}.`,
    });

    onNotify('Configuração de backup no Google Sheets salva com sucesso!', 'success');
    onClose();
  };

  const handleTest = async () => {
    setFeedback(null);
    const trimmedUrl = webhookUrl.trim();
    const urlError = GoogleSheetsService.validateWebhookUrl(trimmedUrl);
    if (urlError) {
      setFeedback({ type: 'error', text: urlError });
      return;
    }

    // Salva automaticamente ao testar para evitar perda da configuração caso o usuário feche o modal
    GoogleSheetsService.saveConfig({
      webhookUrl: trimmedUrl,
      token: token.trim(),
      enabled: true,
    });
    setEnabled(true);

    setIsTesting(true);
    const res = await GoogleSheetsService.sendTestPing(trimmedUrl, token);
    setLastSync(GoogleSheetsService.getLastSync());
    setIsTesting(false);

    if (res.ok) {
      setFeedback({
        type: 'success',
        text: `Conexão confirmada e configuração salva! Confira a linha de teste na aba "${res.tabName || 'mês atual'}" da sua planilha Google.`,
      });
    } else {
      setFeedback({
        type: 'error',
        text: res.error || 'Não foi possível enviar o teste.',
      });
    }
  };

  const handleSyncAll = async () => {
    setFeedback(null);
    const trimmedUrl = webhookUrl.trim();
    if (!trimmedUrl.startsWith('https://script.google.com/')) {
      setFeedback({
        type: 'error',
        text: 'Informe uma URL válida do Google Apps Script antes de sincronizar.',
      });
      return;
    }

    GoogleSheetsService.saveConfig({
      webhookUrl: trimmedUrl,
      token: token.trim(),
      enabled,
    });

    setIsSyncingAll(true);
    const res = await GoogleSheetsService.syncAllTripsToSheets(trips);
    setLastSync(GoogleSheetsService.getLastSync());
    setIsSyncingAll(false);

    if (res.ok) {
      setFeedback({
        type: 'success',
        text: `Backup completo enviado (${res.sent} solicitações). Cada registro foi salvo automaticamente na aba do seu respectivo mês.`,
      });
      onNotify(`Backup de ${res.sent} solicitações enviado ao Google Sheets!`, 'success');
    } else {
      setFeedback({
        type: 'error',
        text: res.error || 'Erro ao enviar backup completo.',
      });
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(GoogleSheetsService.getAppsScriptCode(token.trim()));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFeedback({
        type: 'error',
        text: 'Não foi possível copiar automaticamente. Expanda o código abaixo e copie manualmente.',
      });
      setShowScript(true);
    }
  };

  const scriptCode = GoogleSheetsService.getAppsScriptCode(token.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-emerald-900 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">
                Integração & Backup em Nuvem
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">
                Backup Automático no Google Sheets
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Sempre que uma solicitação de veículo for <strong>salva ou atualizada</strong> no sistema, uma cópia completa dos dados será enviada automaticamente para a aba do mês correspondente à data da demanda (ex.:{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-navy-900 font-semibold">
              11-2026 (Novembro)
            </code>
            ).
          </p>

          {feedback && (
            <div
              className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Toggle */}
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <div className="font-bold text-navy-950">Ativar backup automático ao salvar</div>
                <div className="text-[11px] text-slate-500">
                  Envia novas solicitações e atualizações (escalação, indeferimento, alteração de datas) automaticamente.
                </div>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </label>

            {/* Webhook URL */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                URL do Web App (Google Apps Script)
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none font-mono text-xs text-slate-800"
              />
            </div>

            {/* Optional Token */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                Token de Segurança <span className="font-normal text-slate-400">(Opcional)</span>
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Ex: unilab-divtrans-2026"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none font-mono text-xs text-slate-800"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Se preencher um token aqui, clique em "Copiar Código do Apps Script" novamente para incluí-lo no script da planilha.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Salvar Configuração
              </button>

              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || !webhookUrl.trim()}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-brand-600" />
                {isTesting ? 'Enviando...' : 'Testar Conexão'}
              </button>

              <button
                type="button"
                onClick={handleSyncAll}
                disabled={isSyncingAll || !webhookUrl.trim() || trips.length === 0}
                className="px-3.5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-bold transition-colors flex items-center gap-1.5 ml-auto"
              >
                <CloudUpload className="w-3.5 h-3.5 text-emerald-300" />
                {isSyncingAll ? 'Sincronizando...' : `Enviar Backup Completo (${trips.length})`}
              </button>
            </div>
          </form>

          {/* Last Sync Info */}
          {lastSync && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600">
              <span>
                <strong>Último envio:</strong> {lastSync.message}
              </span>
              <span className="text-slate-400 font-mono">
                {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
                  new Date(lastSync.timestamp)
                )}
              </span>
            </div>
          )}

          {/* Setup Guide + Script */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-navy-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Como configurar sua Planilha Google (3 passos)
                </div>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Código Copiado!' : 'Copiar Código Apps Script'}
                </button>
              </div>

              <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                <li>
                  Abra sua planilha no <strong>Google Sheets</strong> e acesse o menu{' '}
                  <strong>Extensões ➔ Apps Script</strong>.
                </li>
                <li>
                  Apague o conteúdo padrão, <strong>cole o código copiado</strong> e clique em{' '}
                  <strong>Salvar</strong> (ícone de disquete).
                </li>
                <li>
                  Clique em <strong>Implantar ➔ Nova implantação ➔ App da Web</strong>, selecione{' '}
                  <em>Executar como: Eu</em> e <em>Quem pode acessar: Qualquer pessoa</em>, autorize e cole a{' '}
                  <strong>URL do App da Web</strong> no campo acima.
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowScript((prev) => !prev)}
                className="text-[11px] font-bold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 pt-1"
              >
                {showScript ? (
                  <>
                    Ocultar código do Apps Script <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    Ver código do Apps Script <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {showScript && (
              <pre className="p-4 bg-navy-950 text-emerald-200 text-[11px] font-mono overflow-x-auto max-h-64 leading-relaxed">
                {scriptCode}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
