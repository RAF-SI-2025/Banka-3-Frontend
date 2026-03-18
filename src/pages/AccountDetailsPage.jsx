import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAccountById, getAccountTransactions } from "../services/AccountService";
import "./AccountDetailsPage.css";

function fmt(amount, currency = "RSD") {
    if (amount == null) return "—";
    return (
        new Intl.NumberFormat("sr-RS", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount) +
        " " +
        currency
    );
}

export default function AccountDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [account, setAccount] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;
        let cancelled = false;

        const load = async () => {
            try {
                const [acc, txs] = await Promise.all([
                    getAccountById(Number(id)),
                    getAccountTransactions(Number(id)),
                ]);
                if (!cancelled) {
                    setAccount(acc);
                    setTransactions(txs);
                }
            } catch {
                if (!cancelled) setError("Greška pri učitavanju podataka o računu.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [id]);

    if (loading) {
        return (
            <div className="ad-page">
                <p className="ad-state-msg">Učitavanje...</p>
            </div>
        );
    }

    if (error || !account) {
        return (
            <div className="ad-page">
                <p className="ad-state-msg ad-state-msg--error">{error || "Račun nije pronađen."}</p>
            </div>
        );
    }

    const reserved = account.balance - account.available;

    return (
        <div className="ad-page">
            <div className="ad-content">

                {/* ── HEADER ── */}
                <div className="ad-header">
                    <button className="ad-back-btn" onClick={() => navigate("/accounts")}>
                        <ChevronLeftIcon />
                    </button>
                    <h1 className="ad-title">{account.name}</h1>
                </div>

                {/* ── BALANCE CARD ── */}
                <div className="ad-balance-card">
                    <p className="ad-account-number">{account.number}</p>
                    <p className="ad-balance-main">{fmt(account.balance, account.currency)}</p>
                    <div className="ad-balance-row">
                        <div>
                            <p className="ad-balance-label">Raspoloživo</p>
                            <p className="ad-balance-available">{fmt(account.available, account.currency)}</p>
                        </div>
                        <div>
                            <p className="ad-balance-label">Rezervisano</p>
                            <p className="ad-balance-reserved">{fmt(reserved, account.currency)}</p>
                        </div>
                    </div>
                </div>

                {/* ── TRANSACTIONS ── */}
                <h2 className="ad-section-title">Transakcije</h2>

                {transactions.length === 0 ? (
                    <p className="ad-empty">Nema transakcija</p>
                ) : (
                    <div className="ad-txn-list">
                        {transactions.map((tx) => (
                            <div key={tx.id} className="ad-txn-row">
                                <div className={`ad-txn-icon ${tx.amount > 0 ? "ad-txn-icon--credit" : "ad-txn-icon--debit"}`}>
                                    {tx.amount > 0 ? <ArrowDownIcon /> : <ArrowUpIcon />}
                                </div>
                                <div className="ad-txn-info">
                                    <p className="ad-txn-desc">{tx.desc}</p>
                                    <p className="ad-txn-date">{new Date(tx.date).toLocaleDateString("sr-RS")}</p>
                                </div>
                                <p className={`ad-txn-amount ${tx.amount > 0 ? "ad-txn-amount--credit" : ""}`}>
                                    {tx.amount > 0 ? "+" : ""}{fmt(tx.amount, account.currency)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}

function ChevronLeftIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
        </svg>
    );
}

function ArrowDownIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
    );
}

function ArrowUpIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
    );
}