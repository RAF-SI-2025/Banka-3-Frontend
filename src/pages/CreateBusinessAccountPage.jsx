import { useState } from "react";
import "./CreateBusinessAccountPage.css";
import BusinessService from "../services/BusinessService";

const CreateBusinessAccountPage = () => {
  const [form, setForm] = useState({
    name: "",
    pib: "",
    registrationNumber: "",
    activityCode: "",
    address: "",
  });

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const validate = () => {
    let newErrors = {};

    if (!form.name) newErrors.name = "Naziv kompanije je obavezan";
    if (!form.pib || form.pib.length !== 9)
      newErrors.pib = "PIB mora imati 9 cifara";
    if (!form.registrationNumber)
      newErrors.registrationNumber = "Matični broj je obavezan";
    if (!form.activityCode)
      newErrors.activityCode = "Šifra delatnosti je obavezna";
    if (!form.address)
      newErrors.address = "Adresa je obavezna";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await BusinessService.createBusinessAccount(form);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Greška pri kreiranju računa");
    }
  };

  if (success) {
    return (
      <div className="business-container">
        <div className="card">
          <h2>✅ Uspešno kreiran poslovni račun</h2>
          <p>Vaša kompanija je registrovana.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="business-container">
      <div className="header">
        <div className="header-left">
          <h1>Poslovni račun</h1>
          <p>Otvorite novi račun za vašu kompaniju</p>
        </div>
        <div className="header-right">🔔</div>
      </div>

      <div className="form-wrapper">
        <div className="card">
          <h2>Podaci kompanije</h2>
          <p>Unesite osnovne informacije</p>

          <form className="form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="input-group full-width">
                <label>Naziv kompanije</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                />
                {errors.name && <span className="error">{errors.name}</span>}
              </div>

              <div className="input-group">
                <label>PIB</label>
                <input
                  name="pib"
                  value={form.pib}
                  onChange={handleChange}
                />
                {errors.pib && <span className="error">{errors.pib}</span>}
              </div>

              <div className="input-group">
                <label>Matični broj</label>
                <input
                  name="registrationNumber"
                  value={form.registrationNumber}
                  onChange={handleChange}
                />
                {errors.registrationNumber && (
                  <span className="error">{errors.registrationNumber}</span>
                )}
              </div>

              <div className="input-group">
                <label>Šifra delatnosti</label>
                <input
                  name="activityCode"
                  value={form.activityCode}
                  onChange={handleChange}
                />
                {errors.activityCode && (
                  <span className="error">{errors.activityCode}</span>
                )}
              </div>

              <div className="input-group full-width">
                <label>Adresa</label>
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                />
                {errors.address && (
                  <span className="error">{errors.address}</span>
                )}
              </div>
            </div>

            <button type="submit" className="submit-btn">
              Kreiraj račun
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateBusinessAccountPage;