import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getEmployeeById } from "../services/EmployeeService";
import MenuDropdown from "../components/MenuDropdown";
import "./EmployeeDetailsPage.css";

export default function EmployeeDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const load = async () => {
      try {
        const data = await getEmployeeById(Number(id));
        if (!cancelled) setEmployee(data);
      } catch (err) {
        if (!cancelled) {
          setPageError(err.message || "Greška pri učitavanju zaposlenog.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /*
    STARO:
    loading i error su bili samo običan tekst u staroj bež kartici

    NOVO:
    isti dark card stil kao EmployeesPage
  */
  if (loading) {
    return (
      <div className="page-bg">
        <img src="/bank-logo.png" alt="logo" className="bank-logo" />
        <MenuDropdown />

        <div className="profile-page">
          <div className="profile-card profile-state-card">
            <p className="profile-state-text">Učitavanje...</p>
          </div>
        </div>
      </div>
    );
  }

  if (pageError || !employee) {
    return (
      <div className="page-bg">
        <img src="/bank-logo.png" alt="logo" className="bank-logo" />
        <MenuDropdown />

        <div className="profile-page">
          <div className="profile-card profile-state-card">
            <p className="profile-state-text error">
              {pageError || "Zaposleni nije pronađen."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg">
      <img src="/bank-logo.png" alt="logo" className="bank-logo" />
      <MenuDropdown />

      <div className="profile-page">
        <div className="profile-card">
          {/* STARO: samo naslov "Profil zaposlenog" */}
          {/* NOVO: uvodni blok kao na EmployeesPage */}
          <div className="profile-header">
            <div className="profile-header-text">
              <p className="profile-eyebrow">DETALJI ZAPOSLENOG</p>
              <h1 className="profile-title">Profil zaposlenog</h1>
              <p className="profile-subtitle">
                Pregled osnovnih podataka, statusa i kontakt informacija zaposlenog.
              </p>
            </div>

            <div className="profile-header-actions">
              <button
                className="profile-btn profile-btn-secondary"
                onClick={() => navigate("/employees")}
              >
                Nazad
              </button>

              <button
                className="profile-btn profile-btn-primary"
                onClick={() => navigate(`/employees/edit/${id}`)}
              >
                Uredi profil
              </button>
            </div>
          </div>

          {/* STARO: bež avatar blok i dva odvojena stuba */}
          {/* NOVO: dark overview kartica gore */}
          <div className="profile-overview-card">
            <div className="profile-overview-left">
              <div className="profile-avatar">
                <span>
                  {employee.firstName?.[0] || "A"}
                  {employee.lastName?.[0] || "P"}
                </span>
              </div>

              <div className="profile-main-info">
                <h2>
                  {employee.firstName} {employee.lastName}
                </h2>
                <p>{employee.username}</p>

                <div className="profile-meta-row">
                  <span className="role-badge">
                    {employee.position || "Zaposleni"}
                  </span>

                  <span
                    className={`status-badge ${
                      employee.active ? "is-active" : "is-inactive"
                    }`}
                  >
                    {employee.active ? "Aktivan" : "Neaktivan"}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* STARO: dva column layout sa dividerom */}
          {/* NOVO: info grid u dve kartice */}
          <div className="profile-grid">
            <div className="profile-info-card">
              <h3 className="section-title">Lični podaci</h3>

              <div className="profile-fields-grid">
                <ProfileField label="Ime" value={employee.firstName} />
                <ProfileField label="Prezime" value={employee.lastName} />
                <ProfileField
                  label="Datum rođenja"
                  value={formatDate(employee.dateOfBirth)}
                />
                <ProfileField
                  label="Pol"
                  value={employee.gender === "M" ? "Muški" : employee.gender === "F" ? "Ženski" : employee.gender}
                />
                <ProfileField
                  label="Uloga"
                  value={employee.position}
                />
              </div>
            </div>

            <div className="profile-info-card">
              <h3 className="section-title">Kontakt i posao</h3>

              <div className="profile-fields-grid">
                <ProfileField label="Adresa" value={employee.address} />
                <ProfileField label="Email" value={employee.email} />
                <ProfileField label="Broj telefona" value={employee.phone} />
                <ProfileField label="Departman" value={employee.department} />
                <ProfileField
                  label="Status"
                  value={employee.active ? "Aktivan" : "Neaktivan"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="profile-field">
      <span className="pf-label">{label}</span>
      <span className="pf-value">{value || "—"}</span>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  if (typeof value === "string") {
    const [y, m, d] = value.split("-");
    if (y && m && d) return `${parseInt(d)}/${parseInt(m)}/${y}`;
  }
  const d = new Date(typeof value === "number" ? value * 1000 : value);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
