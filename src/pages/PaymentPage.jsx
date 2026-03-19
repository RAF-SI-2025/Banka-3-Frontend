import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { transferFunds } from "../services/TransactionService";
import "./PaymentPage.css";

const EMPTY_FORM = {
    sender_account: "",
    recipient_account: "",
    recipient_name: "",
    amount: "",
    payment_code: "",
    reference_number: "",
    purpose: "",
};

function validate(form) {
    const errors = {};

    if (!form.sender_account.trim())
        errors.sender_account = "Unesite broj računa pošiljaoca.";

    if (!form.recipient_account.trim())
        errors.recipient_account = "Unesite broj računa primaoca.";

    if (!form.recipient_name.trim())
        errors.recipient_name = "Unesite ime primaoca.";

    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
        errors.amount = "Unesite ispravan iznos (veći od 0).";

    if (!form.payment_code.trim())
        errors.payment_code = "Unesite pozivni kod plaćanja.";

    if (!form.purpose.trim())
        errors.purpose = "Unesite svrhu plaćanja.";

    return errors;
}

export default function PaymentPage() {
    const navigate = useNavigate();

    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    function handleChange(e) {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitError("");
        setSuccessMsg("");

        const errs = validate(form);
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        try {
            setSubmitting(true);
            await transferFunds({
                sender_account: form.sender_account.trim(),
                recipient_account: form.recipient_account.trim(),
                recipient_name: form.recipient_name.trim(),
                amount: Number(form.amount),
                payment_code: form.payment_code.trim(),
                reference_number: form.reference_number.trim(),
                purpose: form.purpose.trim(),
            });
            setSuccessMsg("Transakcija je uspešno izvršena.");
            setForm(EMPTY_FORM);
        } catch (err) {
            setSubmitError(
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                "Greška pri izvršavanju transakcije."
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="pay-shell">
            <div className="pay-content">

                {/* Header */}
                <div className="pay-header">
                    <button className="pay-back-btn" onClick={() => navigate("/dashboard")}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                    <div>
                        <p className="pay-subtitle">Novo plaćanje</p>
                        <h1 className="pay-title">Prenos sredstava</h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>

                    {/* ── Sender ── */}
                    <div className="pay-section">
                        <p className="pay-section-label">Pošiljalac</p>

                        <div className="pay-field">
                            <label className="pay-field-label">Broj računa pošiljaoca</label>
                            <input
                                className={`pay-input ${errors.sender_account ? "pay-input--error" : ""}`}
                                name="sender_account"
                                value={form.sender_account}
                                onChange={handleChange}
                                placeholder="npr. 265-0000000011234-56"
                            />
                            {errors.sender_account && <p className="pay-error">{errors.sender_account}</p>}
                        </div>
                    </div>

                    {/* ── Recipient ── */}
                    <div className="pay-section">
                        <p className="pay-section-label">Primalac</p>

                        <div className="pay-field">
                            <label className="pay-field-label">Ime i prezime / naziv primaoca</label>
                            <input
                                className={`pay-input ${errors.recipient_name ? "pay-input--error" : ""}`}
                                name="recipient_name"
                                value={form.recipient_name}
                                onChange={handleChange}
                                placeholder="npr. Petar Nikolić"
                            />
                            {errors.recipient_name && <p className="pay-error">{errors.recipient_name}</p>}
                        </div>

                        <div className="pay-field">
                            <label className="pay-field-label">Broj računa primaoca</label>
                            <input
                                className={`pay-input ${errors.recipient_account ? "pay-input--error" : ""}`}
                                name="recipient_account"
                                value={form.recipient_account}
                                onChange={handleChange}
                                placeholder="npr. 265-0000000099876-12"
                            />
                            {errors.recipient_account && <p className="pay-error">{errors.recipient_account}</p>}
                        </div>
                    </div>

                    {/* ── Payment details ── */}
                    <div className="pay-section">
                        <p className="pay-section-label">Detalji plaćanja</p>

                        <div className="pay-field">
                            <label className="pay-field-label">Iznos (RSD)</label>
                            <input
                                className={`pay-input ${errors.amount ? "pay-input--error" : ""}`}
                                name="amount"
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={form.amount}
                                onChange={handleChange}
                                placeholder="0.00"
                            />
                            {errors.amount && <p className="pay-error">{errors.amount}</p>}
                        </div>

                        <div className="pay-field-row">
                            <div className="pay-field">
                                <label className="pay-field-label">Pozivni kod plaćanja</label>
                                <input
                                    className={`pay-input ${errors.payment_code ? "pay-input--error" : ""}`}
                                    name="payment_code"
                                    value={form.payment_code}
                                    onChange={handleChange}
                                    placeholder="npr. 289"
                                />
                                {errors.payment_code && <p className="pay-error">{errors.payment_code}</p>}
                            </div>

                            <div className="pay-field">
                                <label className="pay-field-label">Poziv na broj (opcionalno)</label>
                                <input
                                    className="pay-input"
                                    name="reference_number"
                                    value={form.reference_number}
                                    onChange={handleChange}
                                    placeholder="npr. 97-12345678"
                                />
                            </div>
                        </div>

                        <div className="pay-field">
                            <label className="pay-field-label">Svrha plaćanja</label>
                            <input
                                className={`pay-input ${errors.purpose ? "pay-input--error" : ""}`}
                                name="purpose"
                                value={form.purpose}
                                onChange={handleChange}
                                placeholder="npr. Uplata za usluge"
                            />
                            {errors.purpose && <p className="pay-error">{errors.purpose}</p>}
                        </div>
                    </div>

                    {/* ── Summary ── */}
                    {form.recipient_name && form.recipient_account && form.amount && (
                        <div className="pay-summary">
                            <p className="pay-summary-label">Pregled transakcije</p>
                            <div className="pay-summary-row">
                                <span>Primalac</span>
                                <span>{form.recipient_name}</span>
                            </div>
                            <div className="pay-summary-row">
                                <span>Račun primaoca</span>
                                <span>{form.recipient_account}</span>
                            </div>
                            {form.amount && !isNaN(Number(form.amount)) && Number(form.amount) > 0 && (
                                <div className="pay-summary-row">
                                    <span>Iznos</span>
                                    <span>
                                        {new Intl.NumberFormat("sr-RS", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        }).format(Number(form.amount))} RSD
                                    </span>
                                </div>
                            )}
                            {form.purpose && (
                                <div className="pay-summary-row">
                                    <span>Svrha</span>
                                    <span>{form.purpose}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {successMsg && <p className="pay-success">{successMsg}</p>}
                    {submitError && <p className="pay-error pay-error--submit">{submitError}</p>}

                    <div className="pay-actions">
                        <button type="button" className="pay-btn-back" onClick={() => navigate("/dashboard")}>
                            Otkaži
                        </button>
                        <button type="submit" className="pay-btn-submit" disabled={submitting}>
                            {submitting ? "Slanje..." : "Pošalji plaćanje"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
