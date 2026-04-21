import "./OrderDialog.css"

export default function OrderDialog({ order, onConfirm, onCancel }){

  if(!order) return null

  return(
    <div className="dialog-overlay">

      <div className="dialog-box">

        <h3>Confirm Order</h3>

        <p>Type: {order.type}</p>
        <p>Quantity: {order.quantity}</p>
        <p>Price: {order.price}</p>
        <p>Total: {order.quantity * order.price}</p>

        <div className="dialog-actions">
          <button className="confirm-btn" onClick={onConfirm}>Confirm</button>
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
        </div>

      </div>

    </div>
  )
}