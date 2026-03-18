import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAccount } from "../services/AccountService";
import "./CreateAccountPage.css";

const ACCOUNT_TYPES = [
    {
        value: "CURRENT",
        label: "Tekući račun",
        desc: "Račun za svakodnevne transakcije u dinarima",
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
        ),
    },
    {
        value: "FOREIGN",
        label: "Devizni račun",
        desc: "Račun za transakcije u stranoj valuti",
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
        ),
    },
];

const FOREIGN_CURRENCIES = [
    { value: "EUR", label: "Euro", flag: "🇪🇺" },
    { value: "USD", label: "Američki dolar", flag: "🇺🇸" },
    { value: "CHF", label: "Švajcarski franak", flag: "🇨🇭" },
    { value: "GBP", label: "Britanska funta", flag: "🇬🇧" },
    { value: "JPY", label: "Japanski jen", flag: "🇯🇵" },
    { value: "CAD", label: "Kanadski dolar", flag: "🇨🇦" },
    { value: "AUD", label: "Australijski dolar", flag: "🇦🇺" },
];

function validate(type, currency) {
    const errors = {};
    if (!type) errors.type = "Izaberite tip računa.";
    if (type === "FOREIGN" && !currency) errors.currency = "Izaberite valutu.";
    return errors;
}

export default function CreateAccountPage() {
    const navigate = useNavigate();

    const [accountType, setAccountType] = useState("");
    const [currency, setCurrency] = useState("");
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    function handleTypeSelect(value) {
        setAccountType(value);
        setCurrency(value === "CURRENT" ? "RSD" : "");
        setErrors((prev) => ({ ...prev, type: "" }));
    }

    function handleCurrencySelect(value) {
        setCurrency(value);
        setErrors((prev) => ({ ...prev, currency: "" }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitError("");

        const errs = validate(accountType, currency);
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        try {
            setSubmitting(true);
            await createAccount({ type: accountType, currency });
            navigate("/dashboard");
        } catch (err) {
            setSubmitError(err.message || "Greška pri kreiranju računa.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="ca-shell">
            <div className="ca-content">

                <div className="ca-header">
                    <button className="ca-back-btn" onClick={() => navigate("/dashboard")}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                    <div>
                        <p className="ca-subtitle">Novi račun</p>
                        <h1 className="ca-title">Otvaranje računa</h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>

                    <div className="ca-section">
                        <p className="ca-section-label">Tip računa</p>
                        <div className="ca-type-grid">
                            {ACCOUNT_TYPES.map(({ value, label, desc, icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={`ca-type-card ${accountType === value ? "ca-type-card--selected" : ""}`}
                                    onClick={() => handleTypeSelect(value)}
                                >
                                    <div className="ca-type-icon">{icon}</div>
                                    <p className="ca-type-label">{label}</p>
                                    <p className="ca-type-desc">{desc}</p>
                                    {accountType === value && (
                                        <div className="ca-type-check">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        {errors.type && <p className="ca-error">{errors.type}</p>}
                    </div>

                    {accountType === "CURRENT" && (
                        <div className="ca-section">
                            <p className="ca-section-label">Valuta</p>
                            <div className="ca-currency-locked">
                                <span>🇷🇸</span>
                                <span>RSD — Srpski dinar</span>
                                <span className="ca-currency-locked-badge">Fiksno</span>
                            </div>
                        </div>
                    )}

                    {accountType === "FOREIGN" && (
                        <div className="ca-section">
                            <p className="ca-section-label">Valuta</p>
                            <div className="ca-currency-grid">
                                {FOREIGN_CURRENCIES.map(({ value, label, flag }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`ca-currency-btn ${currency === value ? "ca-currency-btn--selected" : ""}`}
                                        onClick={() => handleCurrencySelect(value)}
                                    >
                                        <span className="ca-currency-flag">{flag}</span>
                                        <span className="ca-currency-code">{value}</span>
                                        <span className="ca-currency-name">{label}</span>
                                    </button>
                                ))}
                            </div>
                            {errors.currency && <p className="ca-error">{errors.currency}</p>}
                        </div>
                    )}

                    {accountType && currency && (
                        <div className="ca-summary">
                            <p className="ca-summary-label">Pregled</p>
                            <div className="ca-summary-row">
                                <span>Tip računa</span>
                                <span>{ACCOUNT_TYPES.find(t => t.value === accountType)?.label}</span>
                            </div>
                            <div className="ca-summary-row">
                                <span>Valuta</span>
                                <span>{currency}</span>
                            </div>
                        </div>
                    )}

                    {submitError && <p className="ca-error ca-error--submit">{submitError}</p>}


                    <div className="ca-actions">
                        <button type="button" className="ca-btn-back" onClick={() => navigate("/dashboard")}>
                            Otkaži
                        </button>
                        <button type="submit" className="ca-btn-submit" disabled={submitting}>
                            {submitting ? "Kreiranje..." : "Otvori račun"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}