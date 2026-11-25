import React, { useState } from 'react';
import {
  BookOpen,
  Printer,
  Truck,
  PlusCircle,
  Clock,
  SendHorizontal,
  MessageCircle,
  QrCode,
  Smartphone,
  ClipboardCheck,
  BarChart3,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ShieldCheck,
  ArrowRight,
  FileSpreadsheet,
  MapPin,
  Users,
  Fuel,
  Gauge,
  FileText,
  Sparkles,
  KeyRound,
  CalendarDays,
  XCircle,
  Ban,
} from 'lucide-react';

interface TutorialViewProps {
  onNavigateTab?: (tab: string) => void;
}

type GuideMode = 'complete' | 'driver';
type MobileDemoStep = 'pin' | 'checkin' | 'checkout';

interface StepNav {
  id: string;
  num: string;
  shortLabel: string;
}

const STEPS_NAV: StepNav[] = [
  { id: 'step-0', num: '0', shortLabel: 'Cadastros Base' },
  { id: 'step-1', num: '1', shortLabel: 'Nova Demanda' },
  { id: 'step-2', num: '2', shortLabel: 'Fila (3 Abas)' },
  { id: 'step-3', num: '3', shortLabel: 'Escala & Decisão' },
  { id: 'step-4', num: '4', shortLabel: 'Envio & OT' },
  { id: 'step-5', num: '5', shortLabel: 'App Motorista' },
  { id: 'step-6', num: '6', shortLabel: 'Relatório KM' },
  { id: 'step-7', num: '7', shortLabel: 'BI & Portal' },
];

/** Moldura visual simulando um print de tela do sistema (Desktop) */
const BrowserMockupFrame: React.FC<{
  title: string;
  badge?: string;
  children: React.ReactNode;
}> = ({ title, badge, children }) => (
  <div className="rounded-2xl border border-slate-200/90 bg-white shadow-md overflow-hidden select-none">
    <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-[10px] font-bold text-slate-600 truncate">{title}</span>
      </div>
      {badge && (
        <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 shrink-0">
          {badge}
        </span>
      )}
    </div>
    <div className="p-4 bg-slate-50/60">{children}</div>
  </div>
);

/** QR Code ilustrativo nítido em SVG (para demonstração da Ordem de Tráfego) */
const DemoQrSvg: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-16 h-16 bg-white p-1 rounded-lg border border-slate-300 shrink-0">
    <rect x="4" y="4" width="16" height="16" fill="none" stroke="#0f172a" strokeWidth="3.5" />
    <rect x="9" y="9" width="6" height="6" fill="#0f172a" />
    <rect x="44" y="4" width="16" height="16" fill="none" stroke="#0f172a" strokeWidth="3.5" />
    <rect x="49" y="9" width="6" height="6" fill="#0f172a" />
    <rect x="4" y="44" width="16" height="16" fill="none" stroke="#0f172a" strokeWidth="3.5" />
    <rect x="9" y="49" width="6" height="6" fill="#0f172a" />
    <rect x="26" y="6" width="4" height="4" fill="#0f172a" />
    <rect x="34" y="6" width="4" height="4" fill="#0f172a" />
    <rect x="26" y="14" width="4" height="8" fill="#0f172a" />
    <rect x="34" y="18" width="4" height="4" fill="#0f172a" />
    <rect x="6" y="26" width="8" height="4" fill="#0f172a" />
    <rect x="18" y="26" width="12" height="4" fill="#0f172a" />
    <rect x="34" y="26" width="4" height="12" fill="#0f172a" />
    <rect x="44" y="26" width="8" height="4" fill="#0f172a" />
    <rect x="56" y="26" width="4" height="8" fill="#0f172a" />
    <rect x="10" y="34" width="4" height="4" fill="#0f172a" />
    <rect x="22" y="34" width="8" height="4" fill="#0f172a" />
    <rect x="42" y="34" width="10" height="4" fill="#0f172a" />
    <rect x="26" y="44" width="4" height="10" fill="#0f172a" />
    <rect x="34" y="44" width="10" height="4" fill="#0f172a" />
    <rect x="48" y="44" width="4" height="8" fill="#0f172a" />
    <rect x="56" y="44" width="4" height="16" fill="#0f172a" />
    <rect x="34" y="54" width="8" height="6" fill="#0f172a" />
    <rect x="46" y="56" width="6" height="4" fill="#0f172a" />
  </svg>
);

export const TutorialView: React.FC<TutorialViewProps> = ({ onNavigateTab }) => {
  const [guideMode, setGuideMode] = useState<GuideMode>('complete');
  const [mobileDemoStep, setMobileDemoStep] = useState<MobileDemoStep>('pin');

  const scrollToStep = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Banner Principal */}
      <div className="bg-gradient-to-br from-navy-950 via-navy-900 to-brand-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-navy-800 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-brand-500/15 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold uppercase tracking-wider text-brand-200">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Manual Interativo de Usabilidade • DIVTRANS / UNILAB</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Guia Passo a Passo do SIG-FROTA
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Aprenda visualmente todas as etapas da operação: do cadastro da solicitação, triagem e escala de
              veículos, envio seguro por WhatsApp/QR Code, preenchimento no celular do motorista até a homologação
              do relatório pós-viagem e prestação de contas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 print:hidden">
            <div className="inline-flex rounded-xl bg-white/10 p-1 border border-white/15">
              <button
                type="button"
                onClick={() => setGuideMode('complete')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  guideMode === 'complete'
                    ? 'bg-white text-navy-950 shadow-sm'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                Manual Completo
              </button>
              <button
                type="button"
                onClick={() => setGuideMode('driver')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  guideMode === 'driver'
                    ? 'bg-white text-navy-950 shadow-sm'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Guia do Motorista</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* Barra de Navegação Rápida por Etapas */}
        {guideMode === 'complete' && (
          <div className="relative mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-2 print:hidden">
            {STEPS_NAV.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToStep(s.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white transition-all"
              >
                <span className="w-4 h-4 rounded-full bg-brand-500 text-[10px] font-extrabold flex items-center justify-center">
                  {s.num}
                </span>
                <span>{s.shortLabel}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MODO GUIA RÁPIDO DO MOTORISTA (1 página enxuta para WhatsApp / impressão) */}
      {guideMode === 'driver' ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
                Cartilha Rápida • Motoristas UNILAB
              </span>
              <h2 className="text-xl font-extrabold text-navy-950 mt-2">
                Como preencher sua Ordem de Tráfego pelo Celular
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Não precisa instalar aplicativo nem ter senha. Basta abrir o link enviado pela DIVTRANS no WhatsApp ou ler o QR Code da folha impressa.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-navy-900 text-white font-extrabold text-sm flex items-center justify-center">1</div>
              <h3 className="font-extrabold text-sm text-navy-950">Abra o Link ou QR Code</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Toque no link recebido no WhatsApp da DIVTRANS ou aponte a câmera do celular para o QR Code da Ordem de Tráfego.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-brand-700 text-white font-extrabold text-sm flex items-center justify-center">2</div>
              <h3 className="font-extrabold text-sm text-navy-950">Confirme sua Identidade</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Digite seus <strong>4 dígitos</strong> (PIN fornecido pela DIVTRANS ou os 4 últimos dígitos da sua CNH/telefone cadastrado).
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-sky-700 text-white font-extrabold text-sm flex items-center justify-center">3</div>
              <h3 className="font-extrabold text-sm text-navy-950">Check-in na Saída</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Confira os passageiros, informe o <strong>KM inicial do painel</strong> e uma observação de saída (opcional). Toque em <strong>Registrar Saída</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center">4</div>
              <h3 className="font-extrabold text-sm text-navy-950">Trechos & Check-out</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Lance o KM de cada trecho (se houver paradas), informe o <strong>KM final</strong>, abastecimento/pedágio e toque em <strong>Finalizar Viagem</strong>.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-950">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Importante:</strong> Se aparecer a mensagem <em>&ldquo;Link Revogado ou Inválido&rdquo;</em>, significa que houve atualização na escala ou troca de motorista. Solicite o link novo diretamente à DIVTRANS.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Legenda Oficial de Status */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">
              Padrão Visual de Status em todo o Sistema
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-extrabold text-emerald-900">Confirmado</div>
                  <div className="text-[11px] text-emerald-700">Deferido e escalado</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div className="font-extrabold text-amber-900">Pendente</div>
                  <div className="text-[11px] text-amber-700">Na fila da DIVTRANS</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white">
                <Ban className="w-4 h-4 text-slate-200 shrink-0" />
                <div>
                  <div className="font-extrabold">Indeferido</div>
                  <div className="text-[11px] text-slate-300">Não atendido (Preto)</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <div className="font-extrabold text-rose-900">Cancelado</div>
                  <div className="text-[11px] text-rose-700">Cancelado (Vermelho)</div>
                </div>
              </div>
            </div>
          </div>

          {/* ETAPA 0 — CADASTROS BASE */}
          <section id="step-0" className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 scroll-mt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white font-extrabold flex items-center justify-center shadow-sm">
                    0
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">Preparação</span>
                    <h2 className="text-lg font-extrabold text-navy-950">Cadastros Base (Frota, Motoristas & Matriz)</h2>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Antes de iniciar as escalas, mantenha atualizados os cadastros de <strong>Veículos</strong>,{' '}
                  <strong>Motoristas</strong>, <strong>Unidades Solicitantes</strong> e a{' '}
                  <strong>Matriz de Quilometragem</strong>.
                </p>

                <ol className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center shrink-0">1</span>
                    <span>
                      Acesse <strong>Frota, Motoristas & Unidades</strong> no menu lateral para cadastrar placas, capacidades, contratos e a <strong>Franquia Mensal de KM</strong> de cada veículo.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center shrink-0">2</span>
                    <span>
                      No cadastro de cada <strong>Motorista</strong>, informe o <strong>PIN de 4 dígitos</strong> (ou CNH/telefone) para liberar o acesso seguro ao aplicativo mobile da viagem.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center shrink-0">3</span>
                    <span>
                      Na aba <strong>Matriz de Quilometragem</strong>, confira as distâncias oficiais entre municípios (usadas no cálculo automático do KM estimado).
                    </span>
                  </li>
                </ol>

                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('fleet')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800 print:hidden"
                  >
                    <span>Abrir Frota, Motoristas & Unidades</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="lg:col-span-6">
                <BrowserMockupFrame title="SIG-FROTA • Frota, Motoristas & Unidades" badge="Demonstração">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-navy-950 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-brand-600" />
                          Van Executivo
                        </span>
                        <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded">RIA-4B21</span>
                      </div>
                      <div className="text-[11px] text-slate-500">15 lugares • Locadora Contratada</div>
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-medium">Franquia mensal:</span>
                        <span className="font-extrabold text-brand-700">4.000 km/mês</span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-navy-950 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                          João da Silva
                        </span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">CNH D</span>
                      </div>
                      <div className="text-[11px] text-slate-500">Motorista Efetivo / Terceirizado</div>
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-medium">Acesso Mobile:</span>
                        <span className="font-extrabold text-emerald-700">PIN •••• ativo</span>
                      </div>
                    </div>
                  </div>
                </BrowserMockupFrame>
              </div>
            </div>
          </section>

          {/* ETAPA 1 — CADASTRO DE SOLICITAÇÃO */}
          <section id="step-1" className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 scroll-mt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-700 text-white font-extrabold flex items-center justify-center shadow-sm">
                    1
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">Entrada de Demandas</span>
                    <h2 className="text-lg font-extrabold text-navy-950">Cadastro da Solicitação (Manual ou Planilha)</h2>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Toda viagem nasce do protocolo de uma solicitação — cadastrada individualmente ou importada em lote de uma planilha Excel/CSV.
                </p>

                <ol className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center shrink-0">1</span>
                    <span>
                      Clique em <strong>+ Nova Solicitação</strong> na aba <em>Fila de Solicitações & Escala</em> (ou use <strong>Importar Planilha</strong> para carregar várias demandas de uma vez).
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center shrink-0">2</span>
                    <span>
                      Preencha <strong>Processo SEI</strong>, solicitante, unidade, origem/destino, datas/horários, finalidade e quantidade/lista de passageiros.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center shrink-0">3</span>
                    <span>
                      O sistema calcula automaticamente o <strong>KM Estimado</strong> pela matriz e verifica se o pedido chegou <strong>Dentro do Prazo</strong> ou <strong>Fora do Prazo</strong>.
                    </span>
                  </li>
                </ol>

                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('dispatch')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800 print:hidden"
                  >
                    <span>Ir para Fila de Solicitações & Escala</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="lg:col-span-6">
                <BrowserMockupFrame title="Modal • + Nova Solicitação de Transporte" badge="Cadastro">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-extrabold text-navy-950 flex items-center gap-1.5">
                        <PlusCircle className="w-4 h-4 text-brand-600" />
                        Nova Solicitação SEI
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        ✓ Dentro do Prazo
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Processo SEI</div>
                        <div className="font-bold text-navy-950">23282.013294/2026-63</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Unidade</div>
                        <div className="font-bold text-navy-950">ICS • Graduação</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 col-span-2 flex items-center justify-between">
                        <div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Itinerário (Cálculo Automático)</div>
                          <div className="font-bold text-navy-950 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-brand-600" />
                            Redenção-CE ➔ Fortaleza-CE
                          </div>
                        </div>
                        <span className="text-[11px] font-extrabold text-brand-700 bg-brand-50 px-2 py-1 rounded-lg border border-brand-200">
                          136 km
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-[11px] flex items-center gap-1">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        Ou Importar Excel
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-brand-700 text-white font-bold text-[11px]">
                        Salvar Solicitação
                      </span>
                    </div>
                  </div>
                </BrowserMockupFrame>
              </div>
            </div>
          </section>

          {/* ETAPA 2 — TRIAGEM NA FILA (3 ABAS) */}
          <section id="step-2" className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 scroll-mt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white font-extrabold flex items-center justify-center shadow-sm">
                    2
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Priorização</span>
                    <h2 className="text-lg font-extrabold text-navy-950">Triagem na Fila de Escala (3 Abas)</h2>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Na tela <strong>Visão Geral & Painel</strong>, as demandas pendentes são separadas automaticamente em 3 abas por urgência de saída, junto ao alerta de consumo de franquia.
                </p>

                <ul className="space-y-2 text-xs text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span><strong>Fila de Escala Imediata (&lt; 3 dias):</strong> viagens saindo hoje, amanhã ou nos próximos 3 dias — prioridade máxima.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                    <span><strong>Fila de Escala (&gt; 3 dias):</strong> viagens futuras com prazo para planejamento de veículos e agrupamento.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span><strong>Fila de Escala Vencidas:</strong> demandas pendentes cuja data já passou, facilitando a regularização ou baixa.</span>
                  </li>
                </ul>

                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('dashboard')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800 print:hidden"
                  >
                    <span>Abrir Visão Geral & Painel</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="lg:col-span-6">
                <BrowserMockupFrame title="Visão Geral & Painel • Fila de Escala" badge="3 Abas">
                  <div className="space-y-3 text-xs">
                    <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200">
                      <span className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-[10px]">
                        Imediata &lt;3 dias (4)
                      </span>
                      <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px]">
                        Escala &gt;3 dias (18)
                      </span>
                      <span className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-bold text-[10px]">
                        Vencidas (2)
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-navy-950 text-[11px]">23282.013294/2026-63 • ICS</div>
                        <div className="text-[10px] text-slate-500">Redenção ➔ Maracanaú (106 km) • 5 passag.</div>
                      </div>
                      <span className="px-2.5 py-1.5 rounded-lg bg-brand-700 text-white font-bold text-[10px] shrink-0">
                        Escalar Demanda
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-[10px] text-amber-900">
                      <span className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Alerta de Franquia (≥ 75%)
                      </span>
                      <span className="font-extrabold">Van RIA-4B21 • 82% usado</span>
                    </div>
                  </div>
                </BrowserMockupFrame>
              </div>
            </div>
          </section>

          {/* ETAPA 3 — ESCALA / DESPACHO */}
          <section id="step-3" className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 scroll-mt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white font-extrabold flex items-center justify-center shadow-sm">
                    3
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Decisão & Alocação</span>
                    <h2 className="text-lg font-extrabold text-navy-950">Escala de Veículo/Motorista, Agrupamento ou Indeferimento</h2>
                  </div>
                </div>

                <ol className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">1</span>
                    <span>
                      Clique em <strong>Escalar Demanda</strong>, escolha o <strong>Veículo</strong> e o <strong>Motorista</strong> disponíveis (o sistema avisa sobre choques de horário e capacidade).
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">2</span>
                    <span>
                      Ao confirmar, a demanda passa para <strong>Confirmado</strong> (verde) e o sistema gera automaticamente um <strong>token de segurança único</strong> para aquela escala.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">3</span>
                    <span>
                      Se necessário, utilize <strong>Agrupar Viagens</strong> (carona na mesma rota), <strong>Alterar Data</strong>, <strong>Indeferir</strong> (com justificativa formal) ou <strong>Cancelar</strong>.
                    </span>
                  </li>
                </ol>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Troca de Motorista:</strong> se você alterar o motorista de uma viagem já confirmada, o link antigo é revogado automaticamente e um novo link seguro é gerado.
                  </span>
                </div>
              </div>

              <div className="lg:col-span-6">
                <BrowserMockupFrame title="Modal • Escalar Demanda (Despacho Rápido)" badge="Alocação">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-navy-950 flex items-center gap-1.5">
                        <SendHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                        Definir Recursos da Viagem
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Sem conflito de agenda
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400">Veículo Escalado</div>
                        <div className="font-bold text-navy-950">Micro-ônibus Volare (OHZ-8912) • 28 lugares</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400">Motorista Responsável</div>
                        <div className="font-bold text-navy-950">João da Silva • CNH Categoria D</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500 font-medium">Token exclusivo gerado ao salvar</span>
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px]">
                        ✓ Confirmar Escala
                      </span>
                    </div>
                  </div>
                </BrowserMockupFrame>
              </div>
            </div>
          </section>

          {/* ETAPA 4 — ENVIO PARA O MOTORISTA & ORDEM DE TRÁFEGO */}
          <section id="step-4" className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 scroll-mt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-700 text-white font-extrabold flex items-center justify-center shadow-sm">
                    4
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Acionamento</span>
                    <h2 className="text-lg font-extrabold text-navy-950">Envio para o Motorista (WhatsApp & Ordem de Tráfego)</h2>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Com a viagem confirmada, abra os <strong>Detalhes da Viagem</strong> para acionar o motorista de forma digital ou impressa:
                </p>

                <ol className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center shrink-0">1</span>
                    <span>
                      <strong>Enviar via WhatsApp:</strong> clique em <em>Enviar para Motorista</em> para abrir o WhatsApp já com a mensagem formatada (processo, rota, horário, veículo e o <strong>link exclusivo com token</strong>).
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center shrink-0">2</span>
                    <span>
                      <strong>Ordem de Tráfego (OT):</strong> clique em <em>Ordem de Tráfego</em> para visualizar/imprimir o documento oficial com lista de passageiros e <strong>QR Code</strong> — basta o motorista apontar a câmera do celular.
                    </span>
                  </li>
                </ol>
              </div>

              <div className="lg:col-span-6">
                <BrowserMockupFrame title="Detalhes da Viagem & Ordem de Tráfego (OT)" badge="WhatsApp + QR">
                  <div className="space-y-3 text-xs">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-xs">
                        <MessageCircle className="w-3.5 h-3.5" />
                        Enviar no WhatsApp
                      </span>
                      <span className="px-3 py-2 rounded-xl bg-navy-900 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-xs">
                        <QrCode className="w-3.5 h-3.5" />
                        Ordem de Tráfego (OT)
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700">
                          Ordem de Tráfego • UNILAB / DIVTRANS
                        </div>
                        <div className="font-extrabold text-navy-950 truncate">SEI 23282.013294/2026-63</div>
                        <div className="text-[10px] text-slate-600">Redenção ➔ Fortaleza • Saída 07:00</div>
                        <div className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Lock className="w-2.5 h-2.5" />
                          Link protegido por token único
                        </div>
                      </div>
                      <DemoQrSvg />
                    </div>
                  </div>
                </BrowserMockupFrame>
              </div>
            </div>
          </section>

          {/* ETAPA 5 — EXECUÇÃO PELO MOTORISTA (MODO MOBILE INTERATIVO) */}
          <section id="step-5" className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 scroll-mt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-700 text-white font-extrabold flex items-center justify-center shadow-sm">
                    5
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Operação em Campo</span>
                    <h2 className="text-lg font-extrabold text-navy-950">Execução Mobile pelo Motorista (Sem Login)</h2>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Ao abrir o link ou QR Code no celular, o motorista percorre 3 telas simples (clique nas abas do celular ao lado para visualizar cada tela):
                </p>

                <ol className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center shrink-0">1</span>
                    <span>
                      <strong>Identificação (PIN/CNH):</strong> o motorista informa os 4 dígitos cadastrados; a validação é feita diretamente no servidor (LGPD).
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center shrink-0">2</span>
                    <span>
                      <strong>Check-in de Saída:</strong> marca os passageiros embarcados, informa o <strong>hodômetro inicial</strong> e uma observação de saída (se houver).
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center shrink-0">3</span>
                    <span>
                      <strong>Trechos & Check-out:</strong> registra o KM por trecho (quando há várias paradas), informa <strong>hodômetro final</strong>, abastecimento, pedágio e observação de retorno. Ao finalizar, o relatório vai direto para a DIVTRANS.
                    </span>
                  </li>
                </ol>
              </div>

              {/* Simulador de Smartphone Interativo */}
              <div className="lg:col-span-6 flex flex-col items-center">
                <div className="flex gap-1.5 mb-3 print:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileDemoStep('pin')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                      mobileDemoStep === 'pin'
                        ? 'bg-indigo-700 text-white border-indigo-700'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    1. PIN / CNH
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDemoStep('checkin')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                      mobileDemoStep === 'checkin'
                        ? 'bg-indigo-700 text-white border-indigo-700'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    2. Check-in Saída
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDemoStep('checkout')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                      mobileDemoStep === 'checkout'
                        ? 'bg-indigo-700 text-white border-indigo-700'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    3. Trechos & Check-out
                  </button>
                </div>

                <div className="w-full max-w-[320px] rounded-[28px] border-[6px] border-slate-900 bg-slate-100 shadow-xl overflow-hidden">
                  {/* Topo do Celular */}
                  <div className="bg-navy-950 text-white px-4 py-2.5 flex items-center justify-between text-[10px]">
                    <span className="font-extrabold">SIG-FROTA • Motorista</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                      Token OK
                    </span>
                  </div>

                  <div className="p-3.5 space-y-3 text-xs">
                    {mobileDemoStep === 'pin' && (
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-extrabold text-navy-950">Confirmar Motorista</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            João da Silva • Informe seu PIN ou 4 últimos dígitos da CNH
                          </div>
                        </div>
                        <div className="flex justify-center gap-2 font-mono text-base font-extrabold tracking-widest py-2 rounded-xl bg-slate-50 border border-slate-300 text-navy-950">
                          • • • •
                        </div>
                        <div className="w-full py-2 rounded-xl bg-navy-950 text-white font-bold text-[11px]">
                          Liberar Ordem de Tráfego
                        </div>
                      </div>
                    )}

                    {mobileDemoStep === 'checkin' && (
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-2.5">
                        <div className="font-extrabold text-navy-950 flex items-center gap-1.5 text-[11px]">
                          <Users className="w-3.5 h-3.5 text-brand-600" />
                          Lista de Embarque (3/3)
                        </div>
                        <div className="space-y-1 text-[10px]">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Maria Silva (Confirmada)
                          </div>
                          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Carlos Oliveira (Confirmado)
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Hodômetro Inicial (KM)</div>
                          <div className="font-extrabold text-navy-950">142.350 km</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-500">
                          Obs. saída: Embarque no Campus Liberdade...
                        </div>
                        <div className="w-full py-2 rounded-xl bg-sky-600 text-white font-bold text-[11px] text-center">
                          ▶ Registrar Saída (Check-in)
                        </div>
                      </div>
                    )}

                    {mobileDemoStep === 'checkout' && (
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-2.5">
                        <div className="font-extrabold text-navy-950 flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                            Trechos da Viagem
                          </span>
                          <span className="text-emerald-700">Total: 140 km</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] space-y-0.5">
                          <div className="font-bold text-navy-950">Trecho 1: Redenção ➔ Fortaleza</div>
                          <div className="text-slate-500">142.350 ➔ 142.420 (70 km)</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] space-y-0.5">
                          <div className="font-bold text-navy-950">Trecho 2: Fortaleza ➔ Redenção</div>
                          <div className="text-slate-500">142.420 ➔ 142.490 (70 km)</div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-1">
                            <Fuel className="w-3 h-3 text-amber-600" />
                            <span>Abast.: 30 L</span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                            Pedágio: R$ 0,00
                          </div>
                        </div>
                        <div className="w-full py-2 rounded-xl bg-emerald-600 text-white font-bold text-[11px] text-center">
                          ✓ Finalizar & Enviar Relatório
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ETAPA 6 — FINALIZAÇÃO E HOMOLOGAÇÃO DO RELATÓRIO PÓS-VIAGEM */}
          <section id="step-6" className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 scroll-mt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-700 text-white font-extrabold flex items-center justify-center shadow-sm">
                    6
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Encerramento & Fiscalização</span>
                    <h2 className="text-lg font-extrabold text-navy-950">Homologação do Relatório (KM Real) & Controle de Tráfego</h2>
                  </div>
                </div>

                <ol className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0">1</span>
                    <span>
                      Acesse <strong>Relatórios de Viagem (KM Real)</strong> no menu lateral. As viagens concluídas pelo motorista aparecem prontas para conferência.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0">2</span>
                    <span>
                      Confira <strong>KM Estimado × KM Real</strong>, trechos, abastecimento e as observações combinadas (<code>[Saída]</code> e <code>[Retorno]</code>). Se necessário, ajuste manualmente.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0">3</span>
                    <span>
                      Clique em <strong>Homologar / Aprovar Relatório</strong> (registrando o gestor aprovador) e emita o <strong>Documento Oficial</strong> para anexar ao SEI.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0">4</span>
                    <span>
                      Na aba <strong>Controle de Tráfego</strong> (dentro do mesmo módulo), filtre por mês e veículo para visualizar e exportar em <strong>Excel/PDF</strong> a planilha completa de hodômetros e processos SEI.
                    </span>
                  </li>
                </ol>

                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('postTrip')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800 print:hidden"
                  >
                    <span>Abrir Relatórios de Viagem (KM Real)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="lg:col-span-6">
                <BrowserMockupFrame title="Relatórios de Viagem • Homologação & Controle de Tráfego" badge="Pós-Viagem">
                  <div className="space-y-3 text-xs">
                    <div className="bg-white rounded-xl border border-purple-200 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-navy-950 flex items-center gap-1.5">
                          <ClipboardCheck className="w-4 h-4 text-purple-600" />
                          SEI 23282.013294/2026-63
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                          Aguardando Homologação
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="text-[9px] text-slate-400 font-bold">KM PREVISTO</div>
                          <div className="font-extrabold text-slate-700">136 km</div>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                          <div className="text-[9px] text-emerald-600 font-bold">KM REAL</div>
                          <div className="font-extrabold text-emerald-800">140 km</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="text-[9px] text-slate-400 font-bold">DESVIO</div>
                          <div className="font-extrabold text-emerald-700">+2,9%</div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Documento SEI
                        </span>
                        <span className="px-2.5 py-1.5 rounded-lg bg-purple-700 text-white font-bold text-[10px]">
                          ✓ Homologar Relatório
                        </span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                      <div className="text-[10px] font-extrabold text-slate-500 uppercase mb-1.5">
                        Controle Mensal de Tráfego • Van RIA-4B21
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[9px] font-bold text-slate-400 border-b border-slate-100 pb-1">
                        <span>Processo SEI</span>
                        <span>Hodôm. Inic.</span>
                        <span>Hodôm. Final</span>
                        <span className="text-right">KM Rodado</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-700 pt-1">
                        <span className="font-semibold truncate">013294/2026</span>
                        <span>142.350</span>
                        <span>142.490</span>
                        <span className="text-right font-extrabold text-navy-950">140 km</span>
                      </div>
                    </div>
                  </div>
                </BrowserMockupFrame>
              </div>
            </div>
          </section>

          {/* ETAPA 7 — BI, RELATÓRIO EXECUTIVO & PORTAL PÚBLICO */}
          <section id="step-7" className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 scroll-mt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-navy-900 text-white font-extrabold flex items-center justify-center shadow-sm">
                    7
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-navy-700">Inteligência & Transparência</span>
                    <h2 className="text-lg font-extrabold text-navy-950">BI, Relatório Executivo PDF & Portal Público</h2>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <BarChart3 className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Análise & Inteligência (BI):</strong> mapas de calor (Horas 05h–22h, Faixa Operacional e Turnos), análise por setor, auditoria de desvio de KM e acompanhamento da franquia mensal contratual.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Exportação & Planilhas (Excel/PDF):</strong> gera o <strong>Relatório Executivo A4 em PDF</strong> com KPIs, análise inteligente, todos os 3 mapas de calor, custos, franquia e anexos para prestação de contas à PROADI/Reitoria.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CalendarDays className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Agenda & Auditoria:</strong> visualize todas as viagens no calendário e acompanhe o log de rastreabilidade das operações críticas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Globe className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Portal Público & Transparência:</strong> solicitantes consultam o andamento do processo SEI em 3 etapas reais sem login, com total conformidade LGPD.
                    </span>
                  </li>
                </ul>

                {onNavigateTab && (
                  <div className="flex flex-wrap gap-4 print:hidden">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('analytics')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800"
                    >
                      <span>Abrir BI</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('reports')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800"
                    >
                      <span>Abrir Relatório Executivo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="lg:col-span-6">
                <BrowserMockupFrame title="Portal Público • Consulta de Processo SEI (LGPD)" badge="Público">
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-navy-950">23282.013294/2026-63</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Confirmado
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                        <div className="font-extrabold">1. Cadastro</div>
                        <div className="text-[9px] text-emerald-700">Protocolada</div>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                        <div className="font-extrabold">2. Parecer</div>
                        <div className="text-[9px] text-emerald-700">Deferida</div>
                      </div>
                      <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
                        <div className="font-extrabold">3. Execução</div>
                        <div className="text-[9px] text-sky-700">Em Viagem</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>Dados pessoais ocultos (LGPD)</span>
                      <span className="font-bold text-brand-700">Painel de Transparência ✓</span>
                    </div>
                  </div>
                </BrowserMockupFrame>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
