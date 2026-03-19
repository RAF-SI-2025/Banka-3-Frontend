import { useState } from "react"
import "./AdminLoansPage.css"

export default function AdminLoansPage(){

  const initialLoans = [
    {id:1,client:"Marko Markovic",amount:12000,period:36,status:"PENDING"},
    {id:2,client:"Ana Petrovic",amount:5000,period:24,status:"APPROVED"},
    {id:3,client:"Nikola Ilic",amount:20000,period:60,status:"REJECTED"},
    {id:4,client:"Jovan Jovanovic",amount:8000,period:36,status:"PENDING"}
  ]

  const [loans,setLoans] = useState(initialLoans)
  const [filter,setFilter] = useState("ALL")
  const [selected,setSelected] = useState(null)

  const filteredLoans = loans.filter(l=>{
    if(filter==="ALL") return true
    return l.status===filter
  })

  const updateStatus = (id,status)=>{
    setLoans(loans.map(l=>{
      if(l.id===id){
        return {...l,status}
      }
      return l
    }))
    setSelected(null)
  }

  return(
    <div className="loan-page">

      <h1 className="loan-title">
        Administracija kreditnih zahteva
      </h1>

      <div className="loan-filter">
        <select
          value={filter}
          onChange={(e)=>setFilter(e.target.value)}
        >
          <option value="ALL">Svi zahtevi</option>
          <option value="PENDING">Na čekanju</option>
          <option value="APPROVED">Odobreni</option>
          <option value="REJECTED">Odbijeni</option>
        </select>
      </div>

      <div className="loan-grid">

        {filteredLoans.map(loan=>(
          <div
            key={loan.id}
            className="loan-card"
            onClick={()=>setSelected(loan)}
          >

            <div className={`loan-status ${loan.status}`}>
              {loan.status}
            </div>

            <div className="loan-amount">
              {loan.amount} €
            </div>

            <div className="loan-info">
              <div>
                <span>Klijent</span>
                <strong>{loan.client}</strong>
              </div>

              <div>
                <span>Period</span>
                <strong>{loan.period} meseci</strong>
              </div>
            </div>

          </div>
        ))}

      </div>

      {selected && (
        <div className="loan-details">

          <h2>Detalji zahteva</h2>

          <p><strong>Klijent:</strong> {selected.client}</p>
          <p><strong>Iznos:</strong> {selected.amount} €</p>
          <p><strong>Period:</strong> {selected.period} meseci</p>
          <p><strong>Status:</strong> {selected.status}</p>

          {selected.status==="PENDING" && (
            <div className="loan-actions">

              <button
                className="loan-approve"
                onClick={()=>updateStatus(selected.id,"APPROVED")}
              >
                Odobri
              </button>

              <button
                className="loan-reject"
                onClick={()=>updateStatus(selected.id,"REJECTED")}
              >
                Odbij
              </button>

            </div>
          )}

        </div>
      )}

    </div>
  )
}