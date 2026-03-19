import { useState } from "react"
import "./LoanApplicationPage.css"

export default function CreateLoanRequestPage(){

  const [amount,setAmount] = useState("")
  const [period,setPeriod] = useState("")
  const [monthlyRate,setMonthlyRate] = useState(null)
  const [error,setError] = useState("")
  const [success,setSuccess] = useState("")
  const [loading,setLoading] = useState(false)

  const calculateRate = (a,p)=>{
    if(a>0 && p>0){
      setMonthlyRate((a/p).toFixed(2))
    }else{
      setMonthlyRate(null)
    }
  }

  const mockLoanRequest = (data)=>{
    return new Promise((resolve,reject)=>{
      setTimeout(()=>{
        if(data.amount && data.period){
          resolve({status:"ok"})
        }else{
          reject(new Error("Greška prilikom slanja zahteva"))
        }
      },900)
    })
  }

  const handleSubmit = async (e)=>{
    e.preventDefault()

    setError("")
    setSuccess("")

    if(!amount || !period){
      setError("Sva polja su obavezna.")
      return
    }

    if(amount <= 0 || period <= 0){
      setError("Vrednosti moraju biti veće od nule.")
      return
    }

    try{
      setLoading(true)

      await mockLoanRequest({
        amount:Number(amount),
        period:Number(period)
      })

      setSuccess("Zahtev za kredit je uspešno podnet.")
      setAmount("")
      setPeriod("")
      setMonthlyRate(null)

    }catch(err){
      setError(err.message)
    }finally{
      setLoading(false)
    }
  }

  const handleAmountChange = (value)=>{
    setAmount(value)
    calculateRate(value,period)
  }

  const handlePeriodChange = (value)=>{
    setPeriod(value)
    calculateRate(amount,value)
  }

  return(
    <div className="loan-page">

      <h1 className="loan-title">
        Podnošenje zahteva za kredit
      </h1>

      <div className="loan-grid">

        <div className="loan-card">

          <form className="loan-form" onSubmit={handleSubmit}>

            <input
              type="number"
              placeholder="Iznos kredita"
              value={amount}
              onChange={(e)=>handleAmountChange(e.target.value)}
            />

            <input
              type="number"
              placeholder="Period otplate (meseci)"
              value={period}
              onChange={(e)=>handlePeriodChange(e.target.value)}
            />

            {monthlyRate &&
              <div className="loan-rate">
                Procena mesečne rate: <strong>{monthlyRate} €</strong>
              </div>
            }

            <button
              className="loan-submit"
              disabled={loading}
            >
              {loading ? "Slanje..." : "Podnesi zahtev"}
            </button>

          </form>

          {error && <div className="loan-error">{error}</div>}
          {success && <div className="loan-success">{success}</div>}

        </div>

      </div>

    </div>
  )
}