import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAccounts, getClients } from "../services/ClientService";
import "./AccountDetailsPage.css";

export default function AccountDetailsPage() {
    const { clientId, accountId } = useParams();

    const [account, setAccount] = useState(null);
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    useEffect(() => {
        if (!accountId || !clientId) return;

        let cancelled = false;

        const loadData = async () => {
            try {
                setLoading(true);
                setPageError("");

                const [allAccounts, allClients] = await Promise.all([
                    getAccounts(),
                    getClients(),
                ]);

                const foundAccount = allAccounts.find(
                    (acc) =>
                        acc.id === Number(accountId) &&
                        acc.client_id === Number(clientId)
                );

                if (!foundAccount) {
                    if (!cancelled) {
                        setPageError("Račun nije pronađen!");
                        setLoading(false);
                    }
                    return;
                }

                const foundClient = allClients.find(
                    (c) => c.id === Number(clientId)
                );

                if (!cancelled) {
                    setAccount(foundAccount);
                    setClient(foundClient || null);
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
    }, [clientId, accountId]);

    if (loading) {
        return (
            <div className="page-bg">
                <div className="content-wrapper">
                    <div className="state-card">Učitavanje...</div>
                </div>
            </div>
        );
    }

    if (pageError || !account) {
        return (
            <div className="page-bg">
                <div className="content-wrapper">
                    <div className="state-card error-state">
                        {pageError || "Račun nije pronađen."}
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
                <div className="account-header-card">
                    <div className="account-avatar">
                        {account.type?.[0] || "R"}
                    </div>

                    <div>
                        <h2>Detalji računa</h2>
                        <p className="account-sub">{account.account_number}</p>
                    </div>
                </div>

                <div className="account-info-grid">
                    <div className="info-item">
                        <span>Tip računa</span>
                        <strong>
                            <span className="badge">{account.type}</span>
                        </strong>
                    </div>

                    <div className="info-item">
                        <span>Stanje</span>
                        <strong className="balance">
                            {account.balance.toLocaleString()} {account.currency}
                        </strong>
                    </div>

                    <div className="info-item">
                        <span>Valuta</span>
                        <strong>{account.currency}</strong>
                    </div>
                </div>

                <div className="owner-card">
                    <h3>Vlasnik računa</h3>

                    {client ? (
                        <div className="owner-info">
                            <p>
                                <span>Ime i prezime</span>
                                <strong>
                                    {client.first_name} {client.last_name}
                                </strong>
                            </p>
                            <p>
                                <span>Email</span>
                                <strong>{client.email}</strong>
                            </p>
                            <p>
                                <span>Telefon</span>
                                <strong>{client.phone}</strong>
                            </p>
                            <p>
                                <span>Adresa</span>
                                <strong>{client.address}</strong>
                            </p>
                        </div>
                    ) : (
                        <p>Podaci o klijentu nisu dostupni.</p>
                    )}
                </div>
            </div>
        </div>
    );
}