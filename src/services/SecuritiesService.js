import api from "./api.js";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_STOCKS = [
  { ticker: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", price: 178.5, ask: 178.58, bid: 178.42, change: 2.35, changePercent: 1.33, volume: 52384000, maintenanceMargin: 8113.64 },
  { ticker: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", price: 415.2, ask: 415.35, bid: 415.05, change: -3.1, changePercent: -0.74, volume: 18942000, maintenanceMargin: 18872.73 },
  { ticker: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", price: 875.4, ask: 875.7, bid: 875.1, change: 21.6, changePercent: 2.53, volume: 41230000, maintenanceMargin: 39790.91 },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", exchange: "NYSE", price: 198.75, ask: 198.82, bid: 198.68, change: 1.05, changePercent: 0.53, volume: 8756000, maintenanceMargin: 9034.09 },
  { ticker: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ", price: 242.8, ask: 243.1, bid: 242.5, change: -8.4, changePercent: -3.34, volume: 91234000, maintenanceMargin: 11036.36 },
  { ticker: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ", price: 184.6, ask: 184.68, bid: 184.52, change: 3.2, changePercent: 1.76, volume: 27890000, maintenanceMargin: 8390.91 },
  { ticker: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ", price: 172.3, ask: 172.38, bid: 172.22, change: -1.15, changePercent: -0.66, volume: 14520000, maintenanceMargin: 7831.82 },
  { ticker: "META", name: "Meta Platforms Inc.", exchange: "NASDAQ", price: 521.4, ask: 521.6, bid: 521.2, change: 8.9, changePercent: 1.74, volume: 11340000, maintenanceMargin: 23700.0 },
  { ticker: "BAC", name: "Bank of America Corp.", exchange: "NYSE", price: 38.9, ask: 38.93, bid: 38.87, change: 0.4, changePercent: 1.04, volume: 34120000, maintenanceMargin: 1768.18 },
  { ticker: "V", name: "Visa Inc.", exchange: "NYSE", price: 278.5, ask: 278.6, bid: 278.4, change: -2.1, changePercent: -0.75, volume: 5840000, maintenanceMargin: 12659.09 },
];

const MOCK_FUTURES = [
  { ticker: "ES", name: "E-mini S&P 500 Futures", exchange: "CME", price: 5248.5, ask: 5249.0, bid: 5248.0, change: 12.25, changePercent: 0.23, volume: 1823400, maintenanceMargin: 12000.0, settlementDate: "2025-06-20" },
  { ticker: "NQ", name: "E-mini NASDAQ-100 Futures", exchange: "CME", price: 18372.0, ask: 18373.5, bid: 18370.5, change: -45.5, changePercent: -0.25, volume: 672300, maintenanceMargin: 19000.0, settlementDate: "2025-06-20" },
  { ticker: "CL", name: "Crude Oil Futures (WTI)", exchange: "NYMEX", price: 81.34, ask: 81.38, bid: 81.30, change: 0.68, changePercent: 0.84, volume: 389500, maintenanceMargin: 4545.45, settlementDate: "2025-05-21" },
  { ticker: "GC", name: "Gold Futures", exchange: "COMEX", price: 2348.6, ask: 2349.1, bid: 2348.1, change: -5.4, changePercent: -0.23, volume: 198700, maintenanceMargin: 8000.0, settlementDate: "2025-06-27" },
  { ticker: "SI", name: "Silver Futures", exchange: "COMEX", price: 28.45, ask: 28.48, bid: 28.42, change: 0.32, changePercent: 1.14, volume: 74200, maintenanceMargin: 5500.0, settlementDate: "2025-05-29" },
  { ticker: "ZB", name: "U.S. Treasury Bond Futures", exchange: "CBOT", price: 118.75, ask: 118.78, bid: 118.72, change: -0.25, changePercent: -0.21, volume: 312400, maintenanceMargin: 3000.0, settlementDate: "2025-06-20" },
  { ticker: "NG", name: "Natural Gas Futures", exchange: "NYMEX", price: 1.845, ask: 1.847, bid: 1.843, change: 0.025, changePercent: 1.37, volume: 156700, maintenanceMargin: 1500.0, settlementDate: "2025-04-28" },
];

const MOCK_FOREX = [
  { ticker: "EUR/USD", name: "Euro / US Dollar", exchange: "FOREX", price: 1.0845, ask: 1.0847, bid: 1.0843, change: 0.0012, changePercent: 0.11, volume: 142500000, maintenanceMargin: 1972.73 },
  { ticker: "GBP/USD", name: "British Pound / US Dollar", exchange: "FOREX", price: 1.2682, ask: 1.2684, bid: 1.2680, change: -0.0034, changePercent: -0.27, volume: 89300000, maintenanceMargin: 2305.82 },
  { ticker: "USD/JPY", name: "US Dollar / Japanese Yen", exchange: "FOREX", price: 151.84, ask: 151.86, bid: 151.82, change: 0.42, changePercent: 0.28, volume: 112400000, maintenanceMargin: 1380.36 },
  { ticker: "USD/CHF", name: "US Dollar / Swiss Franc", exchange: "FOREX", price: 0.9012, ask: 0.9014, bid: 0.9010, change: -0.0018, changePercent: -0.20, volume: 43600000, maintenanceMargin: 819.27 },
  { ticker: "AUD/USD", name: "Australian Dollar / US Dollar", exchange: "FOREX", price: 0.6534, ask: 0.6536, bid: 0.6532, change: 0.0009, changePercent: 0.14, volume: 38900000, maintenanceMargin: 594.0 },
  { ticker: "USD/CAD", name: "US Dollar / Canadian Dollar", exchange: "FOREX", price: 1.3685, ask: 1.3687, bid: 1.3683, change: -0.0022, changePercent: -0.16, volume: 29700000, maintenanceMargin: 1244.09 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enrich(security, type) {
  return {
    ...security,
    type,
    initialMarginCost: +(security.maintenanceMargin * 1.1).toFixed(2),
  };
}

function normalizeList(data, fallbackType) {
  const arr = data?.securities ?? data?.stocks ?? data?.futures ?? data?.pairs ?? data ?? [];
  return Array.isArray(arr) ? arr.map((s) => enrich(s, fallbackType)) : [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getStocks() {
  try {
    const res = await api.get("/stocks");
    return normalizeList(res.data, "STOCK");
  } catch {
    return MOCK_STOCKS.map((s) => enrich(s, "STOCK"));
  }
}

export async function getFutures() {
  try {
    const res = await api.get("/futures");
    return normalizeList(res.data, "FUTURES");
  } catch {
    return MOCK_FUTURES.map((s) => enrich(s, "FUTURES"));
  }
}

export async function getForexPairs() {
  try {
    const res = await api.get("/forex-pairs");
    return normalizeList(res.data, "FOREX");
  } catch {
    return MOCK_FOREX.map((s) => enrich(s, "FOREX"));
  }
}

export async function getSecuritiesByType(type) {
  if (type === "STOCK") return getStocks();
  if (type === "FUTURES") return getFutures();
  if (type === "FOREX") return getForexPairs();
  return [];
}

export async function refreshSecurity(ticker, type) {
  try {
    if (type === "STOCK") {
      const res = await api.get(`/stocks/${ticker}`);
      return enrich(res.data, "STOCK");
    }
    if (type === "FUTURES") {
      const res = await api.get(`/futures/${ticker}`);
      return enrich(res.data, "FUTURES");
    }
    if (type === "FOREX") {
      const res = await api.get(`/forex-pairs/${encodeURIComponent(ticker)}`);
      return enrich(res.data, "FOREX");
    }
  } catch {
    // Simulate price fluctuation in dev/mock mode
    const source =
      type === "STOCK" ? MOCK_STOCKS : type === "FUTURES" ? MOCK_FUTURES : MOCK_FOREX;
    const found = source.find((s) => s.ticker === ticker);
    if (found) {
      const delta = (Math.random() - 0.5) * found.price * 0.002;
      const newPrice = +(found.price + delta).toFixed(4);
      return enrich({ ...found, price: newPrice, ask: +(newPrice + 0.01).toFixed(4), bid: +(newPrice - 0.01).toFixed(4) }, type);
    }
  }
  return null;
}

export function getAllowedTabs(userRole) {
  if (userRole === "client") {
    return [
      { type: "STOCK", label: "ACTIONS" },
      { type: "FUTURES", label: "FUTURES" },
    ];
  }
  return [
    { type: "STOCK", label: "ACTIONS" },
    { type: "FUTURES", label: "FUTURES" },
    { type: "FOREX", label: "FOREX" },
  ];
}

// ─── Detail & history ─────────────────────────────────────────────────────────

export async function getSecurityDetail(ticker, type) {
  try {
    const ep = { STOCK: "stocks", FUTURES: "futures", FOREX: "forex-pairs" }[type];
    const res = await api.get(`/${ep}/${encodeURIComponent(ticker)}`);
    return enrich(res.data, type);
  } catch {
    const src = type === "STOCK" ? MOCK_STOCKS : type === "FUTURES" ? MOCK_FUTURES : MOCK_FOREX;
    const found = src.find((s) => s.ticker === ticker);
    return found ? enrich(found, type) : null;
  }
}

// Seeded pseudo-random (same ticker → same chart shape)
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function tickerSeed(ticker) {
  return ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 1);
}

function buildHistory(basePrice, ticker, period) {
  const cfg = {
    "1D":  { points: 48,  ms: 30 * 60 * 1000 },
    "1W":  { points: 168, ms: 60 * 60 * 1000 },
    "1M":  { points: 30,  ms: 86400 * 1000 },
    "1Y":  { points: 252, ms: 86400 * 1000 },
    "5Y":  { points: 60,  ms: 30 * 86400 * 1000 },
    "MAX": { points: 120, ms: 30 * 86400 * 1000 },
  }[period] ?? { points: 30, ms: 86400 * 1000 };

  const rand = seededRand(tickerSeed(ticker) + cfg.points);
  const vol = 0.008;
  const now = Date.now();
  let price = basePrice;
  const result = [];

  for (let i = cfg.points; i >= 0; i--) {
    const ts = now - i * cfg.ms;
    price = Math.max(0.001, +(price + (rand() - 0.5) * 2 * vol * price).toFixed(6));
    const d = new Date(ts);
    const label =
      period === "1D" || period === "1W"
        ? `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} ${d.getDate()}.${d.getMonth() + 1}.`
        : d.toISOString().slice(0, 10);
    result.push({ date: label, price });
  }
  return result;
}

export async function getPriceHistory(ticker, type, period) {
  try {
    const ep = { STOCK: "stocks", FUTURES: "futures", FOREX: "forex-pairs" }[type];
    const res = await api.get(`/${ep}/${encodeURIComponent(ticker)}/history`, { params: { period } });
    return res.data?.history ?? res.data ?? [];
  } catch {
    const src = type === "STOCK" ? MOCK_STOCKS : type === "FUTURES" ? MOCK_FUTURES : MOCK_FOREX;
    const sec = src.find((s) => s.ticker === ticker);
    return sec ? buildHistory(sec.price, ticker, period) : [];
  }
}

// ─── Options (STOCK only) ─────────────────────────────────────────────────────

function thirdFriday(year, month) {
  let count = 0;
  const d = new Date(year, month, 1);
  while (count < 3) {
    if (d.getDay() === 5) count++;
    if (count < 3) d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function futureExpiryDates() {
  const dates = [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  for (let i = 0; dates.length < 6; i++) {
    const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
    const m = (now.getMonth() + i) % 12;
    const d = thirdFriday(y, m);
    if (d > today) dates.push(d);
  }
  return dates;
}

export async function getOptionExpiryDates(ticker) {
  try {
    const res = await api.get(`/stocks/${encodeURIComponent(ticker)}/options/expiry-dates`);
    return res.data?.dates ?? res.data ?? [];
  } catch {
    return futureExpiryDates();
  }
}

function buildOptionsChain(basePrice, expiryDate, ticker) {
  const rand = seededRand(tickerSeed(ticker) + new Date(expiryDate).getTime() % 1000);
  const days = Math.max(1, Math.ceil((new Date(expiryDate) - new Date()) / 86400000));
  const step = basePrice > 500 ? 10 : basePrice > 100 ? 5 : basePrice > 20 ? 1 : 0.5;
  const start = Math.round((basePrice * 0.85) / step) * step;
  const chain = [];

  for (let i = 0; i < 20; i++) {
    const strike = +(start + i * step).toFixed(2);
    const callIntrinsic = Math.max(0, basePrice - strike);
    const putIntrinsic = Math.max(0, strike - basePrice);
    const tv = basePrice * 0.015 * Math.sqrt(days / 365);

    const cp = +(callIntrinsic + tv * (callIntrinsic > 0 ? 1.0 : 0.4)).toFixed(2);
    const pp = +(putIntrinsic + tv * (putIntrinsic > 0 ? 1.0 : 0.4)).toFixed(2);

    const chg = (v) => +((rand() - 0.5) * v * 0.15).toFixed(2);
    const vol = () => Math.floor(rand() * 8000);
    const oi = () => Math.floor(rand() * 25000);

    chain.push({
      strike,
      callITM: strike < basePrice,
      putITM: strike > basePrice,
      call: { lastPrice: cp, change: chg(cp), changePct: +((rand() - 0.5) * 8).toFixed(2), volume: vol(), openInterest: oi() },
      put:  { lastPrice: pp, change: chg(pp), changePct: +((rand() - 0.5) * 8).toFixed(2), volume: vol(), openInterest: oi() },
    });
  }
  return chain;
}

export async function getOptionsChain(ticker, expiryDate) {
  try {
    const res = await api.get(`/stocks/${encodeURIComponent(ticker)}/options`, { params: { expiry: expiryDate } });
    return res.data?.options ?? res.data ?? [];
  } catch {
    const sec = MOCK_STOCKS.find((s) => s.ticker === ticker);
    return buildOptionsChain(sec?.price ?? 100, expiryDate, ticker);
  }
}
