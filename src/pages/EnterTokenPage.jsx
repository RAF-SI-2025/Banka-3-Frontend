import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
    <div className="business-container">
      <div className="card">
        <h2>Unesite token</h2>
        <p>Token vam je poslat na email adresu.</p>

        <form onSubmit={handleSubmit} className="form">
          <input
            placeholder="Unesite token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />

          <button type="submit">Potvrdi</button>
        </form>
      </div>
    </div>
  );
}