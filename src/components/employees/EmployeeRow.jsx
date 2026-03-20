import { useNavigate } from "react-router-dom";
import "./EmployeeRow.css";

function EmployeeRow({ employee }) {
  const navigate = useNavigate();

  function openEmployeeDetails() {
    navigate(`/employees/${employee.id}`);
  }

  function openEditEmployee() {
    navigate(`/employees/edit/${employee.id}`);
  }

  return (
    <tr className="employee-row">
      <td className="cell-link" onClick={openEmployeeDetails}>{employee.id}</td>
      <td className="cell-link" onClick={openEmployeeDetails}>{employee.first_name}</td>
      <td className="cell-link" onClick={openEmployeeDetails}>{employee.last_name}</td>
      <td className="cell-link employee-email" onClick={openEmployeeDetails}>{employee.email}</td>
      <td className="cell-link">
        <span className="position-badge">{employee.position}</span>
      </td>

      <td className="actions">
        <button className="icon-btn edit-btn" onClick={openEditEmployee}>
          ✏️
        </button>

        <button className="icon-btn delete-btn">
          🗑
        </button>
      </td>
    </tr>
  );
}

export default EmployeeRow;