import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  // Optional capability required to view this route. Users without it are
  // redirected to their home. The backend still enforces this — this is UX only.
  capability?: string;
}

export function ProtectedRoute({ children, capability }: ProtectedRouteProps) {
  const { user, loading, can } = useAuth();
  if (loading) return <div className="loading">…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (capability && !can(capability)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
