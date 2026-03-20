import { useState } from "react";
import { createEmployee, updateEmployee, getEmployees } from "../services/EmployeeService";
import { PERMISSIONS } from "../constants/permissions";
import "./CreateEmployeePage.css";
import "../pages/EmployeesPage.css";
import { useNavigate } from "react-router-dom";
import MenuDropdown from "../components/MenuDropdown";

function validate(form) {
  const errors = {};

  if (!form.ime.trim()) errors.ime = "Ime je obavezno.";
  if (!form.prezime.trim()) errors.prezime = "Prezime je obavezno.";
  if (!form.pol.trim()) errors.pol = "Pol je obavezan.";
  if (!form.username.trim()) errors.username = "Username je obavezan.";
  if (!form.adresa.trim()) errors.adresa = "Adresa je obavezna.";
  if (!form.department.trim()) errors.department = "Departman je obavezan.";


  if (!form.telefon.trim()) {
    errors.telefon = "Broj telefona je obavezan.";
  } else if (!/^\+?[\d\s\-()]{7,15}$/.test(form.telefon)) {
    errors.telefon = "Unesite ispravan broj telefona.";
  }

  if (!form.datum.trim()) {
    errors.datum = "Datum rođenja je obavezan.";
  } else if (!/^\d{2}\.\d{2}\.\d{4}$/.test(form.datum)) {
    errors.datum = "Format: DD.MM.GGGG";
  }

  if (!form.email.trim()) {
    errors.email = "Email je obavezan.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = "Unesite ispravan email.";
  }

  if (!form.pozicija.trim()) errors.pozicija = "Pozicija je obavezna.";

  return errors;
}

const EMPTY = {
  ime: "",
  prezime: "",
  pol: "",
  username: "",
  adresa: "",
  telefon: "",
  datum: "",
  email: "",
  pozicija: "",
  department: "",
  permissions: [],
};

export default function CreateEmployeePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  function handlePermissionToggle(value) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(value)
        ? prev.permissions.filter((p) => p !== value)
        : [...prev.permissions, value],
    }));
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

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
      let dateOfBirth = 0;

      if (form.datum) {
        const [dd, mm, yyyy] = form.datum.split(".");
        dateOfBirth = Math.floor(new Date(`${yyyy}-${mm}-${dd}`).getTime() / 1000);
      }

      const response = await createEmployee({
        firstName: form.ime,
        lastName: form.prezime,
        dateOfBirth,
        gender: form.pol,
        email: form.email,
        phoneNumber: form.telefon,
        address: form.adresa,
        username: form.username,
        position: form.pozicija,
        department: form.department,
      });

      if (form.permissions.length > 0) {
        try {
          const employees = await getEmployees({ email: form.email });
          const created = Array.isArray(employees)
            ? employees.find((e) => e.email === form.email)
            : null;

          if (!created) throw new Error("Nije moguće pronaći kreiranog zaposlenog.");

          await updateEmployee(created.id, {
            firstName: form.ime,
            lastName: form.prezime,
            gender: form.pol,
            phoneNumber: form.telefon,
            address: form.adresa,
            position: form.pozicija,
            department: "form.department",
            active: true,
            permissions: form.permissions,
          });
        } catch {
          setSuccessMsg(
            "Zaposleni je uspešno kreiran, ali dodela permisija nije uspela. Molimo izmenite ga ručno."
          );
          setForm(EMPTY);
          setErrors({});
          return;
        }
      }

      setSuccessMsg("Zaposleni uspešno kreiran. Email za aktivaciju naloga je poslat.");
      setForm(EMPTY);
      setErrors({});
    } catch (err) {
      setErrors({
        submit: err.response?.data?.error || "Greška pri kreiranju zaposlenog.",
      });
    } finally {
      setLoading(false);
    }
  }

  function field(label, name, type = "text", placeholder = "unesite...") {
    return (
      <div className="form-group">
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
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

  return (
    /*
      STARO:
      <div style={{ backgroundColor: "blue" }}>
      ... i unutra još jedan wrapper sa inline style

      NOVO:
      čist layout bez debug background-a i bez inline stilova
    */
    <div className="page-bg">
      <img src="/bank-logo.png" alt="logo" className="bank-logo" />
      <MenuDropdown />

      <div className="create-page">
        <div className="create-form-card">
          {/* STARO: samo h2 naslov */}
          {/* NOVO: isti header stil kao na ostalim ekranima */}
          <div className="create-header">
            <div className="create-header-text">
              <p className="create-eyebrow">KREIRANJE ZAPOSLENOG</p>
              <h1>Napravi novog korisnika</h1>
              <p className="create-subtitle">
                Unesite osnovne podatke, pristupne informacije i radnu poziciju zaposlenog.
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
            {/* STARO: običan row */}
            {/* NOVO: ostaje ista logika, samo dark stil */}
            <div className="form-row-three">
              {field("Ime", "ime")}
              {field("Prezime", "prezime")}
             <div className="form-group">
  <label htmlFor="pol">Pol</label>
  <select
    id="pol"
    name="pol"
    value={form.pol}
    onChange={handleChange}
    className={errors.pol ? "input-error" : ""}
  >
    <option value="">Izaberite pol</option>
    <option value="M">Muški</option>
    <option value="Z">Ženski</option>
  </select>
  {errors.pol && <span className="error-msg">{errors.pol}</span>}
</div>

            </div>

            <div className="form-grid">
              {field("Username", "username")}
              {field("Adresa", "adresa")}
              {field("Broj telefona", "telefon")}
              {field("Datum rođenja", "datum", "text", "DD.MM.GGGG")}
              {field("Email", "email", "email")}
              {field("Pozicija", "pozicija")}
              {field("Departman", "department")}

            </div>

            <div className="permissions-section">
              <label className="permissions-label">PERMISIJE</label>
              <div className="permissions-grid">
                {PERMISSIONS.map((perm) => (
                  <label key={perm.value} className="permission-checkbox">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(perm.value)}
                      onChange={() => handlePermissionToggle(perm.value)}
                    />
                    <span className="checkmark" />
                    <span className="permission-text">{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button
                className="create-btn create-btn-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "Slanje..." : "Potvrdi"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
