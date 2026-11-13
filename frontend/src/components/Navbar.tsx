import { NavLink } from "react-router";
import "./Navbar.css";
import { useEffect, useState } from "react";

function Navbar() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Tutaj sie wstawi pobieranie danych z API
    setFirstName("Aleksander");
    setLastName("Szostak");
    setIsAdmin(true);
  }, []);

  const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();

  return (
    <div>
      <aside className="navbar">
        <nav className="navbar-links">
          {isAdmin && (
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? "navbar-link active" : "navbar-link"}>
              Dashboard
            </NavLink>
          )}

          <NavLink to="/chat" className={({ isActive }) => isActive ? "navbar-link active" : "navbar-link"}>
            Chat
          </NavLink>

          <NavLink to="/tickets" className={({ isActive }) => isActive ? "navbar-link active" : "navbar-link"}>
            Tickets
          </NavLink>

          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? "navbar-link active" : "navbar-link"}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="navbar-profile">
          <NavLink to="/profile" className="profile-link">
            <div className="profile-avatar">{initials}</div>
            <div>
              <p>{firstName} {lastName}</p>
              <span>{isAdmin ? "ADMINISTRATOR" : "USER"}</span>
            </div>

          </NavLink>
        </div>
      </aside>
    </div>
  )
}

export default Navbar