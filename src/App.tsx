import React, { useState, useEffect } from 'react';
import { TripRequest, RejectionReason } from './types';
import { TripService } from './services/tripService';
import { FleetService } from './services/fleetService';
import { DistanceService } from './services/distanceService';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { CalendarView } from './components/dashboard/CalendarView';
import { DispatchQueue } from './components/dispatch/DispatchQueue';
import { QuickDispatchModal } from './components/dispatch/QuickDispatchModal';
import { NewTripModal } from './components/dispatch/NewTripModal';
import { TripDetailModal } from './components/dispatch/TripDetailModal';
import { RejectTripModal } from './components/dispatch/RejectTripModal';
import { ChangeDateModal } from './components/dispatch/ChangeDateModal';
import { ImportSpreadsheetModal } from './components/dispatch/ImportSpreadsheetModal';
import { TrafficOrderModal } from './components/dispatch/TrafficOrderModal';
import { TripGroupingModal } from './components/dispatch/TripGroupingModal';
import { DistanceMatrixView } from './components/matrix/DistanceMatrixView';
import { TravelReportView } from './components/postTrip/TravelReportView';
import { FleetManagement } from './components/fleet/FleetManagement';
import { AuditView } from './components/audit/AuditView';
import { ReportsView } from './components/reports/ReportsView';
import { PublicPortal } from './components/public/PublicPortal';
import { AuditService } from './services/auditService';

export function App() {
  // Controle de Autenticação / Separação entre Portal do Solicitante e Sistema de Gestão
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('sigfrota_auth') === 'true';
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [trips, setTrips] = useState<TripRequest[]>([]);
  
  // Modals state
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isChangeDateModalOpen, setIsChangeDateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTrafficOrderModalOpen, setIsTrafficOrderModalOpen] = useState(false);
  const [isGroupingModalOpen, setIsGroupingModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripRequest | null>(null);

  // Toast / Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadTrips = async () => {
    try {
      const freshData = await TripService.fetchFromSupabase();
      if (freshData) {
        setTrips([...freshData]);
        return;
      }
    } catch {
      // fallback local
    }
    const list = TripService.getTrips();
    setTrips([...list]);
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const handleLogin = () => {
    localStorage.setItem('sigfrota_auth', 'true');
    setIsAuthenticated(true);
    setActiveTab('dashboard');
    showToast('Acesso autorizado! Bem-vindo ao SIG-FROTA Gestão.', 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('sigfrota_auth');
    localStorage.removeItem('sigfrota_user');
    setIsAuthenticated(false);
    showToast('Sessão encerrada. Você retornou ao Portal do Solicitante.', 'info');
  };

  const handleResetData = async () => {
    if (confirm('Deseja zerar a base de solicitações para carregar a planilha oficial?')) {
      await TripService.clearAllTrips();
      setTrips([]);
      showToast('Base de solicitações zerada com sucesso!', 'info');
    }
  };

  const handleImportSuccess = (count: number, mode: 'replace' | 'append') => {
    loadTrips();
    showToast(
      mode === 'replace'
        ? `Base de dados atualizada com ${count} solicitações reais de 2026!`
        : `${count} solicitações adicionadas com sucesso!`,
      'success'
    );
  };

  // Fleet & Reference data
  const vehicles = FleetService.getVehicles();
  const drivers = FleetService.getDrivers();
  const contractors = FleetService.getContractors();
  const cities = DistanceService.getCities();

  // Dispatch Actions
  const handleOpenDispatchModal = (trip: TripRequest) => {
    setSelectedTrip(trip);
    setIsDispatchModalOpen(true);
  };

  const handleSelectTripDetail = (trip: TripRequest) => {
    setSelectedTrip(trip);
    setIsDetailModalOpen(true);
  };

  const handleOpenRejectModal = (trip: TripRequest) => {
    setSelectedTrip(trip);
    setIsRejectModalOpen(true);
  };

  const handleOpenChangeDateModal = (trip: TripRequest) => {
    setSelectedTrip(trip);
    setIsChangeDateModalOpen(true);
  };

  const handleOpenTrafficOrderModal = (trip: TripRequest) => {
    setSelectedTrip(trip);
    setIsTrafficOrderModalOpen(true);
  };

  const handleGroupDispatched = () => {
    loadTrips();
    showToast('Viagens agrupadas e escaladas em carona solidária com sucesso!', 'success');
  };

  const handleConfirmDispatch = (
    tripId: string,
    allocation: {
      contractorId: string;
      driverId: string;
      vehicleId: string;
      notes?: string;
    }
  ) => {
    const { trip, conflictWarning } = TripService.dispatchTrip(tripId, allocation);
    loadTrips();
    
    // Log de auditoria do despacho
    AuditService.logEvent({
      action: 'Despacho & Escala',
      process_number: trip.process_number,
      target_id: trip.id,
      entity_type: 'Viagem',
      compliance_status: conflictWarning ? 'Alerta' : 'Conforme',
      details: `Despacho realizado para ${trip.requester_name} (${trip.macro_unit}). Veículo ID: ${allocation.vehicleId}, Motorista ID: ${allocation.driverId}. ${conflictWarning ? `Alerta: ${conflictWarning}` : ''}`,
    });

    if (conflictWarning) {
      showToast(`Viagem confirmada com alerta de conflito: ${conflictWarning}`, 'warning');
    } else {
      showToast(`Processo ${trip.process_number} escalado com sucesso!`, 'success');
    }
  };

  const handleConfirmReject = (
    tripId: string,
    data: { reason: RejectionReason | string; rejection_notes?: string }
  ) => {
    const trip = TripService.rejectTrip(tripId, data);
    loadTrips();

    // Log de auditoria do indeferimento
    AuditService.logEvent({
      action: 'Indeferimento de Demanda',
      process_number: trip.process_number,
      target_id: trip.id,
      entity_type: 'Viagem',
      compliance_status: 'Exceção Justificada',
      details: `Solicitação indeferida. Motivo: ${data.reason}. Justificativa: ${data.rejection_notes || 'Sem observações'}`,
    });

    showToast(`Processo ${trip.process_number} indeferido com sucesso.`, 'info');
  };

  const handleConfirmChangeDate = (
    tripId: string,
    data: { departureDatetime: string; returnDatetime: string; notes?: string }
  ) => {
    const trip = TripService.changeTripDates(tripId, data);
    loadTrips();

    // Log de auditoria de alteração de datas
    AuditService.logEvent({
      action: 'Alteração de Datas',
      process_number: trip.process_number,
      target_id: trip.id,
      entity_type: 'Viagem',
      compliance_status: 'Conforme',
      details: `Datas da viagem atualizadas. Nova saída: ${data.departureDatetime}, retorno: ${data.returnDatetime}. Motivo: ${data.notes || 'Ajuste operacional'}`,
    });

    showToast(`Datas do processo ${trip.process_number} atualizadas.`, 'success');
  };

  const handleSaveNewTrip = (tripData: Partial<TripRequest>) => {
    const saved = TripService.saveTrip(tripData);
    loadTrips();

    // Log de auditoria de nova solicitação
    AuditService.logEvent({
      action: 'Criação de Solicitação',
      process_number: saved.process_number,
      target_id: saved.id,
      entity_type: 'Viagem',
      compliance_status: saved.status_deadline === 'Dentro do Prazo' ? 'Conforme' : 'Alerta',
      details: `Nova solicitação aberta por ${saved.requester_name} (${saved.macro_unit}) com destino ${saved.destination_city_id}. Prazo: ${saved.status_deadline} (${saved.advance_days}d).`,
    });

    showToast(`Processo ${saved.process_number} cadastrado com sucesso!`, 'success');
  };

  // Counts for badges
  const pendingCount = trips.filter((t) => t.status === 'Pendente de Análise').length;
  const urgentCount = trips.filter(
    (t) => t.status === 'Pendente de Análise' && t.status_deadline === 'Fora do Prazo'
  ).length;
  const reportPendingCount = trips.filter(
    (t) => t.travel_report_status === 'Aguardando a Apreciação do Gerente'
  ).length;

  // SE NÃO ESTIVER AUTENTICADO: Exibe diretamente a Página Inicial / Portal do Solicitante & Login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-900">
        {toastMessage && (
          <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold text-white flex items-center gap-2 animate-fade-in ${
            toastMessage.type === 'success'
              ? 'bg-brand-600 shadow-brand-600/30'
              : toastMessage.type === 'warning'
              ? 'bg-amber-600 shadow-amber-600/30'
              : 'bg-navy-900 shadow-navy-900/30'
          }`}>
            <span>{toastMessage.text}</span>
          </div>
        )}

        <PublicPortal
          onLoginSuccess={handleLogin}
          onNewTripCreated={(trip) => {
            loadTrips();
            showToast(`Solicitação ${trip.process_number} registrada!`, 'success');
          }}
        />
      </div>
    );
  }

  // SE AUTENTICADO: Exibe o Sistema Integrado de Gestão da DIVTRANS / PROADI
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-900">
      
      {/* Toast Floating Notification */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold text-white flex items-center gap-2 animate-fade-in ${
          toastMessage.type === 'success'
            ? 'bg-brand-600 shadow-brand-600/30'
            : toastMessage.type === 'warning'
            ? 'bg-amber-600 shadow-amber-600/30'
            : 'bg-navy-900 shadow-navy-900/30'
        }`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Header with Logout option */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
        urgentCount={urgentCount}
        onResetData={handleResetData}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex w-full max-w-[1600px] mx-auto min-w-0 overflow-x-hidden">
        
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={pendingCount}
          reportPendingCount={reportPendingCount}
          onLogout={handleLogout}
        />

        {/* Dynamic Content Area */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 min-w-0 overflow-x-hidden">
          
          {/* Dashboard Module */}
          {activeTab === 'dashboard' && (
            <DashboardOverview
              trips={trips}
              onOpenNewTripModal={() => setIsNewTripModalOpen(true)}
              onOpenDispatchModal={handleOpenDispatchModal}
              onSelectTripDetail={handleSelectTripDetail}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {/* Dispatch Queue Module (Separado por Meses e com Resumo Operacional como padrão) */}
          {activeTab === 'dispatch' && (
            <DispatchQueue
              trips={trips}
              cities={cities}
              vehicles={vehicles}
              drivers={drivers}
              contractors={contractors}
              onOpenNewTripModal={() => setIsNewTripModalOpen(true)}
              onOpenDispatchModal={handleOpenDispatchModal}
              onSelectTripDetail={handleSelectTripDetail}
              onOpenRejectModal={handleOpenRejectModal}
              onOpenChangeDateModal={handleOpenChangeDateModal}
              onOpenImportModal={() => setIsImportModalOpen(true)}
              onOpenTrafficOrderModal={handleOpenTrafficOrderModal}
              onOpenGroupingModal={() => setIsGroupingModalOpen(true)}
            />
          )}

          {/* Analytics & BI Module */}
          {activeTab === 'analytics' && (
            <AnalyticsView
              trips={trips}
              vehicles={vehicles}
              drivers={drivers}
              contractors={contractors}
              cities={cities}
            />
          )}

          {/* Calendar & Gantt Timeline Module */}
          {activeTab === 'calendar' && (
            <CalendarView
              trips={trips}
              onSelectTripDetail={handleSelectTripDetail}
              onOpenDispatchModal={handleOpenDispatchModal}
            />
          )}

          {/* Distance Matrix Module */}
          {activeTab === 'matrix' && (
            <DistanceMatrixView
              onMatrixUpdated={loadTrips}
            />
          )}

          {/* Travel Reports Module (Post-Trip) */}
          {activeTab === 'postTrip' && (
            <TravelReportView
              trips={trips}
              onTripUpdated={loadTrips}
            />
          )}

          {/* Fleet, Drivers, Contractors & Units Management */}
          {activeTab === 'fleet' && (
            <FleetManagement />
          )}

          {/* Audit & Traceability Module */}
          {activeTab === 'audit' && (
            <AuditView
              trips={trips}
              vehicles={vehicles}
              drivers={drivers}
              contractors={contractors}
            />
          )}

          {/* Reports & PDF/Excel Export */}
          {activeTab === 'reports' && (
            <ReportsView
              trips={trips}
              onOpenImportModal={() => setIsImportModalOpen(true)}
            />
          )}

        </main>
      </div>

      {/* Global Modals */}
      <NewTripModal
        isOpen={isNewTripModalOpen}
        onClose={() => setIsNewTripModalOpen(false)}
        onSaveTrip={handleSaveNewTrip}
      />

      <QuickDispatchModal
        trip={selectedTrip}
        allTrips={trips}
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        onConfirmDispatch={handleConfirmDispatch}
      />

      <TripDetailModal
        trip={selectedTrip}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onOpenDispatch={handleOpenDispatchModal}
        onOpenReject={handleOpenRejectModal}
        onOpenChangeDate={handleOpenChangeDateModal}
        onOpenTrafficOrder={handleOpenTrafficOrderModal}
      />

      <RejectTripModal
        trip={selectedTrip}
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirmReject={handleConfirmReject}
      />

      <ChangeDateModal
        trip={selectedTrip}
        isOpen={isChangeDateModalOpen}
        onClose={() => setIsChangeDateModalOpen(false)}
        onConfirmChangeDate={handleConfirmChangeDate}
      />

      {/* Import Spreadsheet Modal */}
      <ImportSpreadsheetModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Traffic Order Slip Modal */}
      <TrafficOrderModal
        isOpen={isTrafficOrderModalOpen}
        onClose={() => setIsTrafficOrderModalOpen(false)}
        trip={selectedTrip}
      />

      {/* Ride Grouping & Pooling Modal */}
      <TripGroupingModal
        isOpen={isGroupingModalOpen}
        onClose={() => setIsGroupingModalOpen(false)}
        trips={trips}
        onGroupDispatched={handleGroupDispatched}
        onSelectTripDetail={handleSelectTripDetail}
      />

    </div>
  );
}

export default App;
