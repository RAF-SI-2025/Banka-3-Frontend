import api from "./api.js";

const USE_MOCK = true;

const MOCK_ACCOUNTS = [
    { id: 1, name: "Tekući račun", number: "265-0000000011234-56", balance: 347250, available: 335750, currency: "RSD" },
    { id: 2, name: "Devizni račun", number: "265-0000000011234-57", balance: 1840.5, available: 1840.5, currency: "EUR" },
    { id: 3, name: "Štedni račun", number: "265-0000000011234-58", balance: 120000, available: 120000, currency: "RSD" },
];

const MOCK_TRANSACTIONS = [
    { id: 1, accountId: 1, desc: "Mesečna rata kredita", date: "2025-03-05", amount: -15420 },
    { id: 2, accountId: 1, desc: "Uplata plate - IT Solutions doo", date: "2025-03-01", amount: 185000 },
    { id: 3, accountId: 1, desc: "Maxi Market - kupovina", date: "2025-02-28", amount: -3240.5 },
    { id: 4, accountId: 1, desc: "EPS - račun za struju", date: "2025-02-25", amount: -4580 },
    { id: 5, accountId: 1, desc: "Povraćaj poreza", date: "2025-02-20", amount: 12500 },
    { id: 6, accountId: 1, desc: "Telenor - mesečni račun", date: "2025-02-18", amount: -2890 },
    { id: 7, accountId: 2, desc: "Devizna uplata", date: "2025-03-03", amount: 500 },
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

export async function createAccount(data) {
    if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 500));
        const newAccount = {
            id: MOCK_ACCOUNTS.length + 1,
            name: data.type === "CURRENT" ? "Tekući račun" : "Devizni račun",
            number: `265-0000000011234-${56 + MOCK_ACCOUNTS.length}`,
            balance: 0,
            available: 0,
            currency: data.currency,
        };
        MOCK_ACCOUNTS.push(newAccount);
        return newAccount
    }
    const response = await api.post("/accounts", {
        account_type: data.type,
        currency: data.currency,
    });
    return response.data;
}