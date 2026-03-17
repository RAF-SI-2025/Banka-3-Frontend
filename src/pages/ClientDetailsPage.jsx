import {useParams, Link} from "react-router-dom";
import { getClientById, getAccountsByClient } from "../services/ClientService";
import "./ClientDetailsPage.css";
import { useEffect, useState } from "react";

export default function ClientDetailsPage() {
    const { clientId } = useParams();

    const [client, setClient] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    useEffect(() => {
        if (!clientId) return;

        let cancelled = false;

        const loadData = async () => {
            try {
                setLoading(true);
                setPageError("");

                const [clientData, accountsData] = await Promise.all([
                    getClientById(Number(clientId)),
                    getAccountsByClient(Number(clientId)),
                ]);

                if (!cancelled) {
                    setClient(clientData);
                    setAccounts(accountsData);
                }
            } catch (error) {
                if (!cancelled) {
                    setPageError(error.message || "Došlo je do greške.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadData().catch(console.error);

        return () => {
            cancelled = true;
        };
    }, [clientId]);

    if (loading) {
        return (
            <div className="page-bg">
                <div className="content-wrapper">
                    <div className="accounts-card">
                        <p style={{ textAlign: "center", color: "#666" }}>Učitavanje...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (pageError || !client) {
        return (
            <div className="page-bg">
                <div className="content-wrapper">
                    <div className="accounts-card">
                        <p style={{ textAlign: "center", color: "#c00" }}>
                            {pageError || "Klijent nije pronađen."}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-bg">
            <img src="/bank-logo.png" alt="logo" className="bank-logo" />
            <img src="/menu-icon.png" alt="menu" className="menu-icon" />

            <div className="content-wrapper">
                <div className="client-header-card">
                    <div className="client-avatar">
                        {client.first_name[0]}{client.last_name[0]}
                    </div>

                    <div>
                        <h2>{client.first_name} {client.last_name}</h2>
                        <p className="client-sub">{client.email}</p>
                    </div>
                </div>

                <div className="client-info-grid">
                    <div className="info-item">
                        <span>Telefon</span>
                        <strong>{client.phone}</strong>
                    </div>

                    <div className="info-item">
                        <span>Adresa</span>
                        <strong>{client.address}</strong>
                    </div>

                    <div className="info-item">
                        <span>Datum rođenja</span>
                        <strong>{client.date_of_birth}</strong>
                    </div>
                </div>

                <div className="accounts-card">
                    <h3>Računi</h3>

                    {accounts.length > 0 ? (
                        <table className="accounts-table">
                            <thead>
                            <tr>
                                <th>Broj računa</th>
                                <th>Tip</th>
                                <th>Stanje</th>
                                <th>Valuta</th>
                            </tr>
                            </thead>
                            <tbody>
                            {accounts.map((acc) => (
                                <tr key={acc.clientId}>
                                    <td>
                                        <Link to={`/clients/${clientId}/accounts/${acc.id}`} className="details-link">
                                            {acc.account_number}
                                        </Link>
                                    </td>
                                    <td>
                                        <span className="badge">{acc.type}</span>
                                    </td>
                                    <td className="balance">
                                        {acc.balance.toLocaleString()}
                                    </td>
                                    <td>{acc.currency}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    ) : (
                        <p>Klijent nema račune.</p>
                    )}
                </div>
            </div>
        </div>
    );
}