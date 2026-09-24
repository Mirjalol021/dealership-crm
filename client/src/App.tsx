import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { TodayPage } from './pages/TodayPage';
import { LeadPoolPage } from './pages/LeadPoolPage';
import { MyLeadsPage } from './pages/MyLeadsPage';
import { KanbanPage } from './pages/KanbanPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { ManagementPage } from './pages/ManagementPage';
import { InventoryPage } from './pages/InventoryPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { SoldCarsPage } from './pages/SoldCarsPage';
import { FinanceDashboardPage } from './pages/FinanceDashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { KpiBonusesPage } from './pages/KpiBonusesPage';
import { FinanceSettingsPage } from './pages/FinanceSettingsPage';
import { AfterSalesInventoryPage } from './pages/AfterSalesInventoryPage';
import { ServiceVisitsPage } from './pages/ServiceVisitsPage';
import { CustomersToCallPage } from './pages/CustomersToCallPage';
import { StockMovementsPage } from './pages/StockMovementsPage';
import { AfterSalesSoldCarsPage } from './pages/AfterSalesSoldCarsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SalesPage } from './pages/SalesPage';
import { ImportPage } from './pages/ImportPage';
import { LeadFormsPage } from './pages/LeadFormsPage';
import { AuditLogPage } from './pages/AuditLogPage';

// Wraps a page element with an optional capability gate (UX-level; backend enforces).
function guarded(capability: string, node: ReactNode) {
  return <ProtectedRoute capability={capability}>{node}</ProtectedRoute>;
}

function Home() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'SALES_MANAGER') return <Navigate to="/today" replace />;
  return <DashboardPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/today" element={guarded('leads.view.own', <TodayPage />)} />
        <Route path="/leads" element={guarded('leads.view.own', <KanbanPage />)} />
        <Route path="/kanban" element={guarded('leads.view.own', <KanbanPage />)} />
        <Route path="/lead-pool" element={guarded('leads.take', <LeadPoolPage />)} />
        <Route path="/my-leads" element={guarded('leads.view.own', <MyLeadsPage />)} />
        <Route path="/new-leads" element={guarded('leads.view.own', <MyLeadsPage />)} />
        <Route path="/follow-ups" element={guarded('leads.view.own', <MyLeadsPage />)} />
        <Route path="/qualified" element={guarded('leads.assign', <LeadPoolPage />)} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/management" element={guarded('leads.view.all', <ManagementPage />)} />
        <Route path="/inventory" element={guarded('inventory.view', <InventoryPage />)} />
        <Route path="/reservations" element={guarded('sales.view', <ReservationsPage />)} />
        <Route path="/sales" element={guarded('sales.view', <SalesPage />)} />
        <Route path="/sold-cars" element={guarded('sales.view', <SoldCarsPage />)} />
        <Route path="/aftersales" element={guarded('aftersales.view', <AfterSalesSoldCarsPage />)} />
        <Route path="/aftersales/inventory" element={guarded('aftersales.view', <AfterSalesInventoryPage />)} />
        <Route path="/aftersales/stock-movements" element={guarded('aftersales.view', <StockMovementsPage />)} />
        <Route path="/customers-to-call" element={guarded('aftersales.view', <CustomersToCallPage />)} />
        <Route path="/service-visits" element={guarded('aftersales.view', <ServiceVisitsPage />)} />
        <Route path="/finance" element={guarded('finance.view', <FinanceDashboardPage />)} />
        <Route path="/expenses" element={guarded('finance.view', <ExpensesPage />)} />
        <Route path="/sold-cars-finance" element={guarded('finance.view', <SoldCarsPage />)} />
        <Route path="/distributor-bonuses" element={guarded('finance.view', <KpiBonusesPage />)} />
        <Route path="/finance/settings" element={guarded('finance.manage', <FinanceSettingsPage />)} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/import" element={guarded('settings.manage', <ImportPage />)} />
        <Route path="/lead-forms" element={guarded('settings.manage', <LeadFormsPage />)} />
        <Route path="/users" element={guarded('users.manage', <UsersPage />)} />
        <Route path="/settings" element={guarded('settings.manage', <SettingsPage />)} />
        <Route path="/audit-log" element={guarded('settings.manage', <AuditLogPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
