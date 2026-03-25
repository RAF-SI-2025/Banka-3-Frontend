let MOCK_ORDERS = [
    {
        id: 1,
        agent: "Miloš Milošević",
        orderType: "Market",
        asset: "AAPL",
        quantity: 10,
        contractSize: 1,
        pricePerUnit: 185.25,
        direction: "Buy",
        remainingPortions: 4,
        status: "Pending",
        approvedBy: null,
        isDone: false,
        lastModification: "2026-03-24 10:15",
        settlementExpired: false,
    },
    {
        id: 2,
        agent: "Jelena Jovanović",
        orderType: "Limit",
        asset: "MSFT",
        quantity: 18,
        contractSize: 1,
        pricePerUnit: 412.8,
        direction: "Sell",
        remainingPortions: 0,
        status: "Approved",
        approvedBy: "Nina Nikolić",
        isDone: false,
        lastModification: "2026-03-24 09:40",
        settlementExpired: false,
    },
    {
        id: 3,
        agent: "Petar Petrović",
        orderType: "Stop",
        asset: "TSLA",
        quantity: 6,
        contractSize: 1,
        pricePerUnit: 171.4,
        direction: "Buy",
        remainingPortions: 6,
        status: "Declined",
        approvedBy: "Nina Nikolić",
        isDone: false,
        lastModification: "2026-03-23 18:05",
        settlementExpired: true,
    },
    {
        id: 4,
        agent: "Ana Anić",
        orderType: "Market",
        asset: "NVDA",
        quantity: 3,
        contractSize: 1,
        pricePerUnit: 902.15,
        direction: "Buy",
        remainingPortions: 0,
        status: "Done",
        approvedBy: "No need for approval",
        isDone: true,
        lastModification: "2026-03-22 14:20",
        settlementExpired: false,
    },
    {
        id: 5,
        agent: "Marko Marković",
        orderType: "Limit",
        asset: "GOOGL",
        quantity: 12,
        contractSize: 1,
        pricePerUnit: 163.55,
        direction: "Sell",
        remainingPortions: 12,
        status: "Pending",
        approvedBy: null,
        isDone: false,
        lastModification: "2026-03-24 11:05",
        settlementExpired: true,
    },
];

function delay(ms = 250) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowString() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export async function getOrders() {
    await delay();
    return [...MOCK_ORDERS];
}

export async function approveOrder(orderId) {
    await delay(200);

    MOCK_ORDERS = MOCK_ORDERS.map((order) => {
        if (order.id !== orderId) return order;
        if (order.status !== "Pending") return order;
        if (order.settlementExpired) return order;

        return {
            ...order,
            status: "Approved",
            approvedBy: "Current supervisor",
            lastModification: nowString(),
        };
    });

    return [...MOCK_ORDERS];
}

export async function declineOrder(orderId) {
    await delay(200);

    MOCK_ORDERS = MOCK_ORDERS.map((order) => {
        if (order.id !== orderId) return order;
        if (order.status !== "Pending") return order;

        return {
            ...order,
            status: "Declined",
            approvedBy: "Current supervisor",
            lastModification: nowString(),
        };
    });

    return [...MOCK_ORDERS];
}