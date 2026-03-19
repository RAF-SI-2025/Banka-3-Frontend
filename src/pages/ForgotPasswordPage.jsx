import { useState } from "react";
import { requestPasswordReset } from "../services/AuthService";
import { useNavigate } from "react-router-dom";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await requestPasswordReset(email);

      navigate("/enter-token");
    } catch (err) {
      setMessage("Greška pri slanju tokena");
    }
  };

  return (
    <div className="business-container">
      <div className="card">
        <h2>Reset lozinke</h2>
        <p>Token vam je poslat na email adresu.</p>

        <form onSubmit={handleSubmit} className="form">
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button type="submit">Pošalji token</button>

          {message && <p className="error">{message}</p>}
        </form>
      </div>
    </div>
  );
}