import { useEffect, useMemo, useState } from "react";
import MenuDropdown from "../components/MenuDropdown";
import StatusBadge from "../components/common/StatusBadge";
import { getOrders, approveOrder, declineOrder } from "../services/OrdersService";
import "./OrdersReviewPage.css";

function fmtPrice(value) {
    return new Intl.NumberFormat("sr-RS", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export default function OrdersReviewPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [actionLoadingId, setActionLoadingId] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function loadOrders() {
            try {
                setLoading(true);
                setError("");
                const data = await getOrders();
                if (!cancelled) setOrders(data);
            } catch {
                if (!cancelled) setError("Greška pri učitavanju naloga.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadOrders();


        return () => {
            cancelled = true;
        };
    }, []);

    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const matchesStatus =
                statusFilter === "All" ? true : order.status === statusFilter;

            const searchValue = query.trim().toLowerCase();
            const matchesQuery =
                !searchValue ||
                order.agent.toLowerCase().includes(searchValue) ||
                order.asset.toLowerCase().includes(searchValue) ||
                order.orderType.toLowerCase().includes(searchValue) ||
                order.direction.toLowerCase().includes(searchValue);

            return matchesStatus && matchesQuery;
        });
    }, [orders, query, statusFilter]);

    async function handleApprove(orderId) {
        try {
            setActionLoadingId(orderId);
            const updated = await approveOrder(orderId);
            setOrders(updated);
        } finally {
            setActionLoadingId(null);
        }
    }

    async function handleDecline(orderId) {
        try {
            setActionLoadingId(orderId);
            const updated = await declineOrder(orderId);
            setOrders(updated);
        } finally {
            setActionLoadingId(null);
        }
    }

    return (
        <div className="orders-shell">
            <MenuDropdown />

            <main className="orders-content">
                <section className="orders-header-card">
                    <div className="orders-title-block">
                        <p>PREGLED NALOGA</p>
                        <h1>Svi nalozi</h1>
                        <span>
              Pregled svih naloga, filtriranje po statusu i odobravanje naloga koji čekaju potvrdu.
            </span>
                    </div>
                </section>

                <section className="orders-filters-card">
                    <div className="orders-filters">
                        <div className="orders-search-wrapper">
             <span className="orders-search-icon">
                      <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </span>
                            <input
                                type="text"
                                className="orders-input"
                                placeholder="Pretraga po agentu, hartiji, tipu ili smeru..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>

                        <select
                            className="orders-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Declined">Declined</option>
                            <option value="Done">Done</option>
                        </select>

                        <button
                            className="orders-reset-btn"
                            onClick={() => {
                                setQuery("");
                                setStatusFilter("All");
                            }}
                        >
                            Reset filtera
                        </button>
                    </div>

                    <div className="orders-filter-info">
                        Pronađeno: <strong>{filteredOrders.length}</strong> / {orders.length} naloga
                    </div>
                </section>

                {loading ? (
                    <div className="orders-state-msg">Učitavanje naloga...</div>
                ) : error ? (
                    <div className="orders-state-msg orders-state-msg--error">{error}</div>
                ) : (
                    <section className="orders-table-wrap">
                        <table className="orders-table">
                            <thead>
                            <tr>
                                <th>Agent</th>
                                <th>Tip</th>
                                <th>Hartija</th>
                                <th>Količina</th>
                                <th>Contract size</th>
                                <th>Cena</th>
                                <th>Smer</th>
                                <th>Remaining</th>
                                <th>Status</th>
                                <th>Approved by</th>
                                <th>Last modification</th>
                                <th>Akcije</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="12" className="orders-empty">
                                        Nema naloga za zadate filtere.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => {
                                    const isPending = order.status === "Pending";
                                    const isExpired = order.settlementExpired;
                                    const isBusy = actionLoadingId === order.id;

                                    return (
                                        <tr key={order.id} className="orders-row">
                                            <td>{order.agent}</td>
                                            <td>{order.orderType}</td>
                                            <td>{order.asset}</td>
                                            <td>{order.quantity}</td>
                                            <td>{order.contractSize}</td>
                                            <td>{fmtPrice(order.pricePerUnit)}</td>
                                            <td>{order.direction}</td>
                                            <td>{order.remainingPortions}</td>
                                            <td>
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className="orders-approved-by">
                                                {order.approvedBy || "—"}
                                            </td>
                                            <td className="orders-last-modification">
                                                {order.lastModification || "—"}
                                            </td>
                                            <td>
                                                {order.status === "Pending" ? (
                                                    <div className="orders-actions">
                                                        {!order.settlementExpired && (
                                                            <button
                                                                className="orders-action-btn orders-action-btn--approve"
                                                                onClick={() => handleApprove(order.id)}
                                                            >
                                                                Approve
                                                            </button>
                                                        )}

                                                        <button
                                                            className="orders-action-btn orders-action-btn--decline"
                                                            onClick={() => handleDecline(order.id)}
                                                        >
                                                            Decline
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="orders-no-actions">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                            </tbody>
                        </table>
                    </section>
                )}
            </main>
        </div>
    );
}