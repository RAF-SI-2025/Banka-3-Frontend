import { useEffect, useState } from "react"
import { getOptions } from "../services/OptionsService"
import "./StockOptionsTable.css"

export default function StockOptionsTable({ onSelectOption }){

  const [data,setData] = useState([])
  const [price,setPrice] = useState(0)
  const [sort,setSort] = useState("asc")
  const [limit,setLimit] = useState(5)
  const [loading,setLoading] = useState(true)
  const [selectedStrike,setSelectedStrike] = useState(null)

  useEffect(()=>{
    getOptions().then(res=>{
      setData(res.options)
      setPrice(res.currentPrice)
      setLoading(false)
    })
  },[])

  const sorted = [...data]
    .sort((a,b)=> sort==="asc" ? a.strike - b.strike : b.strike - a.strike)
    .slice(0,limit)

  const getClass = (strike)=>{
    if(strike < price) return "itm"
    if(strike > price) return "otm"
    return "atm"
  }

  if(loading){
    return <div className="options-page">Loading...</div>
  }

  return(
    <div className="options-page">

      <h1 className="options-title">Options Table</h1>

      <div className="options-header">

        <div className="stock-price-box">
          <span>Current Price</span>
          <strong>{price} $</strong>
        </div>

        <div style={{display:"flex",gap:"10px"}}>

          <div className="options-filter">
            <label>Sort</label>
            <select value={sort} onChange={(e)=>setSort(e.target.value)}>
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>

          <div className="options-filter">
            <label>Limit</label>
            <select value={limit} onChange={(e)=>setLimit(Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>

        </div>

      </div>

      <div className="options-table-wrapper">

        <table className="options-table">

          <thead>
            <tr>
              <th colSpan="4">CALL OPTIONS</th>
              <th>STRIKE</th>
              <th colSpan="4">PUT OPTIONS</th>
            </tr>
            <tr>
              <th>Bid</th>
              <th>Ask</th>
              <th>Volume</th>
              <th>OI</th>
              <th></th>
              <th>Bid</th>
              <th>Ask</th>
              <th>Volume</th>
              <th>OI</th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((r,i)=>(
              <tr
                key={i}
                onClick={()=>{
                  setSelectedStrike(r.strike)
                  onSelectOption && onSelectOption(r)
                }}
                className={selectedStrike === r.strike ? "selected-row" : ""}
              >

                {/* CALL */}
                <td>{r.call.bid}</td>
                <td>{r.call.ask}</td>
                <td>{r.call.volume}</td>
                <td>{r.call.openInterest}</td>

                {/* STRIKE */}
                <td className={`strike ${getClass(r.strike)}`}>
                  {r.strike}
                </td>

                {/* PUT */}
                <td>{r.put.bid}</td>
                <td>{r.put.ask}</td>
                <td>{r.put.volume}</td>
                <td>{r.put.openInterest}</td>

              </tr>
            ))}
          </tbody>

        </table>

      </div>

    </div>
  )
}