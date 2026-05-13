import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { getPermissions, logout, clearAuthState } from "../services/AuthService";
import { hasPermission } from "../utils/permissions";
import "./Sidebar.css";

export default function MenuDropdown() {
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const navigate = useNavigate();
    const role = sessionStorage.getItem("userRole");

    useEffect(() => {
        if (!open) return;

        function handleClickOutside(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }

        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    const handleLogout = async () => {
        try {
            await logout();
        } catch {
            clearAuthState();
        }

        navigate("/login");
        setOpen(false);
    };

    const getMenuSections = () => {
        const sections = [];
        const permissions = getPermissions();
        const isSupervisor = permissions.includes("admin") || permissions.includes("supervisor");
        const canManageClients = hasPermission("manage_clients");
        const canManageEmployees = hasPermission("manage_employees");
        const canManageAccounts = hasPermission("manage_accounts");
        const canManageLoans = hasPermission("manage_loans");
        const canManageCards = hasPermission("manage_cards");

        if (role === "client") {
            sections.push(
                { title: "Dashboard", items: [{ label: "Client Dashboard", path: "/dashboard" }] },
                { title: "Računi", items: [{ label: "Moji računi", path: "/accounts" }] },
                {
                    title: "Plaćanja",
                    items: [
                        { label: "Novo plaćanje", path: "/payment" },
                        { label: "Novi transfer", path: "/transfer" },
                        { label: "Pregled transakcija", path: "/payments" },
                        { label: "Primaoci", path: "/recipients" },
                    ],
                },
                { title: "Menjačnica", items: [{ label: "Kursna lista / konverzija", path: "/exchange" }] },
                {
                    title: "Kartice",
                    items: [
                        { label: "Moje kartice", path: "/cards" },
                        { label: "Zahtev za novu karticu", path: "/cards?tab=create" },
                    ],
                },
                {
                    title: "Krediti",
                    items: [
                        { label: "Moji krediti", path: "/loans" },
                        { label: "Zahtev za kredit", path: "/loan-request" },
                    ],
                },
                {
                    title: "Trgovanje",
                    items: [
                        { label: "Hartije od vrednosti", path: "/securities" },
                        { label: "Moj portfolio", path: "/portfolio" },
                        { label: "Moji nalozi", path: "/orders/my" },
                        { label: "OTC Trgovina", path: "/otc" },
                    ],
                }
            );
        }

        if (role === "employee") {
            const accountItems = [];
            if (canManageAccounts) {
                accountItems.push(
                    { label: "Svi računi", path: "/admin/accounts" },
                    { label: "Kreiraj račun", path: "/accounts/create" }
                );
            }
            if (accountItems.length) {
                sections.push({ title: "Računi", items: accountItems });
            }

            if (canManageCards) {
                sections.push({
                    title: "Kartice",
                    items: [{ label: "Upravljanje karticama", path: "/cards" }],
                });
            }

            if (canManageLoans) {
                sections.push({
                    title: "Krediti",
                    items: [
                        { label: "Zahtevi za kredit", path: "/employee-loans" },
                        { label: "Svi krediti", path: "/employee-loans-list" },
                    ],
                });
            }

            const tradingItems = [
                { label: "Hartije od vrednosti", path: "/securities" },
                { label: "Moj portfolio", path: "/portfolio" },
                { label: "Moji nalozi", path: "/orders/my" },
                { label: "OTC Trgovina", path: "/otc" },
            ];
            sections.push({
                title: "Trgovanje",
                items: tradingItems,
            });

            if (isSupervisor) {
                sections.push({
                    title: "Supervizor",
                    items: [
                        { label: "Pregled naloga", path: "/orders/review" },
                        { label: "Upravljanje aktuarima", path: "/actuary-management" },
                        { label: "Porez tracking", path: "/tax" },
                        { label: "Berze", path: "/berza" },
                    ],
                });
            }

            if (canManageEmployees) {
                sections.push({
                    title: "Zaposleni",
                    items: [
                        { label: "Lista zaposlenih", path: "/employees" },
                        { label: "Dodaj zaposlenog", path: "/employees/create" },
                    ],
                });
            }

            if (canManageClients) {
                sections.push({
                    title: "Klijenti",
                    items: [
                        { label: "Lista klijenata", path: "/clients" },
                        { label: "Kreiraj klijenta", path: "/clients/create" },
                    ],
                });
            }
        }

        return sections;
    };

    const menuSections = getMenuSections();

    return createPortal(
        <>
            <button
                className="menu-icon-btn"
                onClick={() => setOpen(true)}
                aria-label="Meni"
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>

            <div className={`sidepanel-overlay${open ? " open" : ""}`} onClick={() => setOpen(false)}>
                <nav
                    ref={panelRef}
                    className={`sidepanel${open ? " open" : ""}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button className="sidepanel-close" onClick={() => setOpen(false)} aria-label="Zatvori">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>

                    <div className="sidepanel-content">
                        {menuSections.map((section, i) => (
                            <div key={i}>
                                <h4 style={{ color: "#94a3b8", margin: "12px 0 6px 0" }}>{section.title}</h4>
                                {section.items.map((item, j) => (
                                    <button
                                        key={j}
                                        className="sidepanel-item"
                                        onClick={() => {
                                            navigate(item.path);
                                            setOpen(false);
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        ))}

                        <button className="sidepanel-item sidepanel-logout" onClick={handleLogout}>
                            Odjavi se
                        </button>
                    </div>
                </nav>
            </div>
        </>,
        document.body
    );
}