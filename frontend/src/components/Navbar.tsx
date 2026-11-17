
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import "./Navbar.css";

function Navbar() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const fullName = user?.fullName ?? "";
  const isAdmin = user?.isAdmin ?? false;

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join("")
    .toUpperCase();

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Przycisk otwierania menu */}
      <button
        className="navbar-toggle"
        onClick={() => setIsOpen(true)}
        aria-label="Otwórz menu"
        aria-expanded={isOpen}
      >
        ☰
      </button>

      {/* Przyciemnione tło */}
      {isOpen && (
        <div
          className="navbar-overlay"
          onClick={closeMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`navbar ${isOpen ? "open" : ""}`}>

        {/* Górny pasek menu */}
        <div className="navbar-header">
          <button
            className="navbar-close"
            onClick={closeMenu}
            aria-label="Zamknij menu"
          >
            ✕
          </button>
        </div>

        {/* Linki */}
        <nav className="navbar-links">

          {isAdmin && (
            <NavLink
              to="/dashboard"
              onClick={closeMenu}
              className={({ isActive }) =>
                isActive
                  ? "navbar-link active"
                  : "navbar-link"
              }
            >
              Dashboard
            </NavLink>
          )}

          <NavLink
            to="/chat"
            onClick={closeMenu}
            className={({ isActive }) =>
              isActive
                ? "navbar-link active"
                : "navbar-link"
            }
          >
            Chat
          </NavLink>

          <NavLink
            to="/tickets"
            onClick={closeMenu}
            className={({ isActive }) =>
              isActive
                ? "navbar-link active"
                : "navbar-link"
            }
          >
            Tickets
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/admin"
              onClick={closeMenu}
              className={({ isActive }) =>
                isActive
                  ? "navbar-link active"
                  : "navbar-link"
              }
            >
              Admin
            </NavLink>
          )}

        </nav>

        {/* Profil użytkownika */}
        <div className="navbar-profile">
          <NavLink
            to="/profile"
            onClick={closeMenu}
            className="profile-link"
          >
            <div className="profile-avatar">
              {initials}
            </div>

            <div className="profile-info">
              <p>
                {fullName}
              </p>

              <span>
                {isAdmin ? "ADMINISTRATOR" : "USER"}
              </span>
            </div>
          </NavLink>
        </div>

      </aside>
    </>
  );
}

export default Navbar;
