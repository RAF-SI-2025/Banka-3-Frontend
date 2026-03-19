import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { confirmPasswordReset } from "../services/AuthService";
import { validatePasswordStrength } from "../utils/validators";
import "./ChangePasswordPage.css";
import "./EmployeesPage.css";

export default function ChangePasswordPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [strengthErrors, setStrengthErrors] = useState([]);
  const [matchError, setMatchError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    setSubmitError("");
    setMatchError("");

    const errors = validatePasswordStrength(newPassword);
    setStrengthErrors(errors);
    if (errors.length > 0) return;

    if (newPassword !== confirmPassword) {
      setMatchError("Lozinke se ne poklapaju.");
      return;
    }

    try {
      setSubmitting(true);

      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token") || "";

      await confirmPasswordReset(token, newPassword);

      setSuccessMessage("Lozinka uspešno promenjena.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Greška pri promeni lozinke."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <img src="/bank-logo.png" alt="logo" className="bank-logo" />
      <img src="/menu-icon.png" alt="menu" className="menu-icon" />

      {/* STARO: cp-page-center + cp-card sa bež karticom */}
      {/* NOVO: isti dark card sistem kao create/edit/details */}
      <div className="cp-page">
        <div className="cp-card">
          {/* STARO: samo naslov */}
          {/* NOVO: header blok kao na ostalim ekranima */}
          <div className="cp-header">
            <div className="cp-header-text">
              <p className="cp-eyebrow">PROMENA LOZINKE</p>
              <h1 className="cp-title">Promeni lozinku</h1>
              <p className="cp-subtitle">
                Unesite novu lozinku i potvrdu kako biste ažurirali pristup nalogu.
              </p>
            </div>

            <div className="cp-header-actions">
              <button
                type="button"
                className="cp-btn cp-btn-secondary"
                onClick={() => navigate(`/employees/${id}`)}
              >
                Nazad
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="cp-fields">
              <div className="cp-field">
                <label className="cp-label">Nova lozinka</label>
                <input
                  className={`cp-input ${strengthErrors.length > 0 ? "cp-input-error" : ""}`}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="unesite novu lozinku..."
                  required
                />
              </div>

              <div className="cp-field">
                <label className="cp-label">Potvrdite novu lozinku</label>
                <input
                  className={`cp-input ${matchError ? "cp-input-error" : ""}`}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="potvrdite novu lozinku..."
                  required
                />
              </div>

              {strengthErrors.length > 0 && (
                <div className="cp-error-box">
                  <strong>Lozinka mora sadržati:</strong>
                  <ul>
                    {strengthErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {matchError && <p className="cp-error">{matchError}</p>}
              {submitError && <p className="cp-error">{submitError}</p>}
              {successMessage && <p className="cp-success">{successMessage}</p>}
            </div>

            <div className="cp-actions">
              {/* STARO: cp-btn-back + cp-btn-submit */}
              {/* NOVO: shared dark/blue button family */}
              <button
                type="submit"
                className="cp-btn cp-btn-primary"
                disabled={submitting}
              >
                {submitting ? "Čuvanje..." : "Promeni lozinku"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}