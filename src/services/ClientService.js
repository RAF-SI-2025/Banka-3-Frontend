import api from "./api.js";

let clientCache = null;
let clientCacheEmail = null;

function normalizeClient(raw) {
  return {
    id: raw.id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    email: raw.email,
    phone: raw.phone_number || "",
    address: raw.address || "",
    dateOfBirth: raw.birth_date || raw.date_of_birth || null,
    gender: raw.gender || "",
  };
}

export async function getClientByEmail(email) {
  const response = await api.get("/clients", { params: { email } });
  const clients = response.data.clients ?? response.data;
  if (Array.isArray(clients) && clients.length > 0) {
    return normalizeClient(clients[0]);
  }
  if (!Array.isArray(clients) && clients?.id) {
    return normalizeClient(clients);
  }
  return null;
}

export async function getCurrentClient(email) {
  if (clientCache && clientCacheEmail === email) {
    return clientCache;
  }
  const client = await getClientByEmail(email);
  if (client) {
    clientCache = client;
    clientCacheEmail = email;
  }
  return client;
}

export function clearClientCache() {
  clientCache = null;
  clientCacheEmail = null;
}
