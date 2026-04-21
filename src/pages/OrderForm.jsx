import { useState, useEffect } from "react"
import "./OrderForm.css"

export default function OrderForm({ onSubmit, selectedOption }){

  const [quantity,setQuantity] = useState(1)
  const [limit,setLimit] = useState("")
  const [stop,setStop] = useState("")

  // 🔥 AUTO FILL kada klikneš na tabelu
  useEffect(()=>{
    if(selectedOption){
      setLimit(selectedOption.strike)
      setStop("")
    }
  },[selectedOption])

  const getType = ()=>{
    if(limit && stop) return "Stop-Limit"
    if(limit) return "Limit"
    if(stop) return "Stop"
    return "Market"
  }

  const price = limit || stop || 100

  return(
    <div className="order-form">

      <h2>Create Order</h2>

      {selectedOption && (
        <div className="order-selected">
          Selected strike: {selectedOption.strike}
        </div>
      )}

      <input
        type="number"
        value={quantity}
        onChange={e=>setQuantity(e.target.value)}
        placeholder="Quantity"
      />

      <input
        type="number"
        value={limit}
        onChange={e=>setLimit(e.target.value)}
        placeholder="Limit value"
      />

      <input
        type="number"
        value={stop}
        onChange={e=>setStop(e.target.value)}
        placeholder="Stop value"
      />

      <div className="order-info">
        <p>Type: {getType()}</p>
        <p>Approx price: {price}</p>
      </div>

      <button onClick={()=>onSubmit({
        quantity,
        type: getType(),
        price,
        strike: selectedOption?.strike
      })}>
        Submit Order
      </button>

    </div>
  )
}