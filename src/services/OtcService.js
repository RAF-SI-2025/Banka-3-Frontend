export async function getPublicStocks() {
    // MOCK za sada - zameniti api.get(...) kada backend doda endpoint
    return [
        { id: 1, ticker: "AAPL", amount: 50, price: 22000, seller_bank: "Raiffeisen" },
        { id: 2, ticker: "TSLA", amount: 20, price: 31000, seller_bank: "Intesa" },
        { id: 3, ticker: "NVDA", amount: 10, price: 45000, seller_bank: "OTP" },
    ];
}