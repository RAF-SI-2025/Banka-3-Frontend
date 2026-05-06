import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import {
  listOrders,
  approveOrder,
  declineOrder,
  cancelOrder,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  ORDER_DIRECTION_LABEL,
} from "../services/OrderService.js";
import { formatCurrency } from "../utils/loanCalculations.js";
import "./MyOrdersPage.css";

const STATUS_FILTERS = [
  { value: "all", label: "Svi" },
  { value: "pending", label: "Na čekanju" },
  { value: "approved", label: "Odobreni" },
  { value: "declined", label: "Odbijeni" },
  { value: "done", label: "Završeni" },
];

function fmtTimestamp(unix) {
  if (!unix) return "—";
  try {
    const ms = unix < 1e12 ? unix * 1000 : unix;
    return new Date(ms).toLocaleString("sr-RS");
  } catch {
    return "—";
  }
}

function isPastSettlement(value) {
  if (!value) return false;
  const ms = value < 1e12 ? value * 1000 : value;
  return ms < Date.now();
}

export default function OrdersReviewPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [busy, setBusy] = useState(null);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");

  const permissions = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("permissions") || "[]"); }
    catch { return []; }
  }, []);
  const isSupervisor = permissions.includes("admin") || permissions.includes("supervisor");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const data = await listOrders({ status: statusFilter });
      setOrders(data);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) {
        setError("Nemate dozvolu za pristup pregledu naloga.");
      } else {
        setError(e?.response?.data?.message || e?.message || "Greška pri učitavanju naloga.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isSupervisor) {
      navigate("/securities", { replace: true });
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, isSupervisor]);

  async function performAction(action, orderId, label) {
    if (!window.confirm(`Da li ste sigurni da želite da ${label} ovaj nalog?`)) return;
    setBusy(orderId);
    setActionError("");
    setActionMsg("");
    try {
      if (action === "approve") await approveOrder(orderId);
      else if (action === "decline") await declineOrder(orderId);
      else if (action === "cancel") await cancelOrder(orderId);
      setActionMsg(`Nalog je uspešno ${label}.`);
      await load();
    } catch (e) {
      setActionError(
        e?.response?.data?.message || e?.message || "Akcija nije uspela."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mo-page">
      <Sidebar />
      <div className="mo-content">
        <div className="mo-header">
          <div>
            <p className="mo-eyebrow">Supervizor</p>
            <h1 className="mo-title">Pregled naloga</h1>
            <p className="mo-subtitle">Odobravanje, odbijanje i otkazivanje naloga aktuara i klijenata.</p>
          </div>
          <div className="mo-actions">
            <button className="mo-btn-secondary" onClick={load} disabled={loading}>
              {loading ? "Učitava..." : "Osveži"}
            </button>
          </div>
        </div>

        <div className="mo-filters">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`mo-filter ${statusFilter === f.value ? "mo-filter--active" : ""}`}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {actionMsg && <div className="mo-banner mo-banner--ok">{actionMsg}</div>}
        {actionError && <div className="mo-banner mo-banner--error">{actionError}</div>}
        {error && <div className="mo-banner mo-banner--error">{error}</div>}

        <div className="mo-table-wrap">
          <table className="mo-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Korisnik</th>
                <th>Tip</th>
                <th>Hartija</th>
                <th>Smer</th>
                <th>Količina</th>
                <th>Veličina ugovora</th>
                <th>Cena/jed.</th>
                <th>Preostalo</th>
                <th>Status</th>
                <th>Datum</th>
                <th>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={12} className="mo-empty">Učitavanje…</td></tr>
              )}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={12} className="mo-empty">Nema naloga koji odgovaraju filteru.</td></tr>
              )}
              {!loading && orders.map((o) => {
                const expired = isPastSettlement(o.settlementDate);
                const canApprove = o.status === "pending" && !expired;
                const canDecline = o.status === "pending";
                const canCancel = o.status === "approved" && !o.isDone;
                return (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.userName || o.userEmail || `#${o.userId || "—"}`}</td>
                    <td>{ORDER_TYPE_LABEL[o.orderType] || o.orderType}</td>
                    <td>{o.ticker || o.listingName || "—"}</td>
                    <td>
                      <span className={`mo-direction mo-direction--${o.direction}`}>
                        {ORDER_DIRECTION_LABEL[o.direction] || o.direction}
                      </span>
                    </td>
                    <td>{o.quantity}</td>
                    <td>{o.contractSize}</td>
                    <td>{formatCurrency(o.pricePerUnit, o.currency)}</td>
                    <td>{o.remainingPortions}</td>
                    <td><span className={`mo-status mo-status--${o.status}`}>{ORDER_STATUS_LABEL[o.status] || o.status}</span></td>
                    <td>{fmtTimestamp(o.createdAt || o.lastModification)}</td>
                    <td className="mo-actions-cell">
                      {canApprove && (
                        <button
                          className="mo-approve-btn"
                          onClick={() => performAction("approve", o.id, "odobrite")}
                          disabled={busy === o.id}
                        >
                          {busy === o.id ? "..." : "Odobri"}
                        </button>
                      )}
                      {canDecline && (
                        <button
                          className="mo-cancel-btn"
                          onClick={() => performAction("decline", o.id, "odbijete")}
                          disabled={busy === o.id}
                        >
                          {busy === o.id ? "..." : "Odbij"}
                        </button>
                      )}
                      {canCancel && (
                        <button
                          className="mo-cancel-btn"
                          onClick={() => performAction("cancel", o.id, "otkažete")}
                          disabled={busy === o.id}
                        >
                          {busy === o.id ? "..." : "Otkaži"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
