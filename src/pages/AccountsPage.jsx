import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getAccounts } from "../services/AccountsService";
import "./AccountsPage.css";

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

export default function AccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getAccounts();
        if (!cancelled) setAccounts(data);
      } catch {
        if (!cancelled) setError("Greška pri učitavanju računa.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const uniqueTypes = useMemo(() =>
    [...new Set(accounts.map((a) => a.account_type).filter(Boolean))].sort(),
    [accounts]
  );

  const uniqueStatuses = useMemo(() =>
    [...new Set(accounts.map((a) => a.status).filter(Boolean))].sort(),
    [accounts]
  );

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return accounts.filter((a) => {
      const matchesSearch =
        !term ||
        a.account_number?.toLowerCase().includes(term) ||
        a.account_name?.toLowerCase().includes(term) ||
        String(a.owner_id).includes(term);
      const matchesType = !filterType || a.account_type === filterType;
      const matchesStatus = !filterStatus || a.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [accounts, searchTerm, filterType, filterStatus]);

  return (
    <div className="accs-shell">
      <div className="accs-content">

        <div className="accs-header">
          <div className="accs-title-block">
            <p>Administracija</p>
            <h1>Pregled računa</h1>
          </div>
        </div>

        <div className="accs-filters">
          <div className="accs-search-wrapper">
            <span className="accs-search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              className="accs-input"
              placeholder="Pretraga po broju, imenu ili klijentu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="accs-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Svi tipovi</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            className="accs-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Svi statusi</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <button
            className="accs-reset-btn"
            onClick={() => { setSearchTerm(""); setFilterType(""); setFilterStatus(""); }}
          >
            Reset
          </button>
        </div>

        <p className="accs-filter-info">
          Pronađeno: <strong>{filtered.length}</strong> / {accounts.length} računa
        </p>

        {loading && <p className="accs-state-msg">Učitavanje...</p>}
        {error && <p className="accs-state-msg accs-state-msg--error">{error}</p>}

        {!loading && !error && (
          <div className="accs-table-wrap">
            <table className="accs-table">
              <thead>
                <tr>
                  <th>Broj računa</th>
                  <th>Naziv</th>
                  <th>Klijent ID</th>
                  <th>Tip</th>
                  <th>Valuta</th>
                  <th>Stanje</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="accs-empty">Nema rezultata</td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr
                      key={a.account_number}
                      className="accs-row"
                      onClick={() => navigate(`/admin/accounts/${a.account_number}`)}
                    >
                      <td className="accs-number">{a.account_number}</td>
                      <td>{a.account_name}</td>
                      <td>{a.owner_id}</td>
                      <td>{a.account_type}</td>
                      <td>{a.currency}</td>
                      <td>{fmt(a.balance, a.currency)}</td>
                      <td>
                        <span className={`accs-badge ${a.status === "Aktivan" ? "accs-badge--active" : "accs-badge--inactive"}`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
