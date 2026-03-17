const clients = [
    {
        id: 1,
        first_name: "Marko",
        last_name: "Marković",
        email: "marko@gmail.com",
        phone: "+381601234567",
        address: "Beograd",
        date_of_birth: "1995-04-12",
    },
    {
        id: 2,
        first_name: "Ana",
        last_name: "Jovanović",
        email: "ana@gmail.com",
        phone: "+38161111222",
        address: "Novi Sad",
        date_of_birth: "1998-07-21",
    },
    {
        id: 3,
        first_name: "Nikola",
        last_name: "Petrović",
        email: "nikola@gmail.com",
        phone: "+38162222333",
        address: "Niš",
        date_of_birth: "1992-11-05",
    },
    {
        id: 4,
        first_name: "Milica",
        last_name: "Ilić",
        email: "milica@gmail.com",
        phone: "+38163333444",
        address: "Kragujevac",
        date_of_birth: "1990-02-14",
    },
];

const accounts = [
    {
        id: 1,
        client_id: 1,
        account_number: "RS351600000000000001",
        type: "Tekući",
        balance: 125000.5,
        currency: "RSD",
    },
    {
        id: 2,
        client_id: 1,
        account_number: "RS351600000000000002",
        type: "Štedni",
        balance: 500000,
        currency: "RSD",
    },
    {
        id: 3,
        client_id: 2,
        account_number: "RS351600000000000003",
        type: "Tekući",
        balance: 30000,
        currency: "RSD",
    },
    {
        id: 4,
        client_id: 3,
        account_number: "RS351600000000000004",
        type: "Tekući",
        balance: 78000,
        currency: "RSD",
    },
];

function delay(ms = 300) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getClients() {
    await delay();
    return clients;
}

export async function filterClients(search = "", accountType = "") {
    await delay();

    let result = clients;

    if (search) {
        const term = search.toLowerCase();

        result = result.filter(
            (client) =>
                client.first_name.toLowerCase().includes(term) ||
                client.last_name.toLowerCase().includes(term) ||
                client.email.toLowerCase().includes(term)
        );
    }

    if (accountType) {
        result = result.filter((client) =>
            accounts.some(
                (account) =>
                    account.client_id === client.id && account.type === accountType
            )
        );
    }

    return result;
}

export async function getClientById(id) {
    await delay();
    return clients.find((client) => client.id === Number(id));
}

export async function getAccounts() {
    await delay();
    return accounts;
}

export async function getAccountsByClient(clientId) {
    await delay();
    return accounts.filter(
        (account) => account.client_id === Number(clientId)
    );
}