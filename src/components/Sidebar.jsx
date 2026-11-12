
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { apiFetch, getUser, isAdmin, logout, API_URL } from "../api";


const iconProps = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

function NavIcon({ path }) {
  switch (path) {
    case "/":
      return (
        <svg {...iconProps}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "/fruits":
      return (
        <svg {...iconProps}>
          <path d="M12 7c-2.5-2.5-6.5-1-6.5 3 0 3.5 2.7 7 4.5 7 .8 0 1.2-.5 2-.5s1.2.5 2 .5c1.8 0 4.5-3.5 4.5-7 0-4-4-5.5-6.5-3Z" />
          <path d="M12 7c0-2 1-3.2 3-3.2" />
        </svg>
      );
    case "/suppliers":
      return (
        <svg {...iconProps}>
          <path d="M3 7h11v10H3z" />
          <path d="M14 10h4l3 3v4h-7z" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="18" cy="18" r="1.6" />
        </svg>
      );
    case "/vendors":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 20c.6-3.4 3.4-5.4 7-5.4s6.4 2 7 5.4" />
        </svg>
      );
    case "/stock":
      return (
        <svg {...iconProps}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" />
          <path d="m4 7.5 8 4.5 8-4.5" />
          <path d="M12 12v9" />
        </svg>
      );
    case "/orders":
      return (
        <svg {...iconProps}>
          <path d="M7 4h10v17H7z" />
          <path d="M9 3h6v3H9z" />
          <path d="M9 10h6" />
          <path d="M9 14h6" />
          <path d="M9 18h4" />
        </svg>
      );
    case "/reports":
      return (
        <svg {...iconProps}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20H2" />
        </svg>
      );
    case "/users":
      return (
        <svg {...iconProps}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c.5-3 2.8-4.6 6-4.6s5.5 1.6 6 4.6" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8" />
          <path d="M18 16.5c1.6.7 2.7 1.9 3 3.5" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function Sidebar() {
  const [menuItems, setMenuItems] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const user = getUser();

  const initials = (user?.full_name || "User")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    async function loadMenu() {
      try {
        const response = await apiFetch(`${API_URL}/menu-items`);
        if (!response.ok) throw new Error("Could not load menu.");

        const data = await response.json();
        setMenuItems(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Could not load navigation menu:", error);
        setMenuItems([]);
      }
    }

    loadMenu();
  }, []);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 980) setMenuOpen(false);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <>
      {menuOpen && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <header className="top-navigation">
        <div className="top-navigation-brand">
          <div className="brand-icon">BF</div>
          <div>
            <h2>Batloung</h2>
            <p>FRUITS DISTRIBUTION</p>
          </div>
        </div>

        <button
          type="button"
          className={`mobile-menu-toggle${menuOpen ? " open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="primary-navigation"
          className={`top-navigation-links${menuOpen ? " is-open" : ""}`}
        >
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              isActive
                ? "top-navigation-link active"
                : "top-navigation-link"
            }
          >
            <span className="nav-icon">
              <NavIcon path={item.path} />
            </span>
            {item.name}
          </NavLink>
        ))}

        {isAdmin() && (
          <NavLink
            to="/users"
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              isActive
                ? "top-navigation-link active"
                : "top-navigation-link"
            }
          >
            <span className="nav-icon">
              <NavIcon path="/users" />
            </span>
            Users
          </NavLink>
        )}
      </nav>

        <div className="top-navigation-user">
          <ThemeToggle />

          <div className="top-navigation-avatar" aria-hidden="true">
            {initials}
          </div>

          <div className="top-navigation-user-info">
            <span className="top-navigation-user-name">
              {user?.full_name || "User"}
            </span>
            <span className="top-navigation-user-role">
              {user?.role || ""}
            </span>
          </div>

          <button type="button" className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
    </>
  );
}

export default Sidebar;
