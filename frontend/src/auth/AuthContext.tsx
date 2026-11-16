import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode
} from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    loading: boolean;
    checkAuth: () => Promise<boolean>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    async function checkAuth(): Promise<boolean> {
        try {
            // Use an existing protected endpoint
            const response = await fetch(
                'http://localhost:8002/api/v1/machines',
                {
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                setIsAuthenticated(false);
                return false;
            }

            setIsAuthenticated(true);
            return true;

        } catch {
            setIsAuthenticated(false);
            return false;
        } finally {
            setLoading(false);
        }
    }

    function logout() {
        setIsAuthenticated(false);
    }

    useEffect(() => {
        checkAuth();
    }, []);

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
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