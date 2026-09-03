import React, { useState } from 'react';
import { City, DistanceMatrixItem } from '../../types';
import { DistanceService } from '../../services/distanceService';
import { 
  Milestone, 
  Search, 
  Plus, 
  Save, 
  RotateCcw, 
  MapPin, 
  Calculator, 
  CheckCircle2,
  Table as TableIcon,
  ListFilter
} from 'lucide-react';

interface DistanceMatrixViewProps {
  onMatrixUpdated?: () => void;
}

export const DistanceMatrixView: React.FC<DistanceMatrixViewProps> = ({ onMatrixUpdated }) => {
  const [cities, setCities] = useState<City[]>(DistanceService.getCities());
  const [distances, setDistances] = useState<DistanceMatrixItem[]>(DistanceService.getDistances());
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');
  const [searchTerm, setSearchTerm] = useState('');

  // Simulator Test
  const [simOrigin, setSimOrigin] = useState<string>(cities[0]?.id || 'city-1');
  const [simDest, setSimDest] = useState<string>(cities[2]?.id || 'city-3');

  // Modal para nova cidade
  const [isAddCityOpen, setIsAddCityOpen] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [newCityState, setNewCityState] = useState('CE');
  const [newCityCampus, setNewCityCampus] = useState('');

  // Edição inline de célula
  const [editingPair, setEditingPair] = useState<{ orig: string; dest: string } | null>(null);
  const [editKmValue, setEditKmValue] = useState<string>('');

  const refreshData = () => {
    setCities(DistanceService.getCities());
    setDistances(DistanceService.getDistances());
    if (onMatrixUpdated) onMatrixUpdated();
  };

  const handleStartEdit = (origId: string, destId: string, currentKm: number) => {
    if (origId === destId) return;
    setEditingPair({ orig: origId, dest: destId });
    setEditKmValue(currentKm.toString());
  };

  const handleSaveEdit = (origId: string, destId: string) => {
    const km = parseFloat(editKmValue);
    if (!isNaN(km) && km >= 0) {
      DistanceService.updateDistance(origId, destId, km);
      refreshData();
    }
    setEditingPair(null);
  };

  const handleAddCity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;

    DistanceService.addCity({
      name: newCityName.trim(),
      state: newCityState.trim(),
      campus: newCityCampus.trim() || undefined,
    });

    setNewCityName('');
    setNewCityCampus('');
    setIsAddCityOpen(false);
    refreshData();
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar a matriz de distâncias original da UNILAB?')) {
      DistanceService.resetToDefaults();
      refreshData();
    }
  };

  // Simulação de cálculo
  const simKmOneWay = DistanceService.getDistance(simOrigin, simDest);
  const simKmRoundTrip = DistanceService.calculateTotalKm(simOrigin, simDest);

  const filteredCities = cities.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Milestone className="w-5 h-5 text-brand-600" />
            <h2 className="text-xl font-extrabold text-navy-950">
              Matriz de Quilometragem & Trechos Oficiais
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tabela de referência paramétrica para cálculo automático de KM nas viagens institucionais
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddCityOpen(true)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Município</span>
          </button>

          <button
            onClick={handleResetDefaults}
            title="Restaurar distâncias padrão"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Simulator Card (Cálculo Instantâneo) */}
      <div className="bg-gradient-to-br from-navy-900 to-slate-900 rounded-2xl p-5 text-white shadow-card space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-brand-400 uppercase tracking-wider">
          <Calculator className="w-4 h-4" />
          Simulador Rápido de Trecho e Quilometragem
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Partida (Origem)</label>
            <select
              value={simOrigin}
              onChange={(e) => setSimOrigin(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-hidden focus:border-brand-500"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.state}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Destino</label>
            <select
              value={simDest}
              onChange={(e) => setSimDest(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-hidden focus:border-brand-500"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.state}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-white/10 rounded-xl border border-white/10 flex items-center justify-around">
            <div className="text-center">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Trecho Simples</span>
              <strong className="text-lg text-white font-extrabold">{simKmOneWay} km</strong>
            </div>
            <div className="h-8 w-px bg-white/20"></div>
            <div className="text-center">
              <span className="text-[10px] uppercase text-brand-300 font-bold block">Ida e Volta (Total)</span>
              <strong className="text-xl text-brand-400 font-extrabold">{simKmRoundTrip} km</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Control Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar municípios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-brand-500 focus:outline-hidden"
          />
        </div>

        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('matrix')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'matrix' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5 text-brand-600" />
            <span>Matriz Cruzada (KM x KM)</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'list' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5 text-blue-600" />
            <span>Lista de Trechos Cadastrados</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: MATRIZ CRUZADA BIDIRECIONAL */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tabela Bidirecional de Distâncias (KM)
            </span>
            <span className="text-[11px] text-slate-500">
              Clique em qualquer valor para editar diretamente o KM do trecho
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                  <th className="p-3 text-left pl-4 bg-slate-200/60 sticky left-0 z-10">Origem \ Destino</th>
                  {filteredCities.map((dest) => (
                    <th key={dest.id} className="p-2.5 min-w-[100px] border-l border-slate-200 font-bold">
                      {dest.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCities.map((orig) => (
                  <tr key={orig.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Linha de Origem Fixa */}
                    <td className="p-3 text-left pl-4 font-bold text-navy-950 bg-slate-50 sticky left-0 border-r border-slate-200 whitespace-nowrap">
                      {orig.name} <span className="text-[10px] text-slate-400 font-normal">({orig.state})</span>
                    </td>

                    {/* Células de Cruzamento KM */}
                    {filteredCities.map((dest) => {
                      const isSame = orig.id === dest.id;
                      const km = isSame ? 0 : DistanceService.getDistance(orig.id, dest.id);
                      const isEditing = editingPair?.orig === orig.id && editingPair?.dest === dest.id;

                      if (isSame) {
                        return (
                          <td key={dest.id} className="p-2.5 bg-slate-100 text-slate-400 font-bold border-l border-slate-200">
                            -
                          </td>
                        );
                      }

                      if (isEditing) {
                        return (
                          <td key={dest.id} className="p-1 border-l border-brand-300 bg-brand-50">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                autoFocus
                                min={0}
                                value={editKmValue}
                                onChange={(e) => setEditKmValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(orig.id, dest.id);
                                  if (e.key === 'Escape') setEditingPair(null);
                                }}
                                className="w-16 p-1 text-center font-bold text-xs bg-white border border-brand-500 rounded focus:outline-hidden"
                              />
                              <button
                                onClick={() => handleSaveEdit(orig.id, dest.id)}
                                className="p-1 text-brand-700 hover:bg-brand-200 rounded"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={dest.id}
                          onClick={() => handleStartEdit(orig.id, dest.id, km)}
                          title={`Clique para editar distância entre ${orig.name} e ${dest.name}`}
                          className={`p-2.5 border-l border-slate-100 cursor-pointer transition-colors ${
                            km > 0
                              ? 'font-bold text-slate-800 hover:bg-brand-50 hover:text-brand-700'
                              : 'text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {km > 0 ? `${km} km` : '0'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: LISTA DE TRECHOS CADASTRADOS */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Trechos com Distâncias Definidas ({distances.length} rotas)
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {distances.map((d) => {
              const orig = cities.find((c) => c.id === d.origin_city_id);
              const dest = cities.find((c) => c.id === d.destination_city_id);

              return (
                <div key={d.id} className="p-4 flex items-center justify-between hover:bg-slate-50 text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-brand-600" />
                    <span className="font-bold text-navy-950">{orig?.name || d.origin_city_id}</span>
                    <span className="text-slate-400">➔</span>
                    <span className="font-bold text-navy-950">{dest?.name || d.destination_city_id}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-extrabold text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1 rounded-lg">
                      {d.distance_km} km (Ida) • {d.distance_km * 2} km (Ida e Volta)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Adicionar Município */}
      {isAddCityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-navy-950">Adicionar Novo Município</h3>
              <button onClick={() => setIsAddCityOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCity} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Município *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Guaramiranga"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">UF (Estado) *</label>
                <select
                  value={newCityState}
                  onChange={(e) => setNewCityState(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-800 focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="CE">Ceará (CE)</option>
                  <option value="BA">Bahia (BA)</option>
                  <option value="RN">Rio Grande do Norte (RN)</option>
                  <option value="PI">Piauí (PI)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Campus / Observação (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Campus dos Malês"
                  value={newCityCampus}
                  onChange={(e) => setNewCityCampus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCityOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-bold shadow-md"
                >
                  Salvar Município
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
