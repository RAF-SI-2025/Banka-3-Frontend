import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAccount } from "../services/AccountService";
import "./CreateAccountPage.css";

const ACCOUNT_TYPES = [
    {
        value: "TEKUCI",
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
        value: "DEVIZNI",
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

const OWNER_TYPES = [
    {
        value: "PERSONAL",
        label: "Fizičko lice",
        desc: "Račun otvoren na vaše ime",
        icon: (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        ),
    },
    {
        value: "BUSINESS",
        label: "Pravno lice",
        desc: "Račun otvoren na ime kompanije",
        icon: (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="10" y1="14" x2="14" y2="14" />
            </svg>
        ),
    },
];

const EMPTY_COMPANY = {
    name: "",
    pib: "",
    registration_number: "",
    activity_code: "",
    address: "",
};

const PERSONAL_SUBTYPES = [
    { value: "standardni", label: "Standardni" },
    { value: "stedni", label: "Štedni" },
    { value: "penzionerski", label: "Penzionerski" },
    { value: "studentski", label: "Studentski" },
    { value: "za_nezaposlene", label: "Za nezaposlene" },
    { value: "za_mlade", label: "Za mlade" },
];

function validate(type, currency, ownerType, subtype) {
    const errors = {};

    if (!type) errors.type = "Izaberite tip računa.";
    if (type === "DEVIZNI" && !currency) errors.currency = "Izaberite valutu.";
    if (!ownerType) errors.ownerType = "Izaberite tip vlasnika.";
    if (ownerType === "PERSONAL" && !subtype) errors.subtype = "Izaberite podtip računa.";

    return errors;
}

export default function CreateAccountPage() {
    const navigate = useNavigate();

    const [accountType, setAccountType] = useState("");
    const [currency, setCurrency] = useState("");
    const [ownerType, setOwnerType] = useState("");
    const [subtype, setSubtype] = useState("");
    const [company, setCompany] = useState(EMPTY_COMPANY);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [dailyLimit, setDailyLimit] = useState("");
    const [monthlyLimit, setMonthlyLimit] = useState("");
    const [createCard, setCreateCard] = useState(false);

    function handleTypeSelect(value) {
        setAccountType(value);
        setCurrency(value === "TEKUCI" ? "RSD" : "");
        setErrors((prev) => ({ ...prev, type: "" }));
    }

    function handleCurrencySelect(value) {
        setCurrency(value);
        setErrors((prev) => ({ ...prev, currency: "" }));
    }

    function handleOwnerTypeSelect(value) {
        setOwnerType(value);
        setSubtype("");
        if (value === "PERSONAL") setCompany(EMPTY_COMPANY);
        setErrors((prev) => ({ ...prev, ownerType: "", subtype: "", companyName: "", pib: "", registration_number: "", activity_code: "", companyAddress: "" }));
    }

    function handleCompanyChange(e) {
        const { name, value } = e.target;
        setCompany((prev) => ({ ...prev, [name]: value }));
        const errorKey = name === "name" ? "companyName" : name === "address" ? "companyAddress" : name;
        setErrors((prev) => ({ ...prev, [errorKey]: "" }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitError("");

        const errs = validate(accountType, currency, ownerType, subtype);
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        try {
            setSubmitting(true);
            await createAccount({
                client_id: 1,
                account_type: accountType,
                subtype: ownerType === "BUSINESS" ? "DOO" : subtype,
                currency,
                initial_balance: 0,
                daily_limit: dailyLimit ? Number(dailyLimit) : 0,
                monthly_limit: monthlyLimit ? Number(monthlyLimit) : 0,
                create_card: createCard,
                business_info: ownerType === "BUSINESS" ? {
                    company_name: company.name,
                    registration_number: company.registration_number,
                    pib: company.pib,
                    activity_code: company.activity_code,
                    address: company.address,
                } : undefined,
            });
            navigate("/dashboard");
        } catch (err) {
            setSubmitError(err.message || "Greška pri kreiranju računa.");
        } finally {
            setSubmitting(false);
        }
    }

    const readyForSummary = accountType && currency && ownerType &&
        (ownerType === "BUSINESS" || subtype);

    return (
        <div className="ca-shell">
            <div className="ca-content">

                {/* Header */}
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

                    {/* ── Account type ── */}
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

                    {/* ── Currency ── */}
                    {accountType === "TEKUCI" && (
                        <div className="ca-section">
                            <p className="ca-section-label">Valuta</p>
                            <div className="ca-currency-locked">
                                <span>🇷🇸</span>
                                <span>RSD — Srpski dinar</span>
                                <span className="ca-currency-locked-badge">Fiksno</span>
                            </div>
                        </div>
                    )}

                    {accountType === "DEVIZNI" && (
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

                    {/* ── Owner type ── */}
                    {accountType && currency && (
                        <div className="ca-section">
                            <p className="ca-section-label">Vlasnik računa</p>
                            <div className="ca-type-grid">
                                {OWNER_TYPES.map(({ value, label, desc, icon }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`ca-type-card ${ownerType === value ? "ca-type-card--selected" : ""}`}
                                        onClick={() => handleOwnerTypeSelect(value)}
                                    >
                                        <div className="ca-type-icon">{icon}</div>
                                        <p className="ca-type-label">{label}</p>
                                        <p className="ca-type-desc">{desc}</p>
                                        {ownerType === value && (
                                            <div className="ca-type-check">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            {errors.ownerType && <p className="ca-error">{errors.ownerType}</p>}
                        </div>
                    )}

                    {/* ── Personal subtype ── */}
                    {ownerType === "PERSONAL" && (
                        <div className="ca-section">
                            <p className="ca-section-label">Podtip računa</p>
                            <div className="ca-currency-grid">
                                {PERSONAL_SUBTYPES.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`ca-currency-btn ${subtype === value ? "ca-currency-btn--selected" : ""}`}
                                        onClick={() => {
                                            setSubtype(value);
                                            setErrors((prev) => ({ ...prev, subtype: "" }));
                                        }}
                                    >
                                        <span className="ca-currency-code">{label}</span>
                                    </button>
                                ))}
                            </div>
                            {errors.subtype && <p className="ca-error">{errors.subtype}</p>}
                        </div>
                    )}

                    {/* ── Company info ── */}
                    {ownerType === "BUSINESS" && (
                        <div className="ca-section">
                            <p className="ca-section-label">Podaci o kompaniji</p>
                            <div className="ca-company-form">

                                <div className="ca-field">
                                    <label className="ca-field-label">Naziv kompanije</label>
                                    <input
                                        className={`ca-input ${errors.companyName ? "ca-input--error" : ""}`}
                                        name="name"
                                        value={company.name}
                                        onChange={handleCompanyChange}
                                        placeholder="npr. Acme d.o.o."
                                    />
                                    {errors.companyName && <p className="ca-error">{errors.companyName}</p>}
                                </div>

                                <div className="ca-field-row">
                                    <div className="ca-field">
                                        <label className="ca-field-label">PIB</label>
                                        <input
                                            className={`ca-input ${errors.pib ? "ca-input--error" : ""}`}
                                            name="pib"
                                            value={company.pib}
                                            onChange={handleCompanyChange}
                                            placeholder="9 cifara"
                                            maxLength={9}
                                        />
                                        {errors.pib && <p className="ca-error">{errors.pib}</p>}
                                    </div>

                                    <div className="ca-field">
                                        <label className="ca-field-label">Matični broj</label>
                                        <input
                                            className={`ca-input ${errors.registration_number ? "ca-input--error" : ""}`}
                                            name="registration_number"
                                            value={company.registration_number}
                                            onChange={handleCompanyChange}
                                            placeholder="8 cifara"
                                            maxLength={8}
                                        />
                                        {errors.registration_number && <p className="ca-error">{errors.registration_number}</p>}
                                    </div>
                                </div>

                                <div className="ca-field">
                                    <label className="ca-field-label">Šifra delatnosti</label>
                                    <input
                                        className={`ca-input ${errors.activity_code ? "ca-input--error" : ""}`}
                                        name="activity_code"
                                        value={company.activity_code}
                                        onChange={handleCompanyChange}
                                        placeholder="npr. 10.1"
                                    />
                                    {errors.activity_code && <p className="ca-error">{errors.activity_code}</p>}
                                </div>

                                <div className="ca-field">
                                    <label className="ca-field-label">Adresa kompanije</label>
                                    <input
                                        className={`ca-input ${errors.companyAddress ? "ca-input--error" : ""}`}
                                        name="address"
                                        value={company.address}
                                        onChange={handleCompanyChange}
                                        placeholder="Ulica i broj, grad"
                                    />
                                    {errors.companyAddress && <p className="ca-error">{errors.companyAddress}</p>}
                                </div>

                            </div>
                        </div>
                    )}

                    {/* ── Limits & card ── */}
                    {ownerType && (
                        <div className="ca-section">
                            <p className="ca-section-label">Podešavanja računa</p>

                            <div className="ca-field-row" style={{ marginBottom: 12 }}>
                                <div className="ca-field">
                                    <label className="ca-field-label">Dnevni limit (RSD)</label>
                                    <input
                                        className="ca-input"
                                        type="number"
                                        min="0"
                                        value={dailyLimit}
                                        onChange={(e) => setDailyLimit(e.target.value)}
                                        placeholder="0 = bez limita"
                                    />
                                </div>
                                <div className="ca-field">
                                    <label className="ca-field-label">Mesečni limit (RSD)</label>
                                    <input
                                        className="ca-input"
                                        type="number"
                                        min="0"
                                        value={monthlyLimit}
                                        onChange={(e) => setMonthlyLimit(e.target.value)}
                                        placeholder="0 = bez limita"
                                    />
                                </div>
                            </div>

                            <div className="ca-card-toggle">
                                <div>
                                    <p className="ca-card-toggle-label">Kreiraj karticu</p>
                                    <p className="ca-card-toggle-desc">Automatski kreira debitnu karticu uz ovaj račun</p>
                                </div>
                                <button
                                    type="button"
                                    className={`ca-toggle ${createCard ? "ca-toggle--on" : ""}`}
                                    onClick={() => setCreateCard((prev) => !prev)}
                                    aria-pressed={createCard}
                                >
                                    <span className="ca-toggle-knob" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Summary ── */}
                    {readyForSummary && (
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
                            <div className="ca-summary-row">
                                <span>Vlasnik</span>
                                <span>{ownerType === "PERSONAL" ? "Fizičko lice" : company.name || "Pravno lice"}</span>
                            </div>
                            {ownerType === "PERSONAL" && subtype && (
                                <div className="ca-summary-row">
                                    <span>Podtip</span>
                                    <span>{PERSONAL_SUBTYPES.find(s => s.value === subtype)?.label}</span>
                                </div>
                            )}
                            <div className="ca-summary-row">
                                <span>Dnevni limit</span>
                                <span>{dailyLimit ? `${Number(dailyLimit).toLocaleString()} RSD` : "Bez limita"}</span>
                            </div>
                            <div className="ca-summary-row">
                                <span>Mesečni limit</span>
                                <span>{monthlyLimit ? `${Number(monthlyLimit).toLocaleString()} RSD` : "Bez limita"}</span>
                            </div>
                            <div className="ca-summary-row">
                                <span>Kartica</span>
                                <span>{createCard ? "Da" : "Ne"}</span>
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