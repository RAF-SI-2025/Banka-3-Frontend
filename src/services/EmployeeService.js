import api from "./api.js";

export async function getEmployees() {
  const response = await api.get("/employees");
  return response.data.employees ?? response.data;
}

export async function changePassword(resetToken, newPassword) {
  await new Promise(resolve => setTimeout(resolve, 400));
  console.log("Mock: password changed", { resetToken, newPassword });
}