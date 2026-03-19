import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRecipients } from "../services/PaymentService";
import MenuDropdown from "../components/MenuDropdown";
import "./RecipientsPage.css";

export default function RecipientsPage() {
  const [recipients, setRecipients] = useState([]);
  const [searchTerm, setSearchTerm]  = useState("");
  const [loading, setLoading]        = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setRecipients(await getRecipients());
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return recipients.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.account_number.toLowerCase().includes(lower)
    );
  }, [recipients, searchTerm]);

  return (
    <div className="rp-bg">
      <img src="/bank-logo.png" alt="logo" className="rp-logo" />
      <MenuDropdown />

      <div className="rp-wrapper">
        {/* Page header */}
        <div className="rp-page-header">
          <h2 className="rp-page-title">Primaoci</h2>
          <div className="rp-header-actions">
            <button className="rp-secondary-btn" onClick={() => navigate("/payments")}>
              Istorija plaćanja →
            </button>
            <button className="rp-new-btn" onClick={() => navigate("/payments/new")}>
              + Novo plaćanje
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="rp-card">
          {/* Controls */}
          <div className="rp-card-header">
            <div className="rp-search-wrapper">
              <span className="rp-search-icon">🔍</span>
              <input
                className="rp-search"
                placeholder="Pretraga po imenu ili broju računa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="rp-clear-btn" onClick={() => setSearchTerm("")}>✕</button>
              )}
            </div>
            <span className="rp-result-count">
              {filtered.length} / {recipients.length} primaoca
            </span>
          </div>

          {/* Content */}
          {loading ? (
            <div className="rp-loading">Učitavanje...</div>
          ) : filtered.length === 0 ? (
            <div className="rp-empty">Nema pronađenih primaoca.</div>
          ) : (
            <table className="rp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ime i prezime</th>
                  <th>Broj računa</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className="rp-row">
                    <td className="rp-td-index">{i + 1}</td>
                    <td className="rp-td-name">
                      <div className="rp-avatar">{r.name.charAt(0)}</div>
                      {r.name}
                    </td>
                    <td className="rp-td-account">{r.account_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
