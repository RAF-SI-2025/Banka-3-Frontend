const mockRecipients = [
  { id: 1, name: "Marko Nikolić", account_number: "102-39443942389" },
  { id: 2, name: "Ana Petrović", account_number: "102-394438340549" },
  { id: 3, name: "Jovana Jovanović", account_number: "105-12345678901" },
  { id: 4, name: "Stefan Ilić", account_number: "160-98765432101" },
  { id: 5, name: "Milica Stojanović", account_number: "265-11223344556" },
  { id: 6, name: "Dragan Popović", account_number: "325-99887766554" },
];

const mockTransactions = [
  {
    from_account: "102-39443942389",
    to_account: "102-394438340549",
    initial_amount: 15000,
    final_amount: 15000,
    fee: 0,
    currency: "RSD",
    payment_code: "289",
    reference_number: "117.6926",
    purpose: "Plaćanje računa za struju",
    status: "Realizovano",
    timestamp: "2025-03-10T14:15:22Z",
  },
  {
    from_account: "102-39443942389",
    to_account: "105-12345678901",
    initial_amount: 500,
    final_amount: 500,
    fee: 0,
    currency: "EUR",
    payment_code: "289",
    reference_number: "220.1134",
    purpose: "Povrat duga",
    status: "Realizovano",
    timestamp: "2025-03-08T09:30:00Z",
  },
  {
    from_account: "102-39443942389",
    to_account: "160-98765432101",
    initial_amount: 3200,
    final_amount: 3200,
    fee: 0,
    currency: "RSD",
    payment_code: "221",
    reference_number: "334.7812",
    purpose: "Kirija za mart",
    status: "Na čekanju",
    timestamp: "2025-03-07T11:00:00Z",
  },
  {
    from_account: "102-39443942389",
    to_account: "265-11223344556",
    initial_amount: 8750,
    final_amount: 8750,
    fee: 0,
    currency: "RSD",
    payment_code: "289",
    reference_number: "451.9021",
    purpose: "Usluge konsaltinga",
    status: "Realizovano",
    timestamp: "2025-03-05T16:45:00Z",
  },
  {
    from_account: "102-39443942389",
    to_account: "325-99887766554",
    initial_amount: 12000,
    final_amount: 12000,
    fee: 0,
    currency: "RSD",
    payment_code: "289",
    reference_number: "562.3344",
    purpose: "Uplata po ugovoru br. 45",
    status: "Odbijeno",
    timestamp: "2025-03-03T08:20:00Z",
  },
  {
    from_account: "102-39443942389",
    to_account: "102-394438340549",
    initial_amount: 200,
    final_amount: 200,
    fee: 0,
    currency: "EUR",
    payment_code: "289",
    reference_number: "613.5567",
    purpose: "Poklon",
    status: "Realizovano",
    timestamp: "2025-02-28T12:00:00Z",
  },
  {
    from_account: "102-39443942389",
    to_account: "105-12345678901",
    initial_amount: 4500,
    final_amount: 4500,
    fee: 0,
    currency: "RSD",
    payment_code: "221",
    reference_number: "714.2289",
    purpose: "Studentska pomoć",
    status: "Na čekanju",
    timestamp: "2025-02-25T10:10:00Z",
  },
];

export async function getRecipients() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockRecipients;
}

export async function getTransactions() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockTransactions;
}
