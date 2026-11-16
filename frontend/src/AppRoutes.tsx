
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import Login from "./components/Login";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import Chat from "./components/Chat";
import Tickets from "./components/Tickets";
import Admin from "./components/Admin";
import Profile from "./components/Profile";

import ProtectedRoute from "./auth/ProtectedRoute";
import PublicRoute from "./auth/PublicRoute";

import "./App.css";

function AppLayout() {
  return (
    <div className="app-layout">
      <Navbar />

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public pages */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Private pages */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile" element={<Profile />} />

        </Route>
      </Route>

      {/* Unknown pages */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
          