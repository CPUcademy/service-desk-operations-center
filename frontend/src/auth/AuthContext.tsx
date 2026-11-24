import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode
} from 'react';
import { apiFetch, setSessionExpiredHandler } from '../api';

export interface User {
    id: number;
    fullName: string;
    email: string;
    isAdmin: boolean;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    checkAuth: () => Promise<boolean>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    async function checkAuth(): Promise<boolean> {
        try {
            const response = await apiFetch('/api/v1/users/me');

            if (!response.ok) {
                setUser(null);
                return false;
            }

            setUser(await response.json());
            return true;

        } catch {
            setUser(null);
            return false;
        } finally {
            setLoading(false);
        }
    }

    async function logout() {
        try {
            await apiFetch('/api/v1/auth/logout', { method: 'POST' });
        } catch {
        }
        setUser(null);
    }

    useEffect(() => {
        setSessionExpiredHandler(() => setUser(null));
        checkAuth();
        return () => setSessionExpiredHandler(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: user !== null,
                loading,
                checkAuth,
                logout
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider');
    }

    return context;
}