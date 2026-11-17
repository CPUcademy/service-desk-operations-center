import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function PublicRoute() {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="page-loader"><span className="spinner" /></div>;
    }

    if (user) {
        return <Navigate to={user.isAdmin ? "/dashboard" : "/chat"} replace />;
    }

    return <Outlet />;
}