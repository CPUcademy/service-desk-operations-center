
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import Login from "./components/Login";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import Chat from "./components/Chat";
import Tickets from "./components/Tickets";
import Machines from "./components/Machines";
import Profile from "./components/Profile";
import RemoteSession from "./components/RemoteSession";
import Diagnostics from "./components/Diagnostics";

import ProtectedRoute from "./auth/ProtectedRoute";
import PublicRoute from "./auth/PublicRoute";
import { ChatProvider } from "./chat/ChatContext";

import "./App.css";

function AppLayout() {
  return (
    <ChatProvider>
      <div className="app-layout">
        <Navbar />

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </ChatProvider>
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

          <Route path="/chat" element={<Chat />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/profile" element={<Profile />} />

          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<Machines />} />
            <Route path="/session/:id" element={<RemoteSession />} />
            <Route path="/diagnostics" element={<Diagnostics />} />
          </Route>

        </Route>
      </Route>

      {/* Unknown pages */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
          