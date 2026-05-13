import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import { getPublicStocks } from "../services/OtcService.js";
import "./OTCPage.css";

function formatPrice(value) {
    return `${(Number(value) / 100).toLocaleString("sr-RS", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} RSD`;
}

export default function OTCPage() {
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function loadStocks() {
        setLoading(true);
        setError("");

        try {
            const data = await getPublicStocks();
            setStocks(Array.isArray(data) ? data : []);
        } catch {
            setError("Greška pri učitavanju javnih OTC akcija.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadStocks();
    }, []);

    return (
        <div className="otc-page">
            <Sidebar />

            <main className="otc-content">
                <div className="otc-header">
                    <div>
                        <p className="otc-eyebrow">TRGOVANJE</p>
                        <h1 className="otc-title">OTC Trgovina</h1>
                        <p className="otc-subtitle">
                            Pregled javno dostupnih akcija drugih klijenata i banaka.
                        </p>
                    </div>

                    <button className="otc-refresh-btn" onClick={loadStocks} disabled={loading}>
                        {loading ? "Osvežavanje..." : "Osveži"}
                    </button>
                </div>


                {error && <p className="otc-state otc-state--error">{error}</p>}

                <div className="otc-table-wrap">
                    <table className="otc-table">
                        <thead>
                        <tr>
                            <th>Ticker</th>
                            <th>Količina</th>
                            <th>Cena</th>
                            <th>Banka prodavca</th>
                        </tr>
                        </thead>
                        <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="otc-empty">Učitavanje...</td>
                            </tr>
                        ) : stocks.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="otc-empty">Nema javnih OTC akcija za prikaz.</td>
                            </tr>
                        ) : (
                            stocks.map((stock) => (
                                <tr key={stock.id}>
                                    <td>
                                        <span className="otc-ticker">{stock.ticker}</span>
                                    </td>
                                    <td>{stock.amount}</td>
                                    <td className="otc-price">{formatPrice(stock.price)}</td>
                                    <td className="otc-muted">{stock.seller_bank}</td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}