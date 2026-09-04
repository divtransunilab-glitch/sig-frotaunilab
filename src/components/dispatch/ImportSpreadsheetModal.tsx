import React, { useState, useRef } from 'react';
import { TripRequest } from '../../types';
import { ImportService, ImportSpreadsheetResult } from '../../services/importService';
import { TripService } from '../../services/tripService';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Layers, 
  RefreshCw, 
  PlusCircle, 
  Trash2,
  Calendar,
  Building2,
  Users,
  Milestone
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { safeFormatDate } from '../../utils/dateUtils';

interface ImportSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (count: number, mode: 'replace' | 'append') => void;
}

export const ImportSpreadsheetModal: React.FC<ImportSpreadsheetModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  if (!isOpen) return null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportSpreadsheetResult | null>(null);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    processFile(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;

    processFile(dropped);
  };

  const processFile = (f: File) => {
    setFile(f);
    setErrorMsg(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const result = ImportService.parseSpreadsheet(buffer, f.name);

        if (result.allTrips.length === 0) {
          setErrorMsg('Nenhuma solicitação válida foi encontrada no arquivo. Verifique o modelo de planilha.');
        } else {
          setImportResult(result);
          setSelectedSheets(result.sheets.map((s) => s.sheetName));
        }
      } catch (err: any) {
        setErrorMsg(`Falha ao ler o arquivo Excel: ${err?.message || 'Arquivo corrompido ou formato incompatível'}`);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('Erro ao carregar o arquivo no navegador.');
      setIsProcessing(false);
    };

    reader.readAsArrayBuffer(f);
  };

  const activeSheets = importResult
    ? importResult.sheets.filter((s) => selectedSheets.includes(s.sheetName))
    : [];

  const tripsToImport = activeSheets.flatMap((s) => s.validTrips);

  const handleConfirmImport = async () => {
    if (!importResult || tripsToImport.length === 0) {
      setErrorMsg('Selecione pelo menos uma aba com solicitações válidas para importar.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      if (importMode === 'replace') {
        await TripService.replaceTrips(tripsToImport);
      } else {
        await TripService.appendTrips(tripsToImport);
      }
      onImportSuccess(tripsToImport.length, importMode);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Erro ao salvar no banco de dados: ${err?.message || 'Falha na conexão'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetModal = () => {
    setFile(null);
    setImportResult(null);
    setSelectedSheets([]);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-brand-900 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-brand-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
                Importação em Lote & Carga de Dados Reais
              </span>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Subir Planilha Institucional de Viagens (XLSX / CSV)
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">

          {/* Action Bar: Download Template Banner */}
          <div className="bg-brand-50/70 border border-brand-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-brand-950 text-xs flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-brand-700" />
                <span>Formato das 26 Colunas Padrão da UNILAB</span>
              </div>
              <p className="text-[11px] text-brand-800">
                O sistema reconhece planilhas com abas mensais (ex: <code>01-2026</code> a <code>12-2026</code>) ou planilha única com todas as colunas.
              </p>
            </div>
            <button
              onClick={() => ImportService.downloadTemplateExcel()}
              className="flex items-center gap-1.5 bg-white hover:bg-brand-100 text-brand-900 border border-brand-300 px-3 py-2 rounded-xl font-bold text-xs shadow-2xs transition-all whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-brand-700" />
              <span>Baixar Modelo Padrão (.xlsx)</span>
            </button>
          </div>

          {/* Drag and Drop Upload Area (when no file is parsed yet) */}
          {!importResult && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                isProcessing
                  ? 'border-brand-400 bg-brand-50/40 animate-pulse'
                  : 'border-slate-300 hover:border-brand-500 hover:bg-slate-50/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                {isProcessing ? (
                  <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
                ) : (
                  <UploadCloud className="w-8 h-8" />
                )}
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-sm sm:text-base text-navy-950">
                  {isProcessing ? 'Processando e validando planilha...' : 'Clique para selecionar ou arraste sua planilha aqui'}
                </h4>
                <p className="text-slate-500 text-xs">
                  Formatos aceitos: <strong>.xlsx</strong> (Excel), <strong>.xls</strong> ou <strong>.csv</strong>
                </p>
              </div>

              <span className="text-[11px] text-slate-400 font-medium">
                Detecção automática de abas de Janeiro a Dezembro (01-2026 a 12-2026)
              </span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="space-y-0.5">
                <div className="font-bold">Aviso de Importação</div>
                <div className="text-xs">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* IMPORT PREVIEW & SUMMARY (When file is parsed) */}
          {importResult && (
            <div className="space-y-5">
              
              {/* File Info Bar */}
              {/* File Info Bar */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-navy-950">{importResult.fileName}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span><strong>{tripsToImport.length}</strong> viagens selecionadas de <strong>{importResult.totalImported}</strong> no arquivo</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleResetModal}
                  className="text-xs font-bold text-slate-600 hover:text-rose-600 flex items-center gap-1.5 p-2 rounded-xl hover:bg-slate-200/60 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Escolher Outro Arquivo</span>
                </button>
              </div>

              {/* Interactive Sheet Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs">
                    <Layers className="w-3.5 h-3.5 text-brand-600" />
                    <span>Escolha as Abas (Meses) que deseja carregar no sistema:</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedSheets(importResult.sheets.map((s) => s.sheetName))}
                      className="text-brand-600 hover:text-brand-700 font-bold underline cursor-pointer"
                    >
                      Marcar Todas
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSheets([])}
                      className="text-slate-500 hover:text-slate-700 font-bold underline cursor-pointer"
                    >
                      Desmarcar Todas
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {importResult.sheets.map((sheet) => {
                    const isSelected = selectedSheets.includes(sheet.sheetName);
                    return (
                      <button
                        key={sheet.sheetName}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSheets(selectedSheets.filter((s) => s !== sheet.sheetName));
                          } else {
                            setSelectedSheets([...selectedSheets, sheet.sheetName]);
                          }
                        }}
                        className={`px-3.5 py-2 rounded-xl border text-xs flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-50 border-brand-400 text-navy-950 shadow-2xs font-extrabold ring-1 ring-brand-300'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 opacity-70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded text-brand-600 focus:ring-brand-500 pointer-events-none"
                        />
                        <span>{sheet.sheetName}</span>
                        <span
                          className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {sheet.validTrips.length} v.
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Import Mode Selector */}
              <div className="space-y-2">
                <span className="font-bold text-slate-700 text-xs block">Opção de Carga de Dados:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Option 1: Replace */}
                  <div
                    onClick={() => setImportMode('replace')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                      <input
                        type="radio"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      <span>Substituir Toda a Base de Dados (Recomendado)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-5">
                      Limpa os dados de exemplo atuais e carrega exclusivamente as viagens das abas selecionadas.
                    </p>
                  </div>

                  {/* Option 2: Append */}
                  <div
                    onClick={() => setImportMode('append')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      importMode === 'append'
                        ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                      <input
                        type="radio"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      <span>Mesclar / Adicionar às Viagens Existentes</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-5">
                      Mantém as viagens atuais e apenas adiciona os processos novos das abas selecionadas.
                    </p>
                  </div>

                </div>
              </div>

              {/* Sample Table Preview (First 8 Rows) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs">
                    Pré-visualização das Viagens das Abas Selecionadas:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {tripsToImport.length > 0
                      ? `Mostrando ${Math.min(8, tripsToImport.length)} de ${tripsToImport.length} viagens`
                      : 'Nenhuma viagem selecionada'}
                  </span>
                </div>

                {tripsToImport.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-extrabold text-[10.5px] uppercase tracking-wider border-b border-slate-200">
                          <th className="py-2.5 px-3">Processo</th>
                          <th className="py-2.5 px-2">Solicitante</th>
                          <th className="py-2.5 px-2">Unidade</th>
                          <th className="py-2.5 px-2">Saída</th>
                          <th className="py-2.5 px-2">Retorno</th>
                          <th className="py-2.5 px-2 text-center">Pax</th>
                          <th className="py-2.5 px-2 text-center">KM</th>
                          <th className="py-2.5 px-2">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {tripsToImport.slice(0, 8).map((trip) => (
                          <tr key={trip.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold font-mono text-navy-950">
                              {trip.process_number}
                            </td>
                            <td className="py-2 px-2 text-slate-800 font-medium truncate max-w-[140px]">
                              {trip.requester_name}
                            </td>
                            <td className="py-2 px-2 font-bold text-brand-700">
                              {trip.macro_unit}
                            </td>
                            <td className="py-2 px-2 text-slate-600">
                              {safeFormatDate(trip.departure_datetime, "dd/MM 'às' HH:mm", '-')}
                            </td>
                            <td className="py-2 px-2 text-slate-600">
                              {safeFormatDate(trip.return_datetime, "dd/MM 'às' HH:mm", '-')}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-slate-800">
                              {trip.passenger_count}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-emerald-700">
                              {trip.estimated_km} km
                            </td>
                            <td className="py-2 px-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {trip.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 border border-dashed rounded-2xl bg-slate-50">
                    Nenhuma aba selecionada. Clique nas abas acima para marcar quais deseja importar.
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {importResult && (
              <button
                onClick={handleConfirmImport}
                disabled={isProcessing || tripsToImport.length === 0}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 transition-all active:scale-95 ${
                  isProcessing || tripsToImport.length === 0
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/30'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gravando {tripsToImport.length} Viagens no Banco...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Confirmar e Carregar {tripsToImport.length} Viagens ({importMode === 'replace' ? 'Substituir' : 'Adicionar'})
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
