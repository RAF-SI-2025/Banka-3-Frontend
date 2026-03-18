import { useNavigate } from "react-router-dom";
import "./ClientRow.css";

export default function ClientRow({ client }) {
    const navigate = useNavigate();

    function openClientDetails() {
        navigate(`/clients/${client.id}`);
    }

    return (
        <tr className="client-row">
            <td onClick={openClientDetails}>{client.id}</td>
            <td onClick={openClientDetails}>{client.first_name}</td>
            <td onClick={openClientDetails}>{client.last_name}</td>
            <td onClick={openClientDetails}>{client.email}</td>
            <td onClick={openClientDetails}>{client.phone}</td>
        </tr>
    );
}