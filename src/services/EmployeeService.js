import api from "./api.js";

export async function getEmployees() {
  const response = await api.get("/employees");
  return response.data.employees ?? response.data;
}

export async function getEmployeeById(employeeId) {
  const response = await api.get(`/employees/${employeeId}`);
  const d = response.data;
  return {
    id: d.id,
    firstName: d.first_name,
    lastName: d.last_name,
    gender: d.gender || "",
    email: d.email,
    phone: d.phone_number || "",
    address: d.address || "",
    username: d.username || "",
    position: d.position,
    department: d.department || "",
    active: d.active,
    dateOfBirth: d.date_of_birth || 0,
  };
}

// Backend POST /api/employees
export async function createEmployee(data) {
  const response = await api.post("/employees", {
    first_name: data.firstName,
    last_name: data.lastName,
    date_of_birth: data.dateOfBirth,
    gender: data.gender,
    email: data.email,
    phone_number: data.phoneNumber,
    address: data.address,
    username: data.username,
    position: data.position,
    department: data.department,
    password: data.password,
  });
  return response.data;
}

export async function updateEmployee(id, data) {
  const response = await api.put(`/employees/${id}`, {
    last_name: data.lastName,
    gender: data.gender,
    phone_number: data.phoneNumber,
    address: data.address,
    position: data.position,
    department: data.department,
    active: data.active,
  });
  return response.data;
}
