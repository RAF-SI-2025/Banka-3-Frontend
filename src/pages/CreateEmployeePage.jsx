import { useState } from "react";
import { createEmployee } from "../services/EmployeeService";
import "./CreateEmployeePage.css";
import "../pages/EmployeesPage.css";

function validate(form) {
  const errors = {};

  if (!form.ime.trim()) errors.ime = "Ime je obavezno.";
  if (!form.prezime.trim()) errors.prezime = "Prezime je obavezno.";
  if (!form.pol.trim()) errors.pol = "Pol je obavezan.";
  if (!form.username.trim()) errors.username = "Username je obavezan.";
  if (!form.adresa.trim()) errors.adresa = "Adresa je obavezna.";

  if (!form.lozinka) {
    errors.lozinka = "Lozinka je obavezna.";
  } else if (form.lozinka.length < 6) {
    errors.lozinka = "Lozinka mora imati najmanje 6 karaktera.";
  }

  if (!form.potvrda) {
    errors.potvrda = "Potvrda lozinke je obavezna.";
  } else if (form.potvrda !== form.lozinka) {
    errors.potvrda = "Lozinke se ne podudaraju.";
  }

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
  ime: "", prezime: "", pol: "", username: "", adresa: "",
  lozinka: "", potvrda: "", telefon: "", datum: "", email: "", pozicija: "",
};

export default function CreateEmployeePage() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // clear error on edit
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
      // Parse DD.MM.YYYY to Unix timestamp
      let dateOfBirth = 0;
      if (form.datum) {
        const [dd, mm, yyyy] = form.datum.split(".");
        dateOfBirth = Math.floor(new Date(`${yyyy}-${mm}-${dd}`).getTime() / 1000);
      }

      await createEmployee({
        firstName: form.ime,
        lastName: form.prezime,
        dateOfBirth,
        gender: form.pol,
        email: form.email,
        phoneNumber: form.telefon,
        address: form.adresa,
        username: form.username,
        position: form.pozicija,
        department: "",
        password: form.lozinka,
      });
      setSuccessMsg("Zaposleni uspešno kreiran.");
      setForm(EMPTY);
      setErrors({});
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || "Greška pri kreiranju zaposlenog." });
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

  return (
    <div style={{ backgroundColor: "blue" }}>
      <div className="page-bg">
        <img src="/bank-logo.png" alt="logo" className="bank-logo" />
        <img src="/menu-icon.png" alt="menu" className="menu-icon" />
        <div style={{ display: "flex", alignItems: "flex-start", paddingTop: "40px" }}>
          <form className="create-form-card" onSubmit={handleSubmit} noValidate>
            <h2>Napravi novog korisnika</h2>

            {successMsg && <div className="success-msg">{successMsg}</div>}

            {/* Row 1: Ime, Prezime, Pol */}
            <div className="form-row-three">
              {field("Ime:", "ime")}
              {field("Prezime:", "prezime")}
              {field("Pol:", "pol")}
            </div>

            {/* Rows 2-5: two-column grid */}
            <div className="form-grid">
              {field("Username:", "username")}
              {field("Adresa:", "adresa")}
              {field("Lozinka:", "lozinka", "password")}
              {field("Broj telefona:", "telefon")}
              {field("Potvrda lozinke:", "potvrda", "password")}
              {field("Datum rodjenja:", "datum", "text", "DD.MM.GGGG")}
              {field("Email:", "email", "email")}
              {field("Pozicija:", "pozicija")}
            </div>

            <div className="form-actions">
              <button className="submit-btn" type="submit" disabled={loading}>
                {loading ? "Slanje..." : "Potvrdi"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
