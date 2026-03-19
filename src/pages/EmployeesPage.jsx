import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import EmployeeTable from "../components/employees/EmployeeTable";
import { getEmployees } from "../services/EmployeeService";
import MenuDropdown from "../components/MenuDropdown";
import "./EmployeesPage.css";

function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();

    async function loadEmployees() {
      try {
        const data = await getEmployees();
        if (!controller.signal.aborted) {
          setEmployees(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError("Greška pri učitavanju zaposlenih.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadEmployees();
    return () => controller.abort();
  }, []);

  const uniquePositions = useMemo(() => {
    return [...new Set(employees.map((emp) => emp.position))].sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch =
        employee.first_name.toLowerCase().includes(searchLower) ||
        employee.last_name.toLowerCase().includes(searchLower) ||
        employee.email.toLowerCase().includes(searchLower);

      const matchesPosition =
        !filterPosition || employee.position === filterPosition;

      return matchesSearch && matchesPosition;
    });
  }, [employees, searchTerm, filterPosition]);

  function openCreateEmployee() {
    navigate("/employees/create");
  }

  function handleResetFilters() {
    setSearchTerm("");
    setFilterPosition("");
  }

  if (loading) {
    return (
      <div className="page-bg">
        <img src="/bank-logo.png" alt="logo" className="bank-logo" />
        <MenuDropdown />
        <div className="content-wrapper">
          <p>Učitavanje...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-bg">
        <img src="/bank-logo.png" alt="logo" className="bank-logo" />
        <MenuDropdown />
        <div className="content-wrapper">
          <p style={{ color: "#e74c3c" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg">
      <img src="/bank-logo.png" alt="logo" className="bank-logo" />
      <MenuDropdown />

      <div className="content-wrapper">
        <div className="employee-card">
          {/* Gornji naslovni blok */}
          <div className="employee-topbar">
            <div className="employee-title-block">
              <p className="employee-eyebrow">UPRAVLJANJE ZAPOSLENIMA</p>
              <h1>Zaposleni</h1>
              <p className="employee-subtitle">
                Pregled, pretraga i upravljanje zaposlenima u sistemu.
              </p>
            </div>

            <button className="add-btn" onClick={openCreateEmployee}>
              + Dodaj zaposlenog
            </button>
          </div>

          <div className="employee-toolbar">
          <div className="toolbar-row">
            <div className="search-wrapper">
              <span className="search-icon">⌕</span>
              <input
                className="search"
                placeholder="Pretraga po imenu, prezimenu ili email-u"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="toolbar-actions">
            <select
              className="position-filter"
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
            >
              <option value="">Sve pozicije</option>
              {uniquePositions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>

            <button className="reset-btn" onClick={handleResetFilters}>
              Reset filtera
            </button>
          </div>
        </div>

          <div className="filter-info">
            Pronađeno: <strong>{filteredEmployees.length}</strong> /{" "}
            {employees.length} zaposlenih
          </div>

          <div className="table-container">
            <EmployeeTable employees={filteredEmployees} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeesPage;
