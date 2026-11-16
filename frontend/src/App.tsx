import './App.css';
import AppRoutes from './AppRoutes';
import { AuthProvider } from './auth/AuthContext';
import { BrowserRouter } from 'react-router-dom';
function App() {

  return (
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
  )
}
export default App

