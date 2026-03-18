import { useState } from "react";
import { blockCard } from "../../services/CardService";
import { formatCardNumber } from "../../services/CardService";
import "./CardItem.css";

function CardItem({ card, account, isSelected, onSelect, onCardBlocked }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCVV, setShowCVV] = useState(false);

  const handleBlock = async () => {
    if (!window.confirm("Da li ste sigurni da želite da blokirate ovu karticu?")) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      await blockCard(card.cardNumber);
      onCardBlocked(card.id);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCardGradient = (cardName) => {
    switch (cardName) {
        case "Visa":
        return "linear-gradient(135deg, #1434CB 0%, #5cacee 100%)";
        case "Mastercard":
        return "linear-gradient(135deg, #EB001B 0%, #FF5F00 100%)";
        case "DinaCard":
        return "linear-gradient(135deg, #2C7F3A 0%, #52B788 100%)";
        case "American Express":
        return "linear-gradient(135deg, #006FCF 0%, #0088CC 100%)";
        default:
        return "linear-gradient(135deg, #333 0%, #666 100%)";
    }
  };

  const getCardLogo = (cardName) => {
    switch (cardName) {
        case "Visa":
        return "VISA";
        case "Mastercard":
        return "MASTERCARD";
        case "DinaCard":
        return "DINACARD";
        case "American Express":
        return "AMEX";
        default:
        return "CARD";
    }
  };

  return (
    <div className="card-item-wrapper">
      <div
        className={`card-item card-front ${isSelected ? "selected" : ""}`}
        style={{ background: getCardGradient(card.cardName) }}
        onClick={() => onSelect(card)}
      >
        <div className="card-header">
          <div className="card-logo-section">
            <span className="card-logo">{getCardLogo(card.cardName)}</span>
          </div>
          <div className="card-status-badge">
            <span className={`status-dot ${card.status.toLowerCase()}`}></span>
            <span className="status-text">{card.status}</span>
          </div>
        </div>

        <div className="card-chip">
          <div className="chip-pattern"></div>
        </div>

        <div className="card-number-section">
          <span className="card-number">
            {formatCardNumber(card.cardNumber)}
          </span>
        </div>

        <div className="card-footer">
          <div className="card-holder-info">
            <p className="card-label">Vlasnik kartice</p>
            <p className="card-value">{account?.accountHolder || "---"}</p>
          </div>
          <div className="card-expiry-info">
            <p className="card-label">Važi do</p>
            <p className="card-value">{card.expiryDate}</p>
          </div>
          <div className="card-cvv-info">
            <p className="card-label">CVV</p>
            <p className="card-value">
              {showCVV ? card.cvv : "***"}
            </p>
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="card-details-panel">
            <button
                className="close-details-btn"
                onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
                }}
            >
            ✕
            </button>
            <div className="details-container">
            <div className="details-section">
              <h3 className="section-title">Informacije o kartici</h3>

              <div className="detail-row">
                <span className="detail-label">Broj kartice:</span>
                <span className="detail-value">{card.cardNumber}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Tip kartice:</span>
                <span className="detail-value">{card.cardType}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Naziv:</span>
                <span className="detail-value">{card.cardName}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Račun:</span>
                <span className="detail-value">
                  {account?.accountName} - {account?.accountNumber}
                </span>
              </div>
            </div>

            <div className="details-section">
              <h3 className="section-title">Limit i dostupnost</h3>
              
              <div className="limit-card">
                <div className="limit-info">
                  <p className="limit-label">Dnevni limit</p>
                  <p className="limit-amount">
                    {(card.limit / 1000000).toFixed(2)} RSD
                  </p>
                </div>
                <div className="limit-bar">
                  <div className="limit-progress" style={{width: "75%"}}></div>
                </div>
                <p className="limit-text">Dostupno: {(card.limit * 0.25 / 1000000).toFixed(2)} RSD</p>
              </div>
            </div>

            <div className="details-section">
              <h3 className="section-title">Validnost</h3>
              
              <div className="detail-row">
                <span className="detail-label">Kreirana:</span>
                <span className="detail-value">{card.createdDate}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Važi do:</span>
                <span className="detail-value">{card.expiryDate}</span>
              </div>
            </div>

            <div className="details-section">
              <h3 className="section-title">Sigurnost</h3>
              
              <button 
                className="cvv-button"
                onClick={() => setShowCVV(!showCVV)}
              >
                {showCVV ? "Sakrij CVV" : "Prikaži CVV"}
              </button>

              {showCVV && (
                <div className="cvv-display">
                  <p className="cvv-label">CVV kod</p>
                  <p className="cvv-value">{card.cvv}</p>
                  <p className="cvv-warning">⚠️ Ne delite ni sa kim!</p>
                </div>
              )}
            </div>

            {error && (
              <div className="alert alert-error">
                <span className="alert-icon">⚠️</span>
                <span className="alert-text">{error}</span>
              </div>
            )}

            <div className="details-section action-section">
              {card.status === "Aktivna" && (
                <button 
                  className="action-btn block-btn"
                  onClick={handleBlock}
                  disabled={loading}
                >
                  {loading ? "⏳ Blokiranje..." : "🔒 Blokiraj Karticu"}
                </button>
              )}

              {card.status === "Blokirana" && (
                <div className="status-alert warning">
                  <span className="alert-icon">⚠️</span>
                  <div className="alert-content">
                    <p className="alert-title">Kartica je blokirana</p>
                    <p className="alert-message">
                      Kontaktirajte banku da je odblokira
                    </p>
                  </div>
                </div>
              )}

              {card.status === "Deaktivna" && (
                <div className="status-alert danger">
                  <span className="alert-icon">✗</span>
                  <div className="alert-content">
                    <p className="alert-title">Kartica je istekla</p>
                    <p className="alert-message">
                      Zatraži novu karticu
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CardItem;