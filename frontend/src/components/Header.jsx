import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

const shortAddr = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");

export default function Header() {
  const { account, connectWallet } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "light"
  );

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  const navLinks = [
    { to: "/",            label: "Ana Sayfa",       end: true },
    { to: "/marketplace", label: "Pazar Yeri" },
    { to: "/upload",      label: "Kayıt Ekle" },
    ...(account ? [
      { to: "/my-data",   label: "Kayıtlarım" },
      { to: "/purchases", label: "Satın Aldıklarım" },
    ] : []),
  ];

  return (
    <header className="header">
      <div className="header-inner">
        <NavLink to="/" className="logo">
          <div className="logo-mark">M</div>
          <div>
            <span className="logo-name">Medi<span className="logo-dot">Chain</span></span>
            <span className="logo-sub">Blockchain · IPFS</span>
          </div>
        </NavLink>

        <nav className="nav desktop-nav">
          {navLinks.map((l) => (
            <NavLink
              key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-right">
          <span className="badge-network">Sepolia</span>
          <button className="theme-btn" onClick={toggleTheme} aria-label="Tema değiştir" title={theme === "dark" ? "Aydınlık mod" : "Karanlık mod"}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          {account ? (
            <button className="wallet-btn connected">
              <div className="wallet-dot" />
              {shortAddr(account)}
            </button>
          ) : (
            <button className="wallet-btn" onClick={connectWallet}>
              <div className="wallet-dot" />
              Cüzdan Bağla
            </button>
          )}
          <button className="hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menü">
            <span /><span /><span />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="mobile-nav" onClick={() => setMenuOpen(false)}>
          {navLinks.map((l) => (
            <NavLink
              key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
