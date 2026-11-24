import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import Login from "./components/Login";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import Chat from "./components/Chat";
import Tickets from "./components/Tickets";
import Machines from "./components/Machines";
import Users from "./components/Users";
import Profile from "./components/Profile";
import RemoteSession from "./components/RemoteSession";
import Diagnostics from "./components/Diagnostics";

import ProtectedRoute from "./auth/ProtectedRoute";
import PublicRoute from "./auth/PublicRoute";
import { ChatProvider } from "./chat/ChatContext";
import { useAuth } from "./auth/AuthContext";

import "./App.css";

function AppLayout() {
  const { user } = useAuth();
  return (
    <ChatProvider userId={user?.id ?? 0}>
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
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>

          <Route path="/chat" element={<Chat />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/profile" element={<Profile />} />

          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<Machines />} />
            <Route path="/users" element={<Users />} />
            <Route path="/session/:id" element={<RemoteSession />} />
            <Route path="/diagnostics" element={<Diagnostics />} />
          </Route>

        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
          