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


  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return [...accounts]
        .filter((a) => {
          const status = String(a.status || "").toLowerCase();
          const isActive = status === "active" || status === "aktivan";

          const matchesSearch =
              !term ||
              a.account_number?.toLowerCase().includes(term) ||
              a.account_name?.toLowerCase().includes(term);

          const matchesType = !filterType || a.account_type === filterType;

          return isActive && matchesSearch && matchesType;
        })
        .sort((a, b) => {
          const availableA = a.available_balance ?? a.available ?? a.balance ?? 0;
          const availableB = b.available_balance ?? b.available ?? b.balance ?? 0;
          return availableB - availableA;
        });
  }, [accounts, searchTerm, filterType]);

  return (
    <div className="accs-shell">
      <div className="accs-content">

        <div className="accs-header">
          <button
              type="button"
              className="accs-back-btn"
              onClick={() => navigate("/dashboard")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="accs-title-block">
            <p>Moji računi</p>
            <h1>Pregled stanja i detalja</h1>
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
              placeholder="Pretraga po broju računa ili nazivu..."
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

          <button
            className="accs-reset-btn"
            onClick={() => { setSearchTerm(""); setFilterType("");}}
          >
            Reset
          </button>
        </div>

        <p className="accs-filter-info">
          Aktivni računi: <strong>{filtered.length}</strong>
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
                <th>Tip</th>
                <th>Valuta</th>
                <th>Raspoloživo stanje</th>
                <th>Detalji</th>
              </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="accs-empty">Nema aktivnih računa</td>
                  </tr>
                ) : (
                    filtered.map((a) => {
                      const available = a.available_balance ?? a.available ?? a.balance ?? 0;

                      return (
                          <tr
                              key={a.account_number}
                              className="accs-row"
                              onClick={() => navigate(`/accounts/${a.account_number}`)}
                          >
                            <td className="accs-number">{a.account_number}</td>
                            <td>{a.account_name}</td>
                            <td>{a.account_type}</td>
                            <td>{a.currency}</td>
                            <td>{fmt(available, a.currency)}</td>
                            <td>
                              <button
                                  type="button"
                                  className="accs-details-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/accounts/${a.account_number}`);
                                  }}
                              >
                                Detalji
                              </button>
                            </td>
                          </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
