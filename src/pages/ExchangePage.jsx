import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getExchangeRates, performExchange } from "../services/ExchangeService";
import "./ExchangePage.css";

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

export default function ExchangePage() {
    const navigate = useNavigate();

    const [rates, setRates] = useState(null);
    const [fromCurrency, setFromCurrency] = useState("EUR");
    const [toCurrency, setToCurrency] = useState("RSD");
    const [amount, setAmount] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exchanging, setExchanging] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await getExchangeRates();
                if (!cancelled) setRates(data);
            } catch {
                if (!cancelled) setError("Greška pri učitavanju kursne liste.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const currencies = rates ? Object.keys(rates) : [];

    const currentRate = rates && fromCurrency && toCurrency
        ? rates[fromCurrency] / rates[toCurrency]
        : null;

    const convertedAmount = currentRate && amount
        ? parseFloat(amount) * currentRate
        : null;

    const handleSwap = () => {
        setFromCurrency(toCurrency);
        setToCurrency(fromCurrency);
        setResult(null);
        setSuccess("");
        setError("");
    };

    const handleExchange = async () => {
        const parsed = parseFloat(amount);
        if (!parsed || parsed <= 0) {
            setError("Unesite validan iznos.");
            return;
        }
        if (fromCurrency === toCurrency) {
            setError("Izaberite različite valute.");
            return;
        }

        setExchanging(true);
        setError("");
        setSuccess("");
        setResult(null);

        try {
            const res = await performExchange(fromCurrency, toCurrency, parsed);
            setResult(res);
            setSuccess(
                `Uspešno konvertovano ${fmt(res.originalAmount, res.fromCurrency)} u ${fmt(res.convertedAmount, res.toCurrency)}`
            );
        } catch {
            setError("Greška pri izvršavanju konverzije.");
        } finally {
            setExchanging(false);
        }
    };

    if (loading) {
        return (
            <div className="ex-page">
                <p className="ex-state-msg">Učitavanje...</p>
            </div>
        );
    }

    if (error && !rates) {
        return (
            <div className="ex-page">
                <p className="ex-state-msg ex-state-msg--error">{error}</p>
            </div>
        );
    }

    return (
        <div className="ex-page">
            <div className="ex-content">

                {/* ── HEADER ── */}
                <div className="ex-header">
                    <button className="ex-back-btn" onClick={() => navigate("/dashboard")}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                    <h1 className="ex-title">Menjačnica</h1>
                </div>

                {/* ── EXCHANGE CARD ── */}
                <div className="ex-card">

                    {/* From */}
                    <div className="ex-field-group">
                        <label className="ex-label">Iz valute</label>
                        <select
                            className="ex-select"
                            value={fromCurrency}
                            onChange={e => { setFromCurrency(e.target.value); setResult(null); setSuccess(""); setError(""); }}
                        >
                            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="ex-field-group">
                        <label className="ex-label">Iznos</label>
                        <input
                            className="ex-input"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={amount}
                            onChange={e => { setAmount(e.target.value); setResult(null); setSuccess(""); }}
                        />
                    </div>

                    {/* Swap */}
                    <div className="ex-swap-row">
                        <button className="ex-swap-btn" onClick={handleSwap} title="Zameni valute">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                            </svg>
                        </button>
                    </div>

                    {/* To */}
                    <div className="ex-field-group">
                        <label className="ex-label">U valutu</label>
                        <select
                            className="ex-select"
                            value={toCurrency}
                            onChange={e => { setToCurrency(e.target.value); setResult(null); setSuccess(""); setError(""); }}
                        >
                            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="ex-field-group">
                        <label className="ex-label">Konvertovani iznos</label>
                        <div className="ex-result-display">
                            {convertedAmount != null ? fmt(convertedAmount, toCurrency) : "—"}
                        </div>
                    </div>

                    {/* Rate display */}
                    {currentRate != null && fromCurrency !== toCurrency && (
                        <p className="ex-rate-info">
                            1 {fromCurrency} = {new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(currentRate)} {toCurrency}
                        </p>
                    )}

                    {/* Submit */}
                    <button
                        className="ex-submit-btn"
                        onClick={handleExchange}
                        disabled={exchanging || !amount}
                    >
                        {exchanging ? "Obrada..." : "Izvrši konverziju"}
                    </button>

                    {/* Messages */}
                    {error && <p className="ex-msg ex-msg--error">{error}</p>}
                    {success && <p className="ex-msg ex-msg--success">{success}</p>}
                </div>

            </div>
        </div>
    );
}
