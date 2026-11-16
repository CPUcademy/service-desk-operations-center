
import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import "./Navbar.css";

function Navbar() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Tutaj się wstawi pobieranie danych z API
    setFirstName("Aleksander");
    setLastName("Szostak");
    setIsAdmin(true);
  }, []);

  const initials = (
    firstName.charAt(0) + lastName.charAt(0)
  ).toUpperCase();

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
                {firstName} {lastName}
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
