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
import { DeleteTripModal } from './components/dispatch/DeleteTripModal';
import { ImportSpreadsheetModal } from './components/dispatch/ImportSpreadsheetModal';
import { TrafficOrderModal } from './components/dispatch/TrafficOrderModal';
import { TripGroupingModal } from './components/dispatch/TripGroupingModal';
import { ChangePasswordModal } from './components/common/ChangePasswordModal';
import { GoogleSheetsConfigModal } from './components/common/GoogleSheetsConfigModal';
import { GoogleSheetsService } from './services/googleSheetsService';
import { DistanceMatrixView } from './components/matrix/DistanceMatrixView';
import { TravelReportView } from './components/postTrip/TravelReportView';
import { FleetManagement } from './components/fleet/FleetManagement';
import { AuditView } from './components/audit/AuditView';
import { ReportsView } from './components/reports/ReportsView';
import { PublicPortal } from './components/public/PublicPortal';
import { AuditService } from './services/auditService';
import { supabase } from './services/supabaseClient';

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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTrafficOrderModalOpen, setIsTrafficOrderModalOpen] = useState(false);
  const [isGroupingModalOpen, setIsGroupingModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripRequest | null>(null);
  const [editingTrip, setEditingTrip] = useState<TripRequest | null>(null);

  // Toast / Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadTrips = async () => {
    try {
      const freshData = await TripService.fetchFromSupabase();
      if (freshData && freshData.length > 0) {
        const localTrips = TripService.getTrips();
        const map = new Map<string, TripRequest>();
        freshData.forEach((t) => map.set(t.id, t));
        localTrips.forEach((t) => {
          if (!map.has(t.id)) {
            map.set(t.id, t);
          }
        });
        const combined = Array.from(map.values()).sort(
          (a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime()
        );
        setTrips(combined);
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

    const handleSyncNotice = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (!detail) return;
      if (detail.tripId && detail.newProcessNumber) {
        setTrips((prev) =>
          prev.map((t) =>
            t.id === detail.tripId ? { ...t, process_number: detail.newProcessNumber } : t
          )
        );
      }
      if (detail.message) {
        showToast(detail.message, detail.type || 'warning');
      }
    };

    window.addEventListener('sigfrota:trip-sync-notice', handleSyncNotice);
    return () => window.removeEventListener('sigfrota:trip-sync-notice', handleSyncNotice);
  }, []);

  // Atualização em tempo real entre operadores (Supabase Realtime)
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('sigfrota_trip_requests_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_requests' },
        (payload: any) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const incoming = payload.new as TripRequest;
            if (!incoming || !incoming.id) return;
            setTrips((prev) => {
              const existing = prev.find((t) => t.id === incoming.id);
              const mergedItem: TripRequest = {
                ...(existing || {}),
                ...incoming,
                intermediate_cities: incoming.intermediate_cities ?? existing?.intermediate_cities,
                extra_km: incoming.extra_km ?? existing?.extra_km,
              };
              const updatedList = [mergedItem, ...prev.filter((t) => t.id !== incoming.id)].sort(
                (a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime()
              );
              localStorage.setItem('sigfrota_trips', JSON.stringify(updatedList));
              return updatedList;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (!deletedId) return;
            setTrips((prev) => {
              const updatedList = prev.filter((t) => t.id !== deletedId);
              localStorage.setItem('sigfrota_trips', JSON.stringify(updatedList));
              return updatedList;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  const handleLogin = () => {
    localStorage.setItem('sigfrota_auth', 'true');
    setIsAuthenticated(true);
    setActiveTab('dashboard');
    AuditService.logEvent({
      action: 'Autenticação no Sistema',
      entity_type: 'Sistema',
      compliance_status: 'Conforme',
      details: 'Sessão iniciada no painel SIG-FROTA Gestão Operacional.',
    });
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
      AuditService.logEvent({
        action: 'Reset de Base de Dados',
        entity_type: 'Sistema',
        compliance_status: 'Alerta',
        details: 'Base de solicitações de viagem foi resetada pelo operador.',
      });
      showToast('Base de solicitações zerada com sucesso!', 'info');
    }
  };

  const handleImportSuccess = (count: number, mode: 'replace' | 'append') => {
    loadTrips();
    AuditService.logEvent({
      action: 'Importação em Lote',
      entity_type: 'Viagem',
      compliance_status: 'Conforme',
      details: `Importação em lote realizada: ${count} solicitações de viagem (${mode === 'replace' ? 'Substituição da base' : 'Adição de registros'}).`,
    });
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

  const handleOpenDeleteModal = (trip: TripRequest) => {
    setSelectedTrip(trip);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteTrip = async (tripId: string) => {
    const tripToDelete = trips.find((t) => t.id === tripId) || selectedTrip;
    await TripService.deleteTrip(tripId);
    loadTrips();

    AuditService.logEvent({
      action: 'Cancelamento de Demanda',
      process_number: tripToDelete?.process_number || 'Sem Processo',
      target_id: tripId,
      entity_type: 'Viagem',
      compliance_status: 'Alerta',
      details: `Solicitação ${tripToDelete?.process_number || tripId} (${tripToDelete?.requester_name || ''}) foi excluída definitivamente pelo operador.`,
    });

    showToast(`Solicitação ${tripToDelete?.process_number || ''} excluída definitivamente!`, 'info');
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
    setTrips((prev) => prev.map((t) => (t.id === trip.id ? trip : t)));
    
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
    setTrips((prev) => prev.map((t) => (t.id === trip.id ? trip : t)));

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
    setTrips((prev) =>
      prev
        .map((t) => (t.id === trip.id ? trip : t))
        .sort((a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime())
    );

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

  const handleOpenNewTripModal = () => {
    setEditingTrip(null);
    setIsNewTripModalOpen(true);
  };

  const handleOpenEditTrip = (trip: TripRequest) => {
    setEditingTrip(trip);
    setIsNewTripModalOpen(true);
  };

  const handleSaveNewTrip = (tripData: Partial<TripRequest>) => {
    const isEditing = Boolean(tripData.id);
    const saved = TripService.saveTrip(tripData);

    // 1. Atualiza imediatamente o estado React com a lista local atualizada (sem sobrescrever com fetch defasado)
    setTrips((prevTrips) => {
      const merged = [saved, ...prevTrips.filter((t) => t.id !== saved.id)];
      return merged.sort(
        (a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime()
      );
    });

    // 2. Log de auditoria de criação ou edição de solicitação
    AuditService.logEvent({
      action: isEditing ? 'Edição de Solicitação' : 'Criação de Solicitação',
      process_number: saved.process_number,
      target_id: saved.id,
      entity_type: 'Viagem',
      compliance_status: saved.status_deadline === 'Dentro do Prazo' ? 'Conforme' : 'Alerta',
      details: isEditing
        ? `Solicitação ${saved.process_number} atualizada (${saved.requester_name} / ${saved.macro_unit}).`
        : `Nova solicitação aberta por ${saved.requester_name} (${saved.macro_unit}) com destino ${saved.destination_city_id}. Prazo: ${saved.status_deadline} (${saved.advance_days}d).`,
    });

    const sheetsNote = GoogleSheetsService.isConfigured() ? ' (backup enviado ao Google Sheets)' : '';
    showToast(
      isEditing
        ? `Processo ${saved.process_number} atualizado com sucesso!${sheetsNote}`
        : `Processo ${saved.process_number} cadastrado com sucesso!${sheetsNote}`,
      'success'
    );
    setEditingTrip(null);
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
            setTrips((prevTrips) => [trip, ...prevTrips.filter((t) => t.id !== trip.id)]);
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

      {/* Main Header with Logout & Password Change option */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
        urgentCount={urgentCount}
        trips={trips}
        onSelectTripDetail={handleSelectTripDetail}
        onOpenDispatchModal={handleOpenDispatchModal}
        onResetData={handleResetData}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenChangePasswordModal={() => setIsChangePasswordModalOpen(true)}
        onOpenGoogleSheetsModal={() => setIsGoogleSheetsModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto min-w-0 overflow-x-hidden">
        
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
              onOpenNewTripModal={handleOpenNewTripModal}
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
              onOpenNewTripModal={handleOpenNewTripModal}
              onOpenDispatchModal={handleOpenDispatchModal}
              onSelectTripDetail={handleSelectTripDetail}
              onOpenRejectModal={handleOpenRejectModal}
              onOpenChangeDateModal={handleOpenChangeDateModal}
              onOpenDeleteModal={handleOpenDeleteModal}
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
        onClose={() => {
          setIsNewTripModalOpen(false);
          setEditingTrip(null);
        }}
        onSaveTrip={handleSaveNewTrip}
        editingTrip={editingTrip}
        existingTrips={trips}
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
        onOpenEdit={handleOpenEditTrip}
        onOpenTrafficOrder={handleOpenTrafficOrderModal}
        onOpenDelete={handleOpenDeleteModal}
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

      <DeleteTripModal
        trip={selectedTrip}
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirmDelete={handleConfirmDeleteTrip}
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

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onSuccess={(msg) => showToast(msg, 'success')}
      />

      {/* Google Sheets Backup Configuration Modal */}
      <GoogleSheetsConfigModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        trips={trips}
        onNotify={(msg, type) => showToast(msg, type || 'success')}
      />

    </div>
  );
}

export default App;
