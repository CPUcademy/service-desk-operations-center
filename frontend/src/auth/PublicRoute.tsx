import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function PublicRoute() {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <div>Checking authentication...</div>;
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}