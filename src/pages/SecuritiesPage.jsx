import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MenuDropdown from "../components/MenuDropdown";
import {
  getSecuritiesByType,
  refreshSecurity,
  getAllowedTabs,
} from "../services/SecuritiesService";
import "./SecuritiesPage.css";

const AUTO_REFRESH_MS = 30_000;

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtNum(value, decimals = 2) {
  if (value == null) return "—";
  return new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function fmtVolume(value) {
  if (value == null) return "—";
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return value.toLocaleString("sr-RS");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortIcon({ field, sortBy, sortDir }) {
  if (sortBy !== field) return <span className="sort-icon neutral">↕</span>;
  return <span className="sort-icon active">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function RefreshIcon({ spinning }) {
  return (
    <svg
      className={`refresh-svg${spinning ? " spinning" : ""}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SecuritiesPage() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem("userRole") || "client";
  const tabs = getAllowedTabs(userRole);

  const [activeTab, setActiveTab] = useState(tabs[0].type);
  const [securities, setSecurities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingTickers, setRefreshingTickers] = useState(new Set());
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [exchangePrefix, setExchangePrefix] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minAsk, setMinAsk] = useState("");
  const [maxAsk, setMaxAsk] = useState("");
  const [minBid, setMinBid] = useState("");
  const [maxBid, setMaxBid] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [maxVolume, setMaxVolume] = useState("");
  const [settlementFrom, setSettlementFrom] = useState("");
  const [settlementTo, setSettlementTo] = useState("");

  // Sort
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  // Countdown till next auto-refresh
  const [countdown, setCountdown] = useState(AUTO_REFRESH_MS / 1000);
  const countdownRef = useRef(null);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError("");

      try {
        const data = await getSecuritiesByType(activeTab);
        setSecurities(data);
      } catch {
        setError("Greška pri učitavanju hartija od vrednosti.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab]
  );

  // Initial load + tab change
  useEffect(() => {
    setSecurities([]);
    setLoading(true);
    loadData(false);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh interval + countdown
  useEffect(() => {
    setCountdown(AUTO_REFRESH_MS / 1000);

    const intervalId = setInterval(() => {
      loadData(true);
      setCountdown(AUTO_REFRESH_MS / 1000);
    }, AUTO_REFRESH_MS);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(intervalId);
      clearInterval(countdownRef.current);
    };
  }, [loadData]);

  // ─── Per-item refresh ─────────────────────────────────────────────────────

  async function handleRefreshRow(ticker, type) {
    setRefreshingTickers((prev) => new Set(prev).add(ticker));
    try {
      const fresh = await refreshSecurity(ticker, type);
      if (fresh) {
        setSecurities((prev) =>
          prev.map((s) => (s.ticker === ticker ? fresh : s))
        );
      }
    } finally {
      setRefreshingTickers((prev) => {
        const next = new Set(prev);
        next.delete(ticker);
        return next;
      });
    }
  }

  // ─── Tab switching ────────────────────────────────────────────────────────

  function handleTabChange(type) {
    setActiveTab(type);
    resetFilters();
    setSortBy("");
    setSortDir("asc");
  }

  // ─── Filters & sort ───────────────────────────────────────────────────────

  function resetFilters() {
    setSearch("");
    setExchangePrefix("");
    setMinPrice("");
    setMaxPrice("");
    setMinAsk("");
    setMaxAsk("");
    setMinBid("");
    setMaxBid("");
    setMinVolume("");
    setMaxVolume("");
    setSettlementFrom("");
    setSettlementTo("");
  }

  function handleSort(field) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  const processed = useMemo(() => {
    const lo = search.toLowerCase();
    const n = (v) => (v !== "" ? parseFloat(v) : null);
    const minP = n(minPrice), maxP = n(maxPrice);
    const minA = n(minAsk), maxA = n(maxAsk);
    const minB = n(minBid), maxB = n(maxBid);
    const minV = n(minVolume), maxV = n(maxVolume);

    let result = securities.filter((s) => {
      if (lo && !(s.ticker || "").toLowerCase().includes(lo) && !(s.name || "").toLowerCase().includes(lo)) return false;
      if (exchangePrefix && !(s.exchange || "").toLowerCase().startsWith(exchangePrefix.toLowerCase())) return false;
      if (minP != null && s.price < minP) return false;
      if (maxP != null && s.price > maxP) return false;
      if (minA != null && (s.ask ?? s.price) < minA) return false;
      if (maxA != null && (s.ask ?? s.price) > maxA) return false;
      if (minB != null && (s.bid ?? s.price) < minB) return false;
      if (maxB != null && (s.bid ?? s.price) > maxB) return false;
      if (minV != null && s.volume < minV) return false;
      if (maxV != null && s.volume > maxV) return false;
      if (activeTab === "FUTURES" && s.settlementDate) {
        if (settlementFrom && s.settlementDate < settlementFrom) return false;
        if (settlementTo && s.settlementDate > settlementTo) return false;
      }
      return true;
    });

    if (sortBy) {
      result = [...result].sort((a, b) => {
        const av = a[sortBy] ?? 0;
        const bv = b[sortBy] ?? 0;
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }

    return result;
  }, [
    securities, search, exchangePrefix,
    minPrice, maxPrice, minAsk, maxAsk, minBid, maxBid,
    minVolume, maxVolume, settlementFrom, settlementTo,
    sortBy, sortDir, activeTab,
  ]);

  // ─── Buy action ───────────────────────────────────────────────────────────

  function handleBuy(sec) {
    navigate(`/orders/create?ticker=${encodeURIComponent(sec.ticker)}&type=${sec.type}`);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const priceDecimals = activeTab === "FOREX" ? 4 : 2;

  return (
    <div className="page-bg">
      <img src="/bank-logo.png" alt="logo" className="bank-logo" />
      <MenuDropdown />

      <div className="content-wrapper">
        <div className="sec-card">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="sec-topbar">
            <div className="sec-title-block">
              <p className="sec-eyebrow">TRŽIŠTE HARTIJA OD VREDNOSTI</p>
              <h1>Hartije od vrednosti</h1>
              <p className="sec-subtitle">
                Pregled i kupovina hartija dostupnih za trgovanje na berzi.
              </p>
            </div>

            <div className="sec-topbar-actions">
              <span className="sec-countdown" title="Automatsko osvežavanje">
                <RefreshIcon spinning={refreshing} />
                {refreshing ? "Osvežavanje..." : `${countdown}s`}
              </span>
              <button
                className="btn-refresh-all"
                onClick={() => loadData(true)}
                disabled={refreshing}
                title="Osvežite sve hartije"
              >
                <RefreshIcon spinning={refreshing} /> Osveži
              </button>
            </div>
          </div>

          {/* ── Tabs ───────────────────────────────────────────────────── */}
          <div className="sec-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.type}
                className={`sec-tab${activeTab === tab.type ? " active" : ""}`}
                onClick={() => handleTabChange(tab.type)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Search row ─────────────────────────────────────────────── */}
          <div className="sec-toolbar">
            <div className="toolbar-row">
              <div className="search-wrapper">
                <span className="search-icon">⌕</span>
                <input
                  className="search"
                  placeholder="Pretraga po tickeru ili nazivu hartije"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* ── Filters row ─────────────────────────────────────────── */}
            <div className="toolbar-filters">
              <input
                className="sec-filter-input filter-exchange"
                placeholder="Berza (prefiks)"
                value={exchangePrefix}
                onChange={(e) => setExchangePrefix(e.target.value)}
              />
              <input className="sec-filter-input" type="number" placeholder="Min cena" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} min="0" />
              <input className="sec-filter-input" type="number" placeholder="Max cena" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} min="0" />
              <input className="sec-filter-input" type="number" placeholder="Min ask" value={minAsk} onChange={(e) => setMinAsk(e.target.value)} min="0" />
              <input className="sec-filter-input" type="number" placeholder="Max ask" value={maxAsk} onChange={(e) => setMaxAsk(e.target.value)} min="0" />
              <input className="sec-filter-input" type="number" placeholder="Min bid" value={minBid} onChange={(e) => setMinBid(e.target.value)} min="0" />
              <input className="sec-filter-input" type="number" placeholder="Max bid" value={maxBid} onChange={(e) => setMaxBid(e.target.value)} min="0" />
              <input className="sec-filter-input" type="number" placeholder="Min obim" value={minVolume} onChange={(e) => setMinVolume(e.target.value)} min="0" />
              <input className="sec-filter-input" type="number" placeholder="Max obim" value={maxVolume} onChange={(e) => setMaxVolume(e.target.value)} min="0" />

              {activeTab === "FUTURES" && (
                <>
                  <input
                    className="sec-filter-input filter-date"
                    type="date"
                    title="Settlement datum od"
                    value={settlementFrom}
                    onChange={(e) => setSettlementFrom(e.target.value)}
                  />
                  <input
                    className="sec-filter-input filter-date"
                    type="date"
                    title="Settlement datum do"
                    value={settlementTo}
                    onChange={(e) => setSettlementTo(e.target.value)}
                  />
                </>
              )}

              <button className="reset-btn" onClick={() => { resetFilters(); setSortBy(""); setSortDir("asc"); }}>
                Reset
              </button>
            </div>
          </div>

          {/* ── Filter info bar ─────────────────────────────────────────── */}
          {!loading && (
            <div className="filter-info">
              Pronađeno: <strong>{processed.length}</strong> / {securities.length} hartija
            </div>
          )}

          {/* ── Table ───────────────────────────────────────────────────── */}
          <div className="table-container">
            {loading ? (
              <div className="no-results">Učitavanje...</div>
            ) : error ? (
              <div className="no-results" style={{ color: "#f87171" }}>{error}</div>
            ) : processed.length === 0 ? (
              <div className="no-results">Nema hartija koje odgovaraju zadatim kriterijumima.</div>
            ) : (
              <div className="table-scroll">
                <table className="sec-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Naziv</th>
                      <th>Berza</th>
                      <th className="sortable" onClick={() => handleSort("price")}>
                        Cena <SortIcon field="price" sortBy={sortBy} sortDir={sortDir} />
                      </th>
                      <th>Promena</th>
                      <th>Ask</th>
                      <th>Bid</th>
                      <th className="sortable" onClick={() => handleSort("volume")}>
                        Obim <SortIcon field="volume" sortBy={sortBy} sortDir={sortDir} />
                      </th>
                      <th className="sortable" onClick={() => handleSort("maintenanceMargin")}>
                        Initial Margin <SortIcon field="maintenanceMargin" sortBy={sortBy} sortDir={sortDir} />
                      </th>
                      {activeTab === "FUTURES" && <th>Settlement</th>}
                      <th className="th-actions">Akcije</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processed.map((sec) => {
                      const isPos = (sec.change ?? 0) >= 0;
                      const isRowRefreshing = refreshingTickers.has(sec.ticker);
                      return (
                        <tr
                          key={sec.ticker}
                          className={`clickable-row${isRowRefreshing ? " row-refreshing" : ""}`}
                          onClick={() => navigate(`/securities/${sec.type.toLowerCase()}/${encodeURIComponent(sec.ticker)}`)}
                        >
                          <td>
                            <span className={`ticker-badge ticker-badge--${sec.type.toLowerCase()}`}>
                              {sec.ticker}
                            </span>
                          </td>
                          <td className="sec-name">{sec.name}</td>
                          <td className="exchange-cell">{sec.exchange ?? "—"}</td>
                          <td className="num-cell">{fmtNum(sec.price, priceDecimals)}</td>
                          <td className={`change-cell ${isPos ? "pos" : "neg"}`}>
                            {isPos ? "+" : ""}{fmtNum(sec.change, priceDecimals)}
                            <span className="change-pct">
                              {" "}({isPos ? "+" : ""}{(sec.changePercent ?? 0).toFixed(2)}%)
                            </span>
                          </td>
                          <td className="num-cell">{fmtNum(sec.ask, priceDecimals)}</td>
                          <td className="num-cell">{fmtNum(sec.bid, priceDecimals)}</td>
                          <td className="num-cell">{fmtVolume(sec.volume)}</td>
                          <td className="num-cell margin-cell">
                            {fmtNum(sec.initialMarginCost)}
                            <span className="maintenance-hint">
                              MM: {fmtNum(sec.maintenanceMargin)}
                            </span>
                          </td>
                          {activeTab === "FUTURES" && (
                            <td className="settlement-cell">{sec.settlementDate ?? "—"}</td>
                          )}
                          <td className="td-actions">
                            <button
                              className="btn-buy"
                              onClick={(e) => { e.stopPropagation(); handleBuy(sec); }}
                              title={`Kupi ${sec.ticker}`}
                            >
                              Kupi
                            </button>
                            <button
                              className="btn-row-refresh"
                              onClick={(e) => { e.stopPropagation(); handleRefreshRow(sec.ticker, sec.type); }}
                              disabled={isRowRefreshing}
                              title="Osveži hartiju"
                            >
                              <RefreshIcon spinning={isRowRefreshing} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
