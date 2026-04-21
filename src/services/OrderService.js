// Mock order service — simulira backend

export const createOrder = (order) => {
  return new Promise((resolve, reject) => {

    console.log("Sending order:", order)

    setTimeout(() => {

      if (!order || !order.quantity || order.quantity <= 0) {
        reject({
          status: "ERROR",
          message: "Invalid order data"
        })
        return
      }

      resolve({
        status: "SUCCESS",
        orderId: Math.floor(Math.random() * 100000),
        executedPrice: order.price,
        total: order.quantity * order.price,
        timestamp: new Date().toISOString()
      })

    }, 700)
  })
}