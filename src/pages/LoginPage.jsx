import { useState } from "react";
import { login } from "../services/AuthService";
import "./LoginPage.css";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setMessage("Unesite email i lozinku");
      return;
    }

    if (!email.includes("@")) {
      setMessage("Email nije validan");
      return;
    }

    try {
      const data = await login(email, password);

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("userId", data.userId);

      setMessage("Uspešno logovanje");
      navigate("/employees");
    } catch (err) {
      if (err.response) {
        if (err.response.status === 401) {
          setMessage("Pogrešan email ili lozinka");
        } else {
          setMessage("Greška pri prijavljivanju. Pokušajte ponovo.");
        }
      } else if (err.request) {
        setMessage("Greška u konekciji sa serverom");
      } else {
        setMessage(err.message || "Nepoznata greška");
      }
    }
  };

  const handleForgotPassword = () => {
    navigate("/change-password");
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-brand">
          <div className="login-brand-icon">B</div>
          <h1>Banka</h1>
          <p>Prijavite se na vaš nalog</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">EMAIL</label>
            <div className="input-wrapper">
              <span className="input-icon">✉</span>
              <input
                id="email"
                type="email"
                placeholder="unesite adresu..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="password">LOZINKA</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                id="password"
                type="password"
                placeholder="unesite lozinku..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="input-icon right">👁</span>
            </div>
          </div>

          <button type="submit" className="login-button">
            Prijavi se
          </button>

          <p className="forgot-password" onClick={handleForgotPassword}>
            Zaboravili ste lozinku?
          </p>

          {message && <p className="message">{message}</p>}
        </form>

        <p className="login-footer">Banka 2026 • Računarski fakultet</p>
      </div>
    </div>
  );
}