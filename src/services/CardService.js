import api from "./api.js";
import { getCurrentUserId } from "./AuthService.js";

function normalizeCard(card) {
  return {
    id: card.card_number || card.id,
    cardNumber: card.card_number || card.cardNumber,
    cardType: card.card_type || card.cardType,
    cardName: card.card_name || card.cardName,
    accountNumber: card.account_number || card.accountNumber,
    ownerId: card.owner_id || card.ownerId,
    cvv: card.cvv,
    createdDate: new Date(card.creation_date || card.createdDate).toISOString().split('T')[0],
    expiryDate: new Date(card.expiration_date || card.expiryDate).toISOString().split('T')[0],
    limit: card.limit,
    status: card.status,
  };
}

function normalizeAccount(account) {
  return {
    id: account.account_number || account.id,
    accountNumber: account.account_number || account.accountNumber,
    accountName: account.account_name || account.accountName || "Račun",
    currency: account.currency || "RSD",
    accountHolder: account.owner_id || account.ownerId,
    type: (account.account_type || account.type)?.toLowerCase() === "poslovni" ? "business" : "personal",
    subtype: account.account_subtype || account.subtype,
    balance: account.balance || 0,
    availableBalance: account.available_balance || account.availableBalance || 0,
    status: account.status,
    createdDate: new Date(account.creation_date || account.createdDate).toISOString().split('T')[0],
    expirationDate: new Date(account.expiration_date || account.expirationDate).toISOString().split('T')[0],
    dailyLimit: account.daily_limit || account.dailyLimit || 0,
    monthlyLimit: account.monthly_limit || account.monthlyLimit || 0,
    dailySpending: account.daily_spending || account.dailySpending || 0,
    monthlySpending: account.monthly_spending || account.monthlySpending || 0,
    cardCount: account.card_count || account.cardCount || 0,
    maintenanceFee: account.maintenance_fee || account.maintenanceFee || 0,
    company: account.company || null,
  };
}

export async function getUserCards() {
  try {
    const currentUserId = getCurrentUserId();
    
    if (!currentUserId) {
      throw new Error("Korisnik nije pronađen");
    }

    console.log("📍 Trenutni user ID:", currentUserId);

    const response = await api.get("/cards");

    if (!Array.isArray(response.data)) {
      console.error("❌ Neočekivan format odgovora:", response.data);
      throw new Error("Backend vraća neočekivan format (nije niz)");
    }

    console.log("🔍 Sve kartice sa API-ja:", response.data);

    const userCards = response.data.filter(card => 
      card.owner_id && card.owner_id === currentUserId
    );
    console.log("✅ Samo moje kartice (klijentsko filtriranje):", userCards);

    return userCards.map(card => normalizeCard(card));
    
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401) {
        console.error("❌ Niste prijavljeni - token je istekao");
        throw new Error("Niste prijavljeni - molim vas da se ponovo prijavite");
      }
      if (error.response.status === 403) {
        console.error("❌ Nemate pristup karticama");
        throw new Error("Nemate pristup karticama");
      }
      if (error.response.status === 404) {
        console.error("❌ API ruta /cards ne postoji");
        throw new Error("API ruta /cards ne postoji na backend-u");
      }
      console.error(`❌ Greška ${error.response.status}:`, error.response.data);
      throw new Error(`Greška pri učitavanju: ${error.response.data?.message || error.message}`);
    }
    
    console.error("❌ Greška pri učitavanju kartica:", error);
    throw error;
  }
}

export async function getUserAccounts() {
  try {
    const currentUserId = getCurrentUserId();
    
    if (!currentUserId) {
      throw new Error("Korisnik nije pronađen");
    }

    console.log("📍 Trenutni user ID:", currentUserId);

    const response = await api.get("/accounts");

    if (!Array.isArray(response.data)) {
      console.error("❌ Neočekivan format odgovora:", response.data);
      throw new Error("Backend vraća neočekivan format (nije niz)");
    }

    console.log("🔍 Svi računi sa API-ja:", response.data);

    const userAccounts = response.data.filter(account => 
      account.owner_id && account.owner_id === currentUserId
    );
    console.log("✅ Samo moji računi (klijentsko filtriranje):", userAccounts);

    return userAccounts.map(account => normalizeAccount(account));
    
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401) {
        console.error("❌ Niste prijavljeni");
        throw new Error("Niste prijavljeni - molim vas da se ponovo prijavite");
      }
      if (error.response.status === 403) {
        console.error("❌ Nemate pristup");
        throw new Error("Nemate pristup računima");
      }
      if (error.response.status === 404) {
        console.error("❌ API ruta /accounts ne postoji");
        throw new Error("API ruta /accounts ne postoji na backend-u");
      }
      console.error(`❌ Greška ${error.response.status}:`, error.response.data);
      throw new Error(`Greška pri učitavanju: ${error.response.data?.message || error.message}`);
    }
    
    console.error("❌ Greška pri učitavanju računa:", error);
    throw error;
  }
}

export async function blockCard(cardNumber) {
  try {
    const currentUserId = getCurrentUserId();
    
    if (!currentUserId) {
      throw new Error("Korisnik nije pronađen");
    }
    const allCards = await getUserCards();
    const card = allCards.find(c => c.cardNumber === cardNumber);

    if (!card) {
      throw new Error("❌ Kartica nije pronađena ili nije vaša!");
    }

    if (card.ownerId !== currentUserId) {
      throw new Error("❌ Niste vlasnik ove kartice!");
    }

    console.log("📤 Slanje zahteva za blokiranje kartice:", cardNumber);
    const response = await api.post(`/cards/${cardNumber}/block`);
    console.log("✅ Kartica blokirana na backend-u:", response.data);

    return normalizeCard({
      ...response.data,
      owner_id: currentUserId,
    });
    
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error("Niste prijavljeni - molim vas da se ponovo prijavite");
    }
    console.error("❌ Greška pri blokiranju kartice:", error);
    throw error;
  }
}

export async function requestCard(cardData) {
  try {
    const currentUserId = getCurrentUserId();
    
    if (!currentUserId) {
      throw new Error("Korisnik nije pronađen");
    }

    const accounts = await getUserAccounts();
    const account = accounts.find(a => a.accountNumber === cardData.accountNumber);

    if (!account) {
      throw new Error("❌ Račun nije pronađen ili nije vaš!");
    }

    if (account.accountHolder !== currentUserId) {
      throw new Error("❌ Ovaj račun nije vaš!");
    }

    console.log("📤 Slanje zahteva za karticu:", cardData);
    const response = await api.post("/cards", {
      account_number: cardData.accountNumber,
      card_type: cardData.cardType,
    });

    console.log("✅ Zahtev primljen:", response.data);

    return {
      message: "Kartica je zatražena!",
      requestId: response.data.card_number || response.data.cardNumber || "req_" + Date.now(),
    };
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error("Niste prijavljeni - molim vas da se ponovo prijavite");
    }
    console.error("❌ Greška pri zahtevanju kartice:", error);
    throw error;
  }
}

export async function verifyCardRequest(verificationData) {
  try {
    const currentUserId = getCurrentUserId();
    
    if (!currentUserId) {
      throw new Error("Korisnik nije pronađen");
    }

    const accounts = await getUserAccounts();
    const account = accounts.find(a => a.accountNumber === verificationData.accountNumber);

    if (!account) {
      throw new Error("❌ Račun nije pronađen!");
    }

    if (account.accountHolder !== currentUserId) {
      throw new Error("❌ Ovaj račun nije vaš!");
    }

    console.log("📤 Slanje zahteva za kreiranje kartice:", verificationData);
    const response = await api.post("/cards", {
      account_number: verificationData.accountNumber,
      card_type: "Debit",
    });

    console.log("✅ Kartica kreirana:", response.data);

    const normalizedCard = normalizeCard({
      ...response.data,
      owner_id: currentUserId,
    });

    return {
      ...normalizedCard,
      message: "✅ Kartica je uspešno kreirana!",
    };
    
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error("Niste prijavljeni - molim vas da se ponovo prijavite");
    }
    console.error("❌ Greška pri kreiranju kartice:", error);
    throw error;
  }
}

export function formatCardNumber(cardNumber) {
  if (!cardNumber || cardNumber.length < 8) return cardNumber;
  const first4 = cardNumber.substring(0, 4);
  const last4 = cardNumber.substring(cardNumber.length - 4);
  return `${first4}${'*'.repeat(8)}${last4}`;
}

export function getRandomCardBrand() {
  const brands = ["Visa", "Mastercard", "DinaCard", "American Express"];
  return brands[Math.floor(Math.random() * brands.length)];
}

export function generateCardNumber(cardName = "Visa") {
  let prefix = "";

  switch (cardName) {
    case "Visa":
      prefix = "4";
      break;
    case "Mastercard":
      prefix = "5" + Math.floor(Math.random() * 5 + 1);
      break;
    case "DinaCard":
      prefix = "9891";
      break;
    case "American Express":
      prefix = Math.random() > 0.5 ? "34" : "37";
      break;
    default:
      prefix = "4";
  }

  let remainingDigits = (cardName === "American Express" ? 15 : 16) - prefix.length;
  let cardNumber = prefix;

  for (let i = 0; i < remainingDigits - 1; i++) {
    cardNumber += Math.floor(Math.random() * 10);
  }

  const checkDigit = calculateLuhnCheckDigit(cardNumber);
  cardNumber += checkDigit;

  return cardNumber;
}

export function calculateLuhnCheckDigit(cardNumber) {
  let sum = 0;
  let isEven = false;

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return (10 - (sum % 10)) % 10;
}

export function generateCVV() {
  return String(Math.floor(Math.random() * 900 + 100));
}

export function validateCardStructure(cardNumber, cardName) {
  const mii = cardNumber[0];
  
  if (cardName === "Visa" && mii !== "4") {
    throw new Error("Visa kartica mora počinjati sa 4");
  }
  
  if (cardName === "Mastercard") {
    const isMC = /^5[1-5]/.test(cardNumber) || 
                 (cardNumber.substring(0, 4) >= "2221" && cardNumber.substring(0, 4) <= "2720");
    if (!isMC) {
      throw new Error("Mastercard kartica mora počinjati sa 51-55 ili 2221-2720");
    }
  }
  
  if (cardName === "DinaCard" && !cardNumber.startsWith("9891")) {
    throw new Error("DinaCard mora počinjati sa 9891");
  }
  
  if (cardName === "American Express") {
    const first2 = cardNumber.substring(0, 2);
    if ((first2 !== "34" && first2 !== "37") || cardNumber.length !== 15) {
      throw new Error("American Express mora biti 15 cifara i počinjati sa 34 ili 37");
    }
  }
}

export function convertCurrency(amountInSourceCurrency, sourceCurrency, targetCurrency) {
  const exchangeRates = {
    "RSD": 1.0,
    "EUR": 117.0,
    "USD": 105.0,
    "GBP": 132.0,
    "CHF": 116.0,
    "JPY": 0.72,
    "CAD": 77.0,
    "AUD": 69.0,
  };

  if (sourceCurrency === targetCurrency) {
    return amountInSourceCurrency;
  }

  const sourceRate = exchangeRates[sourceCurrency] || 1.0;
  const targetRate = exchangeRates[targetCurrency] || 1.0;

  const convertedAmount = (amountInSourceCurrency / sourceRate) * targetRate;
  const bankFee = convertedAmount * 0.02;
  const cardFee = convertedAmount * 0.005;
  const finalAmount = convertedAmount + bankFee + cardFee;

  return {
    originalAmount: amountInSourceCurrency,
    sourceCurrency: sourceCurrency,
    targetCurrency: targetCurrency,
    exchangeRate: targetRate / sourceRate,
    convertedAmount: parseFloat(convertedAmount.toFixed(2)),
    bankFee: parseFloat(bankFee.toFixed(2)),
    cardFee: parseFloat(cardFee.toFixed(2)),
    finalAmount: parseFloat(finalAmount.toFixed(2)),
  };
}

export function getConversionDetails(amount, fromCurrency, toCurrency) {
  return convertCurrency(amount, fromCurrency, toCurrency);
}