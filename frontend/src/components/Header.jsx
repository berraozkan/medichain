import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

const shortAddr = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");

export default function Header() {
  const { account, connectWallet } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);

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
