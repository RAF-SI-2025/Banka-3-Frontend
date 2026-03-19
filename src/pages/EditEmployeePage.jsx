import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./CreateEmployeePage.css";
import "./EmployeesPage.css";
import { getEmployeeById, updateEmployee } from "../services/EmployeeService";
import MenuDropdown from "../components/MenuDropdown";

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
  const navigate = useNavigate();

  const [form, setForm] = useState({
    prezime: "",
    pol: "",
    telefon: "",
    adresa: "",
    pozicija: "",
    departman: "",
    aktivan: true,
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
      .catch(() => setNotFound(true));
  }, [id]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
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
      setErrors({
        submit: err.response?.data?.error || "Greška pri izmeni profila.",
      });
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
        <img src="/bank-logo.png" className="bank-logo" />
        <MenuDropdown />

        <div className="create-page">
          <div className="create-form-card">
            <p className="submit-error">Zaposleni nije pronađen.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg">
      <img src="/bank-logo.png" className="bank-logo" />
      <MenuDropdown />

      <div className="create-page">
        <div className="create-form-card">

          {/* HEADER */}
          <div className="create-header">
            <div className="create-header-text">
              <p className="create-eyebrow">IZMENA PROFILA</p>
              <h1>Uredi zaposlenog</h1>
              <p className="create-subtitle">
                Izmenite osnovne podatke i status zaposlenog.
              </p>
            </div>

            <div className="create-header-actions">
              <button
                type="button"
                className="create-btn create-btn-secondary"
                onClick={() => navigate("/employees")}
              >
                Nazad
              </button>
            </div>
          </div>

          {successMsg && <div className="success-msg">{successMsg}</div>}
          {errors.submit && <div className="submit-error">{errors.submit}</div>}

          <form onSubmit={handleSubmit} noValidate>

            <div style={{ marginBottom: "16px" }}>
              {field("Prezime", "prezime")}
            </div>

            <div className="form-row-two" style={{ marginBottom: "16px" }}>
              {field("Pol", "pol")}
              {field("Broj telefona", "telefon")}
            </div>

            <div style={{ marginBottom: "16px" }}>
              {field("Adresa", "adresa")}
            </div>

            <div style={{ marginBottom: "16px" }}>
              {field("Pozicija", "pozicija")}
            </div>

            <div style={{ marginBottom: "16px" }}>
              {field("Departman", "departman")}
            </div>

            <div className="form-group" style={{ marginBottom: "24px" }}>
              <label className="checkbox-label">
                Aktivan
                <input
                  type="checkbox"
                  name="aktivan"
                  checked={form.aktivan}
                  onChange={handleChange}
                />
                <span className="checkbox-box">
                  {form.aktivan ? "✓" : ""}
                </span>
              </label>
            </div>

            <div className="form-actions">
              <button
                className="create-btn create-btn-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "Čuvanje..." : "Sačuvaj izmene"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}