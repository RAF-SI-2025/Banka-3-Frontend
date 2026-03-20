import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ChangePasswordPage.css";

export default function EnterTokenPage() {
  const [token, setToken] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    navigate("/change-password", {
      state: { token },
    });
  };

  return (
    <div className="page-bg">
      <div className="cp-page">
        <div className="cp-card">
          <div className="cp-header">
            <div className="cp-header-text">
              <p className="cp-eyebrow">RESET LOZINKE</p>
              <h1 className="cp-title">Unesite token</h1>
              <p className="cp-subtitle">
                Token vam je poslat na email adresu. Unesite ga ispod kako biste nastavili sa promenom lozinke.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="cp-fields">
              <div className="cp-field">
                <label className="cp-label">Token</label>
                <input
                  className="cp-input"
                  type="text"
                  placeholder="unesite token iz emaila..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="cp-actions">
              <button type="submit" className="cp-btn cp-btn-primary">
                Potvrdi
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
