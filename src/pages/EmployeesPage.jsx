import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import EmployeeTable from "../components/employees/EmployeeTable";
import { getEmployees } from "../services/EmployeeService";
import "./EmployeesPage.css";

function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const navigate = useNavigate();

  /*
    STARO:
    useEffect(() => {
      async function loadEmployees() {
        const data = await getEmployees();
        setEmployees(data);
      }
      loadEmployees();
    }, []);

    NOVO:
    Dok radiš UI bez backenda, ostavljamo mock podatke.
    Posle samo vrati stari useEffect.
  */
  useEffect(() => {
    const mockData = [
      {
        id: 1,
        first_name: "Ana",
        last_name: "Petrović",
        email: "ana@test.com",
        position: "Menadžer",
      },
      {
        id: 2,
        first_name: "Marko",
        last_name: "Marković",
        email: "marko@test.com",
        position: "Blagajnik",
      },
      {
        id: 3,
        first_name: "Jelena",
        last_name: "Jovanović",
        email: "jelena@test.com",
        position: "Admin",
      },
    ];

    setEmployees(mockData);
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

  return (
    /*
      STARO:
      page-bg je bio light / image based ekran

      NOVO:
      page-bg ostaje isto ime klase, ali CSS ga pravi dark i modernim
    */
    <div className="page-bg">
      {/* Za sada ostavljamo logo i menu kao što već koristiš */}
      <img src="/bank-logo.png" alt="logo" className="bank-logo" />
      <img src="/menu-icon.png" alt="menu" className="menu-icon" />

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

          {/*
            STARO:
            search, select i reset su bili podeljeni levo/desno
            pa je dolazilo do preklapanja

            NOVO:
            sve ide u jedan toolbar-row:
            [ search ][ select ][ reset ]
          */}
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