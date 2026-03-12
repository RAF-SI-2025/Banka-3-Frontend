import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getEmployeeById } from "../services/EmployeeService";
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
        if (!cancelled) setPageError(err.message || "Greška pri učitavanju zaposlenog.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
        <div className="page-bg">
          <div className="profile-page">
            <div className="profile-card">
              <p style={{ textAlign: "center", color: "#666" }}>Učitavanje...</p>
            </div>
          </div>
        </div>
    );
  }

  if (pageError || !employee) {
    return (
        <div className="page-bg">
          <div className="profile-page">
            <div className="profile-card">
              <p style={{ textAlign: "center", color: "#c00" }}>
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
        <img src="/menu-icon.png" alt="menu" className="menu-icon" />

        <div className="profile-page">
          <div className="profile-card">
            <h2 className="profile-title">Profil zaposlenog</h2>

            <div className="profile-body">
              {/* LEFT COLUMN */}
              <div className="profile-left">
                <div className="profile-avatar">
                  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="50" fill="#c8b99a" />
                    <circle cx="50" cy="38" r="18" fill="#8a7560" />
                    <ellipse cx="50" cy="90" rx="30" ry="22" fill="#8a7560" />
                  </svg>
                </div>

                <p className="profile-role">
                  {employee.role === "ADMIN" ? "Admin" : "Zaposleni"}
                </p>

                <div className="profile-left-fields">
                  <ProfileField label="Ime:" value={employee.firstName} />
                  <ProfileField label="Prezime:" value={employee.lastName} />
                  <ProfileField label="Datum rodjenja:" value={formatDate(employee.birthDate)} />
                  <ProfileField label="Pol:" value={employee.gender === "Male" ? "M" : "Ž"} />
                  <ProfileField label="JMBG:" value={employee.jmbg} />
                </div>
              </div>

              {/* VERTICAL DIVIDER */}
              <div className="profile-divider" />

              {/* RIGHT COLUMN */}
              <div className="profile-right">
                <ProfileField label="Adresa:" value={employee.address} />
                <ProfileField label="Email:" value={employee.email} />
                <ProfileField label="Broj telefona:" value={employee.phone} />
                <ProfileField label="Departman:" value={employee.department} />

                <div className="profile-field profile-field-active">
                  <span className="pf-label">Aktivan</span>
                  <span className="pf-checkbox">
                  {employee.active ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="1" y="1" width="18" height="18" rx="3" stroke="#5a4a3a" strokeWidth="1.5" fill="rgba(255,255,255,0.3)" />
                        <path d="M4 10l4 4 8-8" stroke="#5a4a3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                  ) : (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="1" y="1" width="18" height="18" rx="3" stroke="#5a4a3a" strokeWidth="1.5" fill="rgba(255,255,255,0.3)" />
                      </svg>
                  )}
                </span>
                </div>

                <div className="profile-actions">
                  <button
                      className="btn-uredi"
                      onClick={() => navigate(`/employees/${id}/change-password`)}
                  >
                    Promeni lozinku
                  </button>
                  <button
                      className="btn-uredi"
                      onClick={() => navigate(`/employees/edit/${id}`)}
                  >
                    Uredi profil
                  </button>
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

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}