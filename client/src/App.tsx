import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
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
import { ImportPage } from './pages/ImportPage';
import { LeadFormsPage } from './pages/LeadFormsPage';

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
        <Route path="/today" element={<TodayPage />} />
        <Route path="/leads" element={<KanbanPage />} />
        <Route path="/kanban" element={<KanbanPage />} />
        <Route path="/lead-pool" element={<LeadPoolPage />} />
        <Route path="/my-leads" element={<MyLeadsPage />} />
        <Route path="/new-leads" element={<MyLeadsPage />} />
        <Route path="/follow-ups" element={<MyLeadsPage />} />
        <Route path="/qualified" element={<LeadPoolPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/management" element={<ManagementPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/sales" element={<PlaceholderPage labelKey="sales" />} />
        <Route path="/sold-cars" element={<SoldCarsPage />} />
        <Route path="/aftersales" element={<AfterSalesSoldCarsPage />} />
        <Route path="/aftersales/inventory" element={<AfterSalesInventoryPage />} />
        <Route path="/aftersales/stock-movements" element={<StockMovementsPage />} />
        <Route path="/customers-to-call" element={<CustomersToCallPage />} />
        <Route path="/service-visits" element={<ServiceVisitsPage />} />
        <Route path="/finance" element={<FinanceDashboardPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/sold-cars-finance" element={<PlaceholderPage labelKey="soldCarsFinance" />} />
        <Route path="/distributor-bonuses" element={<KpiBonusesPage />} />
        <Route path="/finance/settings" element={<FinanceSettingsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/lead-forms" element={<LeadFormsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
