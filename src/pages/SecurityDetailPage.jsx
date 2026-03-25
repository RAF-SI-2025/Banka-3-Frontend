import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MenuDropdown from "../components/MenuDropdown";
import {
  getSecurityDetail,
  getPriceHistory,
  getOptionExpiryDates,
  getOptionsChain,
} from "../services/SecuritiesService";
import "./SecurityDetailPage.css";

const PERIODS = [
  { key: "1D", label: "1D" },
  { key: "1W", label: "1N" },
  { key: "1M", label: "1M" },
  { key: "1Y", label: "1G" },
  { key: "5Y", label: "5G" },
  { key: "MAX", label: "MAX" },
];

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtNum(v, d = 2) {
  if (v == null) return "—";
  return new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
}

function fmtVol(v) {
  if (v == null) return "—";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toLocaleString("sr-RS");
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}

// ─── Price Chart ──────────────────────────────────────────────────────────────

function PriceChart({ data, loading }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const W = 1000,
    H = 280;
  const PL = 72,
    PR = 16,
    PT = 16,
    PB = 44;
  const IW = W - PL - PR;
  const IH = H - PT - PB;

  const { pts, line, area, color, yLabels, xLabels } = useMemo(() => {
    if (!data || data.length < 2) return {};
    const prices = data.map((d) => d.price);
    const minP = Math.min(...prices) * 0.9995;
    const maxP = Math.max(...prices) * 1.0005;
    const range = maxP - minP || 1;
    const xOf = (i) => PL + (i / (data.length - 1)) * IW;
    const yOf = (p) => PT + (1 - (p - minP) / range) * IH;

    const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.price), ...d }));
    const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
    const area = `${PL},${PT + IH} ${line} ${PL + IW},${PT + IH}`;
    const isUp = data[data.length - 1].price >= data[0].price;
    const color = isUp ? "#22c55e" : "#ef4444";

    const YTICKS = 5;
    const yLabels = Array.from({ length: YTICKS }, (_, i) => {
      const p = minP + (i / (YTICKS - 1)) * range;
      return { y: yOf(p), label: fmtNum(p, prices[0] < 10 ? 4 : 2) };
    });

    const step = Math.max(1, Math.floor(data.length / 6));
    const xLabels = data
      .filter((_, i) => i % step === 0 || i === data.length - 1)
      .map((d, _, arr) => {
        const i = data.indexOf(d);
        return { x: xOf(i), label: d.date };
      });

    return { pts, line, area, color, yLabels, xLabels };
  }, [data]);

  if (loading)
    return <div className="chart-placeholder">Učitavanje grafikona...</div>;
  if (!pts) return <div className="chart-placeholder">Nema podataka</div>;

  function handleMouseMove(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const innerX = svgX - PL;
    if (innerX < 0 || innerX > IW) {
      setTooltip(null);
      return;
    }
    const idx = Math.round((innerX / IW) * (data.length - 1));
    const p = pts[Math.max(0, Math.min(pts.length - 1, idx))];
    setTooltip(p);
  }

  return (
    <div className="chart-wrapper" onMouseLeave={() => setTooltip(null)}>
      {tooltip && (
        <div
          className="chart-tooltip"
          style={{ left: `${((tooltip.x - PL) / IW) * 100}%` }}
        >
          <span className="tt-date">{tooltip.date}</span>
          <span className="tt-price" style={{ color }}>
            {fmtNum(tooltip.price, tooltip.price < 10 ? 4 : 2)}
          </span>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        onMouseMove={handleMouseMove}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yLabels.map((t, i) => (
          <g key={i}>
            <line
              x1={PL}
              y1={t.y}
              x2={W - PR}
              y2={t.y}
              stroke="rgba(148,163,184,0.08)"
              strokeWidth="1"
            />
            <text
              x={PL - 8}
              y={t.y}
              textAnchor="end"
              dominantBaseline="middle"
              fill="#64748b"
              fontSize="18"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={H - 8}
            textAnchor="middle"
            fill="#475569"
            fontSize="16"
          >
            {l.label}
          </text>
        ))}

        {/* Area + line */}
        <polygon points={area} fill="url(#cg)" />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Hover cursor */}
        {tooltip && (
          <>
            <line
              x1={tooltip.x}
              y1={PT}
              x2={tooltip.x}
              y2={PT + IH}
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <circle
              cx={tooltip.x}
              cy={tooltip.y}
              r="5"
              fill={color}
              stroke="#0f172a"
              strokeWidth="2"
            />
          </>
        )}
      </svg>
    </div>
  );
}

// ─── Options Chain Table ──────────────────────────────────────────────────────

function OptionsChain({ chain, spotPrice, showITM, view, search }) {
  const filtered = useMemo(() => {
    let rows = chain;
    if (showITM) rows = rows.filter((r) => r.callITM || r.putITM);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((r) => String(r.strike).includes(s));
    }
    return rows;
  }, [chain, showITM, search]);

  if (filtered.length === 0)
    return <div className="no-results">Nema opcija za prikazane filtere.</div>;

  if (view === "STRADDLE") {
    return (
      <div className="table-scroll">
        <table className="opt-table">
          <thead>
            <tr>
              <th>Strike</th>
              <th className="num">Call Last</th>
              <th className="num">Call Promjena</th>
              <th className="num">Call Vol</th>
              <th className="num">Call OI</th>
              <th className="num">Put Last</th>
              <th className="num">Put Promjena</th>
              <th className="num">Put Vol</th>
              <th className="num">Put OI</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.strike}
                className={
                  r.strike === Math.round(spotPrice / 1) * 1 ? "atm-row" : ""
                }
              >
                <td>
                  <span className="strike-badge">{r.strike}</span>
                </td>
                <td className="num">{fmtNum(r.call.lastPrice)}</td>
                <td className={`num ${r.call.change >= 0 ? "pos" : "neg"}`}>
                  {r.call.change >= 0 ? "+" : ""}
                  {fmtNum(r.call.change)}
                </td>
                <td className="num">{fmtVol(r.call.volume)}</td>
                <td className="num">{fmtVol(r.call.openInterest)}</td>
                <td className="num">{fmtNum(r.put.lastPrice)}</td>
                <td className={`num ${r.put.change >= 0 ? "pos" : "neg"}`}>
                  {r.put.change >= 0 ? "+" : ""}
                  {fmtNum(r.put.change)}
                </td>
                <td className="num">{fmtVol(r.put.volume)}</td>
                <td className="num">{fmtVol(r.put.openInterest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // List view — Calls | Strike | Puts
  return (
    <div className="chain-grid">
      {/* Calls */}
      <div className="chain-side calls-side">
        <table className="opt-table">
          <thead>
            <tr>
              <th className="num">Last Price</th>
              <th className="num">Promena</th>
              <th className="num">% Promena</th>
              <th className="num">Volume</th>
              <th className="num">Open Int.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.strike} className={r.callITM ? "itm-call" : ""}>
                <td className="num">{fmtNum(r.call.lastPrice)}</td>
                <td className={`num ${r.call.change >= 0 ? "pos" : "neg"}`}>
                  {r.call.change >= 0 ? "+" : ""}
                  {fmtNum(r.call.change)}
                </td>
                <td className={`num ${r.call.changePct >= 0 ? "pos" : "neg"}`}>
                  {r.call.changePct >= 0 ? "+" : ""}
                  {fmtNum(r.call.changePct)}%
                </td>
                <td className="num">{fmtVol(r.call.volume)}</td>
                <td className="num">{fmtVol(r.call.openInterest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Strike column */}
      <div className="strike-col">
        <div className="strike-header">Strike ↕</div>
        {filtered.map((r) => {
          const isAtm =
            Math.abs(r.strike - spotPrice) <
            (filtered[1]?.strike - filtered[0]?.strike || 1) * 0.5;
          return (
            <div key={r.strike} className={`strike-cell${isAtm ? " atm" : ""}`}>
              {r.strike}
            </div>
          );
        })}
      </div>

      {/* Puts */}
      <div className="chain-side puts-side">
        <table className="opt-table">
          <thead>
            <tr>
              <th className="num">Last Price</th>
              <th className="num">Promena</th>
              <th className="num">% Promena</th>
              <th className="num">Volume</th>
              <th className="num">Open Int.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.strike} className={r.putITM ? "itm-put" : ""}>
                <td className="num">{fmtNum(r.put.lastPrice)}</td>
                <td className={`num ${r.put.change >= 0 ? "pos" : "neg"}`}>
                  {r.put.change >= 0 ? "+" : ""}
                  {fmtNum(r.put.change)}
                </td>
                <td className={`num ${r.put.changePct >= 0 ? "pos" : "neg"}`}>
                  {r.put.changePct >= 0 ? "+" : ""}
                  {fmtNum(r.put.changePct)}%
                </td>
                <td className="num">{fmtVol(r.put.volume)}</td>
                <td className="num">{fmtVol(r.put.openInterest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SecurityDetailPage() {
  const { type, ticker } = useParams();
  const navigate = useNavigate();
  const decodedTicker = decodeURIComponent(ticker);
  const typeUpper = (type ?? "").toUpperCase();
  const priceDecimals = typeUpper === "FOREX" ? 4 : 2;

  const [security, setSecurity] = useState(null);
  const [secLoading, setSecLoading] = useState(true);
  const [secError, setSecError] = useState("");

  const [period, setPeriod] = useState("1M");
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  // Options (STOCK only)
  const [expiryDates, setExpiryDates] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState(null);
  const [chain, setChain] = useState([]);
  const [chainLoading, setChainLoading] = useState(false);
  const [showITM, setShowITM] = useState(false);
  const [optView, setOptView] = useState("LIST");
  const [optSearch, setOptSearch] = useState("");

  // ── Load security detail
  useEffect(() => {
    let cancelled = false;
    setSecLoading(true);
    setSecError("");
    getSecurityDetail(decodedTicker, typeUpper)
      .then((data) => {
        if (!cancelled) {
          setSecurity(data);
          setSecLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSecError("Greška pri učitavanju hartije.");
          setSecLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [decodedTicker, typeUpper]);

  // ── Load price history
  useEffect(() => {
    let cancelled = false;
    setHistLoading(true);
    getPriceHistory(decodedTicker, typeUpper, period)
      .then((data) => {
        if (!cancelled) {
          setHistory(data);
          setHistLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setHistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [decodedTicker, typeUpper, period]);

  // ── Load options expiry dates (STOCK only)
  useEffect(() => {
    if (typeUpper !== "STOCK") return;
    getOptionExpiryDates(decodedTicker).then((dates) => {
      setExpiryDates(dates);
      if (dates.length > 0) setSelectedExpiry(dates[0]);
    });
  }, [decodedTicker, typeUpper]);

  // ── Load options chain when expiry changes
  useEffect(() => {
    if (!selectedExpiry) return;
    setChainLoading(true);
    getOptionsChain(decodedTicker, selectedExpiry)
      .then((data) => {
        setChain(data);
        setChainLoading(false);
      })
      .catch(() => setChainLoading(false));
  }, [decodedTicker, selectedExpiry]);

  // ── Info table rows
  const infoRows = useMemo(() => {
    if (!security) return [];
    const rows = [
      { label: "Ticker", value: security.ticker },
      { label: "Naziv", value: security.name },
      { label: "Berza", value: security.exchange },
      { label: "Tip", value: security.type },
      { label: "Cena", value: fmtNum(security.price, priceDecimals) },
      { label: "Ask", value: fmtNum(security.ask, priceDecimals) },
      { label: "Bid", value: fmtNum(security.bid, priceDecimals) },
      { label: "Promena", value: fmtNum(security.change, priceDecimals) },
      { label: "Promena %", value: fmtNum(security.changePercent) + "%" },
      { label: "Obim", value: fmtVol(security.volume) },
      {
        label: "Maintenance Margin",
        value: fmtNum(security.maintenanceMargin),
      },
      {
        label: "Initial Margin Cost",
        value: fmtNum(security.initialMarginCost),
      },
    ];
    if (security.settlementDate) {
      rows.push({ label: "Settlement Date", value: security.settlementDate });
    }
    return rows;
  }, [security, priceDecimals]);

  const isPositive = (security?.change ?? 0) >= 0;

  // ── Loading / error states
  if (secLoading) {
    return (
      <div className="page-bg">
        <img src="/bank-logo.png" alt="logo" className="bank-logo" />
        <MenuDropdown />
        <div className="content-wrapper">
          <p className="loading-msg">Učitavanje...</p>
        </div>
      </div>
    );
  }

  if (secError || !security) {
    return (
      <div className="page-bg">
        <img src="/bank-logo.png" alt="logo" className="bank-logo" />
        <MenuDropdown />
        <div className="content-wrapper">
          <p style={{ color: "#f87171" }}>
            {secError || "Hartija nije pronađena."}
          </p>
          <button className="btn-back" onClick={() => navigate("/securities")}>
            ← Nazad
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg">
      <img src="/bank-logo.png" alt="logo" className="bank-logo" />
      <MenuDropdown />

      <div className="content-wrapper">
        {/* ── Back + Header ─────────────────────────────────────────── */}
        <div className="det-header-row">
          <button className="btn-back" onClick={() => navigate("/securities")}>
            ← Hartije
          </button>
        </div>

        <div className="det-card">
          <div className="det-topbar">
            <div className="det-title-group">
              <span
                className={`det-ticker-badge det-ticker--${typeUpper.toLowerCase()}`}
              >
                {security.ticker}
              </span>
              <div>
                <h1 className="det-name">{security.name}</h1>
                <span className="det-exchange">
                  {security.exchange} · {security.type}
                </span>
              </div>
            </div>
            <div className="det-price-group">
              <span className="det-price">
                {fmtNum(security.price, priceDecimals)}
              </span>
              <span className={`det-change ${isPositive ? "pos" : "neg"}`}>
                {isPositive ? "+" : ""}
                {fmtNum(security.change, priceDecimals)} (
                {isPositive ? "+" : ""}
                {fmtNum(security.changePercent)}%)
              </span>
            </div>
          </div>

          {/* ── Period selector ────────────────────────────────────── */}
          <div className="period-row">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                className={`period-btn${period === p.key ? " active" : ""}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* ── Chart ─────────────────────────────────────────────── */}
          <div className="chart-section">
            <PriceChart data={history} loading={histLoading} />
          </div>

          {/* ── Info table ────────────────────────────────────────── */}
          <div className="info-section">
            <h2 className="section-title">Informacije o hartiji</h2>
            <div className="info-grid">
              {infoRows.map((row) => (
                <div key={row.label} className="info-row">
                  <span className="info-label">{row.label}</span>
                  <span className="info-value">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Options section (STOCK only) ───────────────────────── */}
          {typeUpper === "STOCK" && (
            <div className="options-section">
              <h2 className="section-title">Opcije</h2>

              {/* Expiry dates table */}
              {expiryDates.length > 0 && (
                <div className="expiry-table-wrap">
                  <table className="expiry-table">
                    <thead>
                      <tr>
                        <th>Datum isteka</th>
                        <th>Dana do isteka</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiryDates.map((d) => (
                        <tr
                          key={d}
                          className={`expiry-row${selectedExpiry === d ? " selected" : ""}`}
                          onClick={() => {
                            setSelectedExpiry(d);
                            setOptSearch("");
                            setShowITM(false);
                          }}
                        >
                          <td>
                            {new Date(d).toLocaleDateString("sr-RS", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </td>
                          <td className="days-cell">{daysUntil(d)} dana</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Options chain */}
              {selectedExpiry && (
                <div className="chain-section">
                  {/* Chain toolbar */}
                  <div className="chain-toolbar">
                    <div className="chain-date-label">
                      {new Date(selectedExpiry).toLocaleDateString("sr-RS", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>

                    <button
                      className={`filter-chip${showITM ? " active" : ""}`}
                      onClick={() => setShowITM((v) => !v)}
                    >
                      In The Money
                    </button>

                    <div className="view-toggle">
                      <button
                        className={`view-btn${optView === "LIST" ? " active" : ""}`}
                        onClick={() => setOptView("LIST")}
                      >
                        List
                      </button>
                      <button
                        className={`view-btn${optView === "STRADDLE" ? " active" : ""}`}
                        onClick={() => setOptView("STRADDLE")}
                      >
                        Straddle
                      </button>
                    </div>

                    <div className="opt-search-wrapper">
                      <input
                        className="opt-search"
                        placeholder="Option Lookup"
                        value={optSearch}
                        onChange={(e) => setOptSearch(e.target.value)}
                      />
                      <button className="opt-search-btn">🔍</button>
                    </div>
                  </div>

                  {/* Chain labels */}
                  {optView === "LIST" && (
                    <div className="chain-labels">
                      <span className="chain-label-calls">Calls</span>
                      <span className="chain-label-center">
                        {new Date(selectedExpiry).toLocaleDateString("sr-RS", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span className="chain-label-puts">Puts</span>
                    </div>
                  )}

                  {/* The actual chain */}
                  <div className="chain-container">
                    {chainLoading ? (
                      <div className="no-results">Učitavanje opcija...</div>
                    ) : (
                      <OptionsChain
                        chain={chain}
                        spotPrice={security.price}
                        showITM={showITM}
                        view={optView}
                        search={optSearch}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
