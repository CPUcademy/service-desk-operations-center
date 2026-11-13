import { useState } from 'react'
import { BrowserRouter, Routes, Route } from "react-router";
import './App.css'
import Login from './components/Login'
import Navbar from './components/Navbar'
import Dashboard from './components/Dashboard'
import Chat from './components/Chat'
import Tickets from './components/Tickets'
import Admin from './components/Admin'
import Profile from './components/Profile'


function App() {
  const [count, setCount] = useState(0)

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Navbar />
        <main className="main-content">
          <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
export default App

