import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./BusinessDetailsPage.css";
import { getAccountDetails } from "../services/BusinessService";

const BusinessAccountDetailsPage = () => {
  const { id } = useParams();

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAccount();
  }, [id]);

  const fetchAccount = async () => {
    try {
      const data = await getAccountDetails(id);
      setAccount(data);
    } catch (err) {
      setError("Failed to load account data");
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount) =>
    new Intl.NumberFormat("sr-RS").format(amount);

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("sr-RS");

  if (loading) return <div className="business-loading">Loading...</div>;
  if (error) return <div className="business-loading">{error}</div>;

  return (
    <div className="business-container">
      <div className="header">
        <div>
          <p className="welcome">Dobrodošli,</p>
          <h1>{account.ownerName}</h1>
        </div>
        <div className="bell">🔔</div>
      </div>

      <div className="balance-card">
        <p>Ukupno stanje</p>
        <h2>{formatMoney(account.balance)} RSD</h2>

        <div className="actions">
          <button>Uplata</button>
          <button>Plaćanje</button>
          <button>Prenos</button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Firma</h3>
          <p><strong>{account.companyName}</strong></p>
          <p>PIB: {account.pib}</p>
          <p>{account.address}</p>
        </div>

        <div className="card">
          <h3>Vlasnik</h3>
          <p>{account.ownerName}</p>
          <p>{account.ownerEmail}</p>
        </div>
      </div>

      <div className="card transactions">
        <h3>Poslednje transakcije</h3>

        {account.transactions?.map((t, i) => (
          <div key={t.id || i} className="transaction">
            <div>
              <p className="desc">{t.description}</p>
              <span>{formatDate(t.date)}</span>
            </div>

            <div className={t.amount < 0 ? "negative" : "positive"}>
              {formatMoney(t.amount)} RSD
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessAccountDetailsPage;