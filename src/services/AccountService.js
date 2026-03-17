import api from "./api.js";

const USE_MOCK = true;

const MOCK_ACCOUNTS = [
    { id: 1, name: "Tekući račun", number: "265-0000000011234-56", balance: 347250, available: 335750, currency: "RSD" },
    { id: 2, name: "Devizni račun", number: "265-0000000011234-57", balance: 1840.5, available: 1840.5, currency: "EUR" },
    { id: 3, name: "Štedni račun", number: "265-0000000011234-58", balance: 120000, available: 120000, currency: "RSD" },
];

const MOCK_TRANSACTIONS = [
    { id: 1, accountId: 1, desc: "Mesečna rata kredita", date: "05.03.2025", amount: -15420 },
    { id: 2, accountId: 1, desc: "Uplata plate - IT Solutions doo", date: "01.03.2025", amount: 185000 },
    { id: 3, accountId: 1, desc: "Maxi Market - kupovina", date: "28.02.2025", amount: -3240.5 },
    { id: 4, accountId: 1, desc: "EPS - račun za struju", date: "25.02.2025", amount: -4580 },
    { id: 5, accountId: 1, desc: "Povraćaj poreza", date: "20.02.2025", amount: 12500 },
    { id: 6, accountId: 1, desc: "Telenor - mesečni račun", date: "18.02.2025", amount: -2890 },
    { id: 7, accountId: 2, desc: "Devizna uplata", date: "03.03.2025", amount: 500 },
];

export async function getAccounts() {
    if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 300));
        return MOCK_ACCOUNTS;
    }
    const response = await api.get("/accounts");
    return response.data;
}

export async function getAccountById(accountId) {
    if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 300));
        const found = MOCK_ACCOUNTS.find(a => a.id === accountId);
        if (!found) throw new Error("Račun nije pronađen.");
        return found;
    }
    const response = await api.get(`/accounts/${accountId}`);
    return response.data;
}

export async function getAccountTransactions(accountId) {
    if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 300));
        return MOCK_TRANSACTIONS.filter(t => t.accountId === accountId);
    }
    const response = await api.get(`/accounts/${accountId}/transactions`);
    return response.data;
}