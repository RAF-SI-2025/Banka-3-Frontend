import { useEffect, useState } from "react";
import ClientTable from "../components/clients/ClientTable.jsx";
import {
    filterClients,
    getAccounts,
    getClients,
} from "../services/ClientService.js";
import "./ClientsPage.css";

export default function ClientsPage() {
    const [search, setSearch] = useState("");
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accountType, setAccountType] = useState("");
    const [allClientsCount, setAllClientsCount] = useState(0);
    const [uniqueAccountTypes, setUniqueAccountTypes] = useState([]);

    useEffect(() => {
        async function loadInitialData() {
            try {
                const [allClients, allAccounts] = await Promise.all([
                    getClients(),
                    getAccounts(),
                ]);

                setAllClientsCount(allClients.length);
                setUniqueAccountTypes(
                    [...new Set(allAccounts.map((account) => account.type))].sort()
                );
            } catch (error) {
                console.error(error);
            }
        }

        loadInitialData().catch(console.error);
    }, []);

    useEffect(() => {
        async function fetchFilteredClients() {
            try {
                setLoading(true);
                const data = await filterClients(search, accountType);
                setClients(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }

        fetchFilteredClients().catch(console.error);
    }, [search, accountType]);

    function resetFilters() {
        setSearch("");
        setAccountType("");
    }

    return (
        <div className="page-bg">
            <img src="/bank-logo.png" alt="logo" className="bank-logo" />
            <img src="/menu-icon.png" alt="menu" className="menu-icon" />

            <div className="content-wrapper">
                <div className="client-card">
                    <div className="client-header">
                        <h3>Klijenti</h3>

                        <div className="header-controls">
                            <div className="search-wrapper">
                                <input
                                    className="search"
                                    placeholder="Pretraga"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <span className="search-icon">🔍</span>
                            </div>

                            <select
                                className="account-filter"
                                value={accountType}
                                onChange={(e) => setAccountType(e.target.value)}
                            >
                                <option value="">Svi tipovi računa</option>
                                {uniqueAccountTypes.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>

                            <button className="reset-btn" onClick={resetFilters}>
                                Reset
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <p>Učitavanje...</p>
                    ) : (
                        <div>
                            <div className="filter-info">
                                Pronađeno: <strong>{clients.length}</strong> / {allClientsCount} klijenata
                            </div>

                            <div className="table-container">
                                <ClientTable clients={clients} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}