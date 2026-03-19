import { useState } from "react";
import "./LoanApplicationPage.css";

export default function CreateLoanRequestPage() {
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("");
  const [monthlyRate, setMonthlyRate] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const calculateRate = (a, p) => {
    if (a > 0 && p > 0) {
      const rate = a / p;
      setMonthlyRate(rate.toFixed(2));
    } else {
      setMonthlyRate(null);
    }
  };

  const handleAmountChange = (value) => {
    setAmount(value);
    calculateRate(value, period);
  };

  const handlePeriodChange = (value) => {
    setPeriod(value);
    calculateRate(amount, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!amount || !period) {
      setError("Sva polja su obavezna.");
      return;
    }

    if (amount <= 0 || period <= 0) {
      setError("Vrednosti moraju biti veće od nule.");
      return;
    }

    try {
      const response = await fetch("/api/loans/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Number(amount),
          period: Number(period)
        })
      });

      if (response.ok) {
        setMessage("Zahtev je uspešno podnet.");
        setAmount("");
        setPeriod("");
        setMonthlyRate(null);
      } else {
        setError("Došlo je do greške pri slanju zahteva.");
      }
    } catch {
      setError("Greška pri komunikaciji sa serverom.");
    }
  };

  return (
    <div className="loan-page">
      <div className="loan-card">
        <h2>Podnošenje zahteva za kredit</h2>

        <form onSubmit={handleSubmit} className="loan-form">
          <input
            type="number"
            placeholder="Iznos kredita"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
          />

          <input
            type="number"
            placeholder="Period otplate (meseci)"
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
          />

          {monthlyRate && (
            <div className="loan-rate">
              Procena mesečne rate: {monthlyRate}
            </div>
          )}

          <button type="submit">Podnesi zahtev</button>
        </form>

        {error && <div className="loan-error">{error}</div>}
        {message && <div className="loan-success">{message}</div>}
      </div>
    </div>
  );
}