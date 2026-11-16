import './App.css';

import Login from './components/Login';
import Dashboard from './components/Dashboard';

import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import PublicRoute from './auth/PublicRoute';

import {
    BrowserRouter,
    Routes,
    Route
} from 'react-router-dom';
function App() {

  return (
     <AuthProvider>
            <BrowserRouter>
                <Routes>

                    {/* Public pages */}
                    <Route element={<PublicRoute />}>
                        <Route path="/login" element={<Login />} />
                    </Route>

                    {/* Private pages */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                    </Route>

                </Routes>
            </BrowserRouter>
        </AuthProvider>
  )
}
export default App

