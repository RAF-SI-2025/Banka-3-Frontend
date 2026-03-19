import api from "./api.js";

export async function getAccounts() {
  const response = await api.get("/accounts");
  return response.data;
}

export async function getAccountByNumber(accountNumber) {
  const response = await api.get(`/accounts/${accountNumber}`);
  return response.data;
}
