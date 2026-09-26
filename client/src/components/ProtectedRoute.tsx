import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  // Optional capability required to view this route. Users without it are
  // redirected to their home. The backend still enforces this — this is UX only.
  capability?: string;
  // Optional set of capabilities, ANY of which grants access (e.g. reports).
  anyCapability?: string[];
}

export function ProtectedRoute({ children, capability, anyCapability }: ProtectedRouteProps) {
  const { user, loading, can } = useAuth();
  if (loading) return <div className="loading">…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (capability && !can(capability)) return <Navigate to="/" replace />;
  if (anyCapability && anyCapability.length > 0 && !anyCapability.some((c) => can(c))) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
