import { useState } from "react";
import { requestPasswordReset } from "../services/AuthService";
import { useNavigate } from "react-router-dom";
import "./ChangePasswordPage.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setSuccessMessage("");

    try {
      await requestPasswordReset(email);
      setSuccessMessage("Token je poslat na vašu email adresu. Proverite inbox.");
      setTimeout(() => {
        navigate("/enter-token");
      }, 2000);
    } catch (err) {
      setMessage("Greška pri slanju tokena.");
    }
  };

  return (
    <div className="page-bg">
      <div className="cp-page">
        <div className="cp-card">
          <div className="cp-header">
            <div className="cp-header-text">
              <p className="cp-eyebrow">RESET LOZINKE</p>
              <h1 className="cp-title">Zaboravljena lozinka</h1>
              <p className="cp-subtitle">
                Unesite vašu email adresu i poslaćemo vam token za resetovanje lozinke.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="cp-fields">
              <div className="cp-field">
                <label className="cp-label">Email adresa</label>
                <input
                  className="cp-input"
                  type="email"
                  placeholder="unesite email adresu..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {message && <p className="cp-error">{message}</p>}
              {successMessage && <p className="cp-success">{successMessage}</p>}
            </div>

            <div className="cp-actions">
              <button type="submit" className="cp-btn cp-btn-primary">
                Pošalji token
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-secondary"
                onClick={() => navigate("/login")}
              >
                Nazad na login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
