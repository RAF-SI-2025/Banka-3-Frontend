import { useNavigate } from "react-router-dom";
import "./ClientRow.css";

export default function ClientRow({ client }) {
    const navigate = useNavigate();

    function openEmployeeDetails() {
        navigate(`/clients/${client.id}`);
    }

    return (
        <tr className="client-row">
            <td onClick={openEmployeeDetails}>{client.id}</td>
            <td onClick={openEmployeeDetails}>{client.first_name}</td>
            <td onClick={openEmployeeDetails}>{client.last_name}</td>
            <td onClick={openEmployeeDetails}>{client.email}</td>
            <td onClick={openEmployeeDetails}>{client.phone}</td>
        </tr>
    );
}