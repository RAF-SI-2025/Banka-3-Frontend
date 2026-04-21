import { useState } from "react"
import StockOptionsTable from "./StockOptionsTable"
import OrderForm from "./OrderForm"
import OrderDialog from "./OrderDialog"
import { createOrder } from "../services/orderService"
import "./TradingPage.css"

export default function TradingPage(){

  const [order,setOrder] = useState(null)
  const [selectedOption,setSelectedOption] = useState(null)

  return(
    <div className="trading-page">

      <div className="trading-layout">

        <StockOptionsTable onSelectOption={setSelectedOption} />

        <OrderForm 
          selectedOption={selectedOption}
          onSubmit={(data)=>setOrder(data)} 
        />

      </div>

      <OrderDialog
        order={order}
        onConfirm={()=>{
          createOrder(order).then(()=>{
            setOrder(null)
          })
        }}
        onCancel={()=>setOrder(null)}
      />

    </div>
  )
}