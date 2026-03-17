import api from "./api.js";

// ── Backend nema GET /employees endpoint — ostaje mock dok se ne doda ──
const mockEmployees = [
  {
    id: 1, first_name: "Petar", last_name: "Petrović",
    email: "petar@primer.rs", password: "Petar123!", position: "Menadžer",
    gender: "Muški", phone: "+381601234567",
    address: "Knez Mihailova 1, Beograd", department: "Menadžment", active: true,
  },
  {
    id: 2, first_name: "Ana", last_name: "Jovanović",
    email: "ana@primer.rs", password: "Petar123!", position: "Finansije",
    gender: "Ženski", phone: "+381607654321",
    address: "Terazije 5, Beograd", department: "Finansije", active: true,
  },
  {
    id: 3, first_name: "Nikola", last_name: "Marković",
    email: "nikola@primer.rs", position: "Analitičar",
    gender: "Muški", phone: "+381609876543",
    address: "Nemanjina 10, Beograd", department: "IT", active: true,
  },
  {
    id: 4, first_name: "Nikola", last_name: "Jovanovic",
    email: "nikola2@primer.rs", position: "Analitičar",
    gender: "Muški", phone: "+381611112233",
    address: "Bulevar Oslobođenja 22, Novi Sad", department: "IT", active: false,
  },
];

// TODO: zameni sa api.get("/employees") kad backend doda GET /api/employees
export async function getEmployees() {
  return mockEmployees;
}

// Backend GET /api/employees/:id vraca: id, first_name, last_name, email, position, active
// Ostala polja (phone, address, gender, department, username) backend ne vraca — dopunjavamo iz mock-a
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

// TODO: zameni sa api.put kad backend doda PUT /api/employees/:id
export async function updateEmployee(id, data) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  console.log("Mock: update employee", id, data);
  return { valid: true };
}
