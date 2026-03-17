import { useState } from "react";
import { requestCard, verifyCardRequest, getUserAccounts } from "../../services/CardService";
import "./CreateCardForm.css";

function CreateCardForm({ accounts, onCardCreated }) {
  const [step, setStep] = useState("select-account");
  const [formData, setFormData] = useState({ accountNumber: "" });
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedAccount, setSelectedAccount] = useState(null);

  const personalAccounts = accounts.filter(a => a.type === "personal");
  const businessAccounts = accounts.filter(a => a.type === "business");

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "accountNumber") {
      const account = accounts.find(a => a.accountNumber === value);
      setSelectedAccount(account);
      setFormData(prev => ({ ...prev, [name]: value }));
      setError("");
    }
  };

  const canRequestCard = () => {
    if (!selectedAccount) return false;
    const currentCards = selectedAccount.cardCount || 0;
    if (selectedAccount.type === "personal" && currentCards >= 2) return false;
    if (selectedAccount.type === "business" && currentCards >= 1) return false;
    return true;
  };

  const handleRequestCard = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.accountNumber) {
      setError("Trebate da izaberete račun");
      return;
    }

    if (!canRequestCard()) {
      const currentCards = selectedAccount.cardCount || 0;
      if (selectedAccount.type === "personal" && currentCards >= 2) {
        setError("❌ Lični račun može imati maksimalno 2 kartice.");
      } else {
        setError("❌ Poslovni račun može imati maksimalno 1 karticu.");
      }
      return;
    }

    try {
      setLoading(true);
      const response = await requestCard({
        accountNumber: formData.accountNumber,
        cardType: "Debit",
      });

      setSuccess("📧 Kartica je zatražena!");
      setStep("verify-code");

    } catch (err) {
      setError(err.message || "Greška pri zahtevanju kartice");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setLoading(true);

      const response = await verifyCardRequest({
        accountNumber: formData.accountNumber,
        verificationCode: verificationCode,
      });

      setSuccess("✅ " + response.message);
      
      setTimeout(async () => {
        const updatedAccounts = await getUserAccounts();
        onCardCreated(response, updatedAccounts);
        
        setFormData({ accountNumber: "" });
        setVerificationCode("");
        setStep("select-account");
        setSelectedAccount(null);
      }, 2000);

    } catch (err) {
      setError(err.message || "Greška pri kreiranju kartice");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="create-card-form" onSubmit={
      step === "select-account" ? handleRequestCard : handleVerifyCode
    }>
      <h2>Zatraži novu karticu</h2>

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {step === "select-account" && (
        <>
          <div className="form-group">
            <label htmlFor="accountNumber">Izaberite račun *</label>
            <select
              id="accountNumber"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">-- Izaberite račun --</option>

              {personalAccounts.length > 0 && (
                <optgroup label="Lični računi (Max 2 kartice)">
                  {personalAccounts.map(account => {
                    const canAdd = (account.cardCount || 0) < 2;
                    return (
                      <option 
                        key={account.id} 
                        value={account.accountNumber}
                        disabled={!canAdd}
                      >
                        {account.accountName} - {account.currency}
                        {!canAdd ? " (Popunjeno)" : ` (${account.cardCount}/2)`}
                      </option>
                    );
                  })}
                </optgroup>
              )}

              {businessAccounts.length > 0 && (
                <optgroup label="Poslovni računi (Max 1 kartica)">
                  {businessAccounts.map(account => {
                    const canAdd = (account.cardCount || 0) < 1;
                    return (
                      <option 
                        key={account.id} 
                        value={account.accountNumber}
                        disabled={!canAdd}
                      >
                        {account.accountName} - {account.currency}
                        {!canAdd ? " (Popunjeno)" : ` (${account.cardCount}/1)`}
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </div>

          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading || !formData.accountNumber || !canRequestCard()}
          >
            {loading ? "⏳ Slanje zahteva..." : "📧 Zatraži karticu"}
          </button>
        </>
      )}

      {step === "verify-code" && (
        <>
          <div className="email-sent-section">
            <div className="email-icon">📧</div>
            <p className="email-message">Kartica je zatražena!</p>
          </div>

          <div className="form-group verification-group">
            <label htmlFor="verificationCode">Kod (ako je potreban) *</label>
            <input
              id="verificationCode"
              type="text"
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              disabled={loading}
              className="code-input"
            />
          </div>

          <button 
            type="submit"
            className="submit-btn verify-btn"
            disabled={loading}
          >
            {loading ? "⏳ Kreiram karticu..." : "✓ Potvrdi"}
          </button>

          <button 
            type="button"
            className="cancel-btn"
            onClick={() => {
              setStep("select-account");
              setVerificationCode("");
              setError("");
            }}
            disabled={loading}
          >
            ← Nazad
          </button>
        </>
      )}
    </form>
  );
}

export default CreateCardForm;