import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
    const { user, isAuthenticated, loading } = useAuth();

    if (loading) {
        return <div className="page-loader"><span className="spinner" /></div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && !user?.isAdmin) {
        return <Navigate to="/chat" replace />;
    }

    return <Outlet />;
}