import { useState } from "react";
import CardItem from "./CardItem";
import "./CardsList.css";

function CardsList({ cards, accounts, onCardBlocked }) {
  const [selectedCard, setSelectedCard] = useState(null);

  if (cards.length === 0) {
    return (
      <div className="no-cards">
        <p>Nemate nijednu karticu</p>
        <p>Kreirajte novu karticu da biste započeli</p>
      </div>
    );
  }

  return (
    <div className="cards-list">
      <div className="cards-grid">
        {cards.map(card => (
          <CardItem
            key={card.id}
            card={card}
            account={accounts.find(a => a.accountNumber === card.accountNumber)}
            isSelected={selectedCard?.id === card.id}
            onSelect={setSelectedCard}
            onCardBlocked={onCardBlocked}
          />
        ))}
      </div>
    </div>
  );
}

export default CardsList;