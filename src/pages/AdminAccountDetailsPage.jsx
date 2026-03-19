import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAccountByNumber } from "../services/AccountsService";
import "./AdminAccountDetailsPage.css";

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

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("sr-RS");
}

function InfoRow({ label, value }) {
  return (
    <div className="aad-info-row">
      <span className="aad-info-label">{label}</span>
      <span className="aad-info-value">{value ?? "—"}</span>
    </div>
  );
}

export default function AdminAccountDetailsPage() {
  const { accountNumber } = useParams();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accountNumber) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await getAccountByNumber(accountNumber);
        if (!cancelled) setAccount(data);
      } catch {
        if (!cancelled) setError("Greška pri učitavanju podataka o računu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [accountNumber]);

  if (loading) {
    return (
      <div className="aad-shell">
        <p className="aad-state-msg">Učitavanje...</p>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="aad-shell">
        <p className="aad-state-msg aad-state-msg--error">{error || "Račun nije pronađen."}</p>
      </div>
    );
  }

  const reserved = account.balance - account.available_balance;
  const dailyPct = account.daily_limit ? Math.min((account.daily_spending / account.daily_limit) * 100, 100) : 0;
  const monthlyPct = account.monthly_limit ? Math.min((account.monthly_spending / account.monthly_limit) * 100, 100) : 0;

  return (
    <div className="aad-shell">
      <div className="aad-content">

        {/* Header */}
        <div className="aad-header">
          <button className="aad-back-btn" onClick={() => navigate("/accounts")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="aad-title-block">
            <p>Detalji računa</p>
            <h1>{account.account_name}</h1>
          </div>
          <span className={`aad-status-badge ${account.status === "Aktivan" ? "aad-status-badge--active" : "aad-status-badge--inactive"}`}>
            {account.status}
          </span>
        </div>

        {/* Balance */}
        <div className="aad-balance-card">
          <p className="aad-account-number">{account.account_number}</p>
          <p className="aad-balance-main">{fmt(account.balance, account.currency)}</p>
          <div className="aad-balance-row">
            <div>
              <p className="aad-balance-label">Raspoloživo</p>
              <p className="aad-balance-available">{fmt(account.available_balance, account.currency)}</p>
            </div>
            <div>
              <p className="aad-balance-label">Rezervisano</p>
              <p className="aad-balance-reserved">{fmt(reserved, account.currency)}</p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="aad-section">
          <p className="aad-section-title">Informacije o računu</p>
          <div className="aad-info-grid">
            <InfoRow label="Tip računa" value={account.account_type} />
            <InfoRow label="Valuta" value={account.currency} />
            <InfoRow label="ID Klijenta" value={account.owner_id} />
            <InfoRow label="ID Zaposlenog" value={account.employee_id} />
            <InfoRow label="Datum otvaranja" value={fmtDate(account.creation_date)} />
            <InfoRow label="Datum isteka" value={fmtDate(account.expiration_date)} />
          </div>
        </div>

        {/* Limits */}
        <div className="aad-section">
          <p className="aad-section-title">Limiti i potrošnja</p>
          <div className="aad-info-grid">
            <InfoRow label="Dnevni limit" value={fmt(account.daily_limit, account.currency)} />
            <InfoRow label="Mesečni limit" value={fmt(account.monthly_limit, account.currency)} />
            <InfoRow label="Dnevna potrošnja" value={fmt(account.daily_spending, account.currency)} />
            <InfoRow label="Mesečna potrošnja" value={fmt(account.monthly_spending, account.currency)} />
          </div>

          <div className="aad-limit-bars">
            <div className="aad-limit-bar-wrapper">
              <div className="aad-limit-bar-label">
                <span>Dnevna potrošnja</span>
                <span>{fmt(account.daily_spending, account.currency)} / {fmt(account.daily_limit, account.currency)}</span>
              </div>
              <div className="aad-limit-bar-track">
                <div className="aad-limit-bar-fill" style={{ width: `${dailyPct}%` }} />
              </div>
            </div>

            <div className="aad-limit-bar-wrapper">
              <div className="aad-limit-bar-label">
                <span>Mesečna potrošnja</span>
                <span>{fmt(account.monthly_spending, account.currency)} / {fmt(account.monthly_limit, account.currency)}</span>
              </div>
              <div className="aad-limit-bar-track">
                <div className="aad-limit-bar-fill" style={{ width: `${monthlyPct}%` }} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
