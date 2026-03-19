import { NavLink } from "react-router-dom";
import { useState } from "react";
import "./Navbar.css";

export default function Navbar() {
    const [openMenu, setOpenMenu] = useState(null);

    function toggleMenu(menuName) {
        setOpenMenu((prev) => (prev === menuName ? null : menuName));
    }

    function closeMenu() {
        setOpenMenu(null);
    }

    const navClass = ({ isActive }) =>
        isActive ? "nav-link active-link" : "nav-link";

    return (
        <header className="topbar">
            <div className="topbar-left">
                <img src="/bank-logo.png" alt="logo" className="topbar-logo" />
            </div>

            <nav className="topbar-nav">
                <NavLink to="/dashboard" className={navClass} onClick={closeMenu}>
                    Dashboard
                </NavLink>

                <NavLink to="/clients" className={navClass} onClick={closeMenu}>
                    Klijenti
                </NavLink>

                {/* ACCOUNTS */}
                <div className="nav-dropdown">
                    <button
                        className="nav-link dropdown-toggle"
                        onClick={() => toggleMenu("accounts")}
                        type="button"
                    >
                        <span>Računi</span>
                        <span className={`dropdown-arrow ${openMenu === "accounts" ? "open" : ""}`}>
                            ⌵
                        </span>
                    </button>

                    {openMenu === "accounts" && (
                        <div className="dropdown-menu">
                            <NavLink to="/accounts/personal" className="dropdown-item" onClick={closeMenu}>
                                Lični račun
                            </NavLink>
                            <NavLink to="/accounts/business" className="dropdown-item" onClick={closeMenu}>
                                Poslovni račun
                            </NavLink>
                            <NavLink to="/accounts/create" className="dropdown-item" onClick={closeMenu}>
                                Kreiranje računa
                            </NavLink>
                            <NavLink to="/accounts/business-flow" className="dropdown-item" onClick={closeMenu}>
                                Flow za poslovni račun
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* PAYMENTS */}
                <div className="nav-dropdown">
                    <button
                        className="nav-link dropdown-toggle"
                        onClick={() => toggleMenu("payments")}
                        type="button"
                    >
                        <span>Plaćanja</span>
                        <span className={`dropdown-arrow ${openMenu === "payments" ? "open" : ""}`}>
                            ⌵
                        </span>
                    </button>

                    {openMenu === "payments" && (
                        <div className="dropdown-menu">
                            <NavLink to="/payments/new" className="dropdown-item" onClick={closeMenu}>
                                Novo plaćanje
                            </NavLink>
                            <NavLink to="/payments/overview" className="dropdown-item" onClick={closeMenu}>
                                Primaoci i pregled
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* CARDS */}
                <div className="nav-dropdown">
                    <button
                        className="nav-link dropdown-toggle"
                        onClick={() => toggleMenu("cards")}
                        type="button"
                    >
                        <span>Kartice</span>
                        <span className={`dropdown-arrow ${openMenu === "cards" ? "open" : ""}`}>
                            ⌵
                        </span>
                    </button>

                    {openMenu === "cards" && (
                        <div className="dropdown-menu">
                            <NavLink to="/cards/create" className="dropdown-item" onClick={closeMenu}>
                                Kreiranje kartice
                            </NavLink>
                            <NavLink to="/cards" className="dropdown-item" onClick={closeMenu}>
                                Lista i blokiranje
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* LOANS */}
                <div className="nav-dropdown">
                    <button
                        className="nav-link dropdown-toggle"
                        onClick={() => toggleMenu("loans")}
                        type="button"
                    >
                        <span>Krediti</span>
                        <span className={`dropdown-arrow ${openMenu === "loans" ? "open" : ""}`}>
                            ⌵
                        </span>
                    </button>

                    {openMenu === "loans" && (
                        <div className="dropdown-menu">
                            <NavLink to="/loans/apply" className="dropdown-item" onClick={closeMenu}>
                                Podnošenje zahteva
                            </NavLink>
                            <NavLink to="/loans/client-view" className="dropdown-item" onClick={closeMenu}>
                                Klijentski prikaz
                            </NavLink>
                            <NavLink to="/loans/manage" className="dropdown-item" onClick={closeMenu}>
                                Upravljanje kreditima
                            </NavLink>
                        </div>
                    )}
                </div>

                <NavLink to="/exchange" className={navClass} onClick={closeMenu}>
                    Menjačnica
                </NavLink>

                {/* ADMIN */}
                <div className="nav-dropdown">
                    <button
                        className="nav-link dropdown-toggle"
                        onClick={() => toggleMenu("admin")}
                        type="button"
                    >
                        <span>Administracija / HR</span>
                        <span className={`dropdown-arrow ${openMenu === "admin" ? "open" : ""}`}>
                            ⌵
                        </span>
                    </button>

                    {openMenu === "admin" && (
                        <div className="dropdown-menu">
                            <NavLink to="/login" className="dropdown-item" onClick={closeMenu}>
                                Login
                            </NavLink>
                            <NavLink to="/employees" className="dropdown-item" onClick={closeMenu}>
                                Employee list
                            </NavLink>
                            <NavLink to="/employees/1" className="dropdown-item" onClick={closeMenu}>
                                Employee details
                            </NavLink>
                        </div>
                    )}
                </div>
            </nav>
        </header>
    );
}