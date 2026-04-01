import api from "./api";

export async function getRecipients() {
  const response = await api.get("/recipients");
  return response.data;
}

export async function createRecipient(data) {
  const response = await api.post("/recipients", {
    name: data.name,
    account_number: data.account_number,
  });
  return response.data;
}

export async function updateRecipient(id, data) {
  const response = await api.put(`/recipients/${id}`, {
    name: data.name,
    account_number: data.account_number,
  });
  return response.data;
}

export async function deleteRecipient(id) {
  await api.delete(`/recipients/${id}`);
}

export async function getTransactions() {
  const response = await api.get("/transactions");
  return response.data;
}