export const getAccountDetails = async (id) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {

      const accounts = [
        {
          id: "1",
          companyName: "Tech Solutions DOO",
          pib: "109876543",
          address: "Beograd, Srbija",
          balance: 1250000,
          ownerName: "Luka Trajkovic",
          ownerEmail: "luka@mail.com",
          transactions: [
            {
              id: 1,
              date: "2026-03-10",
              description: "Uplata klijenta",
              amount: 500000
            },
            {
              id: 2,
              date: "2026-03-11",
              description: "Plata zaposlenima",
              amount: -200000
            }
          ]
        },
        {
          id: "2",
          companyName: "Marketing Plus DOO",
          pib: "123123123",
          address: "Novi Sad, Srbija",
          balance: 780000,
          ownerName: "Petar Petrovic",
          ownerEmail: "petar@mail.com",
          transactions: [
            {
              id: 1,
              date: "2026-03-12",
              description: "Uplata klijenta",
              amount: 300000
            },
            {
              id: 2,
              date: "2026-03-13",
              description: "Kupovina opreme",
              amount: -150000
            }
          ]
        }
      ];

      const account = accounts.find(acc => acc.id === id);

      if (!account) {
        reject("Account not found");
      } else {
        resolve(account);
      }

    }, 800);
  });
};