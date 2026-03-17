import "./ClientTable.css";
import ClientRow from "./ClientRow.jsx";

export default function ClientTable({ clients }) {
    if (clients.length === 0) {
        return (
            <div className="no-results">
                <p>Nema klijenata koji odgovaraju vašoj pretrazi</p>
            </div>
        );
    }

    return (
        <table className="employee-table">
            <thead>
            <tr>
                <th>ID</th>
                <th>Ime</th>
                <th>Prezime</th>
                <th>Email</th>
                <th>Broj telefona</th>
                <th className="actions-header"></th>
            </tr>
            </thead>

            <tbody>
            {clients.map(client => (
                <ClientRow key={client.id} client={client} />
            ))}
            </tbody>
        </table>
    );
}