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

    if (!email.includes("@")){
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

  const handleForgotPassword = async () => {
      navigate("/change-password");
  };

  return (
    <div className="login-container">
      <div className="overlay">

        <img src="/bank-logo.png" className="logo" alt="Bank logo" />

        <form className="login-form" onSubmit={handleSubmit}>
          <h2>Ulogujte se</h2>

          <label>email</label>
          <input
            type="email"
            placeholder="unesite adresu..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>lozinka</label>
          <input
            type="password"
            placeholder="unesite lozinku..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <p className="forgot-password" onClick={handleForgotPassword}>
            zaboravili ste lozinku?
          </p>

          <button type="submit">Potvrdi</button>

          {message && <p className="message">{message}</p>}
        </form>

      </div>
    </div>
  );
}