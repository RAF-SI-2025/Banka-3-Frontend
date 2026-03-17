import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import "./CreateEmployeePage.css";
import "./EmployeesPage.css";
import { getEmployeeById, updateEmployee } from "../services/EmployeeService";

function validate(form) {
  const errors = {};

  if (!form.prezime.trim()) errors.prezime = "Prezime je obavezno.";
  if (!form.pol.trim()) errors.pol = "Pol je obavezan.";

  if (!form.telefon.trim()) {
    errors.telefon = "Broj telefona je obavezan.";
  } else if (!/^\+?[\d\s\-()]{7,15}$/.test(form.telefon)) {
    errors.telefon = "Unesite ispravan broj telefona.";
  }

  if (!form.adresa.trim()) errors.adresa = "Adresa je obavezna.";
  if (!form.pozicija.trim()) errors.pozicija = "Pozicija je obavezna.";
  if (!form.departman.trim()) errors.departman = "Departman je obavezan.";

  return errors;
}

export default function EditEmployeePage() {
  const { id } = useParams();

  const [form, setForm] = useState({
    prezime: "", pol: "", telefon: "", adresa: "", pozicija: "", departman: "", aktivan: true,
  });
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getEmployeeById(Number(id))
      .then((employee) => {
        setForm({
          prezime: employee.lastName ?? "",
          pol: employee.gender ?? "",
          telefon: employee.phone ?? "",
          adresa: employee.address ?? "",
          pozicija: employee.position ?? "",
          departman: employee.department ?? "",
          aktivan: employee.active ?? true,
        });
      })
      .catch(() => {
        setNotFound(true);
      });
  }, [id]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccessMsg("");
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      await updateEmployee(Number(id), {
        lastName: form.prezime,
        gender: form.pol,
        phoneNumber: form.telefon,
        address: form.adresa,
        position: form.pozicija,
        department: form.departman,
        active: form.aktivan,
      });
      setSuccessMsg("Profil uspešno izmenjen.");
      setErrors({});
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || "Greška pri izmeni profila." });
    } finally {
      setLoading(false);
    }
  }

  function field(label, name, type = "text", placeholder = "unesite...") {
    return (
      <div className="form-group">
        <label>{label}</label>
        <input
          type={type}
          name={name}
          value={form[name]}
          onChange={handleChange}
          placeholder={placeholder}
          className={errors[name] ? "input-error" : ""}
        />
        {errors[name] && <span className="error-msg">{errors[name]}</span>}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page-bg">
        <img src="/bank-logo.png" alt="logo" className="bank-logo" />
        <img src="/menu-icon.png" alt="menu" className="menu-icon" />
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "80px" }}>
          <div className="create-form-card">
            <h2>Zaposleni nije pronađen.</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg">
      <img src="/bank-logo.png" alt="logo" className="bank-logo" />
      <img src="/menu-icon.png" alt="menu" className="menu-icon" />
      <div style={{ display: "flex", alignItems: "flex-start", paddingTop: "40px" }}>
        <form className="create-form-card" onSubmit={handleSubmit} noValidate>
          <h2>Uredi profil</h2>

          {successMsg && <div className="success-msg">{successMsg}</div>}
          {errors.submit && <div className="error-msg">{errors.submit}</div>}

          {/* Prezime — full width */}
          <div style={{ marginBottom: "14px" }}>
            {field("Prezime:", "prezime", "text", "unesite adresu...")}
          </div>

          {/* Pol + Broj telefona — two columns */}
          <div className="form-row-two" style={{ marginBottom: "14px" }}>
            {field("Pol:", "pol", "text", "unesite lozinku...")}
            {field("Broj telefona:", "telefon", "text", "unesite lozinku...")}
          </div>

          {/* Adresa — full width */}
          <div style={{ marginBottom: "14px" }}>
            {field("Adresa:", "adresa", "text", "unesite adresu...")}
          </div>

          {/* Pozicija — full width */}
          <div style={{ marginBottom: "14px" }}>
            {field("Pozicija:", "pozicija", "text", "unesite adresu...")}
          </div>

          {/* Departman — full width */}
          <div style={{ marginBottom: "14px" }}>
            {field("Departman:", "departman", "text", "unesite lozinku...")}
          </div>

          {/* Aktivan checkbox */}
          <div className="form-group" style={{ marginBottom: "20px" }}>
            <label className="checkbox-label">
              Aktivan
              <input
                type="checkbox"
                name="aktivan"
                checked={form.aktivan}
                onChange={handleChange}
              />
              <span className="checkbox-box">{form.aktivan ? "✓" : ""}</span>
            </label>
          </div>

          <div className="form-actions">
            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? "Slanje..." : "Izmeni profil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
