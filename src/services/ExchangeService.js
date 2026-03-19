import api from "./api.js";

const USE_MOCK = true;

// Kursevi prema RSD kao baznoj valuti
const MOCK_RATES = {
    RSD: 1,
    EUR: 117.15,
    USD: 107.80,
    CHF: 121.45,
    GBP: 136.90,
};

export async function getExchangeRates() {
    if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 300));
        return MOCK_RATES;
    }
    const response = await api.get("/exchange-rates");
    return response.data;
}

export async function performExchange(fromCurrency, toCurrency, amount) {
    if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 500));
        const fromRate = MOCK_RATES[fromCurrency];
        const toRate = MOCK_RATES[toCurrency];
        const amountInRSD = amount * fromRate;
        const convertedAmount = amountInRSD / toRate;
        return {
            fromCurrency,
            toCurrency,
            originalAmount: amount,
            convertedAmount,
            rate: fromRate / toRate,
        };
    }
    const response = await api.post("/transactions/transfer", {
        from_account: fromCurrency,
        to_account: toCurrency,
        amount,
    });
    return response.data;
}
