import React, { useState } from 'react';
import { Vehicle, Driver, Contractor, InstitutionalUnit, VehicleType, DriverCategory } from '../../types';
import { FleetService } from '../../services/fleetService';
import { 
  Truck, 
  User, 
  Building2, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  X,
  Phone,
  Mail,
  Users,
  School,
  MapPin,
  Info
} from 'lucide-react';

export const FleetManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers' | 'contractors' | 'units'>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>(FleetService.getVehicles());
  const [drivers, setDrivers] = useState<Driver[]>(FleetService.getDrivers());
  const [contractors, setContractors] = useState<Contractor[]>(FleetService.getContractors());
  const [units, setUnits] = useState<InstitutionalUnit[]>(FleetService.getUnits());

  // Vehicle Modal
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vPlate, setVPlate] = useState('');
  const [vModel, setVModel] = useState('');
  const [vType, setVType] = useState<VehicleType>('Sedan');
  const [vCapacity, setVCapacity] = useState<number>(5);
  const [vContractorId, setVContractorId] = useState<string>('');
  const [vFuelType, setVFuelType] = useState<any>('Diesel S10');
  const [vAvgKmPerLiter, setVAvgKmPerLiter] = useState<number>(9.0);
  const [vOpCost, setVOpCost] = useState<number>(0.40);

  // Driver Modal
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [dName, setDName] = useState('');
  const [dContractorId, setDContractorId] = useState<string>('');
  const [dCategory, setDCategory] = useState<DriverCategory>('Motoristas de 01-09');
  const [dCnh, setDCnh] = useState('B');
  const [dPhone, setDPhone] = useState('');

  // Contractor Modal
  const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [cName, setCName] = useState('');
  const [cCNPJ, setCCNPJ] = useState('');
  const [cContact, setCContact] = useState('');
  const [cEmail, setCEmail] = useState('');

  // Unit Modal
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<InstitutionalUnit | null>(null);
  const [uCode, setUCode] = useState('');
  const [uName, setUName] = useState('');
  const [uCategory, setUCategory] = useState<any>('Instituto');
  const [uCampus, setUCampus] = useState('Campus Liberdade (Redenção/CE)');
  const [uManager, setUManager] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uNotes, setUNotes] = useState('');

  const refreshData = () => {
    setVehicles(FleetService.getVehicles());
    setDrivers(FleetService.getDrivers());
    setContractors(FleetService.getContractors());
    setUnits(FleetService.getUnits());
  };

  // --- VEHICLE HANDLERS ---
  const handleOpenVehicleModal = (veh?: Vehicle) => {
    if (veh) {
      setEditingVehicle(veh);
      setVPlate(veh.plate);
      setVModel(veh.model);
      setVType(veh.type);
      setVCapacity(veh.capacity);
      setVContractorId(veh.contractor_id || '');
      setVFuelType(veh.fuel_type || 'Diesel S10');
      setVAvgKmPerLiter(veh.avg_km_per_liter || 9.0);
      setVOpCost(veh.operational_cost_per_km || 0.40);
    } else {
      setEditingVehicle(null);
      setVPlate('');
      setVModel('');
      setVType('Sedan');
      setVCapacity(5);
      setVContractorId(contractors[0]?.id || '');
      setVFuelType('Diesel S10');
      setVAvgKmPerLiter(9.0);
      setVOpCost(0.40);
    }
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    FleetService.saveVehicle({
      id: editingVehicle ? editingVehicle.id : undefined,
      plate: vPlate.toUpperCase(),
      model: vModel,
      type: vType,
      capacity: vCapacity,
      contractor_id: vContractorId || undefined,
      fuel_type: vFuelType,
      avg_km_per_liter: vAvgKmPerLiter,
      operational_cost_per_km: vOpCost,
      is_active: true,
    });
    setIsVehicleModalOpen(false);
    refreshData();
  };

  // --- DRIVER HANDLERS ---
  const handleOpenDriverModal = (driver?: Driver) => {
    if (driver) {
      setEditingDriver(driver);
      setDName(driver.name);
      setDContractorId(driver.contractor_id);
      setDCategory(driver.driver_category);
      setDCnh(driver.cnh_category);
      setDPhone(driver.phone || '');
    } else {
      setEditingDriver(null);
      setDName('');
      setDContractorId(contractors[0]?.id || '');
      setDCategory('Motoristas de 01-09');
      setDCnh('B');
      setDPhone('');
    }
    setIsDriverModalOpen(true);
  };

  const handleSaveDriver = (e: React.FormEvent) => {
    e.preventDefault();
    FleetService.saveDriver({
      id: editingDriver ? editingDriver.id : undefined,
      name: dName,
      contractor_id: dContractorId,
      driver_category: dCategory,
      cnh_category: dCnh,
      phone: dPhone,
      is_active: true,
    });
    setIsDriverModalOpen(false);
    refreshData();
  };

  // --- CONTRACTOR HANDLERS ---
  const handleOpenContractorModal = (c?: Contractor) => {
    if (c) {
      setEditingContractor(c);
      setCName(c.name);
      setCCNPJ(c.cnpj || '');
      setCContact(c.contact_name || '');
      setCEmail(c.contact_email || '');
    } else {
      setEditingContractor(null);
      setCName('');
      setCCNPJ('');
      setCContact('');
      setCEmail('');
    }
    setIsContractorModalOpen(true);
  };

  const handleSaveContractor = (e: React.FormEvent) => {
    e.preventDefault();
    FleetService.saveContractor({
      id: editingContractor ? editingContractor.id : undefined,
      name: cName,
      cnpj: cCNPJ,
      contact_name: cContact,
      contact_email: cEmail,
      active: true,
    });
    setIsContractorModalOpen(false);
    refreshData();
  };

  // --- UNIT HANDLERS ---
  const handleOpenUnitModal = (unit?: InstitutionalUnit) => {
    if (unit) {
      setEditingUnit(unit);
      setUCode(unit.code);
      setUName(unit.name);
      setUCategory(unit.category);
      setUCampus(unit.campus);
      setUManager(unit.manager_name);
      setUEmail(unit.email);
      setUPhone(unit.phone || '');
      setUNotes(unit.notes || '');
    } else {
      setEditingUnit(null);
      setUCode('');
      setUName('');
      setUCategory('Instituto');
      setUCampus('Campus Liberdade (Redenção/CE)');
      setUManager('');
      setUEmail('');
      setUPhone('');
      setUNotes('');
    }
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    FleetService.saveUnit({
      id: editingUnit ? editingUnit.id : undefined,
      code: uCode.toUpperCase(),
      name: uName,
      category: uCategory,
      campus: uCampus,
      manager_name: uManager,
      email: uEmail,
      phone: uPhone,
      notes: uNotes,
      is_active: true,
    });
    setIsUnitModalOpen(false);
    refreshData();
  };

  const handleDeleteUnit = (id: string, name: string) => {
    if (confirm(`Deseja realmente remover a unidade ${name}?`)) {
      FleetService.deleteUnit(id);
      refreshData();
    }
  };

  const getContractorName = (id?: string) => {
    const c = contractors.find((item) => item.id === id);
    return c ? c.name : 'Frota Própria';
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-navy-950">
            Cadastros: Frota, Motoristas, Contratadas & Unidades
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gerencie os veículos, motoristas habilitados, prestadores de serviço terceirizados e centros de custo da UNILAB.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs max-w-full overflow-x-auto">
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'vehicles' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-brand-600" />
            <span>Veículos ({vehicles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('drivers')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'drivers' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>Motoristas ({drivers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('contractors')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'contractors' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-purple-600" />
            <span>Contratadas ({contractors.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('units')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'units' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <School className="w-3.5 h-3.5 text-amber-600" />
            <span>Unidades & Centros ({units.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: VEÍCULOS */}
      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => handleOpenVehicleModal()}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Novo Veículo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3 hover:border-brand-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-base text-navy-950 tracking-wider">
                    {v.plate}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-200">
                    {v.type}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <div className="font-bold text-slate-800">{v.model}</div>
                  <div className="text-slate-500">Capacidade: <strong>{v.capacity} passageiros</strong></div>
                  <div className="text-slate-500">
                    Combustível: <strong className="text-slate-800">{v.fuel_type || 'Diesel S10'}</strong> ({v.avg_km_per_liter || 9.0} km/L)
                  </div>
                  <div className="text-slate-500">Contratada: <span className="font-medium text-slate-700">{getContractorName(v.contractor_id)}</span></div>
                </div>

                {v.notes && (
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {v.notes}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-brand-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ativo na Frota
                  </span>
                  <button
                    onClick={() => handleOpenVehicleModal(v)}
                    className="p-1.5 text-slate-500 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: MOTORISTAS */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => handleOpenDriverModal()}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Motorista</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.map((d) => (
              <div
                key={d.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3 hover:border-brand-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-navy-950">
                    {d.name}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                    CNH Cat. {d.cnh_category}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <div className="text-slate-600 font-semibold">{d.driver_category}</div>
                  <div className="text-slate-500">Contratada: <span className="font-medium text-slate-700">{getContractorName(d.contractor_id)}</span></div>
                  {d.phone && (
                    <div className="text-slate-500 flex items-center gap-1 pt-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{d.phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-brand-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Habilitado para Escala
                  </span>
                  <button
                    onClick={() => handleOpenDriverModal(d)}
                    className="p-1.5 text-slate-500 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CONTRATADAS */}
      {activeTab === 'contractors' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => handleOpenContractorModal()}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Contratada</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contractors.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm sm:text-base text-navy-950">
                    {c.name}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                    Ativa
                  </span>
                </div>

                <div className="text-xs space-y-1.5 text-slate-600">
                  {c.cnpj && (
                    <div>CNPJ: <strong className="font-mono text-slate-800">{c.cnpj}</strong></div>
                  )}
                  {c.contact_name && (
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.contact_name}</span>
                    </div>
                  )}
                  {c.contact_email && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.contact_email}</span>
                    </div>
                  )}
                  {c.contact_phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.contact_phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Prestadora Credenciada</span>
                  <button
                    onClick={() => handleOpenContractorModal(c)}
                    className="p-1.5 text-slate-500 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: UNIDADES DEMANDANTES & MACROS */}
      {activeTab === 'units' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-sm text-navy-950">
                Unidades Solicitantes & Centros de Custo ({units.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Cadastre e mantenha atualizadas as Unidades Acadêmicas, Pró-Reitorias e Diretorias da UNILAB.
              </p>
            </div>
            <button
              onClick={() => handleOpenUnitModal()}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-all active:scale-95 whitespace-nowrap self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Nova Unidade</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {units.map((u) => {
              const categoryBadge = 
                u.category === 'Instituto' 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : u.category === 'Pró-Reitoria'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : u.category === 'Reitoria'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200';

              return (
                <div
                  key={u.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3 hover:border-brand-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-navy-950 font-mono bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                          {u.code}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${categoryBadge}`}>
                        {u.category}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <h4 className="font-bold text-slate-900 leading-snug">{u.name}</h4>
                      <div className="text-slate-500 flex items-center gap-1 text-[11px]">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{u.campus}</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1 text-[11px] text-slate-600">
                      {u.manager_name && (
                        <div><strong>Gestor(a):</strong> {u.manager_name}</div>
                      )}
                      {u.email && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </div>
                      )}
                      {u.phone && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{u.phone}</span>
                        </div>
                      )}
                    </div>

                    {u.notes && (
                      <p className="text-[10.5px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2" title={u.notes}>
                        {u.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs mt-2">
                    <span className="flex items-center gap-1 text-brand-700 font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Unidade Ativa
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenUnitModal(u)}
                        className="p-1.5 text-slate-500 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Editar Unidade"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUnit(u.id, u.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Excluir Unidade"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL VEÍCULO */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-navy-950">
                {editingVehicle ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}
              </h3>
              <button onClick={() => setIsVehicleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Placa do Veículo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SAS-4C64"
                  value={vPlate}
                  onChange={(e) => setVPlate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 uppercase font-mono font-bold focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Modelo / Fabricante *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Toyota Hilux 4x4 CD"
                  value={vModel}
                  onChange={(e) => setVModel(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Veículo</label>
                  <select
                    value={vType}
                    onChange={(e) => setVType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                  >
                    <option value="Sedan">Sedan</option>
                    <option value="Caminhonete">Caminhonete</option>
                    <option value="Van">Van</option>
                    <option value="Micro-Ônibus">Micro-Ônibus</option>
                    <option value="Ônibus">Ônibus</option>
                    <option value="Caminhão">Caminhão</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Capacidade (Lugares)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={vCapacity}
                    onChange={(e) => setVCapacity(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Combustível</label>
                  <select
                    value={vFuelType}
                    onChange={(e) => setVFuelType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                  >
                    <option value="Diesel S10">Diesel S10</option>
                    <option value="Gasolina">Gasolina</option>
                    <option value="Etanol">Etanol</option>
                    <option value="Flex">Flex</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Consumo (Km/L)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="40"
                    value={vAvgKmPerLiter}
                    onChange={(e) => setVAvgKmPerLiter(parseFloat(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contratada / Proprietária</label>
                <select
                  value={vContractorId}
                  onChange={(e) => setVContractorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="">Frota Própria / UNILAB</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-bold shadow-md"
                >
                  Salvar Veículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MOTORISTA */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-navy-950">
                {editingDriver ? 'Editar Motorista' : 'Cadastrar Novo Motorista'}
              </h3>
              <button onClick={() => setIsDriverModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo do Motorista *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: José Francisco Gomes"
                  value={dName}
                  onChange={(e) => setDName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria de Escala</label>
                  <select
                    value={dCategory}
                    onChange={(e) => setDCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                  >
                    <option value="Motoristas de 01-09">Motoristas 01-09</option>
                    <option value="Motoristas de 10-21">Motoristas 10-21</option>
                    <option value="Motoristas>22">Motoristas &gt;22</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria CNH</label>
                  <select
                    value={dCnh}
                    onChange={(e) => setDCnh(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                  >
                    <option value="B">B (Carros/Sedans)</option>
                    <option value="C">C (Caminhões Médios)</option>
                    <option value="D">D (Vans/Micro-Ônibus)</option>
                    <option value="E">E (Ônibus/Carretas)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contratada / Empregador</label>
                <select
                  value={dContractorId}
                  onChange={(e) => setDContractorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="">Frota Própria / UNILAB</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(85) 99999-9999"
                  value={dPhone}
                  onChange={(e) => setDPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDriverModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-bold shadow-md"
                >
                  Salvar Motorista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONTRATADA */}
      {isContractorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-navy-950">
                {editingContractor ? 'Editar Contratada' : 'Cadastrar Nova Contratada'}
              </h3>
              <button onClick={() => setIsContractorModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContractor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Razão Social / Nome Fantasia *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Crateús Locadora de Veículos"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  placeholder="00.000.000/0001-00"
                  value={cCNPJ}
                  onChange={(e) => setCCNPJ(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contato Responsável</label>
                <input
                  type="text"
                  placeholder="Nome do preposto ou gerente"
                  value={cContact}
                  onChange={(e) => setCContact(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail Operacional</label>
                <input
                  type="email"
                  placeholder="operacional@empresa.com.br"
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsContractorModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-bold shadow-md"
                >
                  Salvar Contratada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UNIDADE SOLICITANTE */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-navy-950 flex items-center gap-2">
                <School className="w-5 h-5 text-amber-600" />
                {editingUnit ? 'Editar Unidade Institucional' : 'Cadastrar Nova Unidade Institucional'}
              </h3>
              <button onClick={() => setIsUnitModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sigla / Código *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: ICS"
                    value={uCode}
                    onChange={(e) => setUCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 uppercase font-mono font-bold focus:border-brand-500 focus:outline-hidden"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
                  <select
                    value={uCategory}
                    onChange={(e) => setUCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                  >
                    <option value="Instituto">Instituto Acadêmico</option>
                    <option value="Pró-Reitoria">Pró-Reitoria</option>
                    <option value="Reitoria">Reitoria / Gabinete</option>
                    <option value="Superintendência">Superintendência</option>
                    <option value="Setor Administrativo">Setor Administrativo / Diretoria</option>
                    <option value="Campus">Campus Fora de Sede</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo da Unidade *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Instituto de Ciências da Saúde"
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Campus / Localização *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Campus das Auroras (Redenção/CE)"
                  value={uCampus}
                  onChange={(e) => setUCampus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Responsável / Gestor(a)</label>
                  <input
                    type="text"
                    placeholder="Nome do Diretor(a) ou Pró-Reitor(a)"
                    value={uManager}
                    onChange={(e) => setUManager(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone / Ramal</label>
                  <input
                    type="text"
                    placeholder="(85) 3332-0000"
                    value={uPhone}
                    onChange={(e) => setUPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail Institucional</label>
                <input
                  type="email"
                  placeholder="unidade@unilab.edu.br"
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações & Finalidades</label>
                <textarea
                  rows={2}
                  placeholder="Cursos vinculados, projetos ou observações de logística"
                  value={uNotes}
                  onChange={(e) => setUNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUnitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-bold shadow-md"
                >
                  Salvar Unidade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default FleetManagement;
