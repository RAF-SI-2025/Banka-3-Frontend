import { useEffect, useState } from "react";
import "./LoanOverview.css";

export default function LoanOverview() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const mockLoans = [
    {
      id: 1,
      amount: 10000,
      repaymentPeriod: 60,
      monthlyInstallment: 210,
      status: "APPROVED"
    },
    {
      id: 2,
      amount: 5000,
      repaymentPeriod: 36,
      monthlyInstallment: 155,
      status: "PENDING"
    },
    {
      id: 3,
      amount: 8000,
      repaymentPeriod: 48,
      monthlyInstallment: 190,
      status: "REJECTED"
    }
  ];

  useEffect(() => {
    setTimeout(() => {
      setLoans(mockLoans);
      setLoading(false);
    }, 400);
  }, []);

  if (loading) {
    return <div>Učitavanje kredita...</div>;
  }

 return (
  <div className="loan-page">
    <h1 className="loan-title">Moji krediti</h1>

    <div className="loan-grid">
      {loans.map((loan) => (
        <div key={loan.id} className="loan-card">

          <div className={`loan-status ${loan.status}`}>
            {loan.status}
          </div>

          <div className="loan-amount">
            {loan.amount.toLocaleString()} €
          </div>

          <div className="loan-info">
            <div>
              <span>Rok otplate</span>
              <strong>{loan.repaymentPeriod} meseci</strong>
            </div>

            <div>
              <span>Mesečna rata</span>
              <strong>{loan.monthlyInstallment} €</strong>
            </div>
          </div>

        </div>
      ))}
    </div>
  </div>
)
}