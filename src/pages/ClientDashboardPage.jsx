import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAccounts, getAccountTransactions } from "../services/AccountService";
import "./ClientDashboardPage.css";

function fmt(amount, currency = "RSD") {
    return (
        new Intl.NumberFormat("sr-RS", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Math.abs(amount)) +
        " " +
        currency
    );
}

export default function ClientDashboardPage() {
    const navigate = useNavigate();

    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const accountsData = await getAccounts();
                if (cancelled) return;
                setAccounts(accountsData);

                if (accountsData.length > 0) {
                    const txData = await getAccountTransactions(accountsData[0].id);
                    if (!cancelled) setTransactions(txData);
                }
            } catch (err) {
                if (!cancelled) setError("Greška pri učitavanju podataka.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <div className="dash-shell">
                <p className="dash-state-msg">Učitavanje...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dash-shell">
                <p className="dash-state-msg dash-state-msg--error">{error}</p>
            </div>
        );
    }

    const mainAccount = accounts[0];

    const quickActions = [
        {
            label: "Uplata",
            target: "/deposit",
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
            ),
        },
        {
            label: "Plaćanje",
            target: "/payment",
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
            ),
        },
        {
            label: "Prenos",
            target: "/transfer",
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
            ),
        },
    ];

    const quickMenu = [
        {
            label: "Kartice", target: "/cards",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
        },
        {
            label: "Menjačnica", target: "/exchange",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>,
        },
        {
            label: "Krediti", target: "/loans",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
        },
        {
            label: "Plaćanja", target: "/payment-history",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
        },
        {
            label: "Primaoci", target: "/recipients",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
        },
        {
            label: "Verifikacija", target: "/verify",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
        },
    ];

    return (
        <div className="dash-shell">

            {/* ── Scrollable content ── */}
            <div className="dash-content">

                {/* Header */}
                <div className="dash-header">
                    <div>
                        <p className="dash-greeting">Dobro došli</p>
                        <p className="dash-name">Marko Petrović</p>
                    </div>
                    <button className="dash-bell" aria-label="Obaveštenja">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                    </button>

                </div>

                {/* Balance card */}
                {mainAccount && (
                    <div className="dash-balance-card">
                        <div className="dash-bc-circle1"/>
                        <div className="dash-bc-circle2"/>
                        <p className="dash-bc-label">Ukupno stanje</p>
                        <p className="dash-bc-amount">{fmt(mainAccount.balance, mainAccount.currency)}</p>
                        <p className="dash-bc-avail">Raspoloživo: {fmt(mainAccount.available, mainAccount.currency)}</p>
                        <div className="dash-quick-row">
                            {quickActions.map(({label, icon, target}) => (
                                <button key={label} className="dash-quick-btn" onClick={() => navigate(target)}>
                                    {icon}
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Accounts */}
                <div className="dash-section-row">
                    <p className="dash-section-title">Moji računi</p>
                    <button className="dash-section-link" onClick={() => navigate("/accounts")}>Prikaži sve</button>
                </div>
                <div className="dash-accounts-scroll">
                    {accounts.map((acc) => (
                        <button key={acc.id} className="dash-account-pill"
                                onClick={() => navigate(`/accounts/${acc.id}`)}>
                            <p className="dash-pill-name">{acc.name}</p>
                            <p className="dash-pill-number">{acc.number}</p>
                            <p className="dash-pill-bal">{fmt(acc.balance, acc.currency)}</p>
                        </button>
                    ))}
                </div>

                {/* Quick menu */}
                <div className="dash-section-row">
                    <p className="dash-section-title">Brzi pristup</p>
                </div>
                <div className="dash-menu-grid">
                    {quickMenu.map(({label, icon, target}) => (
                        <button key={label} className="dash-menu-item" onClick={() => navigate(target)}>
                            <div className="dash-menu-icon">{icon}</div>
                            <span className="dash-menu-label">{label}</span>
                        </button>
                    ))}
                </div>

                {/* Transactions */}
                <div className="dash-section-row" style={{marginTop: 24}}>
                    <p className="dash-section-title">Poslednje transakcije</p>
                </div>
                <div className="dash-tx-list">
                    {transactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="dash-tx-row">
                            <div className={`dash-tx-icon ${tx.amount > 0 ? "dash-tx-icon--in" : "dash-tx-icon--out"}`}>
                                {tx.amount > 0 ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"/>
                                        <polyline points="19 12 12 19 5 12"/>
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="19" x2="12" y2="5"/>
                                        <polyline points="5 12 12 5 19 12"/>
                                    </svg>
                                )}
                            </div>
                            <div className="dash-tx-info">
                                <p className="dash-tx-desc">{tx.desc}</p>
                                <p className="dash-tx-date">{new Date(tx.date).toLocaleDateString("sr-RS")}</p>
                            </div>
                            <p className={`dash-tx-amt ${tx.amount > 0 ? "dash-tx-amt--in" : ""}`}>
                                {tx.amount > 0 ? "+" : ""}{fmt(tx.amount, "RSD")}
                            </p>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}