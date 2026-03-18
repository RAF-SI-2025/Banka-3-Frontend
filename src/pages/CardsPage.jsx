import { useEffect, useState } from "react";
import { getUserCards, getUserAccounts } from "../services/CardService";
import { getCurrentUserId } from "../services/AuthService";
import CardsList from "../components/cards/CardsList";
import CreateCardForm from "../components/cards/CreateCardForm";
import { useNavigate } from "react-router-dom";
import "./CardsPage.css";

function CardsPage() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState(null);
  const [cards, setCards] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("list");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const userId = getCurrentUserId();
    
    if (!userId) {
      navigate("/login");
      return;
    }

    setCurrentUserId(userId);
    loadData(userId);
  }, [navigate]);

  const loadData = async (userId) => {
    try {
      setLoading(true);
      const [cardsData, accountsData] = await Promise.all([
        getUserCards(parseInt(userId)),
        getUserAccounts(parseInt(userId))
      ]);
      
      const filteredCards = cardsData.filter(card => {
        const account = accountsData.find(a => a.accountNumber === card.accountNumber);
        return account !== undefined;
      });
      
      setCards(filteredCards);
      setAccounts(accountsData);
    } catch (error) {
      setMessage("Greška pri učitavanju podataka: " + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardCreated = (newCard, updatedAccounts) => {
    setCards([...cards, newCard]);
    setAccounts(updatedAccounts);
    setMessage("✅ Kartica je uspešno kreirana!");
    setActiveTab("list");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleCardBlocked = (cardId) => {
    setCards(cards.map(card => 
      card.id === cardId ? { ...card, status: "Blokirana" } : card
    ));
    setMessage("🔒 Kartica je uspešno blokirana!");
    setTimeout(() => setMessage(""), 3000);
  };

  if (!currentUserId) {
    return <div className="loading">⏳ Učitavanje...</div>;
  }

  if (loading) {
    return <div className="loading">⏳ Učitavanje...</div>;
  }

  return (
    <div className="cards-page">
      <div className="cards-container">
        <h1>Moje kartice</h1>

        {message && <div className="message success">{message}</div>}

        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === "list" ? "active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            Sve kartice ({cards.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            Zatraži karticu
          </button>
        </div>

        {activeTab === "list" && (
          <CardsList 
            cards={cards} 
            accounts={accounts}
            onCardBlocked={handleCardBlocked}
            currentUserId={parseInt(currentUserId)}
          />
        )}

        {activeTab === "create" && (
          <CreateCardForm 
            accounts={accounts}
            onCardCreated={handleCardCreated}
            currentUserId={parseInt(currentUserId)}
          />
        )}
      </div>
    </div>
  );
}

export default CardsPage;