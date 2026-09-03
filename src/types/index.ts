export type ActivityType = 
  | 'Graduação' 
  | 'Pós Graduação' 
  | 'Pesquisa' 
  | 'Extensão' 
  | 'Administrativo';

export type MacroUnit = 
  | 'ICS' 
  | 'IDR' 
  | 'PROADI' 
  | 'PROPAE' 
  | 'ICEN' 
  | 'GR' 
  | 'PROEX' 
  | 'IH' 
  | 'PROINTER' 
  | 'ICSA'
  | 'SECOM'
  | 'PROPPG'
  | 'DTI';

export type StatusDeadline = 'Dentro do Prazo' | 'Fora do Prazo';

export type TripStatus = 
  | 'Confirmado ao Demandante'
  | 'Indeferido'
  | 'Cancelado pelo Demandante'
  | 'Cancelado pela Unidade Executante'
  | 'Alterado a Data da Demanda'
  | 'Pendente de Análise';

export type RejectionReason = 
  | 'Indisponibilidade de veículo'
  | 'Indisponibilidade de veículo e KM'
  | 'Fora do prazo'
  | 'Inconsistência nas informações'
  | 'Outros';

export type TravelReportStatus = 
  | 'Finalizado no Sistema'
  | 'Aguardando Envio da Contratada'
  | 'Aguardando a Apreciação do Gerente'
  | 'Não Aplicável';

export type VehicleType = 
  | 'Sedan' 
  | 'Caminhonete' 
  | 'Van' 
  | 'Micro-Ônibus' 
  | 'Ônibus' 
  | 'Caminhão';

export type DriverCategory = 
  | 'Motoristas de 01-09' 
  | 'Motoristas de 10-21' 
  | 'Motoristas>22';

export interface City {
  id: string;
  name: string;
  state: string;
  campus?: string;
}

export interface DistanceMatrixItem {
  id: string;
  origin_city_id: string;
  destination_city_id: string;
  distance_km: number;
  last_updated?: string;
}

export type FuelType = 'Gasolina' | 'Diesel S10' | 'Etanol' | 'Flex';

export interface FuelPrices {
  gasoline: number; // R$/L
  diesel: number;   // R$/L
  ethanol: number;  // R$/L
  maintenancePerKm: number; // R$/km com manutenção veicular e desgaste
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  type: VehicleType;
  capacity: number;
  contractor_id?: string;
  is_active: boolean;
  fuel_type: FuelType;
  avg_km_per_liter: number; // ex: 13.5 km/L
  operational_cost_per_km?: number; // Custo de manutenção, pneus, contrato por km
  notes?: string;
}

export interface Contractor {
  id: string;
  name: string;
  cnpj?: string;
  active: boolean;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface Driver {
  id: string;
  name: string;
  contractor_id: string;
  driver_category: DriverCategory;
  cnh_category: string;
  cnh_number?: string;
  phone?: string;
  is_active: boolean;
}

export interface TripRequest {
  id: string;
  process_number: string;
  received_at: string; // ISO string
  advance_days: number;
  status_deadline: StatusDeadline;
  activity_type: ActivityType;
  requester_name: string;
  requester_email: string;
  requester_phone?: string;
  macro_unit: MacroUnit;
  requesting_unit: string;
  origin_city_id: string;
  origin_address?: string;
  destination_city_id: string;
  destination_address?: string;
  departure_datetime: string; // ISO string
  return_datetime: string; // ISO string
  passenger_count: number;
  passenger_names?: string;
  passenger_list?: string[];
  trip_objective?: string;
  allocated_contractor_id?: string;
  allocated_driver_id?: string;
  allocated_vehicle_id?: string;
  status: TripStatus;
  rejection_reason?: RejectionReason | string;
  rejection_notes?: string;
  travel_report_status?: TravelReportStatus;
  estimated_km: number; // total (ida + volta)
  real_km?: number;
  fuel_liters?: number;
  toll_amount?: number;
  report_notes?: string;
  report_submitted_at?: string;
  report_approved_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingTrips: TripRequest[];
  reason?: string;
}

export interface FilterOptions {
  month?: number;
  year?: number;
  status?: string;
  macro_unit?: string;
  activity_type?: string;
  status_deadline?: string;
  searchTerm?: string;
}

export interface InstitutionalUnit {
  id: string;
  code: MacroUnit | string;
  name: string;
  category: 'Instituto' | 'Pró-Reitoria' | 'Reitoria' | 'Superintendência' | 'Setor Administrativo' | 'Campus';
  campus: string;
  manager_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  notes?: string;
}

export type AuditAction = 
  | 'Criação de Solicitação'
  | 'Despacho & Escala'
  | 'Alteração de Escala'
  | 'Indeferimento de Demanda'
  | 'Cancelamento de Demanda'
  | 'Alteração de Datas'
  | 'Aprovação de Relatório'
  | 'Importação em Lote'
  | 'Parametrização Financeira'
  | 'Cadastro de Frota'
  | 'Cadastro de Unidade'
  | 'Agrupamento de Viagem (Carona Solidária)';

export interface AuditLog {
  id: string;
  timestamp: string; // ISO string
  user_name: string;
  user_role: string;
  action: AuditAction;
  target_id?: string;
  process_number?: string;
  entity_type: 'Viagem' | 'Veículo' | 'Motorista' | 'Contratada' | 'Unidade' | 'Parâmetros' | 'Sistema';
  details: string;
  ip_address?: string;
  compliance_status: 'Conforme' | 'Alerta' | 'Exceção Justificada' | 'Crítico';
  notes?: string;
}

export interface AuditFilterOptions {
  action?: string;
  entity_type?: string;
  compliance_status?: string;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
}
