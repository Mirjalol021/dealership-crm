import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

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
        <Route path="/today" element={<PlaceholderPage labelKey="today" />} />
        <Route path="/leads" element={<PlaceholderPage labelKey="leads" />} />
        <Route path="/lead-pool" element={<PlaceholderPage labelKey="leadPool" />} />
        <Route path="/my-leads" element={<PlaceholderPage labelKey="myLeads" />} />
        <Route path="/new-leads" element={<PlaceholderPage labelKey="newLeads" />} />
        <Route path="/follow-ups" element={<PlaceholderPage labelKey="followUps" />} />
        <Route path="/qualified" element={<PlaceholderPage labelKey="qualified" />} />
        <Route path="/appointments" element={<PlaceholderPage labelKey="appointments" />} />
        <Route path="/inventory" element={<PlaceholderPage labelKey="inventory" />} />
        <Route path="/sales" element={<PlaceholderPage labelKey="sales" />} />
        <Route path="/sold-cars" element={<PlaceholderPage labelKey="soldCars" />} />
        <Route path="/aftersales" element={<PlaceholderPage labelKey="aftersales" />} />
        <Route path="/aftersales/inventory" element={<PlaceholderPage labelKey="aftersalesInventory" />} />
        <Route path="/customers-to-call" element={<PlaceholderPage labelKey="customersToCall" />} />
        <Route path="/service-visits" element={<PlaceholderPage labelKey="serviceVisits" />} />
        <Route path="/finance" element={<PlaceholderPage labelKey="finance" />} />
        <Route path="/expenses" element={<PlaceholderPage labelKey="expenses" />} />
        <Route path="/sold-cars-finance" element={<PlaceholderPage labelKey="soldCarsFinance" />} />
        <Route path="/distributor-bonuses" element={<PlaceholderPage labelKey="distributorBonuses" />} />
        <Route path="/reports" element={<PlaceholderPage labelKey="reports" />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
