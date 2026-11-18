
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { LayoutGrid, Menu, MessageSquare, ShieldCheck, Ticket, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import "./Navbar.css";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, admin: true },
  { to: "/tickets", label: "Tickets", icon: Ticket, admin: false },
  { to: "/chat", label: "Chat", icon: MessageSquare, admin: false },
  { to: "/admin", label: "Admin", icon: ShieldCheck, admin: true },
];

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
        <Menu size={18} />
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
            <X size={16} />
          </button>
        </div>

        <div className="navbar-brand">
          <strong>SDOC</strong>
          <span>Service desk operations</span>
        </div>

        <nav className="navbar-links">
          {links.filter(link => isAdmin || !link.admin).map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={closeMenu}
              className={({ isActive }) => isActive ? "navbar-link active" : "navbar-link"}
            >
              <link.icon size={16} strokeWidth={1.75} />
              {link.label}
            </NavLink>
          ))}
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
                {isAdmin ? "Administrator" : "User"}
              </span>
            </div>
          </NavLink>
        </div>

      </aside>
    </>
  );
}

export default Navbar;
